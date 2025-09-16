import mongoose from "mongoose";

const Schema = mongoose.Schema;

const notificationSchema = new Schema({
    recipient: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sender: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    type: {
        type: String,
        enum: [
            'like', 
            'comment', 
            'follow', 
            'mention', 
            'blog_published', 
            'poll_created',
            'poll_ended',
            'chat_message',
            'system'
        ],
        required: true
    },
    title: {
        type: String,
        required: true,
        maxlength: 200
    },
    message: {
        type: String,
        required: true,
        maxlength: 500
    },
    data: {
        blogId: {
            type: mongoose.Types.ObjectId,
            ref: 'Blog'
        },
        pollId: {
            type: mongoose.Types.ObjectId,
            ref: 'Poll'
        },
        chatId: {
            type: mongoose.Types.ObjectId,
            ref: 'Chat'
        },
        url: String,
        metadata: mongoose.Schema.Types.Mixed
    },
    read: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    }
}, {
    timestamps: true
});

// Index for better performance
notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);