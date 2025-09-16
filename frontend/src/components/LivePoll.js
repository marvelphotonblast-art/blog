import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    LinearProgress,
    Radio,
    RadioGroup,
    FormControlLabel,
    FormControl,
    Chip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Switch,
    FormGroup,
    Divider,
    Alert
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
    Poll as PollIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Share as ShareIcon,
    BarChart as ChartIcon,
    Timer as TimerIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import useSocket from '../hooks/useSocket';
import axios from 'axios';
import { serverURL } from '../helper/Helper';
import { formatDistanceToNow } from 'date-fns';

// Styled Components
const PollContainer = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(3),
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: theme.spacing(3),
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    marginBottom: theme.spacing(3),
}));

const PollHeader = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(3),
}));

const PollOption = styled(Box)(({ theme }) => ({
    padding: theme.spacing(2),
    borderRadius: theme.spacing(2),
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginBottom: theme.spacing(1),
    position: 'relative',
    overflow: 'hidden',
    '&:hover': {
        borderColor: theme.palette.primary.main,
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
    },
    '&.selected': {
        borderColor: theme.palette.primary.main,
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
    }
}));

const ProgressBar = styled(LinearProgress)(({ theme, color }) => ({
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    '& .MuiLinearProgress-bar': {
        backgroundColor: color || theme.palette.primary.main,
        borderRadius: 4,
    }
}));

const CreatePollButton = styled(Button)(({ theme }) => ({
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    padding: theme.spacing(1.5, 3),
    borderRadius: theme.spacing(2),
    fontWeight: 600,
    textTransform: 'none',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
    '&:hover': {
        background: 'linear-gradient(135deg, #5a6fd8, #6a4190)',
        transform: 'translateY(-2px)',
        boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)',
    }
}));

const LivePoll = ({ blogId, isOwner = false }) => {
    const [polls, setPolls] = useState([]);
    const [selectedOptions, setSelectedOptions] = useState({});
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Create poll form state
    const [newPoll, setNewPoll] = useState({
        title: '',
        description: '',
        options: ['', ''],
        settings: {
            allowMultipleVotes: false,
            showResults: 'after_vote',
            allowAddOptions: false,
            requireAuth: true
        },
        endDate: ''
    });

    const currentUser = useSelector(state => state.user);
    const { socket, isConnected, votePoll } = useSocket();

    // Fetch polls for this blog
    useEffect(() => {
        const fetchPolls = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`${serverURL}/api/polls/blog/${blogId}`);
                setPolls(response.data.polls || []);
            } catch (error) {
                console.error('Error fetching polls:', error);
                setError('Failed to load polls');
            } finally {
                setLoading(false);
            }
        };

        if (blogId) {
            fetchPolls();
        }
    }, [blogId]);

    // Socket event listeners for real-time poll updates
    useEffect(() => {
        if (!socket) return;

        const handlePollUpdated = (data) => {
            setPolls(prev => prev.map(poll => 
                poll._id === data.pollId ? data.poll : poll
            ));
        };

        socket.on('poll_updated', handlePollUpdated);

        return () => {
            socket.off('poll_updated', handlePollUpdated);
        };
    }, [socket]);

    const handleVote = async (pollId, optionIndex) => {
        try {
            // Optimistic update
            setSelectedOptions(prev => ({
                ...prev,
                [pollId]: optionIndex
            }));

            // Send vote via socket for real-time updates
            if (isConnected) {
                votePoll(pollId, optionIndex);
            }

            // Also send via HTTP for reliability
            await axios.post(`${serverURL}/api/polls/${pollId}/vote`, {
                optionIndex
            }, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('userId')}`
                }
            });

        } catch (error) {
            console.error('Error voting:', error);
            // Revert optimistic update on error
            setSelectedOptions(prev => {
                const newState = { ...prev };
                delete newState[pollId];
                return newState;
            });
            setError('Failed to submit vote');
        }
    };

    const handleCreatePoll = async () => {
        try {
            if (!newPoll.title.trim() || newPoll.options.filter(opt => opt.trim()).length < 2) {
                setError('Please provide a title and at least 2 options');
                return;
            }

            const pollData = {
                ...newPoll,
                blogId,
                options: newPoll.options.filter(opt => opt.trim()).map(text => ({ text })),
                endDate: newPoll.endDate ? new Date(newPoll.endDate) : null
            };

            const response = await axios.post(`${serverURL}/api/polls`, pollData, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('userId')}`
                }
            });

            setPolls(prev => [response.data.poll, ...prev]);
            setShowCreateDialog(false);
            setNewPoll({
                title: '',
                description: '',
                options: ['', ''],
                settings: {
                    allowMultipleVotes: false,
                    showResults: 'after_vote',
                    allowAddOptions: false,
                    requireAuth: true
                },
                endDate: ''
            });
            setError('');

        } catch (error) {
            console.error('Error creating poll:', error);
            setError('Failed to create poll');
        }
    };

    const addOption = () => {
        setNewPoll(prev => ({
            ...prev,
            options: [...prev.options, '']
        }));
    };

    const updateOption = (index, value) => {
        setNewPoll(prev => ({
            ...prev,
            options: prev.options.map((opt, i) => i === index ? value : opt)
        }));
    };

    const removeOption = (index) => {
        if (newPoll.options.length > 2) {
            setNewPoll(prev => ({
                ...prev,
                options: prev.options.filter((_, i) => i !== index)
            }));
        }
    };

    const calculatePercentage = (votes, totalVotes) => {
        return totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
    };

    const hasUserVoted = (poll) => {
        return poll.options.some(option => 
            option.votes.some(vote => vote.user === currentUser?._id)
        );
    };

    const canShowResults = (poll) => {
        const { showResults } = poll.settings;
        const userVoted = hasUserVoted(poll);
        
        return showResults === 'always' || 
               (showResults === 'after_vote' && userVoted) ||
               (showResults === 'after_end' && poll.status === 'ended');
    };

    if (loading) {
        return (
            <PollContainer>
                <Box display="flex" alignItems="center" justifyContent="center" py={4}>
                    <Typography>Loading polls...</Typography>
                </Box>
            </PollContainer>
        );
    }

    return (
        <Box>
            {/* Create Poll Button */}
            {isOwner && (
                <Box mb={3} display="flex" justifyContent="center">
                    <CreatePollButton
                        startIcon={<AddIcon />}
                        onClick={() => setShowCreateDialog(true)}
                    >
                        Create Poll
                    </CreatePollButton>
                </Box>
            )}

            {/* Error Alert */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {/* Polls List */}
            {polls.length === 0 ? (
                <PollContainer>
                    <Box textAlign="center" py={4}>
                        <PollIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" mb={1}>
                            No polls yet
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {isOwner ? 'Create your first poll to engage with your readers!' : 'Check back later for polls from the author.'}
                        </Typography>
                    </Box>
                </PollContainer>
            ) : (
                polls.map((poll) => {
                    const userVoted = hasUserVoted(poll);
                    const showResults = canShowResults(poll);
                    const isEnded = poll.status === 'ended' || (poll.endDate && new Date() > new Date(poll.endDate));

                    return (
                        <PollContainer key={poll._id}>
                            <PollHeader>
                                <Box>
                                    <Typography variant="h6" fontWeight="700" mb={1}>
                                        {poll.title}
                                    </Typography>
                                    {poll.description && (
                                        <Typography variant="body2" color="text.secondary" mb={2}>
                                            {poll.description}
                                        </Typography>
                                    )}
                                    <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                                        <Chip
                                            icon={<ChartIcon />}
                                            label={`${poll.totalVotes} vote${poll.totalVotes !== 1 ? 's' : ''}`}
                                            size="small"
                                            color="primary"
                                            variant="outlined"
                                        />
                                        {poll.endDate && (
                                            <Chip
                                                icon={<TimerIcon />}
                                                label={isEnded ? 'Ended' : `Ends ${formatDistanceToNow(new Date(poll.endDate), { addSuffix: true })}`}
                                                size="small"
                                                color={isEnded ? 'error' : 'warning'}
                                                variant="outlined"
                                            />
                                        )}
                                        {userVoted && (
                                            <Chip
                                                label="Voted"
                                                size="small"
                                                color="success"
                                                variant="outlined"
                                            />
                                        )}
                                    </Box>
                                </Box>
                                
                                {isOwner && (
                                    <Box>
                                        <IconButton size="small">
                                            <EditIcon />
                                        </IconButton>
                                        <IconButton size="small">
                                            <ShareIcon />
                                        </IconButton>
                                        <IconButton size="small" color="error">
                                            <DeleteIcon />
                                        </IconButton>
                                    </Box>
                                )}
                            </PollHeader>

                            <Divider sx={{ mb: 3 }} />

                            {/* Poll Options */}
                            <Box>
                                {poll.options.map((option, index) => {
                                    const voteCount = option.votes.length;
                                    const percentage = calculatePercentage(voteCount, poll.totalVotes);
                                    const isSelected = selectedOptions[poll._id] === index;

                                    return (
                                        <PollOption
                                            key={index}
                                            className={isSelected ? 'selected' : ''}
                                            onClick={() => !isEnded && !userVoted && handleVote(poll._id, index)}
                                            sx={{
                                                cursor: isEnded || userVoted ? 'default' : 'pointer',
                                                opacity: isEnded ? 0.7 : 1
                                            }}
                                        >
                                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                                <Typography variant="body1" fontWeight={500}>
                                                    {option.text}
                                                </Typography>
                                                {showResults && (
                                                    <Typography variant="body2" color="text.secondary" fontWeight="600">
                                                        {percentage}% ({voteCount})
                                                    </Typography>
                                                )}
                                            </Box>
                                            
                                            {showResults && (
                                                <ProgressBar
                                                    variant="determinate"
                                                    value={percentage}
                                                    color={option.color}
                                                />
                                            )}
                                        </PollOption>
                                    );
                                })}
                            </Box>

                            {/* Poll Footer */}
                            <Box mt={3} display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="caption" color="text.secondary">
                                    Created by {poll.creator.name} • {formatDistanceToNow(new Date(poll.createdAt), { addSuffix: true })}
                                </Typography>
                                
                                {poll.settings.allowAddOptions && !isEnded && (
                                    <Button
                                        size="small"
                                        startIcon={<AddIcon />}
                                        onClick={() => {/* Handle add option */}}
                                    >
                                        Add Option
                                    </Button>
                                )}
                            </Box>
                        </PollContainer>
                    );
                })
            )}

            {/* Create Poll Dialog */}
            <Dialog
                open={showCreateDialog}
                onClose={() => setShowCreateDialog(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    <Box display="flex" alignItems="center" gap={1}>
                        <PollIcon color="primary" />
                        Create New Poll
                    </Box>
                </DialogTitle>
                
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={3} pt={1}>
                        <TextField
                            label="Poll Title"
                            fullWidth
                            value={newPoll.title}
                            onChange={(e) => setNewPoll(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="What would you like to ask?"
                        />
                        
                        <TextField
                            label="Description (Optional)"
                            fullWidth
                            multiline
                            rows={2}
                            value={newPoll.description}
                            onChange={(e) => setNewPoll(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Provide additional context for your poll"
                        />

                        <Box>
                            <Typography variant="subtitle1" fontWeight="600" mb={2}>
                                Poll Options
                            </Typography>
                            {newPoll.options.map((option, index) => (
                                <Box key={index} display="flex" gap={1} mb={2}>
                                    <TextField
                                        fullWidth
                                        label={`Option ${index + 1}`}
                                        value={option}
                                        onChange={(e) => updateOption(index, e.target.value)}
                                        placeholder={`Enter option ${index + 1}`}
                                    />
                                    {newPoll.options.length > 2 && (
                                        <IconButton
                                            onClick={() => removeOption(index)}
                                            color="error"
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    )}
                                </Box>
                            ))}
                            <Button
                                startIcon={<AddIcon />}
                                onClick={addOption}
                                variant="outlined"
                                size="small"
                            >
                                Add Option
                            </Button>
                        </Box>

                        <TextField
                            label="End Date (Optional)"
                            type="datetime-local"
                            fullWidth
                            value={newPoll.endDate}
                            onChange={(e) => setNewPoll(prev => ({ ...prev, endDate: e.target.value }))}
                            InputLabelProps={{ shrink: true }}
                        />

                        <Box>
                            <Typography variant="subtitle1" fontWeight="600" mb={2}>
                                Poll Settings
                            </Typography>
                            <FormGroup>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={newPoll.settings.allowMultipleVotes}
                                            onChange={(e) => setNewPoll(prev => ({
                                                ...prev,
                                                settings: { ...prev.settings, allowMultipleVotes: e.target.checked }
                                            }))}
                                        />
                                    }
                                    label="Allow multiple votes per user"
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={newPoll.settings.allowAddOptions}
                                            onChange={(e) => setNewPoll(prev => ({
                                                ...prev,
                                                settings: { ...prev.settings, allowAddOptions: e.target.checked }
                                            }))}
                                        />
                                    }
                                    label="Allow users to add new options"
                                />
                            </FormGroup>
                        </Box>
                    </Box>
                </DialogContent>
                
                <DialogActions>
                    <Button onClick={() => setShowCreateDialog(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreatePoll}
                        variant="contained"
                        disabled={!newPoll.title.trim() || newPoll.options.filter(opt => opt.trim()).length < 2}
                    >
                        Create Poll
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default LivePoll;