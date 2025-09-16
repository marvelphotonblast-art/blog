import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Container, 
  Paper,
  InputAdornment,
  Divider,
  Chip,
  Grid,
  Alert,
  CircularProgress,
  Avatar,
  Card,
  CardContent,
  Tab,
  Tabs,
  Badge,
  IconButton
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { 
  Title as TitleIcon,
  Description as DescriptionIcon,
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Image as ImageIcon,
  CheckCircle as CheckCircleIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Warning as WarningIcon,
  Chat as ChatIcon,
  Poll as PollIcon,
  Notifications as NotificationsIcon,
  Visibility as VisibilityIcon,
  Share as ShareIcon
} from '@mui/icons-material';
import axios from 'axios';
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Swal from 'sweetalert2';
import { serverURL } from '../helper/Helper';
import RealTimeChat from './RealTimeChat';
import LivePoll from './LivePoll';
import LiveNotifications from './LiveNotifications';
import LiveAnalytics from './LiveAnalytics';
import useSocket from '../hooks/useSocket';

import 'sweetalert2/dist/sweetalert2.css';

// Styled Components - Enhanced
const EditContainer = styled(Container)(({ theme }) => ({
  padding: theme.spacing(4),
  background: 'linear-gradient(135deg, #f5f7fa, #e4e9f7)',
  minHeight: '100vh',
}));

const EditCard = styled(Paper)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(20px)',
  borderRadius: theme.spacing(3),
  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  padding: theme.spacing(4),
  marginBottom: theme.spacing(3),
}));

const LiveFeaturesContainer = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '2fr 1fr',
  gap: theme.spacing(3),
  marginTop: theme.spacing(4),
  [theme.breakpoints.down('lg')]: {
    gridTemplateColumns: '1fr',
  },
}));

const RightSidebar = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
}));

const LiveIndicator = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 2),
  background: 'linear-gradient(135deg, #4caf50, #45a049)',
  color: 'white',
  borderRadius: theme.spacing(3),
  fontSize: '0.875rem',
  fontWeight: 600,
  animation: 'pulse 2s infinite',
  '@keyframes pulse': {
    '0%': { opacity: 1 },
    '50%': { opacity: 0.7 },
    '100%': { opacity: 1 },
  },
}));

const TabPanel = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`live-tabpanel-${index}`}
    aria-labelledby={`live-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    }
  </div>
);

const BlogDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const currentUser = useSelector(state => state.user);
  const [input, setInput] = useState({
    title: '',
    description: '',
    image: '',
  });
  const [blog, setBlog] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [liveViewers, setLiveViewers] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Socket connection for real-time features
  const { socket, isConnected, joinBlog, updateBlog } = useSocket();

  const handleChange = (e) => {
    setInput((prevState) => ({
      ...prevState,
      [e.target.name]: e.target.value,
    }));
    
    // Real-time content updates
    if (isConnected && blog) {
      updateBlog(blog._id, {
        field: e.target.name,
        value: e.target.value,
        user: currentUser
      });
    }
    
    if (error) setError("");
  };

  const fetchDetails = useCallback(async () => {
    try {
      const userId = localStorage.getItem("userId");
      if (!userId) {
        setError('User not authenticated');
        return null;
      }

      const res = await axios.get(`${serverURL}/api/blog/${id}`, {
        headers: {
          'Authorization': `Bearer ${userId}`,
          'Content-Type': 'application/json'
        }
      });
      const data = res.data;
      return data.blog;
    } catch (error) {
      console.error('Error fetching blog details:', error);
      setError('Failed to load blog details. Please try again.');
      return null;
    }
  }, [id]);

  useEffect(() => {
    const loadBlogDetails = async () => {
      const data = await fetchDetails();
      if (data) {
        setBlog(data);
        setInput({
          title: data.title || '',
          description: data.description || '',
          image: data.image || '',
        });
        
        // Join blog room for real-time features
        if (isConnected) {
          joinBlog(data._id);
        }
        
        if (currentUser && data.user && currentUser._id !== data.user._id) {
          setError('You can only edit your own blogs');
        }
      } else {
        setError('Blog not found');
      }
      setIsLoading(false);
    };
    
    loadBlogDetails();
  }, [fetchDetails, currentUser, isConnected, joinBlog]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !blog) return;

    const handleBlogContentUpdated = (data) => {
      if (data.blogId === blog._id && data.user._id !== currentUser._id) {
        // Show real-time updates from other users
        setInput(prev => ({
          ...prev,
          [data.field]: data.value
        }));
      }
    };

    const handleUserJoinedBlog = (data) => {
      if (data.blogId === blog._id) {
        setLiveViewers(prev => prev + 1);
      }
    };

    const handleUserLeftBlog = (data) => {
      if (data.blogId === blog._id) {
        setLiveViewers(prev => Math.max(0, prev - 1));
      }
    };

    socket.on('blog_content_updated', handleBlogContentUpdated);
    socket.on('user_joined_blog', handleUserJoinedBlog);
    socket.on('user_left_blog', handleUserLeftBlog);

    return () => {
      socket.off('blog_content_updated', handleBlogContentUpdated);
      socket.off('user_joined_blog', handleUserJoinedBlog);
      socket.off('user_left_blog', handleUserLeftBlog);
    };
  }, [socket, blog, currentUser]);

  const sendRequest = async () => {
    try {
      const userId = localStorage.getItem("userId");
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const res = await axios.put(`${serverURL}/api/blog/update/${id}`, {
        title: input.title,
        description: input.description,
        image: input.image,
      }, {
        headers: {
          'Authorization': `Bearer ${userId}`,
          'Content-Type': 'application/json'
        }
      });
      const data = res.data;
      return data;
    } catch (error) {
      console.error('Error updating blog:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update blog';
      setError(errorMessage);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!input.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!input.description.trim()) {
      setError('Description is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const data = await sendRequest();
      
      Swal.fire({
        icon: 'success',
        title: 'Blog Updated Successfully!',
        text: 'Your blog has been updated and saved.',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
      }).then(() => navigate('/myblogs'));
    } catch (error) {
      console.error('Error updating blog:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleBack = () => {
    navigate('/myblogs');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date not available';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Date not available';
    }
  };

  if (isLoading) {
    return (
      <EditContainer maxWidth={false}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress size={60} thickness={4} sx={{ color: 'primary.main' }} />
        </Box>
      </EditContainer>
    );
  }

  if (error && !blog) {
    return (
      <EditContainer maxWidth={false}>
        <Container maxWidth="md">
          <Box textAlign="center" py={8}>
            <Alert severity="error" sx={{ mb: 4, borderRadius: 3, fontSize: '1.1rem' }}>
              {error}
            </Alert>
            <Button onClick={handleBack} startIcon={<ArrowBackIcon />} variant="contained">
              Back to My Blogs
            </Button>
          </Box>
        </Container>
      </EditContainer>
    );
  }

  const isOwner = currentUser && blog && currentUser._id === blog.user._id;

  return (
    <EditContainer maxWidth={false}>
      <Container maxWidth="xl">
        {/* Header with Live Indicators */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Button onClick={handleBack} startIcon={<ArrowBackIcon />} variant="contained">
            Back to My Blogs
          </Button>
          
          <Box display="flex" alignItems="center" gap={2}>
            {isConnected && (
              <LiveIndicator>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    animation: 'pulse 1s infinite',
                  }}
                />
                Live
              </LiveIndicator>
            )}
            
            <Chip
              icon={<VisibilityIcon />}
              label={`${liveViewers} viewing`}
              color="primary"
              variant="outlined"
            />
            
            <IconButton color="primary">
              <ShareIcon />
            </IconButton>
          </Box>
        </Box>

        <LiveFeaturesContainer>
          {/* Main Content Area */}
          <Box>
            {/* Blog Edit Form */}
            <EditCard elevation={0}>
              <Typography variant="h4" fontWeight={700} mb={3} color="primary">
                {isOwner ? 'Edit Your Blog' : 'View Blog'}
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                  {error}
                </Alert>
              )}

              {blog && (
                <form onSubmit={handleSubmit}>
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <TextField
                        name="title"
                        onChange={handleChange}
                        value={input.title}
                        placeholder="Enter your blog title"
                        fullWidth
                        multiline
                        rows={2}
                        disabled={!isOwner}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <TitleIcon color="action" />
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                          }
                        }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        name="description"
                        onChange={handleChange}
                        value={input.description}
                        placeholder="Write your blog content here..."
                        fullWidth
                        multiline
                        rows={12}
                        disabled={!isOwner}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                              <DescriptionIcon color="action" />
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                          }
                        }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        name="image"
                        onChange={handleChange}
                        value={input.image}
                        placeholder="Enter image URL for your blog"
                        fullWidth
                        disabled={!isOwner}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <ImageIcon color="action" />
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                          }
                        }}
                      />
                    </Grid>

                    {isOwner && (
                      <Grid item xs={12}>
                        <Button
                          type="submit"
                          variant="contained"
                          disabled={isSubmitting}
                          startIcon={isSubmitting ? <CircularProgress size={20} /> : <SaveIcon />}
                          size="large"
                          sx={{
                            background: 'linear-gradient(135deg, #667eea, #764ba2)',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #5a6fd8, #6a4190)',
                            },
                          }}
                        >
                          {isSubmitting ? 'Updating Blog...' : 'Update Blog'}
                        </Button>
                      </Grid>
                    )}
                  </Grid>
                </form>
              )}
            </EditCard>

            {/* Live Analytics */}
            {blog && (
              <LiveAnalytics blogId={blog._id} isOwner={isOwner} />
            )}
          </Box>

          {/* Right Sidebar with Live Features */}
          <RightSidebar>
            <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                variant="fullWidth"
                sx={{
                  '& .MuiTab-root': {
                    minHeight: 60,
                    fontWeight: 600,
                  }
                }}
              >
                <Tab
                  icon={
                    <Badge badgeContent={0} color="primary">
                      <ChatIcon />
                    </Badge>
                  }
                  label="Live Chat"
                />
                <Tab
                  icon={<PollIcon />}
                  label="Polls"
                />
                <Tab
                  icon={
                    <Badge badgeContent={unreadNotifications} color="error">
                      <NotificationsIcon />
                    </Badge>
                  }
                  label="Notifications"
                />
              </Tabs>

              <TabPanel value={activeTab} index={0}>
                {blog && (
                  <RealTimeChat
                    blogId={blog._id}
                    isVisible={activeTab === 0}
                  />
                )}
              </TabPanel>

              <TabPanel value={activeTab} index={1}>
                {blog && (
                  <LivePoll
                    blogId={blog._id}
                    isOwner={isOwner}
                  />
                )}
              </TabPanel>

              <TabPanel value={activeTab} index={2}>
                <LiveNotifications
                  onUnreadCountChange={setUnreadNotifications}
                />
              </TabPanel>
            </Paper>
          </RightSidebar>
        </LiveFeaturesContainer>
      </Container>
    </EditContainer>
  );
};

export default BlogDetail;