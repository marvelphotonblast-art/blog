import express from "express";
import mongoose from "mongoose";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from 'cors';
import dotenv from 'dotenv';

import router from "./routes/user-routes.js";
import blogRouter from "./routes/blog-routes.js";
import chatRouter from "./routes/chat-routes.js";
import pollRouter from "./routes/poll-routes.js";
import notificationRouter from "./routes/notification-routes.js";
import { handleConnection, authenticateSocket } from "./socket/socketHandlers.js";

// Load environment variables
dotenv.config();

const app = express()
const server = createServer(app);

// Configure CORS for both Express and Socket.IO
const corsOptions = {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));

// Initialize Socket.IO with CORS
const io = new Server(server, {
    cors: corsOptions,
    transports: ['websocket', 'polling']
});

// Socket.IO authentication middleware
io.use(authenticateSocket);

// Handle socket connections
io.on('connection', (socket) => {
    handleConnection(io, socket);
});

// Make io available to routes
app.set('io', io);

app.use(express.json())
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api/user", router)
app.use("/api/blog",blogRouter)
app.use("/api/chat", chatRouter);
app.use("/api/polls", pollRouter);
app.use("/api/notifications", notificationRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sandeepdara44:1234567890@cluster0.5z3d3z6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGODB_URI)
.then(() => server.listen(PORT))
.then(() => console.log(`🚀 Server running on port ${PORT}`))
.then(() => console.log(`📡 Socket.IO server ready`))
.then(() => console.log(`🗄️  Database connected`))
.catch((err)=>console.log(err))

// Catch-all route should come after API routes
app.use('/', (req, res) => {
    res.json({ 
        message: 'Real-time Blog API Server',
        version: '2.0.0',
        features: ['Real-time Chat', 'Live Polls', 'Push Notifications', 'Live Updates']
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    res.status(error.status || 500).json({
        message: error.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

export { io };