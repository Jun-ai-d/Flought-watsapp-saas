import express from 'express';
import cors from 'cors';
import webhooksRouter from './routes/webhooks';
import outboundRouter from './routes/outbound';
import metricsRoutes from './routes/metrics';
import adminRoutes from './routes/admin';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/webhooks', webhooksRouter);
app.use('/api', outboundRouter);
app.use('/api/metrics', metricsRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});
