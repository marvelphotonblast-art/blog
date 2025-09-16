import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Card,
    CardContent,
    LinearProgress,
    Chip,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    Avatar,
    Divider,
    IconButton,
    Tooltip,
    Switch,
    FormControlLabel
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
    Visibility as VisibilityIcon,
    TrendingUp as TrendingUpIcon,
    Schedule as ScheduleIcon,
    LocationOn as LocationIcon,
    Devices as DevicesIcon,
    Language as LanguageIcon,
    Share as ShareIcon,
    Favorite as FavoriteIcon,
    Comment as CommentIcon,
    Poll as PollIcon,
    Refresh as RefreshIcon,
    Analytics as AnalyticsIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import useSocket from '../hooks/useSocket';
import axios from 'axios';
import { serverURL } from '../helper/Helper';

// Styled Components
const AnalyticsContainer = styled(Paper)(({ theme }) => ({
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: theme.spacing(3),
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
}));

const MetricCard = styled(Card)(({ theme }) => ({
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    borderRadius: theme.spacing(2),
    transition: 'all 0.3s ease',
    '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: '0 12px 25px rgba(102, 126, 234, 0.3)',
    },
}));

const LiveIndicator = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.palette.success.main,
    fontSize: '0.875rem',
    fontWeight: 600,
}));

const PulsingDot = styled(Box)(({ theme }) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: theme.palette.success.main,
    animation: 'pulse 2s infinite',
    '@keyframes pulse': {
        '0%': { opacity: 1, transform: 'scale(1)' },
        '50%': { opacity: 0.5, transform: 'scale(1.2)' },
        '100%': { opacity: 1, transform: 'scale(1)' },
    },
}));

const LiveAnalytics = ({ blogId, isOwner }) => {
    const [analytics, setAnalytics] = useState({
        realTimeViews: 0,
        totalViews: 0,
        uniqueVisitors: 0,
        averageTimeSpent: 0,
        bounceRate: 0,
        topCountries: [],
        deviceTypes: [],
        referralSources: [],
        recentActivity: [],
        engagementMetrics: {
            likes: 0,
            comments: 0,
            shares: 0,
            polls: 0
        }
    });
    const [loading, setLoading] = useState(true);
    const [realTimeEnabled, setRealTimeEnabled] = useState(true);
    const [activeUsers, setActiveUsers] = useState([]);

    const currentUser = useSelector(state => state.user);
    const { socket, isConnected } = useSocket();

    // Fetch analytics data
    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!isOwner) return;
            
            try {
                setLoading(true);
                const userId = localStorage.getItem('userId');
                const response = await axios.get(`${serverURL}/api/analytics/blog/${blogId}`, {
                    headers: {
                        'Authorization': `Bearer ${userId}`
                    }
                });

                setAnalytics(response.data);
            } catch (error) {
                console.error('Error fetching analytics:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [blogId, isOwner]);

    // Real-time analytics updates
    useEffect(() => {
        if (!socket || !isConnected || !realTimeEnabled) return;

        const handleRealTimeAnalytics = (data) => {
            if (data.blogId === blogId) {
                setAnalytics(prev => ({
                    ...prev,
                    realTimeViews: data.realTimeViews,
                    recentActivity: [data.activity, ...prev.recentActivity.slice(0, 9)]
                }));
            }
        };

        const handleUserActivity = (data) => {
            if (data.blogId === blogId) {
                setActiveUsers(prev => {
                    const existing = prev.find(u => u.sessionId === data.sessionId);
                    if (existing) {
                        return prev.map(u => 
                            u.sessionId === data.sessionId 
                                ? { ...u, lastActivity: new Date(), ...data }
                                : u
                        );
                    } else {
                        return [...prev, { ...data, lastActivity: new Date() }];
                    }
                });
            }
        };

        const handleUserLeft = (data) => {
            if (data.blogId === blogId) {
                setActiveUsers(prev => prev.filter(u => u.sessionId !== data.sessionId));
            }
        };

        socket.on('real_time_analytics', handleRealTimeAnalytics);
        socket.on('user_activity', handleUserActivity);
        socket.on('user_left', handleUserLeft);

        return () => {
            socket.off('real_time_analytics', handleRealTimeAnalytics);
            socket.off('user_activity', handleUserActivity);
            socket.off('user_left', handleUserLeft);
        };
    }, [socket, isConnected, blogId, realTimeEnabled]);

    // Clean up inactive users
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveUsers(prev => prev.filter(user => 
                new Date() - new Date(user.lastActivity) < 5 * 60 * 1000 // 5 minutes
            ));
        }, 60000); // Check every minute

        return () => clearInterval(interval);
    }, []);

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const getDeviceIcon = (deviceType) => {
        switch (deviceType.toLowerCase()) {
            case 'mobile': return '📱';
            case 'tablet': return '📱';
            case 'desktop': return '💻';
            default: return '🖥️';
        }
    };

    const getCountryFlag = (countryCode) => {
        // Simple country code to flag emoji conversion
        const flags = {
            'US': '🇺🇸', 'GB': '🇬🇧', 'CA': '🇨🇦', 'AU': '🇦🇺',
            'DE': '🇩🇪', 'FR': '🇫🇷', 'JP': '🇯🇵', 'IN': '🇮🇳',
            'BR': '🇧🇷', 'MX': '🇲🇽', 'ES': '🇪🇸', 'IT': '🇮🇹'
        };
        return flags[countryCode] || '🌍';
    };

    if (!isOwner) {
        return null;
    }

    return (
        <AnalyticsContainer>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Box display="flex" alignItems="center" gap={2}>
                    <AnalyticsIcon color="primary" sx={{ fontSize: 32 }} />
                    <Typography variant="h5" fontWeight={700}>
                        Live Analytics
                    </Typography>
                    {realTimeEnabled && (
                        <LiveIndicator>
                            <PulsingDot />
                            Live
                        </LiveIndicator>
                    )}
                </Box>
                
                <Box display="flex" alignItems="center" gap={2}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={realTimeEnabled}
                                onChange={(e) => setRealTimeEnabled(e.target.checked)}
                                size="small"
                            />
                        }
                        label="Real-time"
                    />
                    <IconButton size="small" color="primary">
                        <RefreshIcon />
                    </IconButton>
                </Box>
            </Box>

            {/* Key Metrics */}
            <Grid container spacing={3} mb={4}>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard>
                        <CardContent>
                            <Box display="flex" alignItems="center" justifyContent="space-between">
                                <Box>
                                    <Typography variant="h4" fontWeight={700}>
                                        {analytics.realTimeViews}
                                    </Typography>
                                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                        Live Viewers
                                    </Typography>
                                </Box>
                                <VisibilityIcon sx={{ fontSize: 40, opacity: 0.7 }} />
                            </Box>
                        </CardContent>
                    </MetricCard>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard sx={{ background: 'linear-gradient(135deg, #4caf50, #45a049)' }}>
                        <CardContent>
                            <Box display="flex" alignItems="center" justifyContent="space-between">
                                <Box>
                                    <Typography variant="h4" fontWeight={700}>
                                        {analytics.totalViews}
                                    </Typography>
                                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                        Total Views
                                    </Typography>
                                </Box>
                                <TrendingUpIcon sx={{ fontSize: 40, opacity: 0.7 }} />
                            </Box>
                        </CardContent>
                    </MetricCard>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard sx={{ background: 'linear-gradient(135deg, #ff9800, #f57c00)' }}>
                        <CardContent>
                            <Box display="flex" alignItems="center" justifyContent="space-between">
                                <Box>
                                    <Typography variant="h4" fontWeight={700}>
                                        {formatTime(analytics.averageTimeSpent)}
                                    </Typography>
                                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                        Avg. Time
                                    </Typography>
                                </Box>
                                <ScheduleIcon sx={{ fontSize: 40, opacity: 0.7 }} />
                            </Box>
                        </CardContent>
                    </MetricCard>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard sx={{ background: 'linear-gradient(135deg, #e91e63, #c2185b)' }}>
                        <CardContent>
                            <Box display="flex" alignItems="center" justifyContent="space-between">
                                <Box>
                                    <Typography variant="h4" fontWeight={700}>
                                        {analytics.uniqueVisitors}
                                    </Typography>
                                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                        Unique Visitors
                                    </Typography>
                                </Box>
                                <DevicesIcon sx={{ fontSize: 40, opacity: 0.7 }} />
                            </Box>
                        </CardContent>
                    </MetricCard>
                </Grid>
            </Grid>

            {/* Engagement Metrics */}
            <Grid container spacing={3} mb={4}>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, borderRadius: 2 }}>
                        <Typography variant="h6" fontWeight={600} mb={2}>
                            Engagement
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <Box display="flex" alignItems="center" gap={1} mb={1}>
                                    <FavoriteIcon color="error" />
                                    <Typography variant="body2">Likes</Typography>
                                </Box>
                                <Typography variant="h5" fontWeight={700}>
                                    {analytics.engagementMetrics.likes}
                                </Typography>
                            </Grid>
                            <Grid item xs={6}>
                                <Box display="flex" alignItems="center" gap={1} mb={1}>
                                    <CommentIcon color="primary" />
                                    <Typography variant="body2">Comments</Typography>
                                </Box>
                                <Typography variant="h5" fontWeight={700}>
                                    {analytics.engagementMetrics.comments}
                                </Typography>
                            </Grid>
                            <Grid item xs={6}>
                                <Box display="flex" alignItems="center" gap={1} mb={1}>
                                    <ShareIcon color="success" />
                                    <Typography variant="body2">Shares</Typography>
                                </Box>
                                <Typography variant="h5" fontWeight={700}>
                                    {analytics.engagementMetrics.shares}
                                </Typography>
                            </Grid>
                            <Grid item xs={6}>
                                <Box display="flex" alignItems="center" gap={1} mb={1}>
                                    <PollIcon color="warning" />
                                    <Typography variant="body2">Poll Votes</Typography>
                                </Box>
                                <Typography variant="h5" fontWeight={700}>
                                    {analytics.engagementMetrics.polls}
                                </Typography>
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, borderRadius: 2 }}>
                        <Typography variant="h6" fontWeight={600} mb={2}>
                            Active Users ({activeUsers.length})
                        </Typography>
                        <List dense sx={{ maxHeight: 200, overflowY: 'auto' }}>
                            {activeUsers.length === 0 ? (
                                <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                                    No active users right now
                                </Typography>
                            ) : (
                                activeUsers.map((user, index) => (
                                    <ListItem key={user.sessionId} sx={{ px: 0 }}>
                                        <ListItemAvatar>
                                            <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem' }}>
                                                {user.userId ? 'U' : 'A'}
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={user.userId ? 'Registered User' : 'Anonymous'}
                                            secondary={
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <Chip
                                                        label={user.deviceType || 'Unknown'}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ fontSize: '0.7rem', height: 20 }}
                                                    />
                                                    {user.location && (
                                                        <Typography variant="caption">
                                                            {getCountryFlag(user.location.country)} {user.location.city}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            }
                                        />
                                    </ListItem>
                                ))
                            )}
                        </List>
                    </Paper>
                </Grid>
            </Grid>

            {/* Geographic and Device Data */}
            <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, borderRadius: 2 }}>
                        <Typography variant="h6" fontWeight={600} mb={2}>
                            Top Countries
                        </Typography>
                        <List dense>
                            {analytics.topCountries.slice(0, 5).map((country, index) => (
                                <ListItem key={index} sx={{ px: 0 }}>
                                    <ListItemText
                                        primary={
                                            <Box display="flex" alignItems="center" gap={1}>
                                                <Typography variant="body2">
                                                    {getCountryFlag(country.code)} {country.name}
                                                </Typography>
                                            </Box>
                                        }
                                        secondary={
                                            <Box>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={(country.views / analytics.totalViews) * 100}
                                                    sx={{ mt: 0.5, mb: 0.5 }}
                                                />
                                                <Typography variant="caption">
                                                    {country.views} views ({Math.round((country.views / analytics.totalViews) * 100)}%)
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, borderRadius: 2 }}>
                        <Typography variant="h6" fontWeight={600} mb={2}>
                            Device Types
                        </Typography>
                        <List dense>
                            {analytics.deviceTypes.map((device, index) => (
                                <ListItem key={index} sx={{ px: 0 }}>
                                    <ListItemText
                                        primary={
                                            <Box display="flex" alignItems="center" gap={1}>
                                                <Typography variant="body2">
                                                    {getDeviceIcon(device.type)} {device.type}
                                                </Typography>
                                            </Box>
                                        }
                                        secondary={
                                            <Box>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={device.percentage}
                                                    sx={{ mt: 0.5, mb: 0.5 }}
                                                />
                                                <Typography variant="caption">
                                                    {device.count} users ({device.percentage}%)
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, borderRadius: 2 }}>
                        <Typography variant="h6" fontWeight={600} mb={2}>
                            Recent Activity
                        </Typography>
                        <List dense sx={{ maxHeight: 250, overflowY: 'auto' }}>
                            {analytics.recentActivity.length === 0 ? (
                                <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                                    No recent activity
                                </Typography>
                            ) : (
                                analytics.recentActivity.map((activity, index) => (
                                    <ListItem key={index} sx={{ px: 0 }}>
                                        <ListItemText
                                            primary={activity.action}
                                            secondary={
                                                <Typography variant="caption" color="text.secondary">
                                                    {new Date(activity.timestamp).toLocaleTimeString()}
                                                </Typography>
                                            }
                                        />
                                    </ListItem>
                                ))
                            )}
                        </List>
                    </Paper>
                </Grid>
            </Grid>
        </AnalyticsContainer>
    );
};

export default LiveAnalytics;