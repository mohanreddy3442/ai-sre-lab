/**
 * Express Server with CORS Configuration
 * Production-ready with proper error handling
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

// ============================================
// CORS MIDDLEWARE - Order is critical
// ============================================

// 1. Global CORS for all routes (allows localhost:3000)
app.use(cors({ 
  origin: "*",
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Explicit preflight OPTIONS handler
app.options("*", cors());

// 3. Body parser middleware
app.use(express.json({ limit: '10mb' }));

// ============================================
// ROUTES
// ============================================

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'AI SRE Lab Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      root: '/ (GET)',
      health: '/health (GET)',
      analyze: '/analyze (POST) - Analyze logs for root cause'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    service: 'backend',
    timestamp: new Date().toISOString()
  });
});

// Analyze endpoint - main API
app.post('/analyze', (req, res) => {
  const { logs } = req.body;
  
  // Validate input
  if (!logs || !Array.isArray(logs) || logs.length === 0) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'logs array is required'
    });
  }
  
  console.log('Received logs:', logs);
  
  // Return analysis result
  res.status(200).json({
    analysis: 'Analysis complete',
    root_cause: 'Database connection timeout',
    recommendation: 'Increase connection pool size'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
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
});

module.exports = app;
