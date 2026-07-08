import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import webhooksRouter from './routes/webhooks';
import outboundRouter from './routes/outbound';
import metricsRoutes from './routes/metrics';
import adminRoutes from './routes/admin';
import billingRoutes from './routes/billing';
import templatesRoutes from './routes/templates';
import campaignsRoutes from './routes/campaigns';
import tenantRoutes from './routes/tenant';
import topicsRoutes from './routes/topics';
import v1Routes from './routes/v1';
import integrationsRouter from './routes/integrations';
import widgetRouter from './routes/widget';

import rateLimit from 'express-rate-limit';
import { traceMiddleware } from './middleware/traceMiddleware';

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4000;

app.use(helmet());
const allowedOrigins = [
  'http://localhost:5173',
  'https://flought.com',
  'https://www.flought.com',
  'https://watsapp-saas.vercel.app',
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : [])
];

// Rate Limiting for webhooks (100 reqs / 1 min)
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: 'Too many requests to webhook endpoint, please try again later.'
});

// Webhooks do not need CORS and can be triggered by external servers (Meta) with foreign Origin headers.
// We apply express.json() locally to this route so it can parse the body BEFORE CORS rejects it.
app.use('/webhooks', webhookLimiter, express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}), webhooksRouter);
app.use(cors({ 
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Capture raw body for webhook HMAC validation (like Shopify)
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(traceMiddleware);



// Rate Limiting for standard API routes (300 reqs / 1 min)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  message: 'Too many API requests, please try again later.'
});

// Apply API limiter to all /api routes
app.use('/api', apiLimiter);

// Routes
app.use('/api/outbound', outboundRouter);
app.use('/api/metrics', metricsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/v1', v1Routes);
app.use('/api/integrations', integrationsRouter);
app.use('/api/widget', widgetRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Flought API', version: '1.0' });
});

// Global Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled API Error:', { error: err.message, stack: err.stack, traceId: req.traceId });
  res.status(500).json({ error: 'Internal Server Error' });
});

import { initJobQueue } from './services/jobQueue';
import { initBroadcasterWorkers } from './services/broadcaster';
import { initCampaignWorker } from './services/campaignWorker';

app.listen(PORT, async () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  
  try {
    await initJobQueue();
    await initBroadcasterWorkers();
    await initCampaignWorker();
  } catch (error) {
    console.error('Failed to initialize background job workers', { error });
  }
});
