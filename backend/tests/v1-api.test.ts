import request from 'supertest';
import express from 'express';
import v1Routes from '../src/routes/v1';

// Mock supabaseAdmin
jest.mock('../src/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: 'test-conv', status: 'handover_active' }, error: null })
  }
}));

import { supabaseAdmin } from '../src/lib/supabase';

const app = express();
app.use(express.json());
// Mock API Auth middleware to just set tenantId
app.use((req, res, next) => {
  (req as any).tenantId = 'test-tenant-123';
  next();
});
app.use('/api/v1', v1Routes);

describe('V1 API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /conversations/:id/takeover updates status to handover_active', async () => {
    const res = await request(app).post('/api/v1/conversations/conv-123/takeover');
    expect(res.status).toBe(200);
    expect(supabaseAdmin.update).toHaveBeenCalledWith({ status: 'handover_active' });
    expect(supabaseAdmin.eq).toHaveBeenCalledWith('id', 'conv-123');
  });

  test('POST /conversations/:id/resolve updates status to bot', async () => {
    const res = await request(app).post('/api/v1/conversations/conv-123/resolve');
    expect(res.status).toBe(200);
    expect(supabaseAdmin.update).toHaveBeenCalledWith({ status: 'bot', handover_reason: null, handover_summary: null });
  });
});
