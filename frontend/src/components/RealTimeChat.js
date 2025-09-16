import React, { useState, useEffect, useRef } from 'react';
import {
    Box,
    Paper,
    TextField,
    IconButton,
    Typography,
    Avatar,
    Chip,
    Divider,
    Menu,
    MenuItem,
    Tooltip,
    Badge,
    CircularProgress
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
    Send as SendIcon,
    EmojiEmotions as EmojiIcon,
    MoreVert as MoreIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Reply as ReplyIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import useSocket from '../hooks/useSocket';
import EmojiPicker from 'emoji-picker-react';
import { formatDistanceToNow } from 'date-fns';

// Styled Components
const ChatContainer = styled(Paper)(({ theme }) => ({
    height: '500px',
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: theme.spacing(3),
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
}));

const ChatHeader = styled(Box)(({ theme }) => ({
    padding: theme.spacing(2, 3),
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
}));

const MessagesContainer = styled(Box)(({ theme }) => ({
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
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

const MessageBubble = styled(Box)(({ theme, isOwn }) => ({
    display: 'flex',
    flexDirection: isOwn ? 'row-reverse' : 'row',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
}));

const MessageContent = styled(Paper)(({ theme, isOwn }) => ({
    padding: theme.spacing(1.5, 2),
    maxWidth: '70%',
    background: isOwn 
        ? 'linear-gradient(135deg, #667eea, #764ba2)' 
        : 'rgba(255, 255, 255, 0.9)',
    color: isOwn ? 'white' : theme.palette.text.primary,
    borderRadius: theme.spacing(2),
    position: 'relative',
    wordBreak: 'break-word',
    '&:hover .message-actions': {
        opacity: 1,
    },
}));

const MessageActions = styled(Box)(({ theme }) => ({
    position: 'absolute',
    top: -10,
    right: isOwn => isOwn ? 'auto' : -10,
    left: isOwn => isOwn ? -10 : 'auto',
    opacity: 0,
    transition: 'opacity 0.2s ease',
    display: 'flex',
    gap: theme.spacing(0.5),
    background: 'rgba(255, 255, 255, 0.9)',
    borderRadius: theme.spacing(1),
    padding: theme.spacing(0.5),
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
}));

const InputContainer = styled(Box)(({ theme }) => ({
    padding: theme.spacing(2),
    borderTop: '1px solid rgba(0,0,0,0.1)',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
}));

const TypingIndicator = styled(Box)(({ theme }) => ({
    padding: theme.spacing(1, 2),
    fontStyle: 'italic',
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
}));

const ActiveUsersList = styled(Box)(({ theme }) => ({
    display: 'flex',
    gap: theme.spacing(0.5),
    alignItems: 'center',
}));

const RealTimeChat = ({ blogId, isVisible = true }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [typingUsers, setTypingUsers] = useState([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [activeUsers, setActiveUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedMessage, setSelectedMessage] = useState(null);
    
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const inputRef = useRef(null);
    
    const currentUser = useSelector(state => state.user);
    const { socket, isConnected, sendMessage, startTyping, stopTyping, addReaction, joinBlog } = useSocket();

    // Join blog room when component mounts
    useEffect(() => {
        if (isConnected && blogId) {
            joinBlog(blogId);
        }
    }, [isConnected, blogId, joinBlog]);

    // Socket event listeners
    useEffect(() => {
        if (!socket) return;

        const handleChatHistory = (data) => {
            if (data.blogId === blogId) {
                setMessages(data.messages || []);
                setActiveUsers(data.activeUsers || []);
                setLoading(false);
            }
        };

        const handleNewMessage = (data) => {
            if (data.blogId === blogId) {
                setMessages(prev => [...prev, data.message]);
            }
        };

        const handleUserTyping = (data) => {
            if (data.blogId === blogId && data.userId !== currentUser?._id) {
                setTypingUsers(prev => {
                    if (!prev.find(u => u.userId === data.userId)) {
                        return [...prev, data];
                    }
                    return prev;
                });
            }
        };

        const handleUserStopTyping = (data) => {
            if (data.blogId === blogId) {
                setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
            }
        };

        const handleUserJoinedBlog = (data) => {
            if (data.blogId === blogId) {
                setActiveUsers(prev => {
                    if (!prev.find(u => u.user._id === data.userId)) {
                        return [...prev, { user: data.user, lastSeen: new Date() }];
                    }
                    return prev;
                });
            }
        };

        const handleMessageReactionUpdated = (data) => {
            if (data.blogId === blogId) {
                setMessages(prev => prev.map(msg => 
                    msg._id === data.messageId 
                        ? { ...msg, reactions: data.reactions }
                        : msg
                ));
            }
        };

        socket.on('chat_history', handleChatHistory);
        socket.on('new_message', handleNewMessage);
        socket.on('user_typing', handleUserTyping);
        socket.on('user_stop_typing', handleUserStopTyping);
        socket.on('user_joined_blog', handleUserJoinedBlog);
        socket.on('message_reaction_updated', handleMessageReactionUpdated);

        return () => {
            socket.off('chat_history', handleChatHistory);
            socket.off('new_message', handleNewMessage);
            socket.off('user_typing', handleUserTyping);
            socket.off('user_stop_typing', handleUserStopTyping);
            socket.off('user_joined_blog', handleUserJoinedBlog);
            socket.off('message_reaction_updated', handleMessageReactionUpdated);
        };
    }, [socket, blogId, currentUser]);

    // Auto scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = () => {
        if (newMessage.trim() && isConnected) {
            sendMessage(blogId, newMessage.trim());
            setNewMessage('');
            stopTyping(blogId);
        }
    };

    const handleInputChange = (e) => {
        setNewMessage(e.target.value);
        
        // Handle typing indicator
        if (e.target.value.trim()) {
            startTyping(blogId);
            
            // Clear existing timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            
            // Set new timeout to stop typing
            typingTimeoutRef.current = setTimeout(() => {
                stopTyping(blogId);
            }, 2000);
        } else {
            stopTyping(blogId);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleEmojiClick = (emojiData) => {
        setNewMessage(prev => prev + emojiData.emoji);
        setShowEmojiPicker(false);
        inputRef.current?.focus();
    };

    const handleReaction = (messageId, emoji) => {
        addReaction(blogId, messageId, emoji);
    };

    const handleMessageAction = (event, message) => {
        setAnchorEl(event.currentTarget);
        setSelectedMessage(message);
    };

    const closeMessageMenu = () => {
        setAnchorEl(null);
        setSelectedMessage(null);
    };

    const formatMessageTime = (timestamp) => {
        return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    };

    if (!isVisible) return null;

    return (
        <ChatContainer elevation={0}>
            {/* Chat Header */}
            <ChatHeader>
                <Box>
                    <Typography variant="h6" fontWeight="700">
                        Live Chat
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        {activeUsers.length} active user{activeUsers.length !== 1 ? 's' : ''}
                    </Typography>
                </Box>
                
                <ActiveUsersList>
                    {activeUsers.slice(0, 5).map((activeUser, index) => (
                        <Tooltip key={activeUser.user._id} title={activeUser.user.name}>
                            <Avatar
                                sx={{
                                    width: 32,
                                    height: 32,
                                    fontSize: '0.875rem',
                                    border: '2px solid white',
                                    marginLeft: index > 0 ? -1 : 0,
                                }}
                            >
                                {activeUser.user.name?.charAt(0).toUpperCase()}
                            </Avatar>
                        </Tooltip>
                    ))}
                    {activeUsers.length > 5 && (
                        <Chip
                            label={`+${activeUsers.length - 5}`}
                            size="small"
                            sx={{
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                color: 'white',
                                fontSize: '0.75rem',
                                height: 24,
                            }}
                        />
                    )}
                </ActiveUsersList>
            </ChatHeader>

            {/* Messages Container */}
            <MessagesContainer>
                {loading ? (
                    <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                        <CircularProgress size={40} />
                    </Box>
                ) : messages.length === 0 ? (
                    <Box display="flex" justifyContent="center" alignItems="center" height="100%" flexDirection="column">
                        <Typography variant="body2" color="text.secondary" textAlign="center">
                            No messages yet. Start the conversation!
                        </Typography>
                    </Box>
                ) : (
                    messages.map((message) => {
                        const isOwn = message.sender._id === currentUser?._id;
                        return (
                            <MessageBubble key={message._id} isOwn={isOwn}>
                                {!isOwn && (
                                    <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem' }}>
                                        {message.sender.name?.charAt(0).toUpperCase()}
                                    </Avatar>
                                )}
                                
                                <Box>
                                    {!isOwn && (
                                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                            {message.sender.name}
                                        </Typography>
                                    )}
                                    
                                    <MessageContent elevation={1} isOwn={isOwn}>
                                        <Typography variant="body2">
                                            {message.content}
                                        </Typography>
                                        
                                        <Typography variant="caption" sx={{ 
                                            opacity: 0.7, 
                                            fontSize: '0.75rem',
                                            display: 'block',
                                            marginTop: 0.5
                                        }}>
                                            {formatMessageTime(message.timestamp)}
                                            {message.edited && ' (edited)'}
                                        </Typography>

                                        {/* Message Reactions */}
                                        {message.reactions && message.reactions.length > 0 && (
                                            <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                {message.reactions.reduce((acc, reaction) => {
                                                    const existing = acc.find(r => r.emoji === reaction.emoji);
                                                    if (existing) {
                                                        existing.count++;
                                                        existing.users.push(reaction.user);
                                                    } else {
                                                        acc.push({
                                                            emoji: reaction.emoji,
                                                            count: 1,
                                                            users: [reaction.user]
                                                        });
                                                    }
                                                    return acc;
                                                }, []).map((reactionGroup, index) => (
                                                    <Chip
                                                        key={index}
                                                        label={`${reactionGroup.emoji} ${reactionGroup.count}`}
                                                        size="small"
                                                        onClick={() => handleReaction(message._id, reactionGroup.emoji)}
                                                        sx={{
                                                            height: 20,
                                                            fontSize: '0.75rem',
                                                            cursor: 'pointer',
                                                            '&:hover': {
                                                                backgroundColor: 'rgba(0,0,0,0.1)'
                                                            }
                                                        }}
                                                    />
                                                ))}
                                            </Box>
                                        )}

                                        {/* Message Actions */}
                                        <MessageActions className="message-actions">
                                            <IconButton
                                                size="small"
                                                onClick={() => handleReaction(message._id, '👍')}
                                            >
                                                👍
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleReaction(message._id, '❤️')}
                                            >
                                                ❤️
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={(e) => handleMessageAction(e, message)}
                                            >
                                                <MoreIcon fontSize="small" />
                                            </IconButton>
                                        </MessageActions>
                                    </MessageContent>
                                </Box>
                            </MessageBubble>
                        );
                    })
                )}
                
                {/* Typing Indicator */}
                {typingUsers.length > 0 && (
                    <TypingIndicator>
                        {typingUsers.map(u => u.user.name).join(', ')} 
                        {typingUsers.length === 1 ? ' is' : ' are'} typing...
                    </TypingIndicator>
                )}
                
                <div ref={messagesEndRef} />
            </MessagesContainer>

            {/* Input Container */}
            <InputContainer>
                <IconButton
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    color="primary"
                >
                    <EmojiIcon />
                </IconButton>
                
                <TextField
                    ref={inputRef}
                    fullWidth
                    variant="outlined"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    multiline
                    maxRows={3}
                    disabled={!isConnected}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 3,
                        }
                    }}
                />
                
                <IconButton
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || !isConnected}
                    color="primary"
                    sx={{
                        background: newMessage.trim() ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'transparent',
                        color: newMessage.trim() ? 'white' : 'inherit',
                        '&:hover': {
                            background: newMessage.trim() ? 'linear-gradient(135deg, #5a6fd8, #6a4190)' : 'rgba(0,0,0,0.04)',
                        }
                    }}
                >
                    <SendIcon />
                </IconButton>
            </InputContainer>

            {/* Emoji Picker */}
            {showEmojiPicker && (
                <Box sx={{ position: 'absolute', bottom: 70, right: 20, zIndex: 1000 }}>
                    <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        width={300}
                        height={400}
                    />
                </Box>
            )}

            {/* Message Context Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={closeMessageMenu}
            >
                <MenuItem onClick={closeMessageMenu}>
                    <ReplyIcon sx={{ mr: 1 }} fontSize="small" />
                    Reply
                </MenuItem>
                {selectedMessage?.sender._id === currentUser?._id && (
                    <>
                        <MenuItem onClick={closeMessageMenu}>
                            <EditIcon sx={{ mr: 1 }} fontSize="small" />
                            Edit
                        </MenuItem>
                        <MenuItem onClick={closeMessageMenu}>
                            <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
                            Delete
                        </MenuItem>
                    </>
                )}
            </Menu>
        </ChatContainer>
    );
};

export default RealTimeChat;