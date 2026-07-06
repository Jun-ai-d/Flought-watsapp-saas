import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function makeAdmin() {
  console.log('Fetching users...');
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
  
  if (usersError) {
    console.error('Error fetching users:', usersError);
    return;
  }

  if (users.length === 0) {
    console.log('No users found in auth.users.');
    return;
  }

  // Make all existing users platform admins for local dev
  for (const user of users) {
    const { error } = await supabase
      .from('platform_admins')
      .upsert({ user_id: user.id }, { onConflict: 'user_id' });
      
    if (error) {
      console.error(`Error making user ${user.email} an admin:`, error);
    } else {
      console.log(`✅ User ${user.email} is now a Platform Admin!`);
    }
  }
}

makeAdmin();
