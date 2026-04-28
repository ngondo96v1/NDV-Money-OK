import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function fixUser6745() {
  console.log("--- SỬA LẠI DỮ LIỆU USER 6745 ---");
  
  // Settling on NDV4 as the primary with 5,000,000 (3 + 1 + 1)
  const { error: err1 } = await supabase
    .from('loans')
    .update({ amount: 5000000, updatedAt: Date.now(), status: 'ĐANG NỢ' })
    .eq('id', '6745NDV4');

  // Ensuring others are marked correctly
  const { error: err2 } = await supabase
    .from('loans')
    .update({ status: 'ĐÃ CỘNG DỒN', consolidatedInto: '6745NDV4' })
    .in('id', ['6745NDV3', '6745NDV5']);

  if (!err1 && !err2) {
    console.log("✅ Đã sửa User 6745 thành công: NDV4 = 5,000,000 đ. Các khoản khác đã được gộp.");
  } else {
    console.error("Lỗi fix:", err1, err2);
  }
}

fixUser6745();
