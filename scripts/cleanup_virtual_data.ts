
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function cleanup() {
  console.log("Starting data cleanup...");

  // 1. Delete "Accumulated" loans (virtual data)
  console.log("Deleting accumulated loans...");
  const { error: loanError } = await supabase
    .from('loans')
    .delete()
    .eq('status', 'ĐÃ CỘNG DỒN');
  
  if (loanError) console.error("Error deleting loans:", loanError);
  else console.log("Deleted accumulated loans successfully.");

  // 2. Clear notifications
  console.log("Cleaning notifications...");
  await supabase.from('notifications').delete().neq('id', 'placeholder');

  // 3. Clear logs
  console.log("Cleaning logs...");
  await supabase.from('logs').delete().neq('id', 'placeholder');

  console.log("Cleanup finished.");
}

cleanup();
