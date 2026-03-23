/**
 * Express Server with CORS Configuration
 * Production-ready with proper CORS handling
 */

const express = require('express');
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 8000;

// ============================================
// CORS CONFIGURATION - EXACT SETUP
// ============================================

// 1. Global CORS middleware - BEFORE routes
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// 2. Explicit preflight OPTIONS handler - BEFORE routes
app.options("*", cors());

// 3. Body parser middleware - BEFORE routes
app.use(express.json({ limit: '10mb' }));

// ============================================
// ROUTES
// ============================================

// Root endpoint
app.get('/', (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({
    service: 'AI SRE Lab Backend',
    version: '1.0.0',
    status: 'running'
  });
});

// Health check endpoint - WITH MANUAL CORS HEADER
app.get('/health', (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ 
    status: 'healthy', 
    service: 'backend',
    timestamp: new Date().toISOString()
  });
});

// Analyze endpoint - POST
app.post('/analyze', (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { logs } = req.body;
  
  // Accept both string and array formats
  let logsArray = [];
  
  if (typeof logs === 'string') {
    logsArray = logs.trim() ? [logs] : [];
  } else if (Array.isArray(logs)) {
    logsArray = logs.filter(log => typeof log === 'string' && log.trim());
  }
  
  if (logsArray.length === 0) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'logs must be a non-empty string or array of strings'
    });
  }
  
  console.log('Received logs:', logsArray);
  
  res.status(200).json({
    analysis: 'Analysis complete',
    root_cause: 'Database connection timeout',
    recommendation: 'Increase connection pool size'
  });
});

// 404 handler
app.use((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred'
  });
});

// ============================================
// SERVER START
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS enabled: origin=*, methods=GET,POST,PUT,DELETE,OPTIONS`);
});

module.exports = app;
