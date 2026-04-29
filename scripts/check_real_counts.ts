import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRealCounts() {
  const { data: users, error: userError } = await supabase.from('users').select('id, phone, fullName, isAdmin');
  const { data: loans, error: loanError } = await supabase.from('loans').select('id, userId, status, amount');

  if (userError || loanError) {
    console.error('Error fetching data:', userError || loanError);
    return;
  }

  const realUsers = users.filter(u => !u.isAdmin);
  const activeLoans = loans.filter(l => !['ĐÃ TẤT TOÁN', 'BỊ TỪ CHỐI', 'ĐÃ HUỶ', 'ĐÃ CỘNG DỒN'].includes(l.status));

  console.log('--- USER REPORT ---');
  console.log(`Total non-admin users: ${realUsers.length}`);
  realUsers.forEach(u => console.log(`- ${u.fullName} (${u.phone}) [${u.id}]`));

  console.log('\n--- LOAN REPORT ---');
  console.log(`Total active loans: ${activeLoans.length}`);
  activeLoans.forEach(l => {
    const user = users.find(u => u.id === l.userId);
    console.log(`- ${l.id}: ${l.amount.toLocaleString()} đ [${l.status}] - User: ${user?.fullName}`);
  });
}

checkRealCounts();
