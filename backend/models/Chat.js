import mongoose from "mongoose";

const Schema = mongoose.Schema;

const messageSchema = new Schema({
    sender: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true,
        maxlength: 1000
    },
    messageType: {
        type: String,
        enum: ['text', 'emoji', 'image', 'file'],
        default: 'text'
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    edited: {
        type: Boolean,
        default: false
    },
    editedAt: {
        type: Date
    },
    reactions: [{
        user: {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        },
        emoji: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }]
});

const chatSchema = new Schema({
    blogId: {
        type: mongoose.Types.ObjectId,
        ref: 'Blog',
        required: true
    },
    messages: [messageSchema],
    activeUsers: [{
        user: {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        },
        lastSeen: {
            type: Date,
            default: Date.now
        },
        isTyping: {
            type: Boolean,
            default: false
        }
    }],
    settings: {
        allowAnonymous: {
            type: Boolean,
            default: false
        },
        moderationEnabled: {
            type: Boolean,
            default: true
        },
        maxMessageLength: {
            type: Number,
            default: 1000
        }
    }
}, {
    timestamps: true
});

// Index for better performance
chatSchema.index({ blogId: 1 });
chatSchema.index({ 'messages.timestamp': -1 });

export default mongoose.model("Chat", chatSchema);