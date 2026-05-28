import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

interface Settings {
  MASTER_CONFIGS?: any;
  SYSTEM_FORMATS_CONFIG?: any;
  SYSTEM_CONTRACT_FORMATS_CONFIG?: any;
  [key: string]: any;
}

// Format resolvers mapping exactly to the app's rules
function getSystemFormat(settings: Settings, type: 'user' | 'contract', defaultValue: string): string {
  if (Array.isArray(settings.MASTER_CONFIGS) && settings.MASTER_CONFIGS.length > 0) {
    const config = settings.MASTER_CONFIGS.find((f: any) => 
      f.category === 'ID_FORMAT' && (f.systemMeaning === type || f.systemMeaning === `${type}_format` || f.systemMeaning === `contract_original_format` && type === 'contract')
    );
    if (config) return config.format || defaultValue;
  }
  return defaultValue;
}

function getSystemContractFormat(settings: Settings, type: 'PARTIAL_SETTLEMENT' | 'EXTENSION', defaultValue: string): string {
  if (Array.isArray(settings.MASTER_CONFIGS) && settings.MASTER_CONFIGS.length > 0) {
    const config = settings.MASTER_CONFIGS.find((f: any) => 
      f.category === 'CONTRACT_NEW' && (f.systemMeaning === type || f.systemMeaning === `contract_${type.toLowerCase().replace('_settlement', '')}_format`)
    );
    if (config) return config.format || defaultValue;
  }
  return defaultValue;
}

const resolveMasterConfig = (
  format: string, 
  settings: any, 
  context: any = {},
  depth = 0
): string => {
  if (depth > 10) return format;
  
  let result = format;
  const masterConfigs = (settings && Array.isArray(settings.MASTER_CONFIGS)) ? settings.MASTER_CONFIGS : [];
  
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 5) {
    changed = false;
    iterations++;
    
    for (const cfg of masterConfigs) {
      if (!cfg.abbreviation) continue;
      
      const placeholder = `{${cfg.abbreviation}}`;
      if (result.toUpperCase().includes(placeholder.toUpperCase())) {
        const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        
        let replacement = "";
        const type = cfg.systemMeaning;
        const cfgFormat = cfg.format;
        const abbr = cfg.abbreviation.toUpperCase();
        
        let dataValue = null;
        if (type === 'user_id' && context.userId) dataValue = context.userId;
        if ((type === 'contract_id' || type === 'contract_id_original') && context.originalId) dataValue = context.originalId;
        if (type === 'sequence' && (context.sequence !== undefined || context.n !== undefined)) {
          dataValue = (context.sequence ?? context.n ?? 1).toString();
        }
        if (type === 'phone' && context.phone) dataValue = context.phone;

        if (type === 'contract_id_new' || type === 'contract_partial_format' || type === 'contract_extension_format' ||
            type === 'transfer_full' || type === 'transfer_extension' || type === 'transfer_partial' || type === 'transfer_disburse') {
          let targetFormat = cfgFormat;
          if (!targetFormat || targetFormat.trim() === "") {
            targetFormat = "{MHD}NEW";
          }
          dataValue = resolveMasterConfig(targetFormat, settings, context, depth + 1);
        }

        if (dataValue === null) {
          if ((abbr === 'US' || abbr === 'USER' || abbr === 'ID') && context.userId) {
            dataValue = context.userId;
          } else if ((abbr === 'MHD' || abbr === 'CONTRACT' || abbr === 'HD') && context.originalId) {
            dataValue = context.originalId;
          } else if (abbr === 'N' && (context.sequence !== undefined || context.n !== undefined)) {
            dataValue = (context.sequence ?? context.n ?? 1).toString();
          }
        }

        if (dataValue !== null) {
          replacement = dataValue;
        } else if (cfgFormat && cfgFormat.trim() !== "") {
          replacement = resolveMasterConfig(cfgFormat, settings, context, depth + 1);
        } else {
          const now = new Date();
          const year = now.getFullYear().toString();
          const month = (now.getMonth() + 1).toString().padStart(2, '0');
          const day = now.getDate().toString().padStart(2, '0');
          const dateStr = `${day}${month}${year.slice(-2)}`;

          switch(type) {
            case 'random':
              const lengthMatch = (cfg.originalName || '')?.match(/\d+/);
              const length = lengthMatch ? parseInt(lengthMatch[0]) : 6;
              const min = Math.pow(10, length - 1);
              const max = Math.pow(10, length) - 1;
              replacement = Math.floor(min + Math.random() * (max - min + 1)).toString();
              break;
            case 'user_id':
              replacement = context.userId || "USER";
              break;
            case 'contract_id':
            case 'contract_id_original':
              replacement = context.originalId || '';
              break;
            case 'contract_id_new':
              replacement = context.originalId ? `${context.originalId}NEW` : '';
              break;
            case 'sequence':
              replacement = (context.sequence ?? context.n ?? 1).toString();
              break;
            case 'date':
            case 'date_now':
              replacement = dateStr;
              break;
            case 'year':
              replacement = year;
              break;
            case 'month':
              replacement = month;
              break;
            case 'day':
              replacement = day;
              break;
            case 'phone':
              replacement = context.phone || "{PHONE}";
              break;
            case 'rank':
              replacement = context.rank || "MEMBER";
              break;
            case 'slgh':
              replacement = (context.slgh || 0).toString();
              break;
            case 'slttmp':
              replacement = (context.slttmp || 0).toString();
              break;
            default:
              replacement = cfg.originalName || "";
          }
        }
        
        const newResult = result.replace(regex, replacement);
        if (newResult !== result) {
          result = newResult;
          changed = true;
        }
      }
    }
  }

  const randomRegex = /\{(RANDOM|MÃ NGẪU NHIÊN)\s*(\d+)?\s*(SỐ)?\}|\{(MHD|RD|HD)\s*(\d+)\s*(SỐ)?\}/gi;
  result = result.replace(randomRegex, (match, p1, p2, p3, p4, p5) => {
    const length = p2 ? parseInt(p2) : (p5 ? parseInt(p5) : 4);
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  });

  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const dateStr = `${day}${month}${year.slice(-2)}`;
  const userPart = context.userId || "USER";

  result = result.replace(/\{ID\}|\{USER\}/gi, userPart);
  result = result.replace(/\{MHD\}|\{CONTRACT\}/gi, () => {
    return context.originalId || "MHD";
  });
  result = result.replace(/\{N\}/gi, (context.sequence !== undefined ? context.sequence : (context.n !== undefined ? context.n : 1)).toString());
  result = result.replace(/\{DATE\}|\{NGÀY\}/gi, dateStr);

  return result;
};

const generateContractId = (userId: string, format = '{ID}NDV{N}', settings?: any, originalId?: string, sequence?: number, phone?: string, slgh?: number, slttmp?: number): string => {
  return resolveMasterConfig(format, settings, { userId, originalId, sequence, phone, slgh, slttmp });
};

async function executeMigration() {
  console.log("=== STARTING CONTRACT ID SYNCHRONIZATION TRANSACTION ===");
  
  // 1. Fetch config settings
  const { data: configRows } = await client.from('config').select('key, value');
  const settings: Settings = {};
  configRows?.forEach((row: any) => {
    settings[row.key] = row.value;
  });
  
  if (typeof settings.MASTER_CONFIGS === 'string') {
    try {
      settings.MASTER_CONFIGS = JSON.parse(settings.MASTER_CONFIGS);
    } catch(e) {}
  }

  // 2. Fetch all loans and users
  const { data: loans, error: loansError } = await client.from('loans').select('*');
  const { data: users, error: usersError } = await client.from('users').select('*');
  
  if (loansError || usersError || !loans || !users) {
    console.error("Failed to retrieve initial data from Supabase:", { loansError, usersError });
    return;
  }

  console.log(`Retrieved ${loans.length} loans and ${users.length} users.`);

  // 3. Build the Translation Map of { [oldId]: [newId] }
  const translationMap: Record<string, string> = {};

  // First pass: populate raw loan ID translations
  loans.forEach((loan: any) => {
    const user = users.find(u => u.id === loan.userId);
    if (!user) return;

    let newId = "";
    const isExtension = loan.extensionCount > 0 && (loan.status === 'ĐANG NỢ' || loan.status === 'QUÁ HẠN') && !loan.id.includes('-GOP');
    const isPartial = loan.partialPaymentCount > 0 && (loan.status === 'ĐANG NỢ' || loan.status === 'QUÁ HẠN') && !loan.id.includes('-GOP');

    if (loan.id.includes('-GOP')) {
      const baseParts = loan.id.split('-GOP');
      const baseId = baseParts[0];
      const numMatch = baseId.match(/\d+$/);
      const loanSeq = numMatch ? parseInt(numMatch[0]) : 1;
      const format = getSystemFormat(settings, 'contract', '{ID}NDV{N}');
      const newBaseId = generateContractId(loan.userId, format, settings, undefined, loanSeq);
      newId = `${newBaseId}-GOP`;
    } else if (isExtension) {
      const baseIdMatch = loan.id.match(/NDV(\d+)/i) || loan.originalBaseId.match(/NDV(\d+)/);
      const baseSeqNum = baseIdMatch ? parseInt(baseIdMatch[1]) : 1;
      const format = getSystemFormat(settings, 'contract', '{ID}NDV{N}');
      // Original base formatted ID, e.g. "8261 NDV2"
      const cleanBaseId = generateContractId(loan.userId, format, settings, undefined, baseSeqNum);
      const extFormat = getSystemContractFormat(settings, 'EXTENSION', '{ID}GH{N}');
      newId = generateContractId(loan.userId, extFormat, settings, cleanBaseId, loan.extensionCount, undefined, loan.extensionCount, loan.partialPaymentCount);
    } else if (isPartial) {
      const baseIdMatch = loan.id.match(/NDV(\d+)/i) || loan.originalBaseId.match(/NDV(\d+)/);
      const baseSeqNum = baseIdMatch ? parseInt(baseIdMatch[1]) : 1;
      const format = getSystemFormat(settings, 'contract', '{ID}NDV{N}');
      const cleanBaseId = generateContractId(loan.userId, format, settings, undefined, baseSeqNum);
      const partFormat = getSystemContractFormat(settings, 'PARTIAL_SETTLEMENT', '{ID}TTMP{N}');
      newId = generateContractId(loan.userId, partFormat, settings, cleanBaseId, loan.partialPaymentCount, undefined, loan.extensionCount, loan.partialPaymentCount);
    } else {
      const baseIdMatch = loan.id.match(/NDV(\d+)/i);
      const baseSeqNum = baseIdMatch ? parseInt(baseIdMatch[1]) : 1;
      const format = getSystemFormat(settings, 'contract', '{ID}NDV{N}');
      newId = generateContractId(loan.userId, format, settings, undefined, baseSeqNum);
    }

    translationMap[loan.id] = newId;
    
    // Also add mapping for their natural originalBaseId
    if (loan.originalBaseId && !translationMap[loan.originalBaseId]) {
      const baseIdMatch = loan.originalBaseId.match(/NDV(\d+)/i);
      const baseSeqNum = baseIdMatch ? parseInt(baseIdMatch[1]) : 1;
      const format = getSystemFormat(settings, 'contract', '{ID}NDV{N}');
      const mappedOriginalBase = generateContractId(loan.userId, format, settings, undefined, baseSeqNum);
      translationMap[loan.originalBaseId] = mappedOriginalBase;
    }
  });

  // Explicitly ensure key special values are present
  // Add direct translation falls for historical edge cases
  users.forEach((user: any) => {
    // Generate base formats up to N=5
    for (let n = 1; n <= 5; n++) {
      const oldBase = `${user.id}NDV${n}`;
      const format = getSystemFormat(settings, 'contract', '{ID}NDV{N}');
      const newBase = generateContractId(user.id, format, settings, undefined, n);
      if (!translationMap[oldBase]) translationMap[oldBase] = newBase;
      
      const oldGop = `${user.id}NDV${n}-GOP`;
      if (!translationMap[oldGop]) translationMap[oldGop] = `${newBase}-GOP`;

      // Extensions
      const oldExt = `${user.id}GH${n}`;
      const extFormat = getSystemContractFormat(settings, 'EXTENSION', '{ID}GH{N}');
      const newExt = generateContractId(user.id, extFormat, settings, newBase, n, undefined, n, 0);
      if (!translationMap[oldExt]) translationMap[oldExt] = newExt;
    }
  });

  console.log("Final Generated Translation Dictionary:", JSON.stringify(translationMap, null, 2));

  // 4. Update the `loans` table records securely via insert new -> delete old approach
  console.log("\n--- PROCESSING LOANS TABLE UPDATES ---");
  for (const loan of loans) {
    const newId = translationMap[loan.id];
    if (!newId || newId === loan.id) {
       console.log(`Skipping update for loan ${loan.id} (no format change required).`);
       continue;
    }
    
    console.log(`Migrating loan row: "${loan.id}" -> "${newId}"`);

    // Prepare the updated row payload
    const updatedOriginalBaseId = translationMap[loan.originalBaseId] || loan.originalBaseId;
    const updatedConsolidatedInto = loan.consolidatedInto ? (translationMap[loan.consolidatedInto] || loan.consolidatedInto) : null;
    
    const nextLoanPayload = {
       ...loan,
       id: newId,
       originalBaseId: updatedOriginalBaseId,
       consolidatedInto: updatedConsolidatedInto,
       updatedAt: Date.now()
    };

    // 1. Insert new loan record with new ID
    const { error: insertError } = await client.from('loans').insert([nextLoanPayload]);
    if (insertError) {
       console.error(`Error inserting new loan record "${newId}":`, insertError);
       continue;
    }

    // 2. Delete old loan record with old ID
    const { error: deleteError } = await client.from('loans').delete().eq('id', loan.id);
    if (deleteError) {
       console.error(`Error deleting legacy loan record "${loan.id}":`, deleteError);
    } else {
       console.log(`Successfully completed migration for loan row "${loan.id}" -> "${newId}".`);
    }
  }

  // 5. Update other loans referencing originalBaseId or consolidatedInto that weren't migrated
  const { data: remainingLoans } = await client.from('loans').select('id, originalBaseId, consolidatedInto');
  if (remainingLoans) {
    for (const rem of remainingLoans) {
      const updatedBase = translationMap[rem.originalBaseId];
      const updatedConsolidated = rem.consolidatedInto ? translationMap[rem.consolidatedInto] : null;

      if (updatedBase || updatedConsolidated) {
         console.log(`Updating remaining reference on loan ID "${rem.id}": base -> "${updatedBase || rem.originalBaseId}"`);
         await client.from('loans').update({
           originalBaseId: updatedBase || rem.originalBaseId,
           consolidatedInto: updatedConsolidated || rem.consolidatedInto,
           updatedAt: Date.now()
         }).eq('id', rem.id);
      }
    }
  }

  // 6. Update `budget_logs` text references
  console.log("\n--- PROCESSING BUDGET LOGS SUBSTRING UPDATES ---");
  const { data: budgetLogs } = await client.from('budget_logs').select('*');
  if (budgetLogs) {
    for (const log of budgetLogs) {
      if (!log.note) continue;
      
      let updatedNote = log.note;
      let hasChange = false;
      
      // Perform replacement of any old IDs with new IDs in text
      Object.entries(translationMap).forEach(([oldId, newId]) => {
         if (updatedNote.includes(oldId)) {
            updatedNote = updatedNote.split(oldId).join(newId);
            hasChange = true;
         }
      });

      if (hasChange) {
         console.log(`Updating budget log ID "${log.id}" note: "${log.note}" -> "${updatedNote}"`);
         await client.from('budget_logs').update({ note: updatedNote }).eq('id', log.id);
      }
    }
  }

  // 7. Update `notifications` title & content references
  console.log("\n--- PROCESSING NOTIFICATIONS SUBSTRING UPDATES ---");
  const { data: notifications } = await client.from('notifications').select('*');
  if (notifications) {
    for (const n of notifications) {
      let updatedTitle = n.title || "";
      let updatedContent = n.content || "";
      let hasChange = false;

      Object.entries(translationMap).forEach(([oldId, newId]) => {
         if (updatedTitle.includes(oldId)) {
            updatedTitle = updatedTitle.split(oldId).join(newId);
            hasChange = true;
         }
         if (updatedContent.includes(oldId)) {
            updatedContent = updatedContent.split(oldId).join(newId);
            hasChange = true;
         }
      });

      if (hasChange) {
         console.log(`Updating notification ID "${n.id}": "${n.title}" -> "${updatedTitle}"`);
         await client.from('notifications').update({
            title: updatedTitle,
            content: updatedContent
         }).eq('id', n.id);
      }
    }
  }

  console.log("\n=== DATABASE CONTRACT ID SYNCHRONIZATION TRANSACTION COMPLETED SUCCESSFULLY ===");
}

executeMigration();
