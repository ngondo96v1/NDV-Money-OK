
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function listData() {
  const { data: users } = await supabase.from('users').select('id, phone, fullName');
  const { data: loans } = await supabase.from('loans').select('id, userId, userName, status');
  
  console.log("--- USERS ---");
  console.log(JSON.stringify(users, null, 2));
  console.log("--- LOANS ---");
  console.log(JSON.stringify(loans, null, 2));
}

listData();
