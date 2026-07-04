import express from 'express';
import cors from 'cors';
import webhooksRouter from './routes/webhooks';
import outboundRouter from './routes/outbound';
import metricsRoutes from './routes/metrics';
import adminRoutes from './routes/admin';
import bspRoutes from './routes/bsp';
import billingRoutes from './routes/billing';
import templatesRoutes from './routes/templates';

import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// Rate Limiting for webhooks (100 reqs / 15 mins)
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: 'Too many requests to webhook endpoint, please try again later.'
});


// Routes
app.use('/webhooks', webhookLimiter, webhooksRouter);
app.use('/api/outbound', outboundRouter);
app.use('/api/metrics', metricsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bsp', bspRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/templates', templatesRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});
