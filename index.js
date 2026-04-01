require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");

const app = express();
const printRoutes = require('./routes/print');

// ====== MIDDLEWARE - ORDER MATTERS! ======
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan("combined"));

app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Debug middleware
app.use((req, res, next) => {
  if (req.path.includes("/api/auth/login") || req.path.includes("/api/auth/register")) {
    console.log(`📥 ${req.method} ${req.path}`);
    console.log("  Content-Type:", req.headers['content-type']);
    console.log("  Body:", req.body);
  }
  next();
});

// Env variables - CHECK BOTH NAMES!
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

console.log("=== ENVIRONMENT VARIABLES CHECK ===");
console.log("PORT:", PORT);
console.log("MONGO_URI exists:", !!MONGO_URI);
console.log("MONGO_URI first 20 chars:", MONGO_URI ? MONGO_URI.substring(0, 20) + "..." : "not set");
console.log("NODE_ENV:", process.env.NODE_ENV || "development");
console.log("===================================");

// ====== MONGODB CONNECTION OPTIONS ======
const mongoOptions = {
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 10000,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  retryReads: true,
  maxPoolSize: 10,
  minPoolSize: 2,
  family: 4, // Force IPv4 - fixes connection issues on Render
};

// ====== MONGODB CONNECTION FUNCTION ======
const connectDB = () => {
  if (!MONGO_URI) {
    console.error("❌ MONGO_URI environment variable is not set!");
    return;
  }
  console.log('⏳ Attempting MongoDB connection...');
  mongoose.connect(MONGO_URI, mongoOptions)
    .then(() => {
      console.log("✅ Connected to MongoDB Atlas");
    })
    .catch((err) => {
      console.error("❌ MongoDB connection error:", err.message);
      console.error("⚠️ Retrying in 5 seconds...");
      setTimeout(connectDB, 5000);
    });
};

// ====== MONGODB EVENT HANDLERS ======
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected. Reconnecting in 5 seconds...');
  setTimeout(connectDB, 5000);
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
    mongodb_uri_configured: !!MONGO_URI,
    port: PORT
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: `Route ${req.method} ${req.path} not found`
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

// ====== START SERVER ======
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});

server.on('error', (err) => {
  console.error('❌ Server failed to start:', err.message);
  process.exit(1);
});

// Connect to MongoDB after server starts
connectDB();