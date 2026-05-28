import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log("---- DETAILED LOANS LIST ----");
  const { data: loans } = await client.from('loans').select('*');
  const { data: users } = await client.from('users').select('id, fullName');
  
  if (!loans) {
    console.error("No loans data found.");
    return;
  }
  
  loans.forEach((l: any) => {
    const user = users?.find(u => u.id === l.userId);
    console.log(`ID: "${l.id}" | User: ${user?.fullName || 'N/A'} (ID: ${l.userId}) | Status: ${l.status} | Amt: ${l.amount} | PrincipalPaymentCount: ${l.principalPaymentCount} | ExtensionCount: ${l.extensionCount} | PartialPaymentCount: ${l.partialPaymentCount} | OriginalBaseId: "${l.originalBaseId}" | Date: ${l.date}`);
  });
}

run();
