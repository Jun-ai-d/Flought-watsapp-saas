import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === 'junaid7798@gmail.com');
  if (!user) return console.log('User not found');
  
  const { data: tenantUser } = await supabase.from('tenant_users').select('tenant_id').eq('user_id', user.id).single();
  if (!tenantUser) return console.log('Tenant user not found');
  
  const { error } = await supabase.from('tenant_bsp_config').insert({
    tenant_id: tenantUser.tenant_id,
    bsp_provider: 'gupshup',
    waba_id: 'Flought-WABA-ID',
    phone_number_id: 'Flought-WABA-ID',
    access_token_encrypted: 'dummy_encrypted_token',
    webhook_verify_token: 'test-signature'
  });
  
  if (error) console.error(error);
  else console.log('✅ Inserted tenant_bsp_config');
  
  process.exit(0);
}

main();
