// server.js
// Main entry point for the Blockchain-based Food Traceability API

// Import required modules
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const fs = require('fs');
require('dotenv').config();

// Import custom modules and routes
const connectDB = require('./utils/db');
const Transfer = require('./models/Transfer'); 
const registerRouter = require('./routes/register');
const loginRouter = require('./routes/login');
const farmerDashboardRouter = require('./routes/farmerDashboard');
const distributorDashboardRouter = require('./routes/distributorDashboard');
const retailerDashboardRouter = require('./routes/retailerDashboard');
const consumerRouter = require('./routes/consumerDashboard');
const blockchainRouter = require('./routes/blockchain');

// Initialize the Express application
const app = express();

// Create an HTTP server using the Express app
const server = http.createServer(app);

// Initialize Socket.IO with the HTTP server
const io = socketIo(server, {
  cors: {
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Security middleware to set various HTTP headers
// Adjust Content Security Policy (CSP) to allow necessary resources
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "font-src": ["'self'", "https:", "data:"],
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:"],
      "connect-src": ["'self'", "http://localhost:3000"]
    },
  },
}));

// Configure CORS options
const corsOptions = {
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

// Rate limiting middleware to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Middleware to parse JSON and URL-encoded bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Setup request logging
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLogStream }));

// Additional console logging for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Connect to the database
connectDB();

// Set up routes
app.use('/api/register', registerRouter);
app.use('/api/login', loginRouter);
app.use('/api/farmer', farmerDashboardRouter);
app.use('/api/distributor', distributorDashboardRouter);
app.use('/api/retailer', retailerDashboardRouter);
app.use('/api/consumer', consumerRouter);
app.use('/api/blockchain', blockchainRouter);

// Basic route to check if the server is running
app.get('/', (req, res) => {
  res.send('Welcome to the Blockchain-based Food Traceability API');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'An unexpected error occurred',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Set io instance on app for use in other parts of the application
app.set('io', io);

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Close server & exit process
  server.close(() => process.exit(1));
});

module.exports = app; // Export for testing purposes