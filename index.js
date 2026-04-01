require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");

const app = express();
const printRoutes = require('./routes/print');

// ====== MIDDLEWARE - ORDER MATTERS! ======
// 1️⃣ FIRST: Parse JSON bodies (req.body must be available for subsequent middleware)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 2️⃣ SECOND: HTTP request logging (now req.body is parsed)
app.use(morgan("combined"));

// 3️⃣ THIRD: CORS configuration
app.use(cors({
  origin: ['https://lulufashion2.netlify.app', 'http://localhost:3000', 'http://localhost:5000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 4️⃣ FOURTH: Debug middleware - now req.body will be populated!
app.use((req, res, next) => {
  if (req.path.includes("/api/auth/login") || req.path.includes("/api/auth/register")) {
    console.log(`📥 ${req.method} ${req.path}`);
    console.log("  Content-Type:", req.headers['content-type']);
    console.log("  Body:", req.body);
  }
  next();
});

// Env variables
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// ====== MONGODB CONNECTION OPTIONS ======
const mongoOptions = {
  connectTimeoutMS: 60000,      // 60 seconds
  socketTimeoutMS: 60000,       // 60 seconds
  serverSelectionTimeoutMS: 60000,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  retryReads: true,
  maxPoolSize: 10,
  minPoolSize: 2
};

// MongoDB connection event handlers
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});

// ====== ROUTES ======
app.use("/api/products", require("./routes/products"));
app.use("/api/sales", require("./routes/sales"));
app.use("/api/customers", require("./routes/customers"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/test", require("./routes/test"));
app.use("/api/categories", require("./routes/categories"));
app.use('/api/print', printRoutes);
app.use("/api/expenses", require("./routes/expenses"));
app.use("/api/exchange-rates", require("./routes/exchangeRates"));
app.use("/api/entries", require("./routes/entries"));

// Default route
app.get("/", (req, res) => {
  res.send("ERP/POS System Backend is running...");
});

// Health check endpoint
app.get("/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({
    status: dbState === 1 ? 'healthy' : 'unhealthy',
    database: states[dbState],
    uptime: process.uptime(),
    timestamp: new Date(),
    mongodb_uri_configured: !!MONGO_URI
  });
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ 
    message: `Route ${req.method} ${req.path} not found`,
    available_endpoints: [
      '/',
      '/health',
      '/api/auth/login',
      '/api/auth/register',
      '/api/products',
      '/api/sales',
      '/api/customers',
      '/api/users',
      '/api/categories',
      '/api/print',
      '/api/expenses',
      '/api/exchange-rates',
      '/api/entries'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ====== DB + SERVER STARTUP ======
const startServer = async () => {
  try {
    console.log('⏳ Connecting to MongoDB...');
    console.log('MONGO_URI exists:', !!MONGO_URI);
    
    if (!MONGO_URI) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }
    
    await mongoose.connect(MONGO_URI, mongoOptions);
    
    console.log("✅ Connected to MongoDB Atlas");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    console.error("Full error:", err);
    
    // Don't exit immediately in development
    if (process.env.NODE_ENV === 'production') {
      console.error('Exiting due to database connection failure...');
      process.exit(1);
    } else {
      console.log('⚠️ Running in development mode without database connection');
      console.log('⚠️ API endpoints requiring database will fail');
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT} (no database connection)`);
      });
    }
  }
};

startServer();