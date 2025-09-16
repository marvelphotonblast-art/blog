import Notification from '../models/Notification.js';

export const getNotifications = async (req, res) => {
    try {
        const userId = req.user?.id || req.headers.authorization?.split(' ')[1];
        const { page = 1, limit = 20, unreadOnly = false } = req.query;

        const query = { recipient: userId };
        if (unreadOnly === 'true') {
            query.read = false;
        }

        const notifications = await Notification.find(query)
            .populate('sender', 'name email')
            .populate('data.blogId', 'title')
            .populate('data.pollId', 'title')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const totalNotifications = await Notification.countDocuments(query);
        const unreadCount = await Notification.countDocuments({
            recipient: userId,
            read: false
        });

        res.status(200).json({
            notifications,
            totalNotifications,
            unreadCount,
            currentPage: page,
            totalPages: Math.ceil(totalNotifications / limit)
        });

    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Failed to fetch notifications' });
    }
};

export const markAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user?.id || req.headers.authorization?.split(' ')[1];

        const notification = await Notification.findOne({
            _id: notificationId,
            recipient: userId
        });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        notification.read = true;
        notification.readAt = new Date();
        await notification.save();

        res.status(200).json({ message: 'Notification marked as read' });

    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Failed to mark notification as read' });
    }
};

export const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user?.id || req.headers.authorization?.split(' ')[1];

        await Notification.updateMany(
            { recipient: userId, read: false },
            { read: true, readAt: new Date() }
        );

        res.status(200).json({ message: 'All notifications marked as read' });

    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ message: 'Failed to mark all notifications as read' });
    }
};

export const deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user?.id || req.headers.authorization?.split(' ')[1];

        const notification = await Notification.findOneAndDelete({
            _id: notificationId,
            recipient: userId
        });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        res.status(200).json({ message: 'Notification deleted successfully' });

    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ message: 'Failed to delete notification' });
    }
};

export const createNotification = async (recipientId, type, title, message, data = {}) => {
    try {
        const notification = new Notification({
            recipient: recipientId,
            sender: data.senderId,
            type,
            title,
            message,
            data,
            priority: data.priority || 'medium'
        });

        await notification.save();
        return notification;

    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};