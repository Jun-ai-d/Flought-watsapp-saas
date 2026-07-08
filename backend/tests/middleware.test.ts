import { requireApiKey } from '../src/middleware/apiAuth';

jest.mock('../src/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn()
  }
}));

import { supabaseAdmin } from '../src/lib/supabase';

describe('API Auth Middleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = { header: jest.fn() };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  test('returns 401 if API key is missing', async () => {
    req.header.mockReturnValue(null);
    await requireApiKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing x-api-key header' });
  });

  test('returns 401 if API key is invalid', async () => {
    req.header.mockReturnValue('invalid-key');
    (supabaseAdmin.single as jest.Mock).mockResolvedValue({ data: null });
    await requireApiKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('calls next and sets tenantId if API key is valid', async () => {
    req.header.mockReturnValue('valid-key');
    (supabaseAdmin.single as jest.Mock).mockResolvedValue({ data: { tenant_id: 'tenant-123' } });
    await requireApiKey(req, res, next);
    expect(req.tenantId).toBe('tenant-123');
    expect(next).toHaveBeenCalled();
  });
});
