import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { Database } from '../src/types/supabase';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

async function processInvites() {
  console.log(`\n🔍 Checking for pending agent invitations...`);

  try {
    // Fetch pending invites
    const { data: invites, error: fetchError } = await supabase
      .from('agent_invitations')
      .select('*')
      .eq('status', 'pending');

    if (fetchError) throw fetchError;

    if (!invites || invites.length === 0) {
      console.log('✅ No pending invitations found.');
      return;
    }

    console.log(`Found ${invites.length} pending invitations. Processing...`);

    for (const invite of invites) {
      console.log(`\nProcessing invite for ${invite.email} (Tenant: ${invite.tenant_id})`);
      
      try {
        // 1. Send invite via Supabase Auth
        // Note: For this to actually send an email, email provider must be configured.
        // Otherwise, it just creates the user in the database.
        const { data: authData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(invite.email);
        
        if (inviteError) {
          // If the user already exists, Supabase throws an error (or we can just query users).
          // For simplicity, we assume they might exist and try to fetch them.
          if (inviteError.message.includes('already exists')) {
             console.log(`User ${invite.email} already exists. Linking them instead.`);
          } else {
             throw inviteError;
          }
        }
        
        // Find the user ID
        const { data: users, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;
        
        const user = users.users.find(u => u.email === invite.email);
        if (!user) throw new Error("User could not be found or created.");

        // 2. Link user in tenant_users
        // Check if already linked
        const { data: existingLink } = await supabase
          .from('tenant_users')
          .select('id')
          .eq('tenant_id', invite.tenant_id)
          .eq('user_id', user.id)
          .single();

        if (!existingLink) {
          const { error: linkError } = await supabase
            .from('tenant_users')
            .insert({
              tenant_id: invite.tenant_id,
              user_id: user.id,
              role: invite.role
            });
          
          if (linkError) throw linkError;
        }

        // 3. Mark invite as processed
        await supabase
          .from('agent_invitations')
          .update({ status: 'processed' })
          .eq('id', invite.id);

        console.log(`✅ Successfully processed invite for ${invite.email}`);

      } catch (err: any) {
        console.error(`❌ Failed to process invite for ${invite.email}: ${err.message}`);
        // Mark invite as failed
        await supabase
          .from('agent_invitations')
          .update({ 
            status: 'failed',
            error_details: err.message
          })
          .eq('id', invite.id);
      }
    }

    console.log(`\n🎉 Finished processing invitations.\n`);

  } catch (error: any) {
    console.error(`\n❌ Fatal Error:`, error.message || error);
  }
}

processInvites();
