import { checkHumanIntent, triggerHandover } from '../src/services/automation/handover';
import { matchFAQ } from '../src/services/automation/faqMatcher';
import { executeFlow } from '../src/services/automation/flowMatcher';
import { processAutomationPipeline, sendBotReply } from '../src/services/automation/pipeline';

const mockSendSessionMessage = jest.fn().mockResolvedValue({ bspMessageId: 'msg-1', status: 'submitted' });

jest.mock('../src/services/llm/tts', () => ({
  isVoiceReplyEligible: jest.fn().mockReturnValue(false),
  synthesizeVoiceNote: jest.fn(),
  uploadVoiceNote: jest.fn(),
}));

jest.mock('../src/services/automation/handover', () => ({
  checkHumanIntent: jest.fn(),
  triggerHandover: jest.fn(),
}));

jest.mock('../src/services/automation/faqMatcher', () => ({
  matchFAQ: jest.fn(),
}));

jest.mock('../src/services/automation/flowMatcher', () => ({
  executeFlow: jest.fn(),
}));

jest.mock('../src/services/automation/agentRouter', () => ({
  routeMessageIntent: jest.fn(),
}));

jest.mock('../src/services/kb/retrieval', () => ({
  retrieveRelevantChunks: jest.fn(),
}));

jest.mock('../src/services/kb/semanticCache', () => ({
  checkSemanticCache: jest.fn().mockResolvedValue(null),
  setSemanticCache: jest.fn(),
}));

jest.mock('../src/services/llm/generator', () => ({
  generateRAGResponse: jest.fn(),
}));

jest.mock('../src/bsp/providerFactory', () => ({
  getBSPProvider: jest.fn(() => ({
    sendSessionMessage: mockSendSessionMessage,
  })),
}));

jest.mock('../src/lib/cache', () => ({
  appCache: { get: jest.fn(), set: jest.fn(), delete: jest.fn() },
}));

jest.mock('../src/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

import { supabaseAdmin } from '../src/lib/supabase';
import { routeMessageIntent } from '../src/services/automation/agentRouter';
import { retrieveRelevantChunks } from '../src/services/kb/retrieval';

function mockFromChain(finalValue: unknown, options?: { limitResolves?: boolean }) {
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockImplementation(() =>
    options?.limitResolves ? Promise.resolve(finalValue) : chain,
  );
  chain.maybeSingle = jest.fn().mockResolvedValue(finalValue);
  chain.single = jest.fn().mockResolvedValue(finalValue);
  chain.insert = jest.fn().mockResolvedValue({ error: null });
  return chain;
}

describe('Automation pipeline branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({ data: true, error: null });
    (supabaseAdmin.from as jest.Mock).mockImplementation(() =>
      mockFromChain({
        data: { created_at: new Date().toISOString() },
        error: null,
      }),
    );
  });

  test('FAQ hit exits before flow matcher follow-ups', async () => {
    (checkHumanIntent as jest.Mock).mockReturnValue(false);
    (executeFlow as jest.Mock).mockResolvedValue({ matched: false });
    (matchFAQ as jest.Mock).mockResolvedValue({ matched: true, answer: 'Our hours are 9-5', faqId: 'faq-1' });

    await processAutomationPipeline('tenant-1', 'conv-1', 'hours?', '+15551234567', 'meta');

    expect(matchFAQ).toHaveBeenCalled();
    expect(routeMessageIntent).not.toHaveBeenCalled();
    expect(triggerHandover).not.toHaveBeenCalled();
  });

  test('flow hit sends reply path without FAQ', async () => {
    (checkHumanIntent as jest.Mock).mockReturnValue(false);
    (executeFlow as jest.Mock).mockResolvedValue({ matched: true, replyText: 'Flow reply' });

    await processAutomationPipeline('tenant-1', 'conv-1', 'hello', '+15551234567', 'meta');

    expect(executeFlow).toHaveBeenCalled();
    expect(matchFAQ).not.toHaveBeenCalled();
  });

  test('human intent triggers handover', async () => {
    (checkHumanIntent as jest.Mock).mockReturnValue(true);

    await processAutomationPipeline('tenant-1', 'conv-1', 'talk to agent', '+15551234567', 'meta');

    expect(triggerHandover).toHaveBeenCalledWith(
      'tenant-1',
      'conv-1',
      'explicit_request',
      'talk to agent',
    );
    expect(executeFlow).not.toHaveBeenCalled();
  });

  test('empty KB retrieval triggers handover', async () => {
    (checkHumanIntent as jest.Mock).mockReturnValue(false);
    (executeFlow as jest.Mock).mockResolvedValue({ matched: false });
    (matchFAQ as jest.Mock).mockResolvedValue({ matched: false });
    (routeMessageIntent as jest.Mock).mockResolvedValue({
      categories: ['knowledge'],
      rewrittenQuery: 'refund policy',
      normalizedKeywords: [],
    });
    (retrieveRelevantChunks as jest.Mock).mockResolvedValue([]);

    (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'tenants') {
        return mockFromChain({ data: { business_name: 'Acme', ai_settings: {} }, error: null });
      }
      if (table === 'tenant_bsp_config') {
        return mockFromChain({ data: { access_token_encrypted: null }, error: null });
      }
      if (table === 'messages') {
        return mockFromChain({
          data: [{ direction: 'inbound', content: 'refund?' }],
          error: null,
        }, { limitResolves: true });
      }
      return mockFromChain({ data: null, error: null });
    });

    await processAutomationPipeline('tenant-1', 'conv-1', 'refund?', '+15551234567', 'meta');

    expect(triggerHandover).toHaveBeenCalled();
  });
});

describe('sendBotReply', () => {
  test('skips send when outside 24h window', async () => {
    (supabaseAdmin.from as jest.Mock).mockImplementation(() =>
      mockFromChain({
        data: { created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() },
        error: null,
      }),
    );

    await sendBotReply('tenant-1', 'conv-1', '+15551234567', 'meta', 'hello', 'faq');

    expect(mockSendSessionMessage).not.toHaveBeenCalled();
  });
});
