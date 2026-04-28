import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function hardReset() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase credentials in .env");
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log("--- BẮT ĐẦU XOÁ DỮ LIỆU TÀI CHÍNH ---");

  // 1. Xoá Log Thu/Chi
  console.log("1. Đang xoá Log Thu/Chi...");
  const { error: logsError } = await supabase.from('budget_logs').delete().neq('id', 'KEEP_NONE_PLEASE');
  if (logsError) console.error("Lỗi xoá log:", logsError);

  // 2. Reset các chỉ số trong config
  console.log("2. Đang đặt lại các chỉ số counters về 0...");
  const keysToReset = [
    'SYSTEM_BUDGET', 
    'TOTAL_LOAN_PROFIT', 
    'TOTAL_RANK_PROFIT', 
    'MONTHLY_STATS'
  ];

  for (const key of keysToReset) {
    const { error } = await supabase.from('config').upsert({ key, value: key === 'MONTHLY_STATS' ? '[]' : '0' }, { onConflict: 'key' });
    if (error) console.error(`Lỗi reset ${key}:`, error);
  }

  console.log("--- ĐÃ XOÁ HẾT DỮ LIỆU TÀI CHÍNH ---");
  console.log("Bây giờ bạn có thể vào Cài đặt -> Điều chỉnh vốn, chọn 'Vốn ban đầu' để nhập lại số vốn.");
}

hardReset();
