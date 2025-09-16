import Chat from '../models/Chat.js';
import Poll from '../models/Poll.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

// Store active users and their socket connections
const activeUsers = new Map();
const blogRooms = new Map();

// Socket authentication middleware
export const authenticateSocket = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
            return next(new Error('User not found'));
        }

        socket.userId = user._id.toString();
        socket.user = user;
        next();
    } catch (error) {
        next(new Error('Authentication error'));
    }
};

// Handle socket connections
export const handleConnection = (io, socket) => {
    console.log(`User ${socket.user.name} connected: ${socket.id}`);
    
    // Store user connection
    activeUsers.set(socket.userId, {
        socketId: socket.id,
        user: socket.user,
        lastSeen: new Date(),
        currentBlog: null
    });

    // Emit user online status
    socket.broadcast.emit('user_online', {
        userId: socket.userId,
        user: socket.user
    });

    // Join blog room
    socket.on('join_blog', async (data) => {
        try {
            const { blogId } = data;
            
            // Leave previous blog room if any
            if (socket.currentBlog) {
                socket.leave(`blog_${socket.currentBlog}`);
                await updateBlogActiveUsers(socket.currentBlog, socket.userId, false);
            }

            // Join new blog room
            socket.join(`blog_${blogId}`);
            socket.currentBlog = blogId;
            
            // Update active users for this blog
            await updateBlogActiveUsers(blogId, socket.userId, true);
            
            // Get or create chat for this blog
            let chat = await Chat.findOne({ blogId }).populate('activeUsers.user', 'name email');
            if (!chat) {
                chat = new Chat({ 
                    blogId, 
                    messages: [],
                    activeUsers: []
                });
                await chat.save();
            }

            // Send recent messages to the user
            const recentMessages = await Chat.findOne({ blogId })
                .populate('messages.sender', 'name email')
                .populate('messages.reactions.user', 'name')
                .slice('messages', -50); // Last 50 messages

            socket.emit('chat_history', {
                blogId,
                messages: recentMessages?.messages || [],
                activeUsers: chat.activeUsers
            });

            // Notify others in the room
            socket.to(`blog_${blogId}`).emit('user_joined_blog', {
                userId: socket.userId,
                user: socket.user,
                blogId
            });

        } catch (error) {
            console.error('Error joining blog:', error);
            socket.emit('error', { message: 'Failed to join blog' });
        }
    });

    // Handle chat messages
    socket.on('send_message', async (data) => {
        try {
            const { blogId, content, messageType = 'text' } = data;
            
            if (!content || content.trim().length === 0) {
                return socket.emit('error', { message: 'Message content is required' });
            }

            // Find or create chat
            let chat = await Chat.findOne({ blogId });
            if (!chat) {
                chat = new Chat({ blogId, messages: [], activeUsers: [] });
            }

            // Create new message
            const newMessage = {
                sender: socket.userId,
                content: content.trim(),
                messageType,
                timestamp: new Date()
            };

            chat.messages.push(newMessage);
            await chat.save();

            // Populate sender info
            await chat.populate('messages.sender', 'name email');
            const populatedMessage = chat.messages[chat.messages.length - 1];

            // Emit to all users in the blog room
            io.to(`blog_${blogId}`).emit('new_message', {
                blogId,
                message: populatedMessage
            });

            // Create notifications for blog followers (implement as needed)
            // await createChatNotification(blogId, socket.userId, content);

        } catch (error) {
            console.error('Error sending message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
        const { blogId } = data;
        socket.to(`blog_${blogId}`).emit('user_typing', {
            userId: socket.userId,
            user: socket.user,
            blogId
        });
    });

    socket.on('typing_stop', (data) => {
        const { blogId } = data;
        socket.to(`blog_${blogId}`).emit('user_stop_typing', {
            userId: socket.userId,
            blogId
        });
    });

    // Handle message reactions
    socket.on('add_reaction', async (data) => {
        try {
            const { blogId, messageId, emoji } = data;
            
            const chat = await Chat.findOne({ blogId });
            if (!chat) return;

            const message = chat.messages.id(messageId);
            if (!message) return;

            // Check if user already reacted with this emoji
            const existingReaction = message.reactions.find(
                r => r.user.toString() === socket.userId && r.emoji === emoji
            );

            if (existingReaction) {
                // Remove reaction
                message.reactions.pull(existingReaction._id);
            } else {
                // Add reaction
                message.reactions.push({
                    user: socket.userId,
                    emoji,
                    timestamp: new Date()
                });
            }

            await chat.save();

            // Emit to all users in the blog room
            io.to(`blog_${blogId}`).emit('message_reaction_updated', {
                blogId,
                messageId,
                reactions: message.reactions
            });

        } catch (error) {
            console.error('Error handling reaction:', error);
            socket.emit('error', { message: 'Failed to update reaction' });
        }
    });

    // Handle poll voting
    socket.on('vote_poll', async (data) => {
        try {
            const { pollId, optionIndex } = data;
            
            const poll = await Poll.findById(pollId);
            if (!poll || poll.status !== 'active') {
                return socket.emit('error', { message: 'Poll not found or inactive' });
            }

            // Check if poll has ended
            if (poll.endDate && new Date() > poll.endDate) {
                poll.status = 'ended';
                await poll.save();
                return socket.emit('error', { message: 'Poll has ended' });
            }

            const option = poll.options[optionIndex];
            if (!option) {
                return socket.emit('error', { message: 'Invalid option' });
            }

            // Check if user already voted
            const hasVoted = poll.options.some(opt => 
                opt.votes.some(vote => vote.user.toString() === socket.userId)
            );

            if (hasVoted && !poll.settings.allowMultipleVotes) {
                return socket.emit('error', { message: 'You have already voted' });
            }

            // Remove previous vote if not allowing multiple votes
            if (!poll.settings.allowMultipleVotes) {
                poll.options.forEach(opt => {
                    opt.votes = opt.votes.filter(vote => vote.user.toString() !== socket.userId);
                });
            }

            // Add new vote
            option.votes.push({
                user: socket.userId,
                timestamp: new Date()
            });

            // Update total votes
            poll.totalVotes = poll.options.reduce((total, opt) => total + opt.votes.length, 0);
            
            await poll.save();

            // Emit updated poll results to all users
            if (poll.blogId) {
                io.to(`blog_${poll.blogId}`).emit('poll_updated', {
                    pollId,
                    poll: await Poll.findById(pollId).populate('creator', 'name email')
                });
            }

        } catch (error) {
            console.error('Error voting on poll:', error);
            socket.emit('error', { message: 'Failed to vote on poll' });
        }
    });

    // Handle real-time blog updates
    socket.on('blog_updated', (data) => {
        const { blogId } = data;
        socket.to(`blog_${blogId}`).emit('blog_content_updated', data);
    });

    // Handle live cursor/selection sharing (for collaborative editing)
    socket.on('cursor_update', (data) => {
        const { blogId, position, selection } = data;
        socket.to(`blog_${blogId}`).emit('user_cursor_update', {
            userId: socket.userId,
            user: socket.user,
            position,
            selection,
            blogId
        });
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
        console.log(`User ${socket.user.name} disconnected: ${socket.id}`);
        
        // Remove from active users
        activeUsers.delete(socket.userId);
        
        // Update blog active users
        if (socket.currentBlog) {
            await updateBlogActiveUsers(socket.currentBlog, socket.userId, false);
        }

        // Notify others
        socket.broadcast.emit('user_offline', {
            userId: socket.userId
        });
    });
};

// Helper function to update active users for a blog
async function updateBlogActiveUsers(blogId, userId, isActive) {
    try {
        const chat = await Chat.findOne({ blogId });
        if (!chat) return;

        if (isActive) {
            // Add user to active users if not already present
            const existingUser = chat.activeUsers.find(u => u.user.toString() === userId);
            if (!existingUser) {
                chat.activeUsers.push({
                    user: userId,
                    lastSeen: new Date(),
                    isTyping: false
                });
            } else {
                existingUser.lastSeen = new Date();
            }
        } else {
            // Remove user from active users
            chat.activeUsers = chat.activeUsers.filter(u => u.user.toString() !== userId);
        }

        await chat.save();
    } catch (error) {
        console.error('Error updating blog active users:', error);
    }
}

// Helper function to create chat notifications
async function createChatNotification(blogId, senderId, content) {
    try {
        // This would create notifications for blog followers
        // Implementation depends on your follower system
        console.log('Creating chat notification for blog:', blogId);
    } catch (error) {
        console.error('Error creating chat notification:', error);
    }
}

export { activeUsers, blogRooms };