
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const calculateFine = (amount: number, dueDateStr: string, targetDate: Date, fineRate = 0.001, maxFinePercent = 30): number => {
  const [d, m, y] = dueDateStr.split('/').map(Number);
  const dueDate = new Date(y, m - 1, d);
  
  dueDate.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  
  if (targetDate <= dueDate) return 0;
  
  const diffTime = Math.abs(targetDate.getTime() - dueDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return 0;

  let fine = amount * fineRate * diffDays;
  const maxFine = amount * (maxFinePercent / 100); 
  const finalFine = Math.min(fine, maxFine);
  return Math.ceil(finalFine / 1000) * 1000;
};

async function run() {
  // 1. Load settings
  const { data: configData } = await supabase.from('config').select('key, value');
  const settings: any = {};
  configData?.forEach((item: any) => {
    settings[item.key] = item.value;
  });

  const preFee = Number(settings.PRE_DISBURSEMENT_FEE || 10);
  const loanProfit = Number(settings.TOTAL_LOAN_PROFIT || 0);
  const rankProfit = Number(settings.TOTAL_RANK_PROFIT || 0);

  // 2. Load loans
  const { data: loans } = await supabase
    .from('loans')
    .select('*')
    .in('status', ['ĐANG NỢ', 'CHỜ TẤT TOÁN', 'ĐANG ĐỐI SOÁT']);

  if (!loans) {
    console.log('No active loans found.');
    return;
  }

  // Calculate fee for one extension cycle (8 loans)
  let oneCycleFee = 0;
  for (const loan of loans) {
    oneCycleFee += loan.amount * (preFee / 100);
  }

  // Projection:
  // Now: May 7
  // June 1: Extension 1 -> +oneCycleFee
  // July 1: Extension 2 -> +oneCycleFee
  
  const projectedLoanProfit = loanProfit + (oneCycleFee * 2);
  const projectedSystemRevenue = projectedLoanProfit + rankProfit;

  console.log('--- CURRENT STATE (07/05/2026) ---');
  console.log(`Current Loan Profit (Phí & Phạt): ${loanProfit.toLocaleString()} đ`);
  console.log(`Current Rank Profit (Nâng Hạng): ${rankProfit.toLocaleString()} đ`);
  console.log(`Current System Revenue (Doanh Thu): ${(loanProfit + rankProfit).toLocaleString()} đ`);
  
  console.log('\n--- PROJECTION FOR 01/07/2026 ---');
  console.log(`Assumed Fee per Cycle (8 loans): ${oneCycleFee.toLocaleString()} đ`);
  console.log(`Total Projected Loan Profit (Phí & Phạt): ${projectedLoanProfit.toLocaleString()} đ`);
  console.log(`Total Projected System Revenue (Doanh Thu): ${projectedSystemRevenue.toLocaleString()} đ`);
}

run();
