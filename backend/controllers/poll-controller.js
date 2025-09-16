import Poll from '../models/Poll.js';
import Blog from '../models/Blog.js';

export const createPoll = async (req, res) => {
    try {
        const {
            title,
            description,
            options,
            blogId,
            settings,
            endDate
        } = req.body;

        const userId = req.user?.id || req.headers.authorization?.split(' ')[1];

        // Validate required fields
        if (!title || !options || options.length < 2) {
            return res.status(400).json({
                message: 'Title and at least 2 options are required'
            });
        }

        // Verify blog exists if blogId is provided
        if (blogId) {
            const blog = await Blog.findById(blogId);
            if (!blog) {
                return res.status(404).json({ message: 'Blog not found' });
            }
        }

        // Create poll
        const poll = new Poll({
            title,
            description,
            options: options.map(option => ({
                text: option.text,
                votes: [],
                color: option.color || '#3b82f6'
            })),
            creator: userId,
            blogId,
            settings: {
                allowMultipleVotes: settings?.allowMultipleVotes || false,
                showResults: settings?.showResults || 'after_vote',
                allowAddOptions: settings?.allowAddOptions || false,
                requireAuth: settings?.requireAuth || true
            },
            endDate: endDate ? new Date(endDate) : null,
            status: 'active'
        });

        await poll.save();

        // Populate creator info
        await poll.populate('creator', 'name email');

        res.status(201).json({
            message: 'Poll created successfully',
            poll
        });

    } catch (error) {
        console.error('Error creating poll:', error);
        res.status(500).json({ message: 'Failed to create poll' });
    }
};

export const getPoll = async (req, res) => {
    try {
        const { pollId } = req.params;
        const userId = req.user?.id || req.headers.authorization?.split(' ')[1];

        const poll = await Poll.findById(pollId)
            .populate('creator', 'name email')
            .populate('options.votes.user', 'name');

        if (!poll) {
            return res.status(404).json({ message: 'Poll not found' });
        }

        // Check if user has voted
        const userVotes = poll.options.map(option => ({
            ...option.toObject(),
            hasUserVoted: option.votes.some(vote => vote.user._id.toString() === userId),
            voteCount: option.votes.length
        }));

        res.status(200).json({
            poll: {
                ...poll.toObject(),
                options: userVotes
            }
        });

    } catch (error) {
        console.error('Error fetching poll:', error);
        res.status(500).json({ message: 'Failed to fetch poll' });
    }
};

export const votePoll = async (req, res) => {
    try {
        const { pollId } = req.params;
        const { optionIndex } = req.body;
        const userId = req.user?.id || req.headers.authorization?.split(' ')[1];

        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({ message: 'Poll not found' });
        }

        if (poll.status !== 'active') {
            return res.status(400).json({ message: 'Poll is not active' });
        }

        // Check if poll has ended
        if (poll.endDate && new Date() > poll.endDate) {
            poll.status = 'ended';
            await poll.save();
            return res.status(400).json({ message: 'Poll has ended' });
        }

        const option = poll.options[optionIndex];
        if (!option) {
            return res.status(400).json({ message: 'Invalid option' });
        }

        // Check if user already voted
        const hasVoted = poll.options.some(opt =>
            opt.votes.some(vote => vote.user.toString() === userId)
        );

        if (hasVoted && !poll.settings.allowMultipleVotes) {
            return res.status(400).json({ message: 'You have already voted' });
        }

        // Remove previous vote if not allowing multiple votes
        if (!poll.settings.allowMultipleVotes) {
            poll.options.forEach(opt => {
                opt.votes = opt.votes.filter(vote => vote.user.toString() !== userId);
            });
        }

        // Add new vote
        option.votes.push({
            user: userId,
            timestamp: new Date()
        });

        // Update total votes
        poll.totalVotes = poll.options.reduce((total, opt) => total + opt.votes.length, 0);

        await poll.save();

        // Return updated poll
        await poll.populate('creator', 'name email');
        
        res.status(200).json({
            message: 'Vote recorded successfully',
            poll
        });

    } catch (error) {
        console.error('Error voting on poll:', error);
        res.status(500).json({ message: 'Failed to vote on poll' });
    }
};

export const getBlogPolls = async (req, res) => {
    try {
        const { blogId } = req.params;
        const { status = 'active' } = req.query;

        const polls = await Poll.find({ blogId, status })
            .populate('creator', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({ polls });

    } catch (error) {
        console.error('Error fetching blog polls:', error);
        res.status(500).json({ message: 'Failed to fetch polls' });
    }
};

export const updatePoll = async (req, res) => {
    try {
        const { pollId } = req.params;
        const { title, description, endDate, status } = req.body;
        const userId = req.user?.id || req.headers.authorization?.split(' ')[1];

        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({ message: 'Poll not found' });
        }

        // Check if user is the creator
        if (poll.creator.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to update this poll' });
        }

        // Update poll
        if (title) poll.title = title;
        if (description !== undefined) poll.description = description;
        if (endDate) poll.endDate = new Date(endDate);
        if (status) poll.status = status;

        await poll.save();

        await poll.populate('creator', 'name email');

        res.status(200).json({
            message: 'Poll updated successfully',
            poll
        });

    } catch (error) {
        console.error('Error updating poll:', error);
        res.status(500).json({ message: 'Failed to update poll' });
    }
};

export const deletePoll = async (req, res) => {
    try {
        const { pollId } = req.params;
        const userId = req.user?.id || req.headers.authorization?.split(' ')[1];

        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({ message: 'Poll not found' });
        }

        // Check if user is the creator or blog owner
        let canDelete = poll.creator.toString() === userId;
        
        if (!canDelete && poll.blogId) {
            const blog = await Blog.findById(poll.blogId);
            canDelete = blog && blog.user.toString() === userId;
        }

        if (!canDelete) {
            return res.status(403).json({ message: 'Not authorized to delete this poll' });
        }

        await Poll.findByIdAndDelete(pollId);

        res.status(200).json({ message: 'Poll deleted successfully' });

    } catch (error) {
        console.error('Error deleting poll:', error);
        res.status(500).json({ message: 'Failed to delete poll' });
    }
};

export const addPollOption = async (req, res) => {
    try {
        const { pollId } = req.params;
        const { text, color } = req.body;
        const userId = req.user?.id || req.headers.authorization?.split(' ')[1];

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ message: 'Option text is required' });
        }

        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({ message: 'Poll not found' });
        }

        if (!poll.settings.allowAddOptions) {
            return res.status(403).json({ message: 'Adding options is not allowed for this poll' });
        }

        if (poll.status !== 'active') {
            return res.status(400).json({ message: 'Cannot add options to inactive poll' });
        }

        // Add new option
        poll.options.push({
            text: text.trim(),
            votes: [],
            color: color || '#3b82f6'
        });

        await poll.save();

        await poll.populate('creator', 'name email');

        res.status(200).json({
            message: 'Option added successfully',
            poll
        });

    } catch (error) {
        console.error('Error adding poll option:', error);
        res.status(500).json({ message: 'Failed to add poll option' });
    }
};