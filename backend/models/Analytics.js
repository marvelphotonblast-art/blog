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
            'page_enter',
            'page_exit',
            'interaction',
            'download',
            'video_play',
            'video_pause'
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
            countryCode: String,
            city: String
        },
        referrer: String,
        pageUrl: String,
        userAgent: String,
        metadata: mongoose.Schema.Types.Mixed
    },
    ipAddress: {
        type: String,
        required: true
    },
    isRealTime: {
        type: Boolean,
        default: true
    },
    processed: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for better performance and analytics queries
analyticsSchema.index({ blogId: 1, createdAt: -1 });
analyticsSchema.index({ userId: 1, createdAt: -1 });
analyticsSchema.index({ event: 1, createdAt: -1 });
analyticsSchema.index({ sessionId: 1, createdAt: -1 });
analyticsSchema.index({ isRealTime: 1, processed: 1 });

export default mongoose.model("Analytics", analyticsSchema);