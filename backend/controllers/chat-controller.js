import Chat from '../models/Chat.js';
import Blog from '../models/Blog.js';

export const getChatHistory = async (req, res) => {
    try {
        const { blogId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        // Verify blog exists
        const blog = await Blog.findById(blogId);
        if (!blog) {
            return res.status(404).json({ message: 'Blog not found' });
        }

        // Get chat with pagination
        const chat = await Chat.findOne({ blogId })
            .populate('messages.sender', 'name email')
            .populate('messages.reactions.user', 'name')
            .populate('activeUsers.user', 'name email');

        if (!chat) {
            return res.status(200).json({
                messages: [],
                activeUsers: [],
                totalMessages: 0
            });
        }

        // Implement pagination for messages
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedMessages = chat.messages.slice(-endIndex, -startIndex || undefined).reverse();

        res.status(200).json({
            messages: paginatedMessages,
            activeUsers: chat.activeUsers,
            totalMessages: chat.messages.length,
            hasMore: chat.messages.length > endIndex
        });

    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ message: 'Failed to fetch chat history' });
    }
};

export const updateChatSettings = async (req, res) => {
    try {
        const { blogId } = req.params;
        const { allowAnonymous, moderationEnabled, maxMessageLength } = req.body;
        const userId = req.user?.id || req.headers.authorization?.split(' ')[1];

        // Verify blog ownership
        const blog = await Blog.findById(blogId);
        if (!blog) {
            return res.status(404).json({ message: 'Blog not found' });
        }

        if (blog.user.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to update chat settings' });
        }

        // Update chat settings
        let chat = await Chat.findOne({ blogId });
        if (!chat) {
            chat = new Chat({ blogId, messages: [], activeUsers: [] });
        }

        chat.settings = {
            allowAnonymous: allowAnonymous ?? chat.settings.allowAnonymous,
            moderationEnabled: moderationEnabled ?? chat.settings.moderationEnabled,
            maxMessageLength: maxMessageLength ?? chat.settings.maxMessageLength
        };

        await chat.save();

        res.status(200).json({
            message: 'Chat settings updated successfully',
            settings: chat.settings
        });

    } catch (error) {
        console.error('Error updating chat settings:', error);
        res.status(500).json({ message: 'Failed to update chat settings' });
    }
};

export const deleteMessage = async (req, res) => {
    try {
        const { blogId, messageId } = req.params;
        const userId = req.user?.id || req.headers.authorization?.split(' ')[1];

        const chat = await Chat.findOne({ blogId });
        if (!chat) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        const message = chat.messages.id(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Check if user is the sender or blog owner
        const blog = await Blog.findById(blogId);
        const isOwner = blog.user.toString() === userId;
        const isSender = message.sender.toString() === userId;

        if (!isOwner && !isSender) {
            return res.status(403).json({ message: 'Not authorized to delete this message' });
        }

        // Remove message
        chat.messages.pull(messageId);
        await chat.save();

        res.status(200).json({ message: 'Message deleted successfully' });

    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ message: 'Failed to delete message' });
    }
};

export const editMessage = async (req, res) => {
    try {
        const { blogId, messageId } = req.params;
        const { content } = req.body;
        const userId = req.user?.id || req.headers.authorization?.split(' ')[1];

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ message: 'Message content is required' });
        }

        const chat = await Chat.findOne({ blogId });
        if (!chat) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        const message = chat.messages.id(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Check if user is the sender
        if (message.sender.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to edit this message' });
        }

        // Update message
        message.content = content.trim();
        message.edited = true;
        message.editedAt = new Date();

        await chat.save();

        // Populate sender info
        await chat.populate('messages.sender', 'name email');
        const updatedMessage = chat.messages.id(messageId);

        res.status(200).json({
            message: 'Message updated successfully',
            updatedMessage
        });

    } catch (error) {
        console.error('Error editing message:', error);
        res.status(500).json({ message: 'Failed to edit message' });
    }
};