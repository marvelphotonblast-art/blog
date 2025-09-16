import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useSelector } from 'react-redux';

const useSocket = () => {
    const socketRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const [activeUsers, setActiveUsers] = useState([]);
    const user = useSelector(state => state.user);
    const isLoggedIn = useSelector(state => state.isLoggedIn);

    useEffect(() => {
        if (!isLoggedIn || !user) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                setIsConnected(false);
            }
            return;
        }

        // Create socket connection
        const serverURL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
        
        socketRef.current = io(serverURL, {
            auth: {
                token: localStorage.getItem('userId') // You might want to use a proper JWT token
            },
            transports: ['websocket', 'polling']
        });

        const socket = socketRef.current;

        // Connection event handlers
        socket.on('connect', () => {
            console.log('Connected to server');
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from server');
            setIsConnected(false);
        });

        socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            setIsConnected(false);
        });

        // User status handlers
        socket.on('user_online', (data) => {
            setActiveUsers(prev => {
                const exists = prev.find(u => u.userId === data.userId);
                if (!exists) {
                    return [...prev, data];
                }
                return prev;
            });
        });

        socket.on('user_offline', (data) => {
            setActiveUsers(prev => prev.filter(u => u.userId !== data.userId));
        });

        // Cleanup on unmount
        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [isLoggedIn, user]);

    const joinBlog = (blogId) => {
        if (socketRef.current && isConnected) {
            socketRef.current.emit('join_blog', { blogId });
        }
    };

    const leaveBlog = (blogId) => {
        if (socketRef.current && isConnected) {
            socketRef.current.emit('leave_blog', { blogId });
        }
    };

    const sendMessage = (blogId, content, messageType = 'text') => {
        if (socketRef.current && isConnected) {
            socketRef.current.emit('send_message', {
                blogId,
                content,
                messageType
            });
        }
    };

    const startTyping = (blogId) => {
        if (socketRef.current && isConnected) {
            socketRef.current.emit('typing_start', { blogId });
        }
    };

    const stopTyping = (blogId) => {
        if (socketRef.current && isConnected) {
            socketRef.current.emit('typing_stop', { blogId });
        }
    };

    const addReaction = (blogId, messageId, emoji) => {
        if (socketRef.current && isConnected) {
            socketRef.current.emit('add_reaction', {
                blogId,
                messageId,
                emoji
            });
        }
    };

    const votePoll = (pollId, optionIndex) => {
        if (socketRef.current && isConnected) {
            socketRef.current.emit('vote_poll', {
                pollId,
                optionIndex
            });
        }
    };

    const updateBlog = (blogId, data) => {
        if (socketRef.current && isConnected) {
            socketRef.current.emit('blog_updated', {
                blogId,
                ...data
            });
        }
    };

    const updateCursor = (blogId, position, selection) => {
        if (socketRef.current && isConnected) {
            socketRef.current.emit('cursor_update', {
                blogId,
                position,
                selection
            });
        }
    };

    const trackAnalytics = (blogId, event, data = {}) => {
        if (socketRef.current && isConnected) {
            socketRef.current.emit('track_analytics', {
                blogId,
                event,
                data,
                sessionId: localStorage.getItem('sessionId') || generateSessionId()
            });
        }
    };

    const generateSessionId = () => {
        const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('sessionId', sessionId);
        return sessionId;
    };
    return {
        socket: socketRef.current,
        isConnected,
        activeUsers,
        joinBlog,
        leaveBlog,
        sendMessage,
        startTyping,
        stopTyping,
        addReaction,
        votePoll,
        updateBlog,
        updateCursor,
        trackAnalytics
    };
};

export default useSocket;