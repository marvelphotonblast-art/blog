import express from 'express';
import {
    getChatHistory,
    updateChatSettings,
    deleteMessage,
    editMessage
} from '../controllers/chat-controller.js';

const chatRouter = express.Router();

chatRouter.get('/:blogId/history', getChatHistory);
chatRouter.put('/:blogId/settings', updateChatSettings);
chatRouter.delete('/:blogId/messages/:messageId', deleteMessage);
chatRouter.put('/:blogId/messages/:messageId', editMessage);

export default chatRouter;