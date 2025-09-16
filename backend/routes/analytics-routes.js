import express from 'express';
import {
    trackEvent,
    getBlogAnalytics,
    getRealtimeUsers
} from '../controllers/analytics-controller.js';

const analyticsRouter = express.Router();

analyticsRouter.post('/track', trackEvent);
analyticsRouter.get('/blog/:blogId', getBlogAnalytics);
analyticsRouter.get('/blog/:blogId/realtime', getRealtimeUsers);

export default analyticsRouter;