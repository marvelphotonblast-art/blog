import mongoose from "mongoose";

const Schema = mongoose.Schema;

const analyticsSchema = new Schema({
    blogId: {
        type: mongoose.Types.ObjectId,
        ref: 'Blog',
        required: true
    },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    sessionId: {
        type: String,
        required: true
    },
    event: {
        type: String,
        enum: [
            'view', 
            'like', 
            'share', 
            'comment', 
            'time_spent',
            'scroll_depth',
            'click',
            'poll_vote',
            'chat_message'
        ],
        required: true
    },
    data: {
        timeSpent: Number, // in seconds
        scrollDepth: Number, // percentage
        deviceType: String,
        browser: String,
        location: {
            country: String,
            city: String
        },
        referrer: String,
        metadata: mongoose.Schema.Types.Mixed
    },
    ipAddress: {
        type: String,
        required: true
    },
    userAgent: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

// Index for better performance and analytics queries
analyticsSchema.index({ blogId: 1, createdAt: -1 });
analyticsSchema.index({ userId: 1, createdAt: -1 });
analyticsSchema.index({ event: 1, createdAt: -1 });

export default mongoose.model("Analytics", analyticsSchema);