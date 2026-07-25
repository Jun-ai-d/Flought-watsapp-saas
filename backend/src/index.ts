console.log('[Startup] Flought backend booting', {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: process.env.PORT ?? 4000,
});

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
import marketingRouter from './routes/marketing';
import shopifyRouter from './routes/shopify';
import crmRouter from './routes/crm';
import notesRouter from './routes/notes';
import growthRouter from './routes/growth';
import analyticsRouter from './routes/analytics';

import rateLimit from 'express-rate-limit';
import { traceMiddleware } from './middleware/traceMiddleware';
import { getSupabaseConfigError, isSupabaseConfigured } from './lib/supabase';
import { getEncryptionConfigError, isEncryptionConfigured } from './bsp/crypto';

function getStartupChecks() {
  return {
    supabase: isSupabaseConfigured(),
    encryption: isEncryptionConfigured(),
    jobQueue: Boolean(process.env.DATABASE_URL),
  };
}

function logStartupConfig() {
  const checks = getStartupChecks();
  const missing: string[] = [];

  if (!checks.supabase) {
    const err = getSupabaseConfigError();
    if (err) missing.push(err);
  }
  if (!checks.encryption) {
    const err = getEncryptionConfigError();
    if (err) missing.push(err);
  }
  if (!checks.jobQueue) {
    console.warn('[Startup] DATABASE_URL unset — background jobs disabled');
  }

  if (missing.length > 0) {
    console.error('[Startup] Missing required config (API routes will fail until set):', missing);
  } else {
    console.log('[Startup] Required config present', checks);
  }
}

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4000;

app.use(helmet());
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:8080',
  'https://flought.com',
  'https://www.flought.com',
  'https://watsapp-saas.vercel.app',
  ...(process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((o) => o.trim()).filter(Boolean)
    : []),
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
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
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
app.use('/api/marketing', marketingRouter);
app.use('/api/shopify', shopifyRouter);
app.use('/api/crm', crmRouter);
app.use('/api/notes', notesRouter);
app.use('/api/growth', growthRouter);
app.use('/api/analytics', analyticsRouter);

// Health check — always 200 when process is up (Coolify/Docker healthcheck)
app.get('/health', (req, res) => {
  const checks = getStartupChecks();
  const errors: string[] = [];
  if (!checks.supabase) {
    const err = getSupabaseConfigError();
    if (err) errors.push(err);
  }
  if (!checks.encryption) {
    const err = getEncryptionConfigError();
    if (err) errors.push(err);
  }

  res.json({
    status: errors.length === 0 ? 'ok' : 'degraded',
    checks,
    ...(errors.length > 0 ? { errors } : {}),
    timestamp: new Date().toISOString(),
  });
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
import { initBroadcastWorkers } from './services/marketing/broadcastWorker';
import { initCartRecoveryWorker } from './services/ecommerce/cartRecoveryWorker';
import { initOrderSyncWorker } from './services/ecommerce/orderSyncWorker';
import { initSLAWorker } from './services/automation/slaWorker';
import { initKbIngestWorker } from './services/kb/ingestWorker';

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Backend server running on http://0.0.0.0:${PORT}`);
  logStartupConfig();

  void (async () => {
    const queueReady = await initJobQueue();

    try {
      await initCampaignWorker();
    } catch (error) {
      console.error('Failed to initialize campaign worker', { error });
    }

    if (!queueReady) {
      console.warn('Skipping pg-boss workers — job queue unavailable');
      return;
    }

    try {
      await initBroadcasterWorkers();
      initBroadcastWorkers();
      initCartRecoveryWorker();
      initOrderSyncWorker();
      await initSLAWorker();
      await initKbIngestWorker();
    } catch (error) {
      console.error('Failed to initialize background job workers', { error });
    }
  })();
});
