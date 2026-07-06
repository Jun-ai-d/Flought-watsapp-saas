import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';

export interface ApiAuthRequest extends Request {
  tenantId?: string;
}

export const requireApiKey = async (req: ApiAuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer sk_live_')) {
    return res.status(401).json({ error: 'Missing or invalid API key format' });
  }

  const apiKey = authHeader.replace('Bearer ', '');

  try {
    const { data, error } = await supabaseAdmin
      .from('developer_settings')
      .select('tenant_id')
      .eq('api_key', apiKey)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.tenantId = data.tenant_id;
    next();
  } catch (error) {
    console.error('Error validating API key:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
