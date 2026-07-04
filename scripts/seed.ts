import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedData() {
  const email = process.argv[2];

  if (!email) {
    console.log('Usage: npx tsx scripts/seed.ts <user_email>');
    process.exit(1);
  }

  console.log(`\n🌱 Seeding dummy conversation for user ${email}...`);

  try {
    // 1. Find user's tenant
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) throw userError;
    
    const user = users.users.find(u => u.email === email);
    if (!user) throw new Error("User not found");

    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!tenantUser) throw new Error("User does not belong to a tenant");

    const tenantId = tenantUser.tenant_id;

    // 2. Create Conversation
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .insert({
        tenant_id: tenantId,
        customer_phone: '+919876543210',
        customer_name: 'Priya Sharma',
        status: 'handover_pending',
        last_message_at: new Date().toISOString()
      })
      .select()
      .single();

    if (convError) throw convError;

    // 3. Create Messages
    const { error: msgError } = await supabase
      .from('messages')
      .insert([
        {
          conversation_id: conv.id,
          tenant_id: tenantId,
          direction: 'inbound',
          message_type: 'text',
          content: 'Hi, I need help with my recent order.',
          sender: 'customer'
        },
        {
          conversation_id: conv.id,
          tenant_id: tenantId,
          direction: 'outbound',
          message_type: 'text',
          content: 'Sure! What is your order number?',
          sender: 'bot'
        },
        {
          conversation_id: conv.id,
          tenant_id: tenantId,
          direction: 'inbound',
          message_type: 'text',
          content: 'Actually can I speak to a human? I have a complex question.',
          sender: 'customer'
        }
      ]);

    if (msgError) throw msgError;

    console.log(`\n🎉 Success! Dummy conversation seeded. Refresh your Inbox!\n`);

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message || error);
  }
}

seedData();
