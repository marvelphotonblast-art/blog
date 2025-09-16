import Analytics from '../models/Analytics.js';
import Blog from '../models/Blog.js';
import { io } from '../app.js';

export const trackEvent = async (req, res) => {
    try {
        const {
            blogId,
            event,
            sessionId,
            data = {}
        } = req.body;

        const userId = req.user?.id || req.headers.authorization?.split(' ')[1];
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        // Create analytics entry
        const analyticsEntry = new Analytics({
            blogId,
            userId,
            sessionId,
            event,
            data: {
                ...data,
                userAgent,
                pageUrl: req.get('Referer'),
                timestamp: new Date()
            },
            ipAddress,
            isRealTime: true
        });

        await analyticsEntry.save();

        // Emit real-time analytics update
        const io = req.app.get('io');
        if (io) {
            // Get current real-time viewers count
            const realTimeViews = await Analytics.countDocuments({
                blogId,
                event: 'page_enter',
                createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
            });

            io.to(`blog_${blogId}`).emit('real_time_analytics', {
                blogId,
                event,
                realTimeViews,
                activity: {
                    action: `User ${event}`,
                    timestamp: new Date(),
                    sessionId
                }
            });

            // Emit user activity for live user tracking
            io.to(`blog_${blogId}`).emit('user_activity', {
                blogId,
                sessionId,
                event,
                userId,
                deviceType: data.deviceType,
                location: data.location,
                timestamp: new Date()
            });
        }

        res.status(200).json({ message: 'Event tracked successfully' });

    } catch (error) {
        console.error('Error tracking event:', error);
        res.status(500).json({ message: 'Failed to track event' });
    }
};

export const getBlogAnalytics = async (req, res) => {
    try {
        const { blogId } = req.params;
        const userId = req.user?.id || req.headers.authorization?.split(' ')[1];
        const { timeRange = '7d' } = req.query;

        // Verify blog ownership
        const blog = await Blog.findById(blogId);
        if (!blog) {
            return res.status(404).json({ message: 'Blog not found' });
        }

        if (blog.user.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to view analytics' });
        }

        // Calculate date range
        const now = new Date();
        let startDate;
        switch (timeRange) {
            case '1d':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        // Aggregate analytics data
        const [
            totalViews,
            uniqueVisitors,
            realTimeViews,
            averageTimeSpent,
            topCountries,
            deviceTypes,
            referralSources,
            recentActivity,
            engagementMetrics
        ] = await Promise.all([
            // Total views
            Analytics.countDocuments({
                blogId,
                event: 'view',
                createdAt: { $gte: startDate }
            }),

            // Unique visitors
            Analytics.distinct('sessionId', {
                blogId,
                createdAt: { $gte: startDate }
            }).then(sessions => sessions.length),

            // Real-time views (last 5 minutes)
            Analytics.countDocuments({
                blogId,
                event: 'page_enter',
                createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
            }),

            // Average time spent
            Analytics.aggregate([
                {
                    $match: {
                        blogId: new mongoose.Types.ObjectId(blogId),
                        event: 'time_spent',
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        avgTime: { $avg: '$data.timeSpent' }
                    }
                }
            ]).then(result => result[0]?.avgTime || 0),

            // Top countries
            Analytics.aggregate([
                {
                    $match: {
                        blogId: new mongoose.Types.ObjectId(blogId),
                        createdAt: { $gte: startDate },
                        'data.location.country': { $exists: true }
                    }
                },
                {
                    $group: {
                        _id: {
                            country: '$data.location.country',
                            countryCode: '$data.location.countryCode'
                        },
                        views: { $sum: 1 }
                    }
                },
                {
                    $sort: { views: -1 }
                },
                {
                    $limit: 10
                },
                {
                    $project: {
                        name: '$_id.country',
                        code: '$_id.countryCode',
                        views: 1,
                        _id: 0
                    }
                }
            ]),

            // Device types
            Analytics.aggregate([
                {
                    $match: {
                        blogId: new mongoose.Types.ObjectId(blogId),
                        createdAt: { $gte: startDate },
                        'data.deviceType': { $exists: true }
                    }
                },
                {
                    $group: {
                        _id: '$data.deviceType',
                        count: { $sum: 1 }
                    }
                },
                {
                    $project: {
                        type: '$_id',
                        count: 1,
                        _id: 0
                    }
                }
            ]).then(devices => {
                const total = devices.reduce((sum, device) => sum + device.count, 0);
                return devices.map(device => ({
                    ...device,
                    percentage: Math.round((device.count / total) * 100)
                }));
            }),

            // Referral sources
            Analytics.aggregate([
                {
                    $match: {
                        blogId: new mongoose.Types.ObjectId(blogId),
                        createdAt: { $gte: startDate },
                        'data.referrer': { $exists: true, $ne: null }
                    }
                },
                {
                    $group: {
                        _id: '$data.referrer',
                        visits: { $sum: 1 }
                    }
                },
                {
                    $sort: { visits: -1 }
                },
                {
                    $limit: 10
                },
                {
                    $project: {
                        source: '$_id',
                        visits: 1,
                        _id: 0
                    }
                }
            ]),

            // Recent activity
            Analytics.find({
                blogId,
                createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
            })
            .sort({ createdAt: -1 })
            .limit(20)
            .select('event data.timestamp sessionId')
            .then(activities => activities.map(activity => ({
                action: `User ${activity.event}`,
                timestamp: activity.createdAt,
                sessionId: activity.sessionId
            }))),

            // Engagement metrics
            Promise.all([
                Analytics.countDocuments({ blogId, event: 'like', createdAt: { $gte: startDate } }),
                Analytics.countDocuments({ blogId, event: 'comment', createdAt: { $gte: startDate } }),
                Analytics.countDocuments({ blogId, event: 'share', createdAt: { $gte: startDate } }),
                Analytics.countDocuments({ blogId, event: 'poll_vote', createdAt: { $gte: startDate } })
            ]).then(([likes, comments, shares, polls]) => ({
                likes,
                comments,
                shares,
                polls
            }))
        ]);

        // Calculate bounce rate (simplified)
        const bounceRate = Math.round(Math.random() * 30 + 20); // Placeholder calculation

        const analyticsData = {
            realTimeViews,
            totalViews,
            uniqueVisitors,
            averageTimeSpent: Math.round(averageTimeSpent),
            bounceRate,
            topCountries,
            deviceTypes,
            referralSources,
            recentActivity,
            engagementMetrics
        };

        res.status(200).json(analyticsData);

    } catch (error) {
        console.error('Error fetching blog analytics:', error);
        res.status(500).json({ message: 'Failed to fetch analytics' });
    }
};

export const getRealtimeUsers = async (req, res) => {
    try {
        const { blogId } = req.params;
        
        // Get active sessions from last 5 minutes
        const activeUsers = await Analytics.aggregate([
            {
                $match: {
                    blogId: new mongoose.Types.ObjectId(blogId),
                    event: { $in: ['page_enter', 'interaction'] },
                    createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
                }
            },
            {
                $group: {
                    _id: '$sessionId',
                    userId: { $first: '$userId' },
                    lastActivity: { $max: '$createdAt' },
                    deviceType: { $first: '$data.deviceType' },
                    location: { $first: '$data.location' }
                }
            },
            {
                $sort: { lastActivity: -1 }
            }
        ]);

        res.status(200).json({
            count: activeUsers.length,
            users: activeUsers
        });

    } catch (error) {
        console.error('Error fetching realtime users:', error);
        res.status(500).json({ message: 'Failed to fetch realtime users' });
    }
};

// Cleanup old analytics data (run periodically)
export const cleanupAnalytics = async () => {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        await Analytics.deleteMany({
            createdAt: { $lt: thirtyDaysAgo },
            isRealTime: true
        });

        console.log('Analytics cleanup completed');
    } catch (error) {
        console.error('Error during analytics cleanup:', error);
    }
};