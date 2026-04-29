
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function finalDataSync() {
  console.log("--- FINAL DATA SYNC & CLEANUP ---");

  // 1. Get real data
  const { data: users } = await supabase.from('users').select('*');
  const { data: loans } = await supabase.from('loans').select('*');
  const { data: settingsArr } = await supabase.from('settings').select('*');
  
  const settings = settingsArr?.reduce((acc: any, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {});

  if (!users || !loans || !settings) return;

  console.log(`Found ${users.length} users and ${loans.length} loans.`);

  // 2. Calculate Real Profits
  let realRankProfit = 0;
  const upgradePercent = Number(settings.UPGRADE_PERCENT || 15);
  const rankConfig = settings.RANK_CONFIG || [];

  users.forEach(u => {
    if (u.isAdmin || u.phone === 'admin' || !u.phone) return;
    if (u.rank && u.rank !== 'DỒNG' && u.rankApproved !== false) {
      const r = rankConfig.find((rc: any) => rc.id === u.rank);
      if (r) {
        realRankProfit += (r.maxLimit * (upgradePercent / 100));
      }
    }
  });

  let realLoanProfit = 0;
  const feePercent = Number(settings.PRE_DISBURSEMENT_FEE || 15) / 100;
  loans.forEach(l => {
    if (['ĐANG NỢ', 'ĐÃ TẤT TOÁN', 'CHỜ TẤT TOÁN', 'ĐANG ĐỐI SOÁT'].includes(l.status)) {
      realLoanProfit += (l.amount * feePercent);
    }
  });

  console.log(`Calculated Real Profits - Rank: ${realRankProfit}, Loan: ${realLoanProfit}`);

  // 3. Update Settings
  await supabase.from('settings').upsert({ key: 'TOTAL_RANK_PROFIT', value: realRankProfit });
  await supabase.from('settings').upsert({ key: 'TOTAL_LOAN_PROFIT', value: realLoanProfit });
  
  // 4. Reset Monthly Stats to reflect current reality only
  const now = new Date();
  const monthKey = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
  const monthlyStats = [{
    month: monthKey,
    rankProfit: realRankProfit,
    loanProfit: realLoanProfit,
    totalProfit: realRankProfit + realLoanProfit
  }];
  await supabase.from('settings').upsert({ key: 'MONTHLY_STATS', value: monthlyStats });

  console.log("Database statistics synchronized with real data.");
}

finalDataSync();
