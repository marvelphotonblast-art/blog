import express from 'express';
import {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
} from '../controllers/notification-controller.js';

const notificationRouter = express.Router();

notificationRouter.get('/', getNotifications);
notificationRouter.put('/:notificationId/read', markAsRead);
notificationRouter.put('/read-all', markAllAsRead);
notificationRouter.delete('/:notificationId', deleteNotification);

export default notificationRouter;