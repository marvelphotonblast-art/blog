import mongoose from "mongoose";

const Schema = mongoose.Schema;

const optionSchema = new Schema({
    text: {
        type: String,
        required: true,
        maxlength: 200
    },
    votes: [{
        user: {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    color: {
        type: String,
        default: '#3b82f6'
    }
});

const pollSchema = new Schema({
    title: {
        type: String,
        required: true,
        maxlength: 300
    },
    description: {
        type: String,
        maxlength: 1000
    },
    options: [optionSchema],
    creator: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true
    },
    blogId: {
        type: mongoose.Types.ObjectId,
        ref: 'Blog'
    },
    settings: {
        allowMultipleVotes: {
            type: Boolean,
            default: false
        },
        showResults: {
            type: String,
            enum: ['always', 'after_vote', 'after_end'],
            default: 'after_vote'
        },
        allowAddOptions: {
            type: Boolean,
            default: false
        },
        requireAuth: {
            type: Boolean,
            default: true
        }
    },
    status: {
        type: String,
        enum: ['active', 'ended', 'draft'],
        default: 'active'
    },
    endDate: {
        type: Date
    },
    totalVotes: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Index for better performance
pollSchema.index({ blogId: 1 });
pollSchema.index({ creator: 1 });
pollSchema.index({ status: 1 });

export default mongoose.model("Poll", pollSchema);