import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Avatar,
    IconButton,
    Chip,
    Button,
    Divider,
    Alert,
    Badge,
    Menu,
    MenuItem,
    Switch,
    FormControlLabel
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
    Notifications as NotificationsIcon,
    NotificationsActive as NotificationsActiveIcon,
    Delete as DeleteIcon,
    MarkEmailRead as MarkReadIcon,
    Settings as SettingsIcon,
    Circle as CircleIcon,
    Comment as CommentIcon,
    Poll as PollIcon,
    Person as PersonIcon,
    Article as ArticleIcon,
    Favorite as FavoriteIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import useSocket from '../hooks/useSocket';
import axios from 'axios';
import { serverURL } from '../helper/Helper';
import { formatDistanceToNow } from 'date-fns';

// Styled Components
const NotificationsContainer = styled(Box)(({ theme }) => ({
    height: '500px',
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(255, 255, 255, 0.95)',
}));

const NotificationsHeader = styled(Box)(({ theme }) => ({
    padding: theme.spacing(2, 3),
    borderBottom: '1px solid rgba(0,0,0,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
}));

const NotificationsList = styled(List)(({ theme }) => ({
    flex: 1,
    overflowY: 'auto',
    padding: 0,
    '&::-webkit-scrollbar': {
        width: '6px',
    },
    '&::-webkit-scrollbar-track': {
        background: '#f1f1f1',
        borderRadius: '3px',
    },
    '&::-webkit-scrollbar-thumb': {
        background: '#c1c1c1',
        borderRadius: '3px',
        '&:hover': {
            background: '#a8a8a8',
        },
    },
}));

const NotificationItem = styled(ListItem)(({ theme, unread }) => ({
    borderLeft: unread ? `4px solid ${theme.palette.primary.main}` : '4px solid transparent',
    backgroundColor: unread ? 'rgba(25, 118, 210, 0.05)' : 'transparent',
    transition: 'all 0.3s ease',
    '&:hover': {
        backgroundColor: 'rgba(0,0,0,0.04)',
    },
}));

const NotificationAvatar = styled(Avatar)(({ theme, type }) => {
    const getBackgroundColor = () => {
        switch (type) {
            case 'comment': return theme.palette.info.main;
            case 'poll': return theme.palette.warning.main;
            case 'like': return theme.palette.error.main;
            case 'follow': return theme.palette.success.main;
            case 'blog_published': return theme.palette.primary.main;
            default: return theme.palette.grey[500];
        }
    };

    return {
        backgroundColor: getBackgroundColor(),
        width: 40,
        height: 40,
    };
});

const EmptyState = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
}));

const LiveNotifications = ({ onUnreadCountChange }) => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const [settingsAnchor, setSettingsAnchor] = useState(null);
    const [settings, setSettings] = useState({
        soundEnabled: true,
        pushEnabled: true,
        emailEnabled: false,
    });

    const currentUser = useSelector(state => state.user);
    const { socket, isConnected } = useSocket();

    // Fetch notifications
    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                setLoading(true);
                const userId = localStorage.getItem('userId');
                const response = await axios.get(`${serverURL}/api/notifications`, {
                    headers: {
                        'Authorization': `Bearer ${userId}`
                    },
                    params: {
                        limit: 50
                    }
                });

                setNotifications(response.data.notifications || []);
                setUnreadCount(response.data.unreadCount || 0);
                
                if (onUnreadCountChange) {
                    onUnreadCountChange(response.data.unreadCount || 0);
                }
            } catch (error) {
                console.error('Error fetching notifications:', error);
                setError('Failed to load notifications');
            } finally {
                setLoading(false);
            }
        };

        if (currentUser) {
            fetchNotifications();
        }
    }, [currentUser, onUnreadCountChange]);

    // Socket listeners for real-time notifications
    useEffect(() => {
        if (!socket || !isConnected) return;

        const handleNewNotification = (notification) => {
            setNotifications(prev => [notification, ...prev]);
            setUnreadCount(prev => prev + 1);
            
            if (onUnreadCountChange) {
                onUnreadCountChange(prev => prev + 1);
            }

            // Play notification sound if enabled
            if (settings.soundEnabled) {
                playNotificationSound();
            }

            // Show browser notification if enabled
            if (settings.pushEnabled && 'Notification' in window) {
                if (Notification.permission === 'granted') {
                    new Notification(notification.title, {
                        body: notification.message,
                        icon: '/favicon.jpg',
                        tag: notification._id,
                    });
                }
            }
        };

        socket.on('new_notification', handleNewNotification);

        return () => {
            socket.off('new_notification', handleNewNotification);
        };
    }, [socket, isConnected, settings, onUnreadCountChange]);

    const playNotificationSound = () => {
        try {
            const audio = new Audio('/notification-sound.mp3');
            audio.volume = 0.3;
            audio.play().catch(e => console.log('Could not play notification sound:', e));
        } catch (error) {
            console.log('Notification sound not available');
        }
    };

    const markAsRead = async (notificationId) => {
        try {
            const userId = localStorage.getItem('userId');
            await axios.put(`${serverURL}/api/notifications/${notificationId}/read`, {}, {
                headers: {
                    'Authorization': `Bearer ${userId}`
                }
            });

            setNotifications(prev => prev.map(notif => 
                notif._id === notificationId 
                    ? { ...notif, read: true, readAt: new Date() }
                    : notif
            ));

            setUnreadCount(prev => Math.max(0, prev - 1));
            
            if (onUnreadCountChange) {
                onUnreadCountChange(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const userId = localStorage.getItem('userId');
            await axios.put(`${serverURL}/api/notifications/read-all`, {}, {
                headers: {
                    'Authorization': `Bearer ${userId}`
                }
            });

            setNotifications(prev => prev.map(notif => ({
                ...notif,
                read: true,
                readAt: new Date()
            })));

            setUnreadCount(0);
            
            if (onUnreadCountChange) {
                onUnreadCountChange(0);
            }
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    const deleteNotification = async (notificationId) => {
        try {
            const userId = localStorage.getItem('userId');
            await axios.delete(`${serverURL}/api/notifications/${notificationId}`, {
                headers: {
                    'Authorization': `Bearer ${userId}`
                }
            });

            const notification = notifications.find(n => n._id === notificationId);
            if (notification && !notification.read) {
                setUnreadCount(prev => Math.max(0, prev - 1));
                if (onUnreadCountChange) {
                    onUnreadCountChange(prev => Math.max(0, prev - 1));
                }
            }

            setNotifications(prev => prev.filter(notif => notif._id !== notificationId));
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'comment':
            case 'chat_message':
                return <CommentIcon />;
            case 'poll_created':
            case 'poll_ended':
                return <PollIcon />;
            case 'like':
                return <FavoriteIcon />;
            case 'follow':
                return <PersonIcon />;
            case 'blog_published':
                return <ArticleIcon />;
            default:
                return <NotificationsIcon />;
        }
    };

    const requestNotificationPermission = async () => {
        if ('Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            setSettings(prev => ({
                ...prev,
                pushEnabled: permission === 'granted'
            }));
        }
    };

    const handleSettingsChange = (setting) => (event) => {
        const value = event.target.checked;
        setSettings(prev => ({
            ...prev,
            [setting]: value
        }));

        if (setting === 'pushEnabled' && value) {
            requestNotificationPermission();
        }
    };

    if (loading) {
        return (
            <NotificationsContainer>
                <EmptyState>
                    <NotificationsIcon sx={{ fontSize: 48, mb: 2 }} />
                    <Typography>Loading notifications...</Typography>
                </EmptyState>
            </NotificationsContainer>
        );
    }

    return (
        <NotificationsContainer>
            {/* Header */}
            <NotificationsHeader>
                <Box display="flex" alignItems="center" gap={1}>
                    <Badge badgeContent={unreadCount} color="error">
                        <NotificationsActiveIcon color="primary" />
                    </Badge>
                    <Typography variant="h6" fontWeight={600}>
                        Notifications
                    </Typography>
                </Box>
                
                <Box>
                    {unreadCount > 0 && (
                        <Button
                            size="small"
                            onClick={markAllAsRead}
                            startIcon={<MarkReadIcon />}
                            sx={{ mr: 1 }}
                        >
                            Mark All Read
                        </Button>
                    )}
                    <IconButton
                        size="small"
                        onClick={(e) => setSettingsAnchor(e.currentTarget)}
                    >
                        <SettingsIcon />
                    </IconButton>
                </Box>
            </NotificationsHeader>

            {/* Error Alert */}
            {error && (
                <Alert severity="error" sx={{ m: 2 }}>
                    {error}
                </Alert>
            )}

            {/* Notifications List */}
            {notifications.length === 0 ? (
                <EmptyState>
                    <NotificationsIcon sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
                    <Typography variant="h6" gutterBottom>
                        No notifications yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                        You'll see notifications here when there's activity on your blogs or interactions with other users.
                    </Typography>
                </EmptyState>
            ) : (
                <NotificationsList>
                    {notifications.map((notification, index) => (
                        <React.Fragment key={notification._id}>
                            <NotificationItem unread={!notification.read}>
                                <ListItemAvatar>
                                    <NotificationAvatar type={notification.type}>
                                        {getNotificationIcon(notification.type)}
                                    </NotificationAvatar>
                                </ListItemAvatar>
                                
                                <ListItemText
                                    primary={
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <Typography variant="subtitle2" fontWeight={600}>
                                                {notification.title}
                                            </Typography>
                                            {!notification.read && (
                                                <CircleIcon sx={{ fontSize: 8, color: 'primary.main' }} />
                                            )}
                                        </Box>
                                    }
                                    secondary={
                                        <Box>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                                {notification.message}
                                            </Typography>
                                            <Box display="flex" alignItems="center" justifyContent="space-between">
                                                <Typography variant="caption" color="text.secondary">
                                                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                                </Typography>
                                                <Chip
                                                    label={notification.type.replace('_', ' ')}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ fontSize: '0.7rem', height: 20 }}
                                                />
                                            </Box>
                                        </Box>
                                    }
                                />
                                
                                <Box display="flex" flexDirection="column" gap={0.5}>
                                    {!notification.read && (
                                        <IconButton
                                            size="small"
                                            onClick={() => markAsRead(notification._id)}
                                            title="Mark as read"
                                        >
                                            <MarkReadIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                    <IconButton
                                        size="small"
                                        onClick={() => deleteNotification(notification._id)}
                                        title="Delete notification"
                                        color="error"
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            </NotificationItem>
                            {index < notifications.length - 1 && <Divider />}
                        </React.Fragment>
                    ))}
                </NotificationsList>
            )}

            {/* Settings Menu */}
            <Menu
                anchorEl={settingsAnchor}
                open={Boolean(settingsAnchor)}
                onClose={() => setSettingsAnchor(null)}
                PaperProps={{
                    sx: { minWidth: 250, p: 1 }
                }}
            >
                <Typography variant="subtitle2" sx={{ px: 2, py: 1, fontWeight: 600 }}>
                    Notification Settings
                </Typography>
                <Divider sx={{ mb: 1 }} />
                
                <MenuItem>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={settings.soundEnabled}
                                onChange={handleSettingsChange('soundEnabled')}
                                size="small"
                            />
                        }
                        label="Sound notifications"
                        sx={{ width: '100%', m: 0 }}
                    />
                </MenuItem>
                
                <MenuItem>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={settings.pushEnabled}
                                onChange={handleSettingsChange('pushEnabled')}
                                size="small"
                            />
                        }
                        label="Browser notifications"
                        sx={{ width: '100%', m: 0 }}
                    />
                </MenuItem>
                
                <MenuItem>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={settings.emailEnabled}
                                onChange={handleSettingsChange('emailEnabled')}
                                size="small"
                            />
                        }
                        label="Email notifications"
                        sx={{ width: '100%', m: 0 }}
                    />
                </MenuItem>
            </Menu>
        </NotificationsContainer>
    );
};

export default LiveNotifications;