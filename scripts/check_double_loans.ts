import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkAllUsers() {
  const { data: activeLoans } = await supabase
    .from('loans')
    .select('*')
    .in('status', ['ĐANG NỢ', 'QUÁ HẠN', 'ĐANG GIẢI NGÂN', 'CHỜ TẤT TOÁN']);

  const groups: { [key: string]: any[] } = {};
  activeLoans?.forEach(l => {
    if (!groups[l.userId]) groups[l.userId] = [];
    groups[l.userId].push(l);
  });

  for (const userId in groups) {
    if (groups[userId].length > 1) {
      console.log(`User ${userId} still has ${groups[userId].length} active loans:`);
      console.table(groups[userId].map(l => ({ id: l.id, amount: l.amount, status: l.status })));
    }
  }
}

checkAllUsers();
