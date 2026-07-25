import { requireTenantMember, requireTenantAdminRole } from '../src/middleware/requireTenantMember';
import { executeFlow } from '../src/services/automation/flowMatcher';

const mockSingle = jest.fn();
const mockGetUser = jest.fn();

const queryChain = {
  select: jest.fn(),
  eq: jest.fn(),
  limit: jest.fn(),
  single: mockSingle,
};

queryChain.select.mockReturnValue(queryChain);
queryChain.eq.mockReturnValue(queryChain);
queryChain.limit.mockReturnValue(queryChain);

jest.mock('../src/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(() => queryChain),
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
  },
}));

describe('Route auth middleware', () => {
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    req = {
      headers: {},
      params: { tenantId: 'tenant-1' },
      query: {},
      body: {},
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test('requireTenantMember returns 401 without authorization header', async () => {
    await requireTenantMember(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('requireTenantMember returns 403 when user is not a tenant member', async () => {
    req.headers.authorization = 'Bearer valid-token';
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });

    await requireTenantMember(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('requireTenantAdminRole returns 403 for agent role', async () => {
    req.tenantRole = 'agent';
    requireTenantAdminRole(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('executeFlow keyword matching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns matched reply for keyword trigger → message edge', async () => {
    mockSingle.mockResolvedValue({
      data: {
        nodes: [
          { id: 't1', type: 'trigger', data: { keyword: 'hello' } },
          { id: 'm1', type: 'message', data: { text: 'Welcome!' } },
        ],
        edges: [{ source: 't1', target: 'm1' }],
      },
      error: null,
    });

    const result = await executeFlow('tenant-1', 'hello');
    expect(result).toEqual({ matched: true, replyText: 'Welcome!' });
  });

  test('returns matched false when keyword does not match', async () => {
    mockSingle.mockResolvedValue({
      data: {
        nodes: [{ id: 't1', type: 'trigger', data: { keyword: 'hello' } }],
        edges: [],
      },
      error: null,
    });

    const result = await executeFlow('tenant-1', 'pricing');
    expect(result).toEqual({ matched: false });
  });
});
