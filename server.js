/**
 * Express Server with CORS Configuration
 * Fixed for preflight OPTIONS requests
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

// ============================================
// CORS MIDDLEWARE - Order is critical
// ============================================

// 1. Global CORS for all routes
app.use(cors({ origin: "*" }));

// 2. Explicit preflight OPTIONS handler
app.options("*", cors());

// 3. Body parser middleware
app.use(express.json());

// ============================================
// ROUTES - Business logic unchanged
// ============================================

app.get('/', (req, res) => {
  res.json({
    service: 'AI SRE Lab Backend',
    version: '1.0.0',
    endpoints: {
      analyze: '/analyze (POST) - Analyze logs for root cause',
      health: '/health (GET) - Health check'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'backend' });
});

app.post('/analyze', (req, res) => {
  const { logs } = req.body;
  
  console.log('Received logs:', logs);
  
  res.json({
    analysis: 'Analysis complete',
    root_cause: 'Database connection timeout',
    recommendation: 'Increase connection pool size'
  });
});

// ============================================
// SERVER START
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
