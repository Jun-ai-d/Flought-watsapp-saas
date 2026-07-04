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

async function provisionTenant() {
  const email = process.argv[2];
  const businessName = process.argv[3];

  if (!email || !businessName) {
    console.log('Usage: npx tsx scripts/provision.ts <user_email> "<business_name>"');
    process.exit(1);
  }

  console.log(`\n🚀 Provisioning tenant "${businessName}" for user ${email}...`);

  try {
    // 1. Find user by email
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) throw userError;
    
    const user = users.users.find(u => u.email === email);
    if (!user) {
      throw new Error(`User with email ${email} not found. Please create them in Supabase Auth first.`);
    }
    console.log(`✅ Found user: ${user.id}`);

    // 2. Create Tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        business_name: businessName,
        status: 'active',
        tier: 'standard'
      })
      .select()
      .single();

    if (tenantError) throw tenantError;
    console.log(`✅ Created tenant: ${tenant.id}`);

    // 3. Link User to Tenant as Admin
    const { error: linkError } = await supabase
      .from('tenant_users')
      .insert({
        tenant_id: tenant.id,
        user_id: user.id,
        role: 'admin'
      });

    if (linkError) throw linkError;
    console.log(`✅ Linked user as Admin to tenant.`);

    console.log(`\n🎉 Success! The user can now log in and access the dashboard for "${businessName}".\n`);

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message || error);
  }
}

provisionTenant();
