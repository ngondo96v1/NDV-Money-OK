import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function resetSystem() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase credentials in .env");
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log("--- STARTING SYSTEM RESET V2 ---");

  // 1. Delete all budget logs
  console.log("1. Deleting all budget logs...");
  const { error: deleteLogsError } = await supabase.from('budget_logs').delete().neq('id', 'placeholder');
  if (deleteLogsError) {
    console.error("Error deleting logs:", deleteLogsError);
  }

  // 2. Set stats based on user request
  const INITIAL_CAPITAL = 34000000;
  
  // 3. Update config table
  const configUpdates = [
    { key: 'SYSTEM_BUDGET', value: INITIAL_CAPITAL.toString() },
    { key: 'TOTAL_LOAN_PROFIT', value: '0' },
    { key: 'TOTAL_RANK_PROFIT', value: '0' },
    { key: 'MONTHLY_STATS', value: '[]' },
    { key: 'MIN_SYSTEM_BUDGET', value: '1000000' },
    { key: 'MIN_LOAN_AMOUNT', value: '1000000' }
  ];

  for (const update of configUpdates) {
    await supabase.from('config').upsert(update, { onConflict: 'key' });
  }

  // 4. Create an initial budget log with type INITIAL for Dashboard recognition
  console.log("4. Creating initial budget log...");
  await supabase.from('budget_logs').insert([{
    id: `INITIAL_${Date.now()}`,
    type: 'INITIAL',
    amount: INITIAL_CAPITAL,
    balanceAfter: INITIAL_CAPITAL,
    note: `Khôi phục hệ thống: Vốn ban đầu 34tr`,
    createdAt: new Date().toISOString()
  }]);

  console.log("--- SYSTEM RESET COMPLETED ---");
}

resetSystem();
