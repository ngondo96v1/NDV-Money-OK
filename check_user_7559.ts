import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function run() {
  const supabase = createClient(url, serviceRoleKey);
  console.log('Fixing user 7559 balance to 2,000,000 in Supabase...');

  const { data, error } = await supabase
    .from('users')
    .update({ balance: 2000000, updatedAt: Date.now() })
    .eq('id', '7559')
    .select();

  if (error) {
    console.error('Error updating user 7559 balance:', error);
  } else {
    console.log('Successfully updated user 7559:', data);
  }
}

run();
