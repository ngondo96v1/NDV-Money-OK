import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function inspectUser6745() {
  console.log("--- CHI TIẾT KHOẢN VAY USER 6745 ---");
  const { data: loans } = await supabase.from('loans').select('*').eq('userId', '6745');
  console.log(JSON.stringify(loans, null, 2));
}

inspectUser6745();
