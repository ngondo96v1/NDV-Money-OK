import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PayOS } from "@payos/node";
import rateLimit from "express-rate-limit";
import admin from "firebase-admin";

// Load environment variables as early as possible
dotenv.config();
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Initialize Firebase Admin for Push Notifications
let firebaseApp: admin.app.App | null = null;
try {
  let saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!saJson) {
    const localSaPath = path.resolve(process.cwd(), "firebase-service-account.json");
    if (fs.existsSync(localSaPath)) {
      saJson = fs.readFileSync(localSaPath, 'utf8');
      console.log("[FIREBASE] Loaded Firebase service account config from local firebase-service-account.json file");
    }
  }
  
  if (saJson) {
    let serviceAccount;
    try {
      // Try to parse if it's a JSON string
      serviceAccount = JSON.parse(saJson);
    } catch (e) {
      // If not JSON, try to read as a file path
      if (fs.existsSync(saJson)) {
        serviceAccount = JSON.parse(fs.readFileSync(saJson, 'utf8'));
      }
    }
    
    if (serviceAccount && !admin.apps.length) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("[FIREBASE] Firebase Admin initialized successfully");
    }
  } else {
    console.warn("[FIREBASE] FIREBASE_SERVICE_ACCOUNT_JSON not found. Push notifications will be disabled.");
  }
} catch (error) {
  console.error("[FIREBASE] Failed to initialize Firebase Admin:", error);
}

// Helper to send push notification
const sendPushNotification = async (fcmToken: string, title: string, body: string, data?: any) => {
  if (!firebaseApp || !fcmToken) return false;
  
  try {
    const message = {
      notification: { title, body },
      data: data || {},
      token: fcmToken
    };
    
    const response = await admin.messaging().send(message);
    console.log(`[FIREBASE] Push sent successfully: ${response}`);
    return true;
  } catch (error: any) {
    console.error(`[FIREBASE] Error sending push:`, error);
    
    // Check if error is due to an invalid/not-found FCM token
    const errorString = String(error || "");
    const errorCode = error?.code || "";
    const isNotFoundError = errorString.includes("Requested entity was not found") || 
                            errorString.includes("registration-token-not-registered") ||
                            errorString.includes("invalid-registration-token") ||
                            errorCode.includes("not-found") || 
                            errorCode.includes("not-registered") || 
                            errorCode.includes("invalid-registration-token");
                            
    if (isNotFoundError) {
      console.log(`[FIREBASE] Stale or invalid FCM token detected. Cleaning up from DB...`);
      try {
        const client = initSupabase();
        if (client) {
          const { error: dbErr } = await client
            .from('users')
            .update({ fcmToken: null })
            .eq('fcmToken', fcmToken);
          if (dbErr) {
            console.error(`[FIREBASE] Failed to clear stale FCM token from DB:`, dbErr);
          } else {
            console.log(`[FIREBASE] Stale FCM token cleared from DB successfully.`);
          }
        }
      } catch (dbEx) {
        console.error(`[FIREBASE] Exception while clearing stale FCM token:`, dbEx);
      }
    }
    return false;
  }
};

// Helper to trigger push notification for a specific user
const triggerPushForUser = async (userId: string, title: string, body: string, client: any) => {
  if (!userId || !title || !body || !client) return;
  
  try {
    const { data: user, error } = await client
      .from('users')
      .select('fcmToken')
      .eq('id', userId)
      .single();
      
    if (error) {
      console.error(`[PUSH] User fetch error for ${userId}:`, error);
      return;
    }
    
    if (user?.fcmToken) {
      console.log(`[PUSH] Found token for user ${userId}, sending...`);
      await sendPushNotification(user.fcmToken, title, body);
    } else {
      console.log(`[PUSH] No FCM token found for user ${userId}`);
    }
  } catch (err) {
    console.error(`[PUSH] Unexpected error for user ${userId}:`, err);
  }
};

// Helper to broadcast push notifications to all users with FCM tokens
const broadcastPushNotification = async (title: string, body: string, client: any) => {
  if (!title || !body || !client) return;
  try {
    const { data: users, error } = await client
      .from('users')
      .select('id, fcmToken');
      
    if (error) {
      console.error(`[PUSH] Error fetching users for broadcast:`, error);
      return;
    }
    
    const usersWithTokens = users?.filter((u: any) => u.fcmToken && u.fcmToken.trim() !== '') || [];
    
    if (usersWithTokens.length > 0) {
      console.log(`[PUSH] Broadcasting to ${usersWithTokens.length} users with FCM tokens...`);
      for (const u of usersWithTokens) {
        sendPushNotification(u.fcmToken, title, body).catch(e => {
          console.error(`[PUSH] Broadcast failed for user ${u.id}:`, e);
        });
      }
    }
  } catch (err) {
    console.error(`[PUSH] Unexpected broadcast error:`, err);
  }
};

const CONFIG_PATH = path.resolve(process.cwd(), "config.json");

const loadConfig = () => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    }
  } catch (e) {
    console.error("[CONFIG] Failed to load config.json:", e);
  }
  return {};
};

const saveConfig = (newConfig: any) => {
  try {
    const currentConfig = loadConfig();
    const updatedConfig = { ...currentConfig, ...newConfig };

    // Parse numeric fields if they are present and not empty
    const numericFields = ['PRE_DISBURSEMENT_FEE', 'MAX_EXTENSIONS', 'UPGRADE_PERCENT', 'FINE_RATE', 'MAX_FINE_PERCENT', 'MAX_LOAN_PER_CYCLE', 'MIN_SYSTEM_BUDGET', 'MAX_SINGLE_LOAN_AMOUNT', 'MIN_LOAN_AMOUNT'];
    numericFields.forEach(field => {
      if (updatedConfig[field] !== undefined && updatedConfig[field] !== '') {
        const val = Number(updatedConfig[field]);
        if (!isNaN(val)) {
          updatedConfig[field] = val;
        }
      }
    });

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(updatedConfig, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error("[CONFIG] Failed to save config.json:", e);
    return false;
  }
};

const config = loadConfig();

let SUPABASE_URL = config.SUPABASE_URL || process.env.SUPABASE_URL || "";
let SUPABASE_KEY = config.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

const isValidUrl = (url: string) => {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

const isPlaceholder = (val: string) => 
  !val || val.includes("your-project-id") || val.includes("your-service-role-key") || val === "https://your-project-id.supabase.co";

const getBusinessOp = (settings: any, key: string) => {
  if (!settings) return null;
  return settings.BUSINESS_OPERATIONS_CONFIG?.find((op: any) => op.key === key);
};

// In-memory cache for settings to reduce DB load
let settingsCache: any = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 15 * 60 * 1000; // Increased to 15 minutes for better performance

// Helper to load system settings from Supabase
const loadSystemSettings = async (client: any) => {
  try {
    if (!client) return {};
    
    // Check cache first
    const now = Date.now();
    if (settingsCache && (now - lastCacheUpdate < CACHE_TTL)) {
      return settingsCache;
    }

    const { data, error } = await client.from('config').select('key, value');
    if (error) throw error;
    
    const settings: any = {};
    data.forEach((item: any) => {
      // Only include system settings keys
      const systemKeys = [
        'PAYMENT_ACCOUNT', 'PRE_DISBURSEMENT_FEE', 'MAX_EXTENSIONS', 
        'UPGRADE_PERCENT', 'FINE_RATE', 'MAX_FINE_PERCENT', 
        'MAX_LOAN_PER_CYCLE', 'MIN_SYSTEM_BUDGET', 'MAX_SINGLE_LOAN_AMOUNT', 'INITIAL_LIMIT', 'MIN_LOAN_AMOUNT',
        'IMGBB_API_KEY', 'PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY',
        'APP_URL', 'JWT_SECRET', 'ADMIN_PHONE', 'ADMIN_PASSWORD',
        'CONTRACT_CODE_FORMAT', 'USER_ID_FORMAT', 'ZALO_GROUP_LINK',
        'SYSTEM_NOTIFICATION', 'SHOW_SYSTEM_NOTIFICATION', 'MAINTENANCE_MODE',
        'SYSTEM_BUDGET', 'TOTAL_LOAN_PROFIT', 'TOTAL_FINE_PROFIT', 'TOTAL_RANK_PROFIT', 'MONTHLY_STATS',
        'ENABLE_PAYOS', 'ENABLE_VIETQR', 'LUCKY_SPIN_VOUCHERS', 'LUCKY_SPIN_WIN_RATE',
        'LUCKY_SPIN_PAYMENTS_REQUIRED', 'MAX_ON_TIME_PAYMENTS_FOR_UPGRADE', 'CONTRACT_CLAUSES',
        'RANK_CONFIG', 'SYSTEM_FORMATS_CONFIG', 'BUSINESS_OPERATIONS_CONFIG', 
        'CONTRACT_FORMATS_CONFIG', 'TRANSFER_CONTENTS_CONFIG', 'SYSTEM_CONTRACT_FORMATS_CONFIG', 'MASTER_CONFIGS', 'lastKeepAlive',
        'ENABLE_SIMULATION', 'SIMULATION_INTERVAL', 'SYSTEM_START_DATE',
        'REMINDER_DAYS_BEFORE_DUE', 'AUTO_LOCK_OVERDUE_DAYS',
        'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'ENABLE_TELEGRAM_NOTIF'
      ];
      if (systemKeys.includes(item.key)) {
        if (['MONTHLY_STATS', 'PAYMENT_ACCOUNT', 'LUCKY_SPIN_VOUCHERS', 'RANK_CONFIG', 'SYSTEM_FORMATS_CONFIG', 'BUSINESS_OPERATIONS_CONFIG', 'CONTRACT_FORMATS_CONFIG', 'TRANSFER_CONTENTS_CONFIG', 'SYSTEM_CONTRACT_FORMATS_CONFIG', 'MASTER_CONFIGS', 'CONTRACT_CLAUSES'].includes(item.key)) {
          try {
            settings[item.key] = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
          } catch (e) {
            settings[item.key] = item.value;
          }
        } else if (['SYSTEM_BUDGET', 'TOTAL_LOAN_PROFIT', 'TOTAL_FINE_PROFIT', 'TOTAL_RANK_PROFIT', 'UPGRADE_PERCENT', 'PRE_DISBURSEMENT_FEE', 'MAX_EXTENSIONS', 'FINE_RATE', 'MAX_FINE_PERCENT', 'MAX_LOAN_PER_CYCLE', 'MIN_SYSTEM_BUDGET', 'MAX_SINGLE_LOAN_AMOUNT', 'INITIAL_LIMIT', 'MIN_LOAN_AMOUNT', 'LUCKY_SPIN_WIN_RATE', 'LUCKY_SPIN_PAYMENTS_REQUIRED', 'MAX_ON_TIME_PAYMENTS_FOR_UPGRADE', 'SIMULATION_INTERVAL', 'REMINDER_DAYS_BEFORE_DUE', 'AUTO_LOCK_OVERDUE_DAYS'].includes(item.key)) {
          settings[item.key] = Number(item.value);
        } else if (['ENABLE_PAYOS', 'ENABLE_VIETQR', 'SHOW_SYSTEM_NOTIFICATION', 'MAINTENANCE_MODE', 'ENABLE_SIMULATION', 'ENABLE_TELEGRAM_NOTIF'].includes(item.key)) {
          settings[item.key] = item.value === true || item.value === 'true';
        } else {
          settings[item.key] = item.value;
        }
      }
    });

    settingsCache = settings;
    lastCacheUpdate = now;
    return settings;
  } catch (e) {
    console.error("[CONFIG] Failed to load settings from Supabase:", e);
    return settingsCache || {}; // Return stale cache if DB fails
  }
};

// Helper to get merged settings
const getMergedSettings = async (client: any) => {
  const config = loadConfig();
  const dbSettings = await loadSystemSettings(client);
  
  return {
    SUPABASE_URL: config.SUPABASE_URL || process.env.SUPABASE_URL || "",
    SUPABASE_SERVICE_ROLE_KEY: config.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "",
    IMGBB_API_KEY: dbSettings.IMGBB_API_KEY || config.IMGBB_API_KEY || process.env.VITE_IMGBB_API_KEY || "",
    PAYMENT_ACCOUNT: dbSettings.PAYMENT_ACCOUNT || config.PAYMENT_ACCOUNT || { bankName: "", bankBin: "", accountNumber: "", accountName: "" },
    PRE_DISBURSEMENT_FEE: Number(dbSettings.PRE_DISBURSEMENT_FEE !== undefined ? dbSettings.PRE_DISBURSEMENT_FEE : (config.PRE_DISBURSEMENT_FEE !== undefined ? config.PRE_DISBURSEMENT_FEE : 10)),
    MAX_EXTENSIONS: Number(dbSettings.MAX_EXTENSIONS !== undefined ? dbSettings.MAX_EXTENSIONS : (config.MAX_EXTENSIONS !== undefined ? config.MAX_EXTENSIONS : 3)),
    UPGRADE_PERCENT: Number(dbSettings.UPGRADE_PERCENT !== undefined ? dbSettings.UPGRADE_PERCENT : (config.UPGRADE_PERCENT !== undefined && config.UPGRADE_PERCENT !== "" ? config.UPGRADE_PERCENT : 10)),
    FINE_RATE: Number(dbSettings.FINE_RATE !== undefined ? dbSettings.FINE_RATE : (config.FINE_RATE !== undefined && config.FINE_RATE !== "" ? config.FINE_RATE : 2)),
    MAX_FINE_PERCENT: Number(dbSettings.MAX_FINE_PERCENT !== undefined ? dbSettings.MAX_FINE_PERCENT : (config.MAX_FINE_PERCENT !== undefined && config.MAX_FINE_PERCENT !== "" ? config.MAX_FINE_PERCENT : 30)),
    MAX_LOAN_PER_CYCLE: Number(dbSettings.MAX_LOAN_PER_CYCLE !== undefined ? dbSettings.MAX_LOAN_PER_CYCLE : (config.MAX_LOAN_PER_CYCLE !== undefined ? config.MAX_LOAN_PER_CYCLE : 10000000)),
    MIN_SYSTEM_BUDGET: Number(dbSettings.MIN_SYSTEM_BUDGET !== undefined ? dbSettings.MIN_SYSTEM_BUDGET : (config.MIN_SYSTEM_BUDGET !== undefined ? config.MIN_SYSTEM_BUDGET : 1000000)),
    MAX_SINGLE_LOAN_AMOUNT: Number(dbSettings.MAX_SINGLE_LOAN_AMOUNT !== undefined ? dbSettings.MAX_SINGLE_LOAN_AMOUNT : (config.MAX_SINGLE_LOAN_AMOUNT !== undefined ? config.MAX_SINGLE_LOAN_AMOUNT : 10000000)),
    MIN_LOAN_AMOUNT: Number(dbSettings.MIN_LOAN_AMOUNT !== undefined ? dbSettings.MIN_LOAN_AMOUNT : (config.MIN_LOAN_AMOUNT !== undefined ? config.MIN_LOAN_AMOUNT : 1000000)),
    PAYOS_CLIENT_ID: dbSettings.PAYOS_CLIENT_ID || config.PAYOS_CLIENT_ID || process.env.PAYOS_CLIENT_ID || "",
    PAYOS_API_KEY: dbSettings.PAYOS_API_KEY || config.PAYOS_API_KEY || process.env.PAYOS_API_KEY || "",
    PAYOS_CHECKSUM_KEY: dbSettings.PAYOS_CHECKSUM_KEY || config.PAYOS_CHECKSUM_KEY || process.env.PAYOS_CHECKSUM_KEY || "",
    APP_URL: dbSettings.APP_URL || config.APP_URL || process.env.APP_URL || "",
    JWT_SECRET: dbSettings.JWT_SECRET || config.JWT_SECRET || process.env.JWT_SECRET || "ndv-money-secret-key-2026",
    ADMIN_PHONE: dbSettings.ADMIN_PHONE || config.ADMIN_PHONE || process.env.ADMIN_PHONE || '0877203996',
    ADMIN_PASSWORD: dbSettings.ADMIN_PASSWORD || config.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '119011Ngon',
    CONTRACT_CODE_FORMAT: dbSettings.CONTRACT_CODE_FORMAT || config.CONTRACT_CODE_FORMAT || "HD-{MHD}",
    USER_ID_FORMAT: dbSettings.USER_ID_FORMAT || config.USER_ID_FORMAT || "US-{RANDOM}",
    ZALO_GROUP_LINK: dbSettings.ZALO_GROUP_LINK || config.ZALO_GROUP_LINK || "",
    SYSTEM_NOTIFICATION: dbSettings.SYSTEM_NOTIFICATION || config.SYSTEM_NOTIFICATION || "",
    SHOW_SYSTEM_NOTIFICATION: dbSettings.SHOW_SYSTEM_NOTIFICATION !== undefined ? dbSettings.SHOW_SYSTEM_NOTIFICATION : (config.SHOW_SYSTEM_NOTIFICATION !== undefined ? config.SHOW_SYSTEM_NOTIFICATION : false),
    MAINTENANCE_MODE: dbSettings.MAINTENANCE_MODE !== undefined ? dbSettings.MAINTENANCE_MODE : (config.MAINTENANCE_MODE !== undefined ? config.MAINTENANCE_MODE : false),
    ENABLE_PAYOS: dbSettings.ENABLE_PAYOS !== undefined ? dbSettings.ENABLE_PAYOS : (config.ENABLE_PAYOS !== undefined ? config.ENABLE_PAYOS : true),
    ENABLE_VIETQR: dbSettings.ENABLE_VIETQR !== undefined ? dbSettings.ENABLE_VIETQR : (config.ENABLE_VIETQR !== undefined ? config.ENABLE_VIETQR : true),
    SYSTEM_BUDGET: dbSettings.SYSTEM_BUDGET !== undefined ? dbSettings.SYSTEM_BUDGET : 0,
    TOTAL_LOAN_PROFIT: dbSettings.TOTAL_LOAN_PROFIT !== undefined ? dbSettings.TOTAL_LOAN_PROFIT : 0,
    TOTAL_FINE_PROFIT: dbSettings.TOTAL_FINE_PROFIT !== undefined ? dbSettings.TOTAL_FINE_PROFIT : 0,
    TOTAL_RANK_PROFIT: dbSettings.TOTAL_RANK_PROFIT !== undefined ? dbSettings.TOTAL_RANK_PROFIT : 0,
    MONTHLY_STATS: dbSettings.MONTHLY_STATS || [],
    LUCKY_SPIN_VOUCHERS: dbSettings.LUCKY_SPIN_VOUCHERS || config.LUCKY_SPIN_VOUCHERS || [
      { minProfit: 1000000, voucherValue: 50000 },
      { minProfit: 2000000, voucherValue: 100000 },
      { minProfit: 5000000, voucherValue: 200000 }
    ],
    LUCKY_SPIN_WIN_RATE: dbSettings.LUCKY_SPIN_WIN_RATE !== undefined ? dbSettings.LUCKY_SPIN_WIN_RATE : (config.LUCKY_SPIN_WIN_RATE !== undefined ? config.LUCKY_SPIN_WIN_RATE : 30),
    LUCKY_SPIN_PAYMENTS_REQUIRED: dbSettings.LUCKY_SPIN_PAYMENTS_REQUIRED !== undefined ? dbSettings.LUCKY_SPIN_PAYMENTS_REQUIRED : (config.LUCKY_SPIN_PAYMENTS_REQUIRED !== undefined ? config.LUCKY_SPIN_PAYMENTS_REQUIRED : 3),
    MAX_ON_TIME_PAYMENTS_FOR_UPGRADE: dbSettings.MAX_ON_TIME_PAYMENTS_FOR_UPGRADE !== undefined ? dbSettings.MAX_ON_TIME_PAYMENTS_FOR_UPGRADE : (config.MAX_ON_TIME_PAYMENTS_FOR_UPGRADE !== undefined ? config.MAX_ON_TIME_PAYMENTS_FOR_UPGRADE : 5),
    ENABLE_SIMULATION: dbSettings.ENABLE_SIMULATION !== undefined ? dbSettings.ENABLE_SIMULATION : (config.ENABLE_SIMULATION !== undefined ? config.ENABLE_SIMULATION : true),
    SIMULATION_INTERVAL: Number(dbSettings.SIMULATION_INTERVAL !== undefined ? dbSettings.SIMULATION_INTERVAL : (config.SIMULATION_INTERVAL !== undefined ? config.SIMULATION_INTERVAL : 15)),
    CONTRACT_CLAUSES: dbSettings.CONTRACT_CLAUSES || config.CONTRACT_CLAUSES || null,
    RANK_CONFIG: dbSettings.RANK_CONFIG || config.RANK_CONFIG || [
      { id: 'bronze', name: 'ĐỒNG', minLimit: 1000000, maxLimit: 3000000, color: '#fdba74', features: ['Hạn mức 1 - 3 triệu', 'Ưu tiên duyệt lệnh'] },
      { id: 'silver', name: 'BẠC', minLimit: 1000000, maxLimit: 4000000, color: '#bfdbfe', features: ['Hạn mức 1 - 4 triệu', 'Hỗ trợ 24/7'] },
      { id: 'gold', name: 'VÀNG', minLimit: 1000000, maxLimit: 5000000, color: '#facc15', features: ['Hạn mức 1 - 5 triệu', 'Giảm 10% phí phạt'] },
      { id: 'diamond', name: 'KIM CƯƠNG', minLimit: 1000000, maxLimit: 10000000, color: '#60a5fa', features: ['Hạn mức 1 - 10 triệu', 'Duyệt lệnh tức thì'] }
    ],
    SYSTEM_FORMATS_CONFIG: dbSettings.SYSTEM_FORMATS_CONFIG || config.SYSTEM_FORMATS_CONFIG || [
      { key: 'CONTRACT_CODE_FORMAT', label: 'Định dạng Mã Hợp Đồng', value: "HD-{MHD}", description: 'Dùng {ID}, {VT}, {N}' },
      { key: 'USER_ID_FORMAT', label: 'Định dạng ID User', value: "US-{RANDOM}", description: 'Dùng {RANDOM}, {N}' }
    ],
    BUSINESS_OPERATIONS_CONFIG: dbSettings.BUSINESS_OPERATIONS_CONFIG || config.BUSINESS_OPERATIONS_CONFIG || [
      { 
        key: 'FULL_SETTLEMENT', 
        label: 'Tất toán', 
        abbr: 'TT', 
        original: 'Tất toán',
        type: 'text',
        hasContent: true, 
        hasFormat: false,
        contentKey: 'PAYMENT_CONTENT_FULL_SETTLEMENT',
        placeholders: '{ID}, {MHD}, {USER}'
      },
      { 
        key: 'PARTIAL_SETTLEMENT', 
        label: 'Tất toán 1 phần', 
        abbr: 'TTMP', 
        original: 'Tất toán một phần',
        type: 'text',
        hasContent: true, 
        hasFormat: true,
        contentKey: 'PAYMENT_CONTENT_PARTIAL_SETTLEMENT',
        formatKey: 'CONTRACT_FORMAT_PARTIAL_SETTLEMENT',
        placeholders: '{ID}, {MHD}, {SLTTMP}, {USER}'
      },
      { 
        key: 'EXTENSION', 
        label: 'Gia hạn', 
        abbr: 'GH', 
        original: 'Gia hạn',
        type: 'text',
        hasContent: true, 
        hasFormat: true,
        contentKey: 'PAYMENT_CONTENT_EXTENSION',
        formatKey: 'CONTRACT_FORMAT_EXTENSION',
        placeholders: '{ID}, {MHD}, {SLGH}, {USER}'
      },
      { 
        key: 'UPGRADE', 
        label: 'Nâng hạng', 
        abbr: 'NH', 
        original: 'Nâng hạng',
        type: 'text',
        hasContent: true, 
        hasFormat: false,
        contentKey: 'PAYMENT_CONTENT_UPGRADE',
        placeholders: '{TEN HANG}, {USER}'
      },
      { 
        key: 'DISBURSE', 
        label: 'Giải ngân', 
        abbr: 'GN', 
        original: 'Giải ngân',
        type: 'text',
        hasContent: false, 
        hasFormat: false 
      }
    ],
    CONTRACT_FORMATS_CONFIG: dbSettings.CONTRACT_FORMATS_CONFIG || config.CONTRACT_FORMATS_CONFIG || [],
    TRANSFER_CONTENTS_CONFIG: dbSettings.TRANSFER_CONTENTS_CONFIG || config.TRANSFER_CONTENTS_CONFIG || [
      { key: 'FULL_SETTLEMENT', original: 'Tất toán', abbr: 'TT', value: '{ID}' },
      { key: 'PARTIAL_SETTLEMENT', original: 'TT 1 phần', abbr: 'TTMP', value: 'TTMP {ID}' },
      { key: 'EXTENSION', original: 'Gia hạn', abbr: 'GH', value: 'GH {ID}' },
      { key: 'UPGRADE', original: 'Nâng hạng', abbr: 'NH', value: 'NH {RANK} {ID}' }
    ],
    SYSTEM_CONTRACT_FORMATS_CONFIG: dbSettings.SYSTEM_CONTRACT_FORMATS_CONFIG || config.SYSTEM_CONTRACT_FORMATS_CONFIG || [
      { key: 'PARTIAL_SETTLEMENT', original: 'TT 1 phần', abbr: 'TTMP', value: '{ID}TTMP{N}' },
      { key: 'EXTENSION', original: 'Gia hạn', abbr: 'GH', value: '{ID}GH{N}' }
    ],
    MASTER_CONFIGS: dbSettings.MASTER_CONFIGS || config.MASTER_CONFIGS || [],
    SYSTEM_START_DATE: dbSettings.SYSTEM_START_DATE !== undefined ? dbSettings.SYSTEM_START_DATE : (config.SYSTEM_START_DATE !== undefined ? config.SYSTEM_START_DATE : ""),
    REMINDER_DAYS_BEFORE_DUE: Number(dbSettings.REMINDER_DAYS_BEFORE_DUE !== undefined ? dbSettings.REMINDER_DAYS_BEFORE_DUE : 1),
    AUTO_LOCK_OVERDUE_DAYS: Number(dbSettings.AUTO_LOCK_OVERDUE_DAYS !== undefined ? dbSettings.AUTO_LOCK_OVERDUE_DAYS : 15),
    TELEGRAM_BOT_TOKEN: dbSettings.TELEGRAM_BOT_TOKEN || config.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "",
    TELEGRAM_CHAT_ID: dbSettings.TELEGRAM_CHAT_ID || config.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "",
    ENABLE_TELEGRAM_NOTIF: dbSettings.ENABLE_TELEGRAM_NOTIF !== undefined ? dbSettings.ENABLE_TELEGRAM_NOTIF : (config.ENABLE_TELEGRAM_NOTIF !== undefined ? (config.ENABLE_TELEGRAM_NOTIF === true || config.ENABLE_TELEGRAM_NOTIF === 'true') : (process.env.ENABLE_TELEGRAM_NOTIF !== undefined ? (process.env.ENABLE_TELEGRAM_NOTIF === 'true' || process.env.ENABLE_TELEGRAM_NOTIF === '1') : true))
  };
};

// Helper for Telegram Bot Notifications
const sendTelegramNotification = async (message: string, settings?: any) => {
  try {
    let botToken = process.env.TELEGRAM_BOT_TOKEN || "";
    let chatId = process.env.TELEGRAM_CHAT_ID || "";
    let enabled = true;

    if (settings) {
      if (settings.TELEGRAM_BOT_TOKEN) botToken = settings.TELEGRAM_BOT_TOKEN;
      if (settings.TELEGRAM_CHAT_ID) chatId = settings.TELEGRAM_CHAT_ID;
      if (settings.ENABLE_TELEGRAM_NOTIF !== undefined) {
        enabled = settings.ENABLE_TELEGRAM_NOTIF === true || settings.ENABLE_TELEGRAM_NOTIF === 'true';
      }
    }

    if (!enabled || !botToken || !chatId) {
      console.log("[Telegram] Disabled or missing config (Token/ChatId). Telegram message not sent.");
      return false;
    }

    const payload = {
      chat_id: chatId.trim(),
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };

    console.log(`[Telegram] Sending notification to chat ${chatId}...`);
    const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[Telegram Error] API returned status:", res.status, errBody);
      return false;
    }

    const result = await res.json();
    console.log("[Telegram] Notification sent successfully! Message ID:", result?.result?.message_id);
    return true;
  } catch (error) {
    console.error("[Telegram Error] Failed to send notification:", error);
    return false;
  }
};


// Helper to get PayOS instance
const getPayOS = (settings: any) => {
  return new PayOS({
    clientId: settings.PAYOS_CLIENT_ID || "",
    apiKey: settings.PAYOS_API_KEY || "",
    checksumKey: settings.PAYOS_CHECKSUM_KEY || ""
  });
};

// Helper to save system settings to Supabase
const saveSystemSettings = async (client: any, newSettings: any) => {
  try {
    if (!client) return false;
    
    const upserts = Object.entries(newSettings).map(([key, value]) => ({
      key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value)
    }));
    
    if (upserts.length === 0) return true;
    
    const { error } = await client.from('config').upsert(upserts, { onConflict: 'key' });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("[CONFIG] Failed to save settings to Supabase:", e);
    return false;
  }
};

const app = express();
const router = express.Router();

// Migration to Unified Master Config
router.post("/migrate-unified-config", async (req: any, res) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: "Chỉ Admin mới có quyền thực hiện migration" });
  }

  const client = initSupabase();
  const settings = await getMergedSettings(client);
  
  if (Array.isArray(settings.MASTER_CONFIGS) && settings.MASTER_CONFIGS.length > 0) {
    return res.json({ message: "Hệ thống đã có cấu hình hợp nhất. Không cần migration." });
  }

  const masterConfigs: any[] = [];

  // 1. Abbreviations
  if (Array.isArray(settings.BUSINESS_OPERATIONS_CONFIG)) {
    settings.BUSINESS_OPERATIONS_CONFIG.forEach((op: any) => {
      masterConfigs.push({
        id: `abbr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        category: 'ABBREVIATION',
        originalName: op.original || op.label || '',
        abbreviation: op.abbr || '',
        format: '',
        systemMeaning: op.type || op.key || ''
      });
    });
  }

  // 2. ID Formats
  if (Array.isArray(settings.SYSTEM_FORMATS_CONFIG)) {
    settings.SYSTEM_FORMATS_CONFIG.forEach((f: any) => {
      masterConfigs.push({
        id: `id_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        category: 'ID_FORMAT',
        originalName: f.label || '',
        abbreviation: '',
        format: f.value || '',
        systemMeaning: f.type || f.key || ''
      });
    });
  }

  // 3. New Contract Formats
  if (Array.isArray(settings.SYSTEM_CONTRACT_FORMATS_CONFIG)) {
    settings.SYSTEM_CONTRACT_FORMATS_CONFIG.forEach((f: any) => {
      masterConfigs.push({
        id: `contract_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        category: 'CONTRACT_NEW',
        originalName: f.label || f.original || '',
        abbreviation: f.abbr || '',
        format: f.value || '',
        systemMeaning: f.type || f.key || ''
      });
    });
  }

  // 4. Transfer Content
  if (Array.isArray(settings.TRANSFER_CONTENTS_CONFIG)) {
    settings.TRANSFER_CONTENTS_CONFIG.forEach((f: any) => {
      masterConfigs.push({
        id: `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        category: 'TRANSFER_CONTENT',
        originalName: f.original || f.label || '',
        abbreviation: f.abbr || '',
        format: f.value || '',
        systemMeaning: f.key || ''
      });
    });
  }

  if (masterConfigs.length === 0) {
    return res.json({ message: "Không tìm thấy cấu hình cũ để migration." });
  }

  const saved = await saveSystemSettings(client, { MASTER_CONFIGS: masterConfigs });
  
  if (saved) {
    settingsCache = null;
    lastCacheUpdate = 0;
    res.json({ success: true, message: "Migration sang cấu hình hợp nhất thành công!", count: masterConfigs.length });
  } else {
    res.status(500).json({ error: "Lỗi khi lưu cấu hình hợp nhất vào Database" });
  }
});
let supabase: any = null;

// Rate limiting for API security
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút." }
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 login/register attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Quá nhiều lần thử đăng nhập, vui lòng thử lại sau 1 giờ." }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use("/api", apiLimiter);
app.use("/api/login", authLimiter);
app.use("/api/register", authLimiter);

// Mount router at both root and /api to handle both local and Vercel environments
// When used as a sub-app in server.ts, it will be mounted at /api, 
// so requests to /api/data will reach here as /data.
app.use("/api", router);
app.use("/", router);

// Helper to safely stringify data that might contain BigInt
const safeJsonStringify = (data: any) => {
  return JSON.stringify(data, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
};

// Helper to send JSON response safely
const sendSafeJson = (res: express.Response, data: any, status = 200) => {
  try {
    const json = safeJsonStringify(data);
    res.status(status).set('Content-Type', 'application/json').send(json);
  } catch (e: any) {
    console.error("[API ERROR] Failed to serialize JSON:", e);
    res.status(500).json({
      error: "Lỗi serialization",
      message: "Không thể chuyển đổi dữ liệu sang JSON: " + e.message
    });
  }
};

// Safe initialization function
const initSupabase = (force = false) => {
  if (supabase && !force) return supabase;

  const config = loadConfig();
  const url = config.SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = config.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

  console.log(`[API] Attempting to initialize Supabase. URL present: ${!!url}, Key present: ${!!key}`);

  if (url && key && isValidUrl(url) && !isPlaceholder(url) && !isPlaceholder(key)) {
    try {
      supabase = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });
      console.log("[API] Supabase client initialized successfully.");
      return supabase;
    } catch (e) {
      console.error("[API] Supabase init error:", e);
      return null;
    }
  }
  console.warn("[API] Supabase credentials missing or invalid.");
  return null;
};

// Initialize once at module level
initSupabase();

// Migration helper to fix legacy isFreeUpgrade flags for non-standard rank users (since all upgrades to date are free)
const runFreeUpgradeMigration = async (client: any) => {
  try {
    if (!client) return;
    console.log("[MIGRATION] Checking for upgraded users with legacy rank settings to mark as free...");
    const { data: config } = await client.from('config').select('*');
    const settings: any = {};
    config?.forEach((item: any) => { settings[item.key] = item.value; });
    const sortedRanks = settings.RANK_CONFIG ? (typeof settings.RANK_CONFIG === 'string' ? JSON.parse(settings.RANK_CONFIG) : settings.RANK_CONFIG).sort((a: any, b: any) => a.maxLimit - b.maxLimit) : [];
    const lowestRankId = sortedRanks.length > 0 ? sortedRanks[0].id : 'ĐỒNG';
    
    // Select all users that have a rank other than lowestRankId
    const { data: users, error } = await client.from('users').select('id, rank, isFreeUpgrade, updatedAt');
    if (error) throw error;
    
    if (users && users.length > 0) {
      const toUpdate = users.filter((u: any) => u.rank && u.rank !== lowestRankId && u.isFreeUpgrade !== true);
      if (toUpdate.length > 0) {
        console.log(`[MIGRATION] Setting isFreeUpgrade to true for ${toUpdate.length} upgraded users to correct historical revenue...`);
        for (const u of toUpdate) {
          await client.from('users').update({ isFreeUpgrade: true, updatedAt: u.updatedAt || Date.now() }).eq('id', u.id);
        }
        console.log("[MIGRATION] Legacy upgrade flags successfully fixed in database.");
      } else {
        console.log("[MIGRATION] All active upgraded users are already marked as free.");
      }
    }
  } catch (err) {
    console.error("[MIGRATION ERROR] Failed to fix legacy upgraded users isFreeUpgrade flags:", err);
  }
};

const STORAGE_LIMIT_MB = 45; // Virtual limit for demo purposes

// Debug middleware to log incoming requests
router.use((req, res, next) => {
  console.log(`[API DEBUG] ${req.method} ${req.url}`);
  next();
});

// Middleware to check Supabase configuration
router.use((req, res, next) => {
  // Allow health checks without Supabase
  // In Express v5, req.path is relative to the mount point.
  // We check for both relative and absolute paths to be safe.
  const isHealthRoute = 
    req.path === '/api-health' || 
    req.path === '/supabase-status' || 
    req.path === '/public-settings' ||
    req.originalUrl === '/api/api-health' || 
    req.originalUrl === '/api/supabase-status' ||
    req.originalUrl === '/api/public-settings';

  if (isHealthRoute) return next();
  
  const client = initSupabase();

  if (!client) {
    return res.status(500).json({
      error: "Cấu hình Supabase không hợp lệ",
      message: "Hệ thống chưa được cấu hình Supabase URL hoặc Service Role Key trên Vercel. Vui lòng kiểm tra Settings -> Environment Variables."
    });
  }
  next();
});

// Helper to check if a route is public
const isPublicRoute = (reqPath: string) => {
  if (!reqPath) return false;
  const path = reqPath.replace(/\/$/, '');
  const publicRoutes = [
    '/login', '/register', '/api-health', '/supabase-status', 
    '/keep-alive', '/payment/webhook', '/payment-result', '/public-settings'
  ];
  return publicRoutes.includes(path) || 
         publicRoutes.some(route => path === '/api' + route) ||
         path.startsWith('/api/public');
};

// Authentication Middleware
const authenticateToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    if (isPublicRoute(req.path) || isPublicRoute(req.originalUrl || '')) {
      return next();
    }
    return res.status(401).json({ error: "Yêu cầu xác thực" });
  }

  try {
    const client = initSupabase();
    const settings = await getMergedSettings(client);
    
    const user = jwt.verify(token, settings.JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Token không hợp lệ hoặc đã hết hạn" });
  }
};

// Apply auth middleware to all routes except login/register/health/webhook
router.use((req, res, next) => {
  if (isPublicRoute(req.path) || isPublicRoute(req.originalUrl || '')) {
    return next();
  }
  authenticateToken(req, res, next);
});

// Helper to estimate JSON size in MB
const getStorageUsage = (data: any) => {
  try {
    const str = safeJsonStringify(data);
    return (Buffer.byteLength(str, 'utf8') / (1024 * 1024));
  } catch (e) {
    console.error("Error calculating storage usage:", e);
    return 0;
  }
};

let isCleaningUp = false;

// Function to process rank penalties for ALL users
export const runBatchPenalties = async (io: any) => {
  console.log("[Penalty] Starting batch penalty process for all users...");
  try {
    const client = initSupabase();
    if (!client) return;
    
    const settings = await getMergedSettings(client);
    
    // Fetch all non-admin users
    const { data: users, error: userError } = await client.from('users')
      .select('*')
      .eq('isAdmin', false);
      
    if (userError) throw userError;
    if (!users || users.length === 0) return;
    
    // Fetch all active/overdue loans
    const { data: allActiveLoans, error: loanError } = await client.from('loans')
      .select('id,userId,status,date,amount')
      .in('status', ['ĐANG NỢ', 'QUÁ HẠN', 'CHỜ TẤT TOÁN', 'ĐANG VAY', 'CHỜ DUYỆT TÍNH PHÍ']);
      
    if (loanError) throw loanError;
    
    let penaltyCount = 0;
    for (const user of users) {
      const userLoans = (allActiveLoans || []).filter(l => l.userId === user.id);
      const updatedUser = await processRankPenalties(user, userLoans, settings, client, io);
      if (updatedUser.penaltyStreak !== user.penaltyStreak || updatedUser.rank !== user.rank) {
        penaltyCount++;
      }
    }
    
    console.log(`[Penalty] Batch process completed. penalized ${penaltyCount} users.`);
    return penaltyCount;
  } catch (e) {
    console.error("[Penalty] Batch process failed:", e);
    return 0;
  }
};

// Unified Daily Task runner
export const runDailySystemTasks = async (io: any) => {
  const client = initSupabase();
  if (!client) return;
  
  // Run legacy isFreeUpgrade migration at every daily system task / startup run to keep it clean and robust
  await runFreeUpgradeMigration(client);
  
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  const { data: lastRunData } = await client.from('config').select('value').eq('key', 'LAST_DAILY_RUN').single();
  if (lastRunData?.value === todayStr) {
    console.log("[DailyTasks] Already ran today. Skipping...");
    return;
  }
  
  console.log("[DailyTasks] Running daily system maintenance...");
  
  await Promise.all([
    runBatchPenalties(io),
    runDailyOverdueChecksAndAutoLock(io),
    autoCleanupStorage(),
    keepAliveSupabase()
  ]);
  
  await client.from('config').upsert({ key: 'LAST_DAILY_RUN', value: todayStr }, { onConflict: 'key' });
  console.log("[DailyTasks] Maintenance completed.");
};

export const autoCleanupStorage = async () => {
  const client = initSupabase();
  if (!client || isCleaningUp) return;
  
  isCleaningUp = true;
  try {
    console.log("[Cleanup] Starting storage cleanup...");
    const now = new Date();
    
    // 1. Cleanup Notifications: Delete all but the 50 most recent per user
    const { data: allNotifs, error: fetchError } = await client.from('notifications')
      .select('id, userId')
      .order('id', { ascending: false });
    
    if (fetchError) throw fetchError;

    if (allNotifs && allNotifs.length > 0) {
      const userNotifCounts: Record<string, number> = {};
      const idsToDelete: string[] = [];
      
      for (const notif of allNotifs) {
        userNotifCounts[notif.userId] = (userNotifCounts[notif.userId] || 0) + 1;
        if (userNotifCounts[notif.userId] > 50) {
          idsToDelete.push(notif.id);
        }
      }
      
      if (idsToDelete.length > 0) {
        for (let i = 0; i < idsToDelete.length; i += 100) {
          const chunk = idsToDelete.slice(i, i + 100);
          await client.from('notifications').delete().in('id', chunk);
        }
        console.log(`[Cleanup] Deleted ${idsToDelete.length} old notifications`);
      }
    }

    // 2. Cleanup Loans: Delete Rejected and Settled (>30d)
    // This mechanism keeps the database clean by removing old history
    // Rejected loans are deleted after 30 days
    // Settled loans are deleted after 30 days to save storage space
    const thirtyDaysAgo = now.getTime() - (30 * 24 * 60 * 60 * 1000);

    const { error: err1 } = await client.from('loans')
      .delete()
      .eq('status', 'BỊ TỪ CHỐI')
      .lt('updatedAt', thirtyDaysAgo);
    
    const { error: err2 } = await client.from('loans')
      .delete()
      .eq('status', 'ĐÃ TẤT TOÁN')
      .lt('updatedAt', thirtyDaysAgo);

    if (err1 || err2) console.error("[Cleanup] Error deleting old loans:", JSON.stringify(err1 || err2));

    // 3. Cleanup Budget Logs: Delete entries older than 60 days
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const sixtyDaysAgoStr = sixtyDaysAgo.toISOString();

    const { error: err3 } = await client.from('budget_logs')
      .delete()
      .lt('createdAt', sixtyDaysAgoStr);
    
    if (err3) console.error("[Cleanup] Error deleting old budget logs:", JSON.stringify(err3));
    
    console.log("[Cleanup] Storage cleanup completed.");
  } catch (e) {
    console.error("Lỗi auto-cleanup:", e);
  } finally {
    isCleaningUp = false;
  }
};

// Keep-Alive function to prevent Supabase from pausing
export const keepAliveSupabase = async () => {
  const client = initSupabase();
  if (!client) return;
  try {
    console.log("[Keep-Alive] Pinging Supabase to prevent project pausing...");
    // Perform a simple query to keep the project active
    const { error } = await client.from('users').select('id').limit(1);
    if (error) throw error;
    
    // Save the last success timestamp in the config table
    await client.from('config').upsert({ key: 'lastKeepAlive', value: new Date().toISOString() }, { onConflict: 'key' });
    
    // Invalidate cache to ensure next data fetch gets the new timestamp
    settingsCache = null;
    lastCacheUpdate = 0;
    
    console.log("[Keep-Alive] Supabase ping successful.");
    return true;
  } catch (e: any) {
    console.error("[Keep-Alive] Supabase ping failed:", e.message || e);
    return false;
  }
};

// Supabase Status check for Admin
router.get("/supabase-status", async (req, res) => {
  try {
    const client = initSupabase();
    if (!client) {
      return res.json({ 
        connected: false, 
        error: "Chưa cấu hình Supabase hoặc URL không hợp lệ. Vui lòng kiểm tra biến môi trường." 
      });
    }
    
    // Trigger keepAlive logic to update timestamp and clear cache
    const keepAliveSuccess = await keepAliveSupabase();
    
    // Use a more standard count query
    const { error } = await client.from('users').select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error("Supabase connection error details:", JSON.stringify(error));
      return res.json({ 
        connected: false, 
        error: `Lỗi kết nối Supabase: ${error.message} (${error.code})` 
      });
    }
    
    res.json({ 
      connected: true, 
      message: "Kết nối Supabase ổn định",
      keepAlive: keepAliveSuccess ? "Updated" : "Failed"
    });
  } catch (e: any) {
    console.error("Critical error in /supabase-status:", e);
    res.json({ connected: false, error: `Lỗi hệ thống: ${e.message}` });
  }
});

// Keep-Alive endpoint for external services
router.get("/keep-alive", async (req, res) => {
  console.log(`[KEEP-ALIVE] Received ping at ${new Date().toISOString()} from ${req.ip}`);
  const success = await keepAliveSupabase();
  if (success) {
    const timestamp = new Date().toISOString();
    const io = req.app.get("io");
    if (io) {
      console.log(`[KEEP-ALIVE] Emitting supabase_ping to admin room`);
      io.to("admin").emit("supabase_ping", { timestamp });
    }
    res.json({ status: "ok", message: "Supabase keep-alive thành công", timestamp });
  } else {
    console.error(`[KEEP-ALIVE] Supabase keep-alive failed`);
    res.status(500).json({ status: "error", message: "Lỗi Supabase keep-alive" });
  }
});

// API Routes
router.post("/telegram/test", async (req: any, res) => {
  try {
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase chưa được cấu hình" });
    const settings = await getMergedSettings(client);
    const botToken = req.body.botToken || settings.TELEGRAM_BOT_TOKEN;
    const chatId = req.body.chatId || settings.TELEGRAM_CHAT_ID;
    
    if (!botToken || !chatId) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ Bot Token và Chat ID để thực hiện kiểm thử!" });
    }
    
    const payload = {
      chat_id: chatId.trim(),
      text: `<b>🔔 TIN NHẮN KIỂM THỬ HỆ THỐNG NDV-MONEY</b>\n` +
            `• <b>Trạng thái:</b> Kết nối thành công! 🎉\n` +
            `• <b>Phân loại:</b> Kênh thông báo đẩy Admin đã được liên kết hoạt động tốt!\n` +
            `• <b>Thông số Bot Token:</b> <code>${botToken.trim().slice(0, 6)}...${botToken.trim().slice(-6)}</code>\n` +
            `• <b>Thông số Chat ID:</b> <code>${chatId.trim()}</code>\n` +
            `• <b>Thời gian gửi:</b> ${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')}`,
      parse_mode: 'HTML'
    };

    console.log(`[Telegram Test] Attempting to send test msg to ${chatId.trim()} using token ${botToken.trim().slice(0, 8)}...`);
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!tgRes.ok) {
      const errText = await tgRes.text();
      console.error("[Telegram Test Error]:", errText);
      return res.status(400).json({ error: "Telegram API trả về lỗi khi gửi tin nhắn", details: errText });
    }

    const resJson = await tgRes.json();
    res.json({ success: true, message: "Gửi tin nhắn thử nghiệm thành công! Vui lòng kiểm tra ứng dụng Telegram của bạn.", result: resJson });
  } catch (err: any) {
    console.error("[Telegram Test Catch Error]:", err);
    res.status(500).json({ error: "Lỗi hệ thống khi gửi tin nhắn thử nghiệm", details: err.message });
  }
});

router.get("/public-settings", async (req, res) => {
  const client = initSupabase();
  const merged = await getMergedSettings(client);
  
  // Return only non-sensitive settings
  const publicSettings = {
    IMGBB_API_KEY: merged.IMGBB_API_KEY,
    PAYMENT_ACCOUNT: merged.PAYMENT_ACCOUNT,
    PRE_DISBURSEMENT_FEE: merged.PRE_DISBURSEMENT_FEE,
    MAX_EXTENSIONS: merged.MAX_EXTENSIONS,
    UPGRADE_PERCENT: merged.UPGRADE_PERCENT,
    FINE_RATE: merged.FINE_RATE,
    MAX_FINE_PERCENT: merged.MAX_FINE_PERCENT,
    MAX_LOAN_PER_CYCLE: merged.MAX_LOAN_PER_CYCLE,
    MIN_SYSTEM_BUDGET: merged.MIN_SYSTEM_BUDGET,
    MAX_SINGLE_LOAN_AMOUNT: merged.MAX_SINGLE_LOAN_AMOUNT,
    APP_URL: merged.APP_URL,
    CONTRACT_CODE_FORMAT: merged.CONTRACT_CODE_FORMAT,
    USER_ID_FORMAT: merged.USER_ID_FORMAT,
    ZALO_GROUP_LINK: merged.ZALO_GROUP_LINK,
    SYSTEM_NOTIFICATION: merged.SYSTEM_NOTIFICATION,
    ENABLE_PAYOS: merged.ENABLE_PAYOS,
    ENABLE_VIETQR: merged.ENABLE_VIETQR,
    SYSTEM_FORMATS_CONFIG: merged.SYSTEM_FORMATS_CONFIG,
    BUSINESS_OPERATIONS_CONFIG: merged.BUSINESS_OPERATIONS_CONFIG,
    CONTRACT_FORMATS_CONFIG: merged.CONTRACT_FORMATS_CONFIG,
    TRANSFER_CONTENTS_CONFIG: merged.TRANSFER_CONTENTS_CONFIG,
    SYSTEM_CONTRACT_FORMATS_CONFIG: merged.SYSTEM_CONTRACT_FORMATS_CONFIG,
    MASTER_CONFIGS: merged.MASTER_CONFIGS
  };
  
  res.json(publicSettings);
});

router.get("/settings", async (req, res) => {
  const client = initSupabase();
  const merged = await getMergedSettings(client);
  
  // Security: Filter sensitive keys for non-admins
  const isAdmin = (req as any).user?.isAdmin === true;
  if (!isAdmin) {
    const publicSettings = { ...merged };
    const sensitiveKeys = [
      'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET', 'PAYOS_API_KEY', 
      'PAYOS_CHECKSUM_KEY', 'ADMIN_PASSWORD', 'IMGBB_API_KEY'
    ];
    sensitiveKeys.forEach(key => {
      delete (publicSettings as any)[key];
    });
    return res.json(publicSettings);
  }
  
  res.json(merged);
});

router.post("/settings", async (req: any, res) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: "Chỉ Admin mới có quyền thay đổi cài đặt" });
  }

  const newConfig = req.body;
  
  // Validation: Ensure at least one payment method is enabled
  // We check if both are explicitly set to false in the request
  if (newConfig.ENABLE_PAYOS === false && newConfig.ENABLE_VIETQR === false) {
    return res.status(400).json({ error: "Phải có ít nhất một phương thức thanh toán được bật." });
  }

  const client = initSupabase();
  const oldSettings = await getMergedSettings(client);
  const oldBudget = Number(oldSettings.SYSTEM_BUDGET || 0);
  const oldMaintenanceMode = oldSettings.MAINTENANCE_MODE === true || oldSettings.MAINTENANCE_MODE === 'true';
  
  // 1. Save credentials to file (still needed for initial boot)
  const fileConfig: any = {};
  if (newConfig.SUPABASE_URL) fileConfig.SUPABASE_URL = newConfig.SUPABASE_URL;
  if (newConfig.SUPABASE_SERVICE_ROLE_KEY) fileConfig.SUPABASE_SERVICE_ROLE_KEY = newConfig.SUPABASE_SERVICE_ROLE_KEY;
  
  if (Object.keys(fileConfig).length > 0) {
    saveConfig(fileConfig);
    initSupabase(true); // Re-init if credentials changed
  }
  
  // 2. Save system settings to Supabase for persistence
  const systemSettings: any = {};
  const systemKeys = [
    'PAYMENT_ACCOUNT', 'PRE_DISBURSEMENT_FEE', 'MAX_EXTENSIONS', 
    'UPGRADE_PERCENT', 'FINE_RATE', 'MAX_FINE_PERCENT', 
    'MAX_LOAN_PER_CYCLE', 'MIN_SYSTEM_BUDGET', 'MAX_SINGLE_LOAN_AMOUNT', 'INITIAL_LIMIT', 'MIN_LOAN_AMOUNT',
    'IMGBB_API_KEY', 'PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY',
    'APP_URL', 'JWT_SECRET', 'ADMIN_PHONE', 'ADMIN_PASSWORD',
    'PAYMENT_CONTENT_FULL_SETTLEMENT', 'PAYMENT_CONTENT_PARTIAL_SETTLEMENT',
    'PAYMENT_CONTENT_EXTENSION', 'PAYMENT_CONTENT_UPGRADE',
    'CONTRACT_CODE_FORMAT', 'USER_ID_FORMAT', 'ZALO_GROUP_LINK',
    'SYSTEM_NOTIFICATION', 'SHOW_SYSTEM_NOTIFICATION', 'MAINTENANCE_MODE',
    'ENABLE_PAYOS', 'ENABLE_VIETQR', 'LUCKY_SPIN_VOUCHERS', 'LUCKY_SPIN_WIN_RATE',
    'LUCKY_SPIN_PAYMENTS_REQUIRED', 'MAX_ON_TIME_PAYMENTS_FOR_UPGRADE', 'CONTRACT_CLAUSES',
    'RANK_CONFIG', 'TOTAL_RANK_PROFIT', 'TOTAL_LOAN_PROFIT', 'TOTAL_FINE_PROFIT', 'SYSTEM_BUDGET', 'SYSTEM_FORMATS_CONFIG', 'BUSINESS_OPERATIONS_CONFIG',
    'CONTRACT_FORMATS_CONFIG', 'TRANSFER_CONTENTS_CONFIG', 'SYSTEM_CONTRACT_FORMATS_CONFIG', 'MASTER_CONFIGS', 'SYSTEM_START_DATE',
    'ENABLE_SIMULATION', 'SIMULATION_INTERVAL', 'REMINDER_DAYS_BEFORE_DUE', 'AUTO_LOCK_OVERDUE_DAYS',
    'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'ENABLE_TELEGRAM_NOTIF'
  ];
  
  systemKeys.forEach(key => {
    if (newConfig[key] !== undefined) {
      systemSettings[key] = newConfig[key];
    }
  });
  
  const savedToDb = await saveSystemSettings(client, systemSettings);
  const io = req.app.get("io");
  
  // 3. If RANK_CONFIG was updated, synchronize user limits if they are tied to ranks
  if (newConfig.RANK_CONFIG) {
    try {
      const rankConfig = Array.isArray(newConfig.RANK_CONFIG) 
        ? newConfig.RANK_CONFIG 
        : (typeof newConfig.RANK_CONFIG === 'string' ? JSON.parse(newConfig.RANK_CONFIG) : null);

      if (Array.isArray(rankConfig)) {
        const allUpdatedUsers: any[] = [];
        for (const rank of rankConfig) {
          if (rank.id && rank.maxLimit !== undefined) {
            // Get users who need update (whose current totalLimit differs from new rank limit)
            const { data: usersToUpdate, error: fetchError } = await client
              .from('users')
              .select('id, totalLimit, balance')
              .eq('rank', rank.id);

            if (!fetchError && usersToUpdate && usersToUpdate.length > 0) {
              const updates = usersToUpdate
                .filter(u => Number(u.totalLimit) !== Number(rank.maxLimit))
                .map(u => {
                  const currentLimit = Number(u.totalLimit) || 0;
                  const newLimit = Number(rank.maxLimit) || 0;
                  const currentBalance = Number(u.balance) || 0;
                  const limitDiff = newLimit - currentLimit;
                  
                  return {
                    id: u.id,
                    totalLimit: newLimit,
                    balance: currentBalance + limitDiff,
                    updatedAt: Date.now()
                  };
                });

              if (updates.length > 0) {
                console.log(`[SETTINGS] Starting sync for ${updates.length} users in rank ${rank.id}`);
                
                // Use individual updates instead of upsert to avoid requiring all NOT NULL columns (like phone)
                const updatePromises = updates.map(u => 
                  client.from('users').update({
                    totalLimit: u.totalLimit,
                    balance: u.balance,
                    updatedAt: u.updatedAt
                  }).eq('id', u.id).select()
                );
                
                const results = await Promise.all(updatePromises);
                results.forEach(r => {
                  if (r.data && r.data[0]) allUpdatedUsers.push(r.data[0]);
                });

                const errors = results.filter(r => r.error);
                if (errors.length > 0) {
                  console.error(`[SETTINGS] Failed to update some users for rank ${rank.id}`);
                }
              }
            }
          }
        }
        
        // Broadcast updates if any occurred
        if (allUpdatedUsers.length > 0 && io) {
          io.emit('users_updated', allUpdatedUsers);
          io.emit('users_bulk_updated');
        }
      }
    } catch (syncErr) {
      console.error("[SETTINGS] Error during user rank sync:", syncErr);
    }
  }

  // Invalidate cache after save
  settingsCache = null;
  lastCacheUpdate = 0;
  
  // Fetch full merged settings after save to return to client
  const fullSettings = await getMergedSettings(client);

  const newBudget = newConfig.SYSTEM_BUDGET !== undefined ? Number(newConfig.SYSTEM_BUDGET) : oldBudget;
  const newMaintenanceMode = newConfig.MAINTENANCE_MODE !== undefined ? (newConfig.MAINTENANCE_MODE === true || newConfig.MAINTENANCE_MODE === 'true') : oldMaintenanceMode;

  // Send notifications for budget additions or maintenance mode toggles
  if (newConfig.SYSTEM_BUDGET !== undefined && newBudget > oldBudget && (newBudget - oldBudget) >= 1000000) {
    const extraBudget = newBudget - oldBudget;
    const title = "Hệ thống bổ sung ngân sách giải ngân";
    const body = `Cập nhật: Nguồn quỹ giải ngân đã được bổ sung thêm ${extraBudget.toLocaleString('vi-VN')} đ. Quý khách có nhu cầu vay có thể đăng ký vay hoặc nâng hạng mức vay ngay bây giờ!`;
    broadcastPushNotification(title, body, client);
  } else if (newConfig.MAINTENANCE_MODE !== undefined && newMaintenanceMode && !oldMaintenanceMode) {
    const title = "Thông báo bảo trì hệ thống";
    const body = "Hệ thống đang tiến hành bảo trì định kỳ nguồn quỹ giải ngân. Các chức năng đăng ký vay mới sẽ tạm ngưng hoạt động cho tới khi bảo trì hoàn tất.";
    broadcastPushNotification(title, body, client);
  } else if (newConfig.MAINTENANCE_MODE !== undefined && !newMaintenanceMode && oldMaintenanceMode) {
    const title = "Bảo trì hoàn tất - Nguồn quỹ giải ngân hoạt động trở lại";
    const body = "Hệ thống đã hoàn tất bảo trì nguồn quỹ giải ngân. Chức năng nhận hồ sơ vay mới đã hoạt động bình thường.";
    broadcastPushNotification(title, body, client);
  }
  
  // Emit real-time update to all clients
  if (io) {
    io.emit("config_updated", fullSettings);
    // Also notify about possible user updates
    if (newConfig.RANK_CONFIG) {
      io.emit("users_bulk_updated"); 
    }
  }
  
  if (savedToDb) {
    res.json({ 
      success: true, 
      message: "Cài đặt đã được lưu vĩnh viễn vào Supabase.",
      settings: fullSettings
    });
  } else {
    // Fallback to file if DB fails
    saveConfig(newConfig);
    res.json({ 
      success: true, 
      message: "Cài đặt đã được lưu vào tệp tin (Lưu ý: Có thể bị mất khi Vercel restart).",
      settings: fullSettings
    });
  }
});

router.get("/check-bank-account", async (req, res) => {
  const { bin, accountNumber } = req.query;
  if (!bin || !accountNumber) {
    return res.status(400).json({ error: "Thiếu thông tin ngân hàng" });
  }

  try {
    // Using VietQR API for bank account lookup
    const response = await fetch("https://api.vietqr.io/v2/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bin, accountNumber })
    });

    const data = await response.json();
    if (data.code === "00" && data.data) {
      res.json({ success: true, accountName: data.data.accountName });
    } else {
      res.status(404).json({ error: "Không tìm thấy tài khoản ngân hàng" });
    }
  } catch (e) {
    console.error("[BANK LOOKUP ERROR]", e);
    res.status(500).json({ error: "Lỗi khi tra cứu tài khoản ngân hàng" });
  }
});

// Helper to get format from settings with priority
const getFormatFromSettings = (settings: any, key: string, defaultValue: string, category?: string) => {
  if (!settings) return defaultValue;
  
  const categoryMap: Record<string, string> = {
    'SYSTEM_FORMATS_CONFIG': 'ID_FORMAT',
    'SYSTEM_CONTRACT_FORMATS_CONFIG': 'CONTRACT_NEW',
    'TRANSFER_CONTENTS_CONFIG': 'TRANSFER_CONTENT',
    'BUSINESS_OPERATIONS_CONFIG': 'ABBREVIATION',
    'ID_FORMAT': 'SYSTEM_FORMATS_CONFIG',
    'CONTRACT_NEW': 'SYSTEM_CONTRACT_FORMATS_CONFIG',
    'TRANSFER_CONTENT': 'TRANSFER_CONTENTS_CONFIG',
    'ABBREVIATION': 'BUSINESS_OPERATIONS_CONFIG'
  };

  // 1. Check in MASTER_CONFIGS if available
  if (Array.isArray(settings.MASTER_CONFIGS) && settings.MASTER_CONFIGS.length > 0) {
    const config = settings.MASTER_CONFIGS.find((f: any) => {
      const matchCategory = category 
        ? (f.category === category || f.category === categoryMap[category]) 
        : true;
      const matchKey = f.systemMeaning === key || 
                       f.originalName === key || 
                       f.abbreviation === key ||
                       (key === 'user' && f.systemMeaning === 'user_format') ||
                       (key === 'contract' && f.systemMeaning === 'contract_original_format') ||
                       (key === 'PARTIAL_SETTLEMENT' && f.systemMeaning === 'contract_partial_format') ||
                       (key === 'EXTENSION' && f.systemMeaning === 'contract_extension_format') ||
                       (key === 'FULL_SETTLEMENT' && f.systemMeaning === 'transfer_full') ||
                       (key === 'PARTIAL_SETTLEMENT' && f.systemMeaning === 'transfer_partial') ||
                       (key === 'EXTENSION' && f.systemMeaning === 'transfer_extension') ||
                       (key === 'UPGRADE' && f.systemMeaning === 'transfer_upgrade');
      return matchCategory && matchKey;
    });
    if (config) {
      if (category === 'ABBREVIATION') return config.abbreviation;
      return config.format || config.abbreviation || defaultValue;
    }
  }

  // 2. Fallback to legacy config arrays
  const legacyMap: Record<string, string> = {
    'ID_FORMAT': 'SYSTEM_FORMATS_CONFIG',
    'CONTRACT_NEW': 'SYSTEM_CONTRACT_FORMATS_CONFIG',
    'TRANSFER_CONTENT': 'TRANSFER_CONTENTS_CONFIG',
    'ABBREVIATION': 'BUSINESS_OPERATIONS_CONFIG'
  };

  const configArrayKey = category ? legacyMap[category] : null;
  
  if (configArrayKey && Array.isArray(settings[configArrayKey])) {
    const config = settings[configArrayKey].find((f: any) => 
      f.type === key || f.key === key || f.original === key || f.originalName === key
    );
    if (config) return config.value || config.abbr || defaultValue;
  }
  
  // 3. Check direct key
  if (settings[key]) return settings[key];
  
  return defaultValue;
};

// Helper to resolve nested master configurations on server
const getSystemFormatServer = (settings: any, type: 'user' | 'contract', defaultValue: string): string => {
  if (!settings) return defaultValue;
  if (Array.isArray(settings.MASTER_CONFIGS) && settings.MASTER_CONFIGS.length > 0) {
    const config = settings.MASTER_CONFIGS.find((f: any) => 
      f.category === 'ID_FORMAT' && (f.systemMeaning === type || f.systemMeaning === `${type}_format` || f.systemMeaning === `contract_original_format` && type === 'contract')
    );
    if (config) return config.format || defaultValue;
  }
  const config = settings.SYSTEM_FORMATS_CONFIG?.find((f: any) => f.type === type || f.key === (type === 'user' ? 'USER_ID_FORMAT' : 'CONTRACT_CODE_FORMAT') || f.original === (type === 'user' ? 'USER_ID_FORMAT' : 'CONTRACT_CODE_FORMAT'));
  return config?.value || defaultValue;
};

const getSystemContractFormatServer = (settings: any, type: 'PARTIAL_SETTLEMENT' | 'EXTENSION', defaultValue: string): string => {
  if (!settings) return defaultValue;
  if (Array.isArray(settings.MASTER_CONFIGS) && settings.MASTER_CONFIGS.length > 0) {
    const config = settings.MASTER_CONFIGS.find((f: any) => 
      f.category === 'CONTRACT_NEW' && (f.systemMeaning === type || f.systemMeaning === `contract_${type.toLowerCase().replace('_settlement', '')}_format`)
    );
    if (config) return config.format || defaultValue;
  }
  const config = settings.SYSTEM_CONTRACT_FORMATS_CONFIG?.find((f: any) => f.type === type || f.key === type || f.original === type);
  return config?.value || defaultValue;
};

interface ResolutionContextServer {
  userId?: string;
  originalId?: string;
  fullId?: string;
  sequence?: number;
  n?: number;
  slgh?: number;
  slttmp?: number;
  phone?: string;
  rank?: string;
  abbr?: string;
}

const resolveMasterConfigServer = (
  format: string, 
  settings: any, 
  context: ResolutionContextServer = {},
  depth = 0
): string => {
  if (depth > 5) return format; // Prevent infinite loops
  
  let result = format;
  const masterConfigs = Array.isArray(settings?.MASTER_CONFIGS) ? settings.MASTER_CONFIGS : [];
  
  // 1. Replace user-defined variables from ALL categories if they have an abbreviation
  masterConfigs.forEach((cfg: any) => {
    if (cfg.abbreviation) {
      const placeholder = `{${cfg.abbreviation}}`;
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      
      if (regex.test(result)) {
        let replacement = "";
        const type = cfg.systemMeaning;
        const cfgFormat = cfg.format;
        const abbr = cfg.abbreviation.toUpperCase();

        // 1. Smart Fallback: Priority 1 - Use existing data from context if type matches OR if abbreviation is a common system name
        let dataValue = null;
        if (type === 'user_id' && context.userId) dataValue = context.userId;
        if ((type === 'contract_id' || type === 'contract_id_original') && context.originalId) dataValue = context.originalId;
        if (type === 'sequence' && (context.sequence !== undefined || context.n !== undefined)) {
          dataValue = (context.sequence ?? context.n ?? 1).toString();
        }
        if (type === 'phone' && context.phone) dataValue = context.phone;

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
        } else if (type === 'contract_id_new' || type === 'contract_partial_format' || type === 'contract_extension_format' ||
            type === 'transfer_full' || type === 'transfer_extension' || type === 'transfer_partial' || type === 'transfer_upgrade' || type === 'transfer_disburse') {
          let targetFormat = cfgFormat;
          if (!targetFormat || targetFormat.trim() === "") {
            if (type === 'contract_partial_format') targetFormat = getSystemContractFormatServer(settings, 'PARTIAL_SETTLEMENT', "{MHD}NEW");
            else if (type === 'contract_extension_format') targetFormat = getSystemContractFormatServer(settings, 'EXTENSION', "{MHD}NEW");
            else if (type === 'transfer_full') targetFormat = settings.TRANSFER_CONTENTS_CONFIG?.find((c: any) => c.key === 'FULL_SETTLEMENT')?.value || "TAT TOAN {ID}";
            else if (type === 'transfer_extension') targetFormat = settings.TRANSFER_CONTENTS_CONFIG?.find((c: any) => c.key === 'EXTENSION')?.value || "GIA HAN {ID} LAN {SLGH}";
            else if (type === 'transfer_partial') targetFormat = settings.TRANSFER_CONTENTS_CONFIG?.find((c: any) => c.key === 'PARTIAL_SETTLEMENT')?.value || "TTMP {ID} LAN {SLTTMP}";
            else if (type === 'transfer_upgrade') targetFormat = settings.TRANSFER_CONTENTS_CONFIG?.find((c: any) => c.key === 'UPGRADE')?.value || "HANG {RANK} {USER}";
            else if (type === 'transfer_disburse') targetFormat = settings.TRANSFER_CONTENTS_CONFIG?.find((c: any) => c.key === 'DISBURSE')?.value || "GIAI NGAN {ID}";
            else targetFormat = "{MHD}NEW";
          }
          replacement = resolveMasterConfigServer(targetFormat, settings, context, depth + 1);
        } else if (cfgFormat && cfgFormat.trim() !== "") {
          replacement = resolveMasterConfigServer(cfgFormat, settings, context, depth + 1);
        } else {
          // Otherwise use system logic
          const now = new Date();
          const year = now.getFullYear().toString();
          const month = (now.getMonth() + 1).toString().padStart(2, '0');
          const day = now.getDate().toString().padStart(2, '0');
          const dateStr = `${day}${month}${year.slice(-2)}`;

          switch(type) {
            case 'random':
              const lengthMatch = (cfg.originalName || '')?.match(/\d+/);
              const length = lengthMatch ? parseInt(lengthMatch[0]) : 6;
              let randomNum = '';
              for (let i = 0; i < length; i++) {
                randomNum += Math.floor(Math.random() * 10).toString();
              }
              replacement = randomNum;
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
              replacement = (context.sequence || context.n || 1).toString();
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
        result = result.replace(regex, replacement);
      }
    }
  });

  // 2. Handle system placeholders if not replaced by user variables
  const randomRegex = /\{(RANDOM|MÃ NGẪU NHIÊN|RD)\s*(\d+)?\s*(SỐ)?\}|\{(MHD|RD|HD)\s*(\d+)\s*(SỐ)?\}/gi;
  result = result.replace(randomRegex, (match, p1, p2, p3, p4, p5) => {
    const length = p2 ? parseInt(p2) : (p5 ? parseInt(p5) : 4);
    let randomNum = '';
    for (let i = 0; i < length; i++) {
      randomNum += Math.floor(Math.random() * 10).toString();
    }
    return randomNum;
  });

  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const dateStr = `${day}${month}${year.slice(-2)}`;
  const userPart = context.userId || "USER";

  // Align with utils.ts resolveMasterConfig legacy logic:
  // {USER} becomes userId
  // {MHD} and {CONTRACT} become originalId
  result = result.replace(/\{USER\}/gi, userPart);
  result = result.replace(/\{ID\}/gi, () => {
    if (context.originalId) return context.originalId;
    return userPart;
  });
  result = result.replace(/\{MHD\}|\{CONTRACT\}/gi, () => {
    if (context.originalId) return context.originalId;
    // Generate 4 random digits as fallback for {MHD} if no originalId provided
    return Math.floor(1000 + Math.random() * 9000).toString();
  });
  result = result.replace(/\{N\}/gi, (context.sequence !== undefined ? context.sequence : (context.n !== undefined ? context.n : 1)).toString());
  result = result.replace(/\{DATE\}|\{NGÀY\}/gi, dateStr);

  // Final pass for specific payment placeholders (matching utils.ts generatePaymentContent)
  // These only apply if not already replaced by resolveMasterConfig
  const fullId = context.fullId || context.originalId || '';
  result = result
    .replace(/\{Mã Hợp Đồng\}|\{LOAN_ID\}/gi, fullId)
    .replace(/\{PHONE\}|\{SĐT\}|\{SDT\}|\{SỐ ĐIỆN THOẠI\}|\{SO DIEN THOAI\}/gi, context.phone || '')
    .replace(/\{RANK\}|\{HẠNG\}|\{HANG\}|\{TÊN HANG\}|\{TÊN HẠNG\}/gi, context.rank || '')
    .replace(/\{SLGH\}|\{SỐ LẦN GIA HẠN\}|\{EXTENSION_COUNT\}/gi, (context.slgh || 0).toString())
    .replace(/\{SLTTMP\}|\{SỐ LẦN TTMP\}|\{PARTIAL_COUNT\}/gi, (context.slttmp || 0).toString())
    .replace(/\{VT\}|\{VIẾT TẮT\}|\{VIET TAT\}/gi, context.abbr || '')
    .replace(/\{N\}|\{SEQUENCE\}/gi, (context.sequence || context.n || 1).toString());

  return result;
};

const generateUserIdServer = (format = '{RANDOM 6 SỐ}', settings?: any) => {
  return resolveMasterConfigServer(format, settings, {});
};

const generateContractIdServer = (userId: string, format = '{ID}NDV{N}', settings?: any, loanId?: string, seq?: number, n?: number, slgh?: number, slttmp?: number) => {
  return resolveMasterConfigServer(format, settings, { userId, originalId: loanId, sequence: seq || n, n, slgh, slttmp });
};

router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    if (!phone || !password) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ số điện thoại và mật khẩu." });
    }
    
    const client = initSupabase();
    const settings = await getMergedSettings(client);
    
    // 1. Try to find user in Supabase first
    if (client) {
      const { data: users, error } = await client
        .from('users')
        .select('*')
        .eq('phone', phone)
        .limit(1);

      if (error) {
        console.error("[SUPABASE ERROR] Login query failed:", JSON.stringify(error));
      } else if (users && users.length > 0) {
        const user = users[0];
        
        if (user.password && typeof user.password === 'string') {
          try {
            // Robust check for bcrypt hash
            const passwordStr = String(password);
            const userPasswordStr = String(user.password);
            
            // Standard bcrypt regex (2a/2b/2y, 2-digit cost, 53 salt/hash chars)
            const isBcryptHash = /^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$/.test(userPasswordStr);
            console.log(`[LOGIN] Testing user ${user.id} against password. Is hash? ${isBcryptHash}`);

            let isMatch = false;
            if (isBcryptHash) {
              try {
                isMatch = await bcrypt.compare(passwordStr, userPasswordStr);
              } catch (compareError: any) {
                console.warn(`[LOGIN] Bcrypt.compare failed for user ${user.id}:`, compareError.message || compareError);
                
                // CRITICAL FAILSAFE: If bcrypt crashes with "pattern" or "atob", it means the hash is malformed.
                // We fallback to checking if it was accidentally saved as plain text or malformed string.
                const errMsg = String(compareError.message || compareError).toLowerCase();
                if (errMsg.includes("pattern") || errMsg.includes("atob") || errMsg.includes("decoded")) {
                  isMatch = passwordStr === userPasswordStr;
                  if (isMatch) console.info(`[LOGIN] Recovered login via plain-match for user ${user.id}`);
                } else {
                  throw compareError;
                }
              }
            } else {
              // Direct match for plain text or base64 (fallback)
              isMatch = passwordStr === userPasswordStr;
            }

            if (isMatch) {
              // Auto-migrate to secure hash if matched plain text
              if (!isBcryptHash) {
                console.log(`[LOGIN] Auto-migrating password for user ${user.id} to bcrypt...`);
                try {
                  const salt = await bcrypt.genSalt(10);
                  const newHash = await bcrypt.hash(passwordStr, salt);
                  await client.from('users').update({ password: newHash }).eq('id', user.id);
                } catch (migErr) {
                  console.error(`[LOGIN] Migration failed for user ${user.id}:`, migErr);
                }
              }

              // Remove password, set admin status, and sign token
              const { password: _, ...userNoPwd } = user;
              const isAdmin = user.isAdmin === true;
              const token = jwt.sign({ id: user.id, isAdmin }, settings.JWT_SECRET, { expiresIn: '24h' });
              
              return sendSafeJson(res, { success: true, user: { ...userNoPwd, isAdmin }, token });
            } else {
              return res.status(401).json({ error: "Số điện thoại hoặc mật khẩu không chính xác." });
            }
          } catch (outerBcryptError: any) {
            console.error("[BCRYPT CRITICAL] Outer catch for user:", user.id, outerBcryptError);
            const outMsg = String(outerBcryptError.message || outerBcryptError).toLowerCase();
            if (outMsg.includes("pattern") || outMsg.includes("atob")) {
              return res.status(401).json({ 
                error: "Lỗi định dạng tài khoản", 
                message: "Mật khẩu trong hệ thống của bạn gặp lỗi định dạng. Vui lòng liên hệ Admin để đặt lại mật khẩu." 
              });
            }
            throw outerBcryptError;
          }
        }
      }
    } else {
      console.warn("[LOGIN] Supabase client not initialized. Falling back to hardcoded admin check.");
    }
    
    // 2. Fallback to hardcoded Admin check if Supabase check fails or user not found
    // This ensures admin can always log in to fix configuration
    if (phone === settings.ADMIN_PHONE && password === settings.ADMIN_PASSWORD) {
      const adminUser = {
        id: 'AD01', phone: settings.ADMIN_PHONE, fullName: 'QUẢN TRỊ VIÊN', idNumber: 'SYSTEM_ADMIN',
        balance: 500000000, totalLimit: 500000000, rank: 'diamond', rankProgress: 10,
        isLoggedIn: true, isAdmin: true
      };
      const token = jwt.sign({ id: adminUser.id, isAdmin: true }, settings.JWT_SECRET, { expiresIn: '24h' });
      return sendSafeJson(res, {
        success: true,
        user: adminUser,
        token
      });
    }

    if (!client) return res.status(503).json({ error: "Supabase not configured" });
    return res.status(401).json({ error: "Số điện thoại hoặc mật khẩu không chính xác." });

  } catch (e: any) {
    console.error("[LOGIN FATAL ERROR]:", e);
    res.status(500).json({ 
      error: "Lỗi hệ thống", 
      message: e.message || "Đã xảy ra lỗi không xác định trong quá trình đăng nhập" 
    });
  }
});

router.post("/public/reset-password", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Vui lòng nhập số điện thoại Zalo." });
    }

    const client = initSupabase();
    if (!client) {
      return res.status(503).json({ error: "Hệ thống cơ sở dữ liệu chưa sẵn sàng." });
    }

    // Find the user by phone
    const { data: users, error: selectError } = await client
      .from('users')
      .select('id, phone')
      .eq('phone', phone)
      .limit(1);

    if (selectError) {
      console.error("[RESET PASSWORD] Error finding user:", selectError);
      return res.status(500).json({ error: "Lỗi hệ thống khi tìm kiếm người dùng." });
    }

    if (!users || users.length === 0) {
      return res.status(404).json({ error: "Số điện thoại Zalo này chưa được đăng ký trong hệ thống." });
    }

    const user = users[0];

    // Reset password to "123456"
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('123456', salt);

    const { error: updateError } = await client
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', user.id);

    if (updateError) {
      console.error("[RESET PASSWORD] Error updating password:", updateError);
      return res.status(500).json({ error: "Lỗi hệ thống khi cập nhật mật khẩu." });
    }

    return res.json({ success: true, message: "Đặt lại mật khẩu thành công về 123456." });
  } catch (e: any) {
    console.error("[RESET PASSWORD FATAL ERROR]:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

router.post("/register", async (req, res) => {
  try {
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase not configured" });
    const settings = await getMergedSettings(client);
    
    const userData = req.body;
    if (!userData || !userData.phone || !userData.password) {
      return res.status(400).json({ error: "Thiếu thông tin đăng ký" });
    }

    // Check if user already exists (by phone, Zalo, or ID Number)
    let query = client.from('users').select('id, phone, "refZalo", "idNumber"');
    const conditions = [`phone.eq.${userData.phone}`];
    if (userData.refZalo) conditions.push(`refZalo.eq.${userData.refZalo}`);
    if (userData.idNumber) conditions.push(`idNumber.eq.${userData.idNumber}`);
    
    query = query.or(conditions.join(','));
    
    const { data: existingUsers, error: checkError } = await query.limit(1);
    
    if (checkError) {
      console.error("[REGISTER] Error checking existing users:", checkError);
      return res.status(500).json({ error: "Lỗi kiểm tra tài khoản tồn tại" });
    }

    if (existingUsers && existingUsers.length > 0) {
      const existing = existingUsers[0];
      console.log("[REGISTER] Found existing user causing conflict:", existing);
      if (existing.phone === userData.phone) {
        return res.status(400).json({ error: "Số điện thoại này đã được đăng ký." });
      } else if (userData.refZalo && existing.refZalo === userData.refZalo) {
        return res.status(400).json({ error: "Số Zalo này đã được sử dụng bởi một tài khoản khác." });
      } else {
        return res.status(400).json({ error: "Số CCCD/CMND này đã được sử dụng bởi một tài khoản khác." });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    // Determine default rank based on CHÍNH SÁCH TÀI CHÍNH (RANK_CONFIG)
    // Find the rank with the lowest maximum limit
    let defaultRank = 'bronze' as any;
    let initialLimit = 3000000;
    
    if (settings.RANK_CONFIG && settings.RANK_CONFIG.length > 0) {
      const sortedRanks = [...settings.RANK_CONFIG].sort((a, b) => a.maxLimit - b.maxLimit);
      defaultRank = sortedRanks[0].id;
      initialLimit = sortedRanks[0].maxLimit;
    }

    // Ensure ID follows Admin format if not already set correctly
    let userId = userData.id;
    const format = getFormatFromSettings(settings, 'user', '{RANDOM 6 SỐ}', 'SYSTEM_FORMATS_CONFIG');
    if (!userId || userId.startsWith('TEMP-')) {
      userId = generateUserIdServer(format, settings);
    }

    const newUser = {
      ...userData,
      id: userId,
      password: hashedPassword,
      rank: defaultRank,
      totalLimit: initialLimit,
      balance: initialLimit,
      isAdmin: false, // Security: Ensure new users are never admins
      updatedAt: Date.now()
    };

    const sanitizedUser = sanitizeData([newUser], USER_WRITE_COLUMNS)[0];
    
    console.log(`[API] Registering user: ${sanitizedUser.id} (${sanitizedUser.phone})`);
    
    const { error: insertError } = await client.from('users').insert(sanitizedUser);
    if (insertError) {
      console.error("[API ERROR] Supabase insert failed for user:", JSON.stringify(insertError));
      throw insertError;
    }

    console.log(`[API] User ${sanitizedUser.id} registered successfully in Supabase.`);

    // Telegram Notification to Admin
    try {
      const telegramMsg = `<b>👤 ĐĂNG KÝ TÀI KHOẢN MỚI</b>\n` +
        `• <b>Họ tên:</b> ${sanitizedUser.fullName || 'Chưa cung cấp'}\n` +
        `• <b>Số điện thoại:</b> <code>${sanitizedUser.phone}</code>\n` +
        `• <b>ID Hệ thống:</b> <code>${sanitizedUser.id}</code>\n` +
        `• <b>Hạng:</b> ${sanitizedUser.rank.toUpperCase()}\n` +
        `• <b>Hạn mức khởi điểm:</b> ${sanitizedUser.totalLimit.toLocaleString()} đ\n` +
        `• <b>Zalo liên hệ:</b> ${sanitizedUser.refZalo || 'Không cung cấp'}\n` +
        `• <b>Thời gian:</b> ${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')}`;
      
      sendTelegramNotification(telegramMsg, settings).catch(telegramErr => {
        console.error("[Telegram Error Callback]:", telegramErr);
      });
    } catch (telegramCatch) {
      console.error("[Telegram Code Catch]:", telegramCatch);
    }

    const token = jwt.sign({ id: sanitizedUser.id, isAdmin: false }, settings.JWT_SECRET, { expiresIn: '24h' });
    
    sendSafeJson(res, {
      success: true,
      token
    });
  } catch (e: any) {
    console.error("Lỗi register:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

let lastPingTime = Date.now();
const PING_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours (preventing database pausing once a day is more than enough)

// Passive Keep-Alive Middleware
router.use(async (req, res, next) => {
  const now = Date.now();
  if (now - lastPingTime > PING_INTERVAL) {
    lastPingTime = now;
    // Don't await, let it run in background
    keepAliveSupabase().catch(e => console.error("[Passive-Keep-Alive] Error:", e));
  }
  next();
});

// Helper to calculate overdue days
const calculateOverdueDays = (dueDateStr: string): number => {
  if (!dueDateStr) return 0;
  try {
    const [d, m, y] = dueDateStr.split('/').map(Number);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return 0;
    const dueDate = new Date(y, m - 1, d);
    dueDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (today <= dueDate) return 0;
    
    const diffTime = today.getTime() - dueDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  } catch (e) {
    return 0;
  }
};

// Logic for Rank Penalty based on overdue loans
const processRankPenalties = async (user: any, userLoans: any[], settings: any, client: any, io: any): Promise<any> => {
  if (!user || user.isAdmin) return user;

  // Active debt loans
  const activeLoans = userLoans.filter(l => 
    l.userId === user.id && 
    (l.status === 'ĐANG NỢ' || l.status === 'QUÁ HẠN' || l.status === 'CHỜ TẤT TOÁN' || l.status === 'ĐANG VAY' || l.status === 'CHỜ DUYỆT TÍNH PHÍ')
  );
  
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  // Find max overdue days among active loans
  let maxOverdueDays = 0;
  activeLoans.forEach(l => {
    const overdue = calculateOverdueDays(l.date);
    if (overdue > maxOverdueDays) maxOverdueDays = overdue;
  });

  // If no active loans or no overdue, check if streak needs reset
  if (activeLoans.length === 0 || maxOverdueDays === 0) {
    if ((user.penaltyStreak && user.penaltyStreak > 0)) {
      const updatedUser = { 
        ...user, 
        penaltyStreak: 0, 
        lastPenaltyDate: todayStr,
        updatedAt: Date.now() 
      };
      await client.from('users').update({ 
        penaltyStreak: 0, 
        lastPenaltyDate: todayStr, 
        updatedAt: Date.now() 
      }).eq('id', user.id);
      return updatedUser;
    }
    return user;
  }

  // Already processed the current level of overdue penalties today?
  // penaltyStreak tracks the last day of overdue penalized for.
  if (user.penaltyStreak >= maxOverdueDays || (user.penaltyStreak >= 5 && maxOverdueDays >= 5)) {
    return user;
  }

  // Check if we already processed penalties TODAY to avoid repeat notifications
  if (user.lastPenaltyDate === todayStr && user.penaltyStreak >= maxOverdueDays) return user;

  // Apply penalties (catch-up if multiple days passed)
  let startDay = (user.penaltyStreak || 0) + 1;
  let endDay = Math.min(5, maxOverdueDays);
  
  let newRank = user.rank;
  let newProgress = Number(user.rankProgress) || 0;
  let newLimit = Number(user.totalLimit);
  let notifications: any[] = [];

  const rankConfig = settings.RANK_CONFIG || [];
  
  for (let s = startDay; s <= endDay; s++) {
    const currentRankIdx = rankConfig.findIndex((r: any) => r.id === newRank);
    const maxLimitOverall = Math.max(...rankConfig.map((r: any) => r.maxLimit || 0));
    const currentRankConf = rankConfig[currentRankIdx];
    const isHighestRank = currentRankConf && currentRankConf.maxLimit >= maxLimitOverall;

    if (s >= 5) {
      newRank = 'bronze';
      newProgress = 0;
      const bronzeConf = rankConfig.find((r: any) => r.id === 'bronze');
      newLimit = bronzeConf ? bronzeConf.maxLimit : 3000000;
      notifications.push({
        title: 'Hạ cấp bậc: QUÁ HẠN 5 NGÀY',
        message: `Tài khoản của bạn đã quá hạn 5 ngày. Hệ thống hạ cấp bậc về ĐỒNG và xóa toàn bộ điểm tiến trình.`
      });
      break; 
    } else if (s === 1) {
      if (isHighestRank && currentRankIdx > 0) {
        // Highest rank special rule: downgrade to next rank + 10 points
        const currentRankName = rankConfig[currentRankIdx]?.name || 'cao nhất';
        const nextRankIdx = currentRankIdx - 1;
        const nextRankConf = rankConfig[nextRankIdx];
        newRank = nextRankConf.id;
        newProgress = 10;
        newLimit = nextRankConf.maxLimit;
        notifications.push({
          title: 'Hạ cấp bậc: QUÁ HẠN 1 NGÀY',
          message: `Hạng ${currentRankName} không được phép quá hạn. Bạn bị hạ xuống hạng ${nextRankConf.name} với 10 điểm tiến trình.`
        });
      } else {
        newProgress = Math.max(0, newProgress - 2);
        notifications.push({
          title: 'Trừ điểm tiến trình: QUÁ HẠN 1 NGÀY',
          message: `Khoản vay quá hạn 1 ngày. Bạn bị trừ 2 điểm tiến trình.`
        });
      }
    } else {
      newProgress = Math.max(0, newProgress - 2);
      notifications.push({
        title: 'Trừ điểm tiến trình: TIẾP TỤC QUÁ HẠN',
        message: `Khoản vay vẫn đang quá hạn. Bạn bị trừ thêm 2 điểm tiến trình (Ngày ${s}).`
      });
    }
  }

  // Calculate new balance based on new limit and existing active debt
  const activeDebt = activeLoans.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const newBalance = Math.max(0, newLimit - activeDebt);

  const updatedUserWithPenalty = {
    ...user,
    rank: newRank,
    rankProgress: newProgress,
    totalLimit: newLimit,
    balance: newBalance,
    penaltyStreak: endDay,
    lastPenaltyDate: todayStr,
    updatedAt: Date.now()
  };

  // Persist to DB
  await client.from('users').update({
    rank: newRank,
    rankProgress: newProgress,
    totalLimit: newLimit,
    balance: newBalance,
    penaltyStreak: endDay,
    lastPenaltyDate: todayStr,
    updatedAt: Date.now()
  }).eq('id', user.id);

  // Send notifications
  if (io) {
    for (const notifData of notifications) {
      const notifId = `NOTIF-${Date.now()}-${Math.floor(Math.random()*1000)}`;
      const notif = {
        id: notifId,
        userId: user.id,
        title: notifData.title,
        message: notifData.message,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
        read: false,
        type: 'SYSTEM'
      };
      await client.from('notifications').insert([notif]);
      io.to(`user_${user.id}`).emit("notification_updated", notif);
      triggerPushForUser(user.id, notif.title, notif.message, client);
    }
    io.to(`user_${user.id}`).emit("user_updated", updatedUserWithPenalty);
  }

  return updatedUserWithPenalty;
};

// Helper: Insert system notifications & trigger Push Notifications for user APK devices
export const insertSystemNotificationHelper = async (client: any, io: any, userId: string, title: string, message: string, type = 'SYSTEM') => {
  try {
    const notifId = `SYS-NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const timeStr = `${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${new Date().toLocaleDateString('vi-VN')}`;
    const notif = {
      id: notifId,
      userId,
      title,
      message,
      time: timeStr,
      read: false,
      type
    };
    
    await client.from('notifications').insert([notif]);
    if (io) {
      io.to(`user_${userId}`).emit("notification_updated", notif);
    }
    
    // Send Push Notification to device APK
    await triggerPushForUser(userId, title, message, client);
  } catch (err) {
    console.error("[insertSystemNotificationHelper] Error:", err);
  }
};

// Daily Overdue Loan Reminder, Status Updater, and Auto Locking Mechanism
export const runDailyOverdueChecksAndAutoLock = async (io: any) => {
  console.log("[OverdueCheck] Starting daily overdue checks and auto-lock runner...");
  try {
    const client = initSupabase();
    if (!client) return;

    // Load dynamic setting parameters
    const settings = await getMergedSettings(client);
    const reminderDaysBeforeDue = Number(settings.REMINDER_DAYS_BEFORE_DUE !== undefined ? settings.REMINDER_DAYS_BEFORE_DUE : 1);
    const autoLockOverdueDays = Number(settings.AUTO_LOCK_OVERDUE_DAYS !== undefined ? settings.AUTO_LOCK_OVERDUE_DAYS : 15);

    // 1. Fetch active status loans
    const activeStatuses = ['ĐANG NỢ', 'QUÁ HẠN', 'CHỜ TẤT TOÁN', 'ĐANG VAY', 'CHỜ DUYỆT TÍNH PHÍ'];
    const { data: loans, error: loanErr } = await client
      .from('loans')
      .select('*')
      .in('status', activeStatuses);

    if (loanErr) throw loanErr;
    if (!loans || loans.length === 0) {
      console.log("[OverdueCheck] No active loans found.");
      return;
    }

    // 2. Fetch non-admin users
    const { data: users, error: userErr } = await client
      .from('users')
      .select('*')
      .eq('isAdmin', false);

    if (userErr) throw userErr;
    if (!users || users.length === 0) return;

    const userMap = new Map<string, any>(users.map(u => [u.id, u]));

    for (const loan of loans) {
      const user = userMap.get(loan.userId);
      if (!user) continue;

      const daysOverdue = calculateOverdueDays(loan.date);
      
      // Calculate days remaining helper
      const daysRemaining = (() => {
        if (!loan.date) return -999;
        try {
          const [d, m, y] = loan.date.split('/').map(Number);
          if (isNaN(d) || isNaN(m) || isNaN(y)) return -999;
          const dueDate = new Date(y, m - 1, d);
          dueDate.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const diffTime = dueDate.getTime() - today.getTime();
          return Math.floor(diffTime / (1000 * 60 * 60 * 24));
        } catch (e) {
          return -999;
        }
      })();

      const amountStr = Number(loan.amount).toLocaleString('vi-VN');

      // Task 1: Auto-update status of overdue loans to 'QUÁ HẠN' in DB
      if (daysOverdue > 0) {
        if (loan.status !== 'QUÁ HẠN' && loan.status !== 'CHỜ TẤT TOÁN') {
          await client.from('loans').update({ status: 'QUÁ HẠN', updatedAt: Date.now() }).eq('id', loan.id);
          loan.status = 'QUÁ HẠN';
          if (io) {
            io.to(`user_${loan.userId}`).emit("loan_updated", { ...loan, status: 'QUÁ HẠN' });
          }
        }

        // Task 3: If overdue > autoLockOverdueDays, auto-lock user (non-admin)
        if (daysOverdue > autoLockOverdueDays && !user.isLocked) {
          const lockedReasonText = `Khoản vay mã ${loan.id} quá hạn ${daysOverdue} ngày chưa thanh toán (Từ ngày ${loan.date})`;
          console.log(`[OverdueCheck] Auto-locking user ${user.id} due to ${autoLockOverdueDays}+ days overdue loan ${loan.id}`);
          
          await client.from('users').update({
            isLocked: true,
            lockedAt: new Date().toISOString(),
            lockedReason: lockedReasonText,
            updatedAt: Date.now()
          }).eq('id', user.id);

          const updatedUser = {
            ...user,
            isLocked: true,
            lockedAt: new Date().toISOString(),
            lockedReason: lockedReasonText
          };

          if (io) {
            io.to(`user_${user.id}`).emit("user_updated", updatedUser);
            io.to("admin").emit("users_updated", [updatedUser]);
          }

          // Insert system notification & push warning
          await insertSystemNotificationHelper(
            client,
            io,
            user.id,
            "Tài khoản bị khóa tự động",
            `Tài khoản của bạn đã bị khóa tự động theo quy định do khoản vay mã ${loan.id} trị giá ${amountStr} đ quá hạn ${daysOverdue} ngày chưa tất toán. Vui lòng liên hệ bộ phận hỗ trợ khách hàng để thanh toán và mở khóa tài khoản.`,
            'SYSTEM'
          );
        } else {
          // Regular daily overdue alert reminder notification (if not locked or just under lock threshold overdue)
          await insertSystemNotificationHelper(
            client,
            io,
            user.id,
            "Khoản vay quá hạn",
            `Cảnh báo! Khoản vay mã ${loan.id} trị giá ${amountStr} đ của bạn đã quá hạn ${daysOverdue} ngày. Vui lòng thanh toán ngay lập tức để tránh điểm phạt nâng cao hoặc bị khóa tài khoản tự động sau ${autoLockOverdueDays} ngày quá hạn.`,
            'LOAN'
          );
        }
      } else if (daysRemaining === reminderDaysBeforeDue && reminderDaysBeforeDue > 0) {
        // Loan will be due in reminderDaysBeforeDue days
        const dayStr = reminderDaysBeforeDue === 1 ? "vào ngày mai" : `sau ${reminderDaysBeforeDue} ngày`;
        await insertSystemNotificationHelper(
          client,
          io,
          user.userId || user.id,
          "Khoản vay sắp đến hạn",
          `Nhắc nhở: Khoản vay mã ${loan.id} trị giá ${amountStr} đ của quý khách sẽ đến hạn thanh toán ${dayStr} (${loan.date}). Quý khách vui lòng lưu ý và thanh toán đúng hạn.`,
          'LOAN'
        );
      } else if (daysRemaining === 0) {
        // Loan is due today
        await insertSystemNotificationHelper(
          client,
          io,
          user.id,
          "Khoản vay đến hạn trả hôm nay",
          `Cảnh báo: Hôm nay (${loan.date}) là hạn thanh toán cuối cùng cho khoản vay mã ${loan.id} trị giá ${amountStr} đ của quý khách. Vui lòng thanh toán đầy đủ trong ngày hôm nay.`,
          'LOAN'
        );
      }
    }

    console.log("[OverdueCheck] Daily overdue checks and auto-lock completed successfully.");
  } catch (error) {
    console.error("[OverdueCheck] Error running daily overdue checks / auto-locking:", error);
  }
};

router.post("/update-fcm-token", async (req: any, res) => {
  const { userId, token } = req.body;
  if (!userId || !token) return res.status(400).json({ error: "Missing data" });

  try {
    const client = initSupabase();
    const { error } = await client
      .from('users')
      .update({ fcmToken: token, updatedAt: Date.now() })
      .eq('id', userId);

    if (error) throw error;
    res.json({ success: true });
  } catch (e: any) {
    console.error("Error updating FCM token:", e);
    res.status(500).json({ error: e.message });
  }
});

router.post("/send-push", async (req: any, res) => {
  const { userId, title, body, all } = req.body;
  
  if (!firebaseApp) {
    return res.status(500).json({ error: "Firebase Admin chưa được cấu hình. Vui lòng thêm FIREBASE_SERVICE_ACCOUNT_JSON vào .env" });
  }

  try {
    const client = initSupabase();
    if (all) {
      // Send to all users who have a token
      const { data: users, error } = await client
        .from('users')
        .select('fcmToken, id')
        .not('fcmToken', 'is', null);
        
      if (error) throw error;
      
      const tokens = users.map(u => u.fcmToken).filter(Boolean);
      if (tokens.length === 0) {
        return res.status(404).json({ error: "Không tìm thấy thiết bị nào để gửi thông báo." });
      }

      // Firebase Admin supports sending to multiple tokens (up to 500 per call)
      const message = {
        notification: { title, body },
        tokens: tokens
      };
      
      const response = await admin.messaging().sendEachForMulticast(message);
      
      // Clean up any stale tokens in the background
      if (response.responses && response.responses.length > 0) {
        const staleTokens: string[] = [];
        response.responses.forEach((resItem, idx) => {
          if (!resItem.success && resItem.error) {
            const errStr = String(resItem.error) || "";
            const errCode = resItem.error.code || "";
            const isStale = errStr.includes("Requested entity was not found") || 
                            errStr.includes("registration-token-not-registered") ||
                            errStr.includes("invalid-registration-token") ||
                            errCode.includes("not-found") || 
                            errCode.includes("not-registered") ||
                            errCode.includes("invalid-registration-token");
            if (isStale) {
              const failedToken = tokens[idx];
              if (failedToken) staleTokens.push(failedToken);
            }
          }
        });

        if (staleTokens.length > 0) {
          console.log(`[FIREBASE] Found ${staleTokens.length} stale FCM tokens during multicast. Clearing from DB...`);
          await client
            .from('users')
            .update({ fcmToken: null })
            .in('fcmToken', staleTokens);
        }
      }

      return res.json({ 
        success: true, 
        message: `Đã gửi thành công đến ${response.successCount} thiết bị. Thất bại: ${response.failureCount}` 
      });
    } else if (userId) {
      // Send to specific user
      const { data: user, error } = await client
        .from('users')
        .select('fcmToken')
        .eq('id', userId)
        .single();
        
      if (error || !user?.fcmToken) {
        return res.status(404).json({ error: "Người dùng này chưa đăng ký nhận thông báo trên app." });
      }

      const success = await sendPushNotification(user.fcmToken, title, body);
      if (success) {
        return res.json({ success: true, message: "Gửi thông báo thành công!" });
      } else {
        return res.status(500).json({ error: "Gửi thông báo thất bại qua Firebase Admin." });
      }
    } else {
      return res.status(400).json({ error: "Vui lòng chọn người dùng hoặc chọn gửi tất cả." });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Lightweight REAL-TIME system budget check route
router.get("/budget", async (req, res) => {
  try {
    const client = initSupabase();
    if (!client) {
      return res.status(500).json({
        error: "Cấu hình Supabase không hợp lệ",
        message: "Hệ thống chưa được cấu hình Supabase URL hoặc Service Role Key."
      });
    }
    const { data } = await client.from('config').select('value').eq('key', 'SYSTEM_BUDGET').single();
    const budgetVal = data?.value !== undefined ? Number(data.value) : 0;
    return res.json({ budget: budgetVal });
  } catch (err: any) {
    console.error("[API BUDGET] Error checking budget:", err);
    res.status(500).json({ error: err.message });
  }
});

// Memory cache to prevent duplicate visitor increments within the same calendar day
const visitorSessions = new Set<string>();

router.get("/data", async (req, res) => {
  try {
    const client = initSupabase();
    if (!client) {
      return res.status(500).json({
        error: "Cấu hình Supabase không hợp lệ",
        message: "Hệ thống chưa được cấu hình Supabase URL hoặc Service Role Key."
      });
    }

    const isAdmin = (req as any).user?.isAdmin === true;
    const isBackup = req.query.backup === 'true';
    const userIdFromQuery = req.query.userId as string;
    const userSearch = req.query.userSearch as string;
    const loanSearch = req.query.loanSearch as string;

    // Fast, non-blocking real-time monthly visitor tracking
    if (!isAdmin && userIdFromQuery) {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate()}`;
      const trackingKey = `${userIdFromQuery}_${dateStr}`;
      
      if (!visitorSessions.has(trackingKey)) {
        visitorSessions.add(trackingKey);
        
        // Prevent heap memory blowup by automatically clearing cache
        if (visitorSessions.size > 5000) {
          visitorSessions.clear();
        }
        
        const curMonthStr = (now.getMonth() + 1).toString().padStart(2, '0');
        const curYearStr = now.getFullYear().toString();
        const monthKey = `VISITORS_${curMonthStr}_${curYearStr}`;
        
        // Non-blocking asynchronous database update
        (async () => {
          try {
            const { data } = await client.from('config').select('value').eq('key', monthKey).maybeSingle();
            const currentVal = Number(data?.value || 0);
            const nextVal = currentVal + 1;
            await client.from('config').upsert({ key: monthKey, value: nextVal.toString() }, { onConflict: 'key' });
            
            // Broadcast the new visitor stats instantly to all active admins
            const io = req.app.get("io");
            if (io) {
              io.to("admin").emit("visitor_stats_updated", { key: monthKey, value: nextVal });
            }
          } catch (err) {
            console.warn("[VISITOR TRACK] Failed to update monthly visitor count safely:", err);
          }
        })();
      }
    }

    // SECURITY: Strictly block any non-admin from requesting a full backup
    if (isBackup && !isAdmin) {
      return res.status(403).json({ 
        error: "Quyền hạn không đủ", 
        message: "Chỉ quản trị viên mới có quyền thực hiện sao lưu toàn bộ hệ thống." 
      });
    }

    // Individual query functions with role-based filtering and pagination
    const fetchUsers = async () => {
      try {
        const from = parseInt(req.query.userFrom as string) || 0;
        // Optimization: When backup=true, we fetch all users (up to 10000)
        // Normal admin view fetches 20-1000 based on params
        const to = isBackup ? 10000 : (parseInt(req.query.userTo as string) || (req.query.full === 'true' ? 99 : 19));
        const since = parseInt(req.query.since as string) || 0;

        // Security: Only fetch full columns if explicitly requested (e.g. for profile or admin edit)
        // AND ensure password is NEVER included in data fetch unless it's an admin backup
        let columnsList = (req.query.full === 'true' ? USER_COLUMNS : USER_SUMMARY_COLUMNS);
        
        if (isBackup) {
          columnsList = USER_WRITE_COLUMNS;
        } else {
          columnsList = columnsList.filter(c => c !== 'password');
        }
        
        const columns = isBackup ? '*' : columnsList.join(',');
          
        let query = client.from('users').select(columns, { count: 'exact' });
        
        // SECURITY: If not admin, ONLY allow fetching own data
        if (!isAdmin) {
          if (!userIdFromQuery) return { data: [], count: 0 };
          query = query.eq('id', userIdFromQuery);
        } else {
          // Server-side search for admin
          if (userSearch) {
            query = query.or(`phone.ilike.%${userSearch}%,fullName.ilike.%${userSearch}%,id.ilike.%${userSearch}%,idNumber.ilike.%${userSearch}%`);
          }
          // Pagination for admin
          query = query.order('updatedAt', { ascending: false }).range(from, to);
        }

        if (since > 0) {
          query = query.gt('updatedAt', since);
        }
        
        const { data, count, error } = await query;
        if (error) {
          // Re-attempt without missing columns if it looks like a schema issue
          if (error.code === 'PGRST204' || error.code === '42703' || (error.message && error.message.includes('column') && error.message.includes('does not exist'))) {
             console.warn("[API] Retrying users fetch without potentially missing columns...");
             const commonNewColumns = ['payosOrderCode', 'payosCheckoutUrl', 'payosAmount', 'payosExpireAt', 'idNumber', 'refZalo', 'spins', 'vouchers', 'totalProfit', 'fullSettlementCount', 'lastPenaltyDate', 'penaltyStreak', 'hasCustomLimit', 'isFreeUpgrade', 'avatar', 'bankName', 'bankBin', 'bankAccountNumber', 'bankAccountHolder', 'isLocked', 'lockedAt', 'lockedReason'];
             
             if (columns !== '*') {
               const columnsList = columns.split(',').map(c => c.trim());
               const saferColumns = columnsList.filter(c => !commonNewColumns.includes(c)).join(',');
               console.log(`[API] Retrying with safer columns: ${saferColumns}`);
               const { data: retryData, count: retryCount, error: retryError } = await client.from('users').select(saferColumns, { count: 'exact' }).range(from, to);
               if (!retryError) return { data: retryData || [], count: retryCount || 0 };
             }
          }

          // If custom columns fail, fallback to * for admin
          if (isAdmin) {
             console.warn("[API] Falling back to select('*') for users fetch...");
             const { data: fallbackData, count: fallbackCount, error: fallbackError } = await client.from('users').select('*', { count: 'exact' }).range(from, to);
             if (fallbackError) throw fallbackError;
             return { data: fallbackData || [], count: fallbackCount || 0 };
          }
          throw error;
        }

        // --- PROCESS OVERDUE PENALTIES ---
        // We only process penalties for the specific user being queried (if not admin bulk query)
        if (userIdFromQuery && data && data.length > 0) {
          try {
            const settings = await getMergedSettings(client);
            // Need loans for penalty calculation
            const { data: userLoans } = await client.from('loans').select('id,userId,status,date,amount').eq('userId', data[0].id);
            const processedUser = await processRankPenalties(data[0], userLoans || [], settings, client, (req as any).app.get("io"));
            data[0] = { ...data[0], ...processedUser };
          } catch (penaltyErr) {
            console.error("[Penalty Process] Error:", penaltyErr);
          }
        }
        
        return { data: data || [], count: count || 0 };
      } catch (e: any) {
        console.error("Lỗi fetch users:", e.message || e);
        return { data: [], count: 0 };
      }
    };

    const fetchLoans = async () => {
      try {
        const from = parseInt(req.query.loanFrom as string) || 0;
        const to = isBackup ? 10000 : (parseInt(req.query.loanTo as string) || (req.query.full === 'true' ? 99 : 19));
        const since = parseInt(req.query.since as string) || 0;

        const columnsToFetch = req.query.full === 'true' ? LOAN_COLUMNS.join(',') : LOAN_SUMMARY_COLUMNS.join(',');
        let query = client.from('loans').select(columnsToFetch, { count: 'exact' });
        
        if (!isAdmin && userIdFromQuery) {
          query = query.eq('userId', userIdFromQuery);
        } else if (isAdmin) {
          // Server-side search for admin
          if (loanSearch) {
            query = query.or(`id.ilike.%${loanSearch}%,userName.ilike.%${loanSearch}%,userId.ilike.%${loanSearch}%,bankTransactionId.ilike.%${loanSearch}%`);
          }
          // Pagination for admin
          query = query.order('updatedAt', { ascending: false }).range(from, to);
        }

        if (since > 0) {
          query = query.gt('updatedAt', since);
        }

        const { data, count, error } = await query;
        if (error) throw error;
        return { data: data || [], count: count || 0 };
      } catch (e: any) {
        console.error("Lỗi fetch loans:", e.message || e);
        return { data: [], count: 0 };
      }
    };

    const fetchNotifications = async () => {
      try {
        const from = parseInt(req.query.notifFrom as string) || 0;
        const to = isBackup ? 10000 : (parseInt(req.query.notifTo as string) || 19);
        const since = parseInt(req.query.since as string) || 0;

        const columns = req.query.full === 'true' ? NOTIFICATION_COLUMNS.join(',') : NOTIFICATION_SUMMARY_COLUMNS.join(',');
        let query = client.from('notifications').select(columns, { count: 'exact' });
        
        if (!isAdmin && userIdFromQuery) {
          query = query.eq('userId', userIdFromQuery);
        } else if (isAdmin) {
          // Fetch notifications for Admin or specific user
          query = query.or(`userId.eq.${userIdFromQuery},userId.eq.ADMIN`);
        }

        // Fetch a larger set (up to 500 rows) so we can sort chronologically across prefixes in memory
        const { data, count, error } = await query.limit(500);
        if (error) throw error;
        
        let sortedData = data || [];
        
        // Helper to extract chronological timestamp from notification objects
        const parseNotifTimestamp = (notif: any) => {
          if (!notif) return 0;
          // 1. Try to extract timestamp from ID (matches 9 to 14 digit numeric sequences like Date.now())
          if (notif.id && typeof notif.id === 'string') {
            const matches = notif.id.match(/\d{9,14}/);
            if (matches) {
              const ts = parseInt(matches[0]);
              return ts < 10000000000 ? ts * 1000 : ts;
            }
          }
          // 2. Parse human readable string "HH:MM DD/MM/YYYY" or similar with seconds/AM/PM
          if (notif.time && typeof notif.time === 'string') {
            try {
              const cleanTimeStr = notif.time.replace(/\s+/g, ' ').trim();
              const parts = cleanTimeStr.split(' ');
              if (parts.length >= 2) {
                // Find date part (contains /) and time part (contains :)
                const datePart = parts.find(p => p.includes('/'));
                const timePart = parts.find(p => p.includes(':'));
                
                if (datePart && timePart) {
                  const dateParts = datePart.split('/');
                  const timeParts = timePart.split(':');
                  
                  if (dateParts.length === 3 && timeParts.length >= 2) {
                    const year = parseInt(dateParts[2]);
                    const month = parseInt(dateParts[1]) - 1;
                    const day = parseInt(dateParts[0]);
                    
                    let hour = parseInt(timeParts[0]);
                    const minute = parseInt(timeParts[1]);
                    
                    // Handler for AM/PM variations
                    const lowerNotifTime = notif.time.toLowerCase();
                    if (lowerNotifTime.includes('pm') && hour < 12) {
                      hour += 12;
                    } else if (lowerNotifTime.includes('am') && hour === 12) {
                      hour = 0;
                    }
                    
                    return new Date(year, month, day, hour, minute).getTime();
                  }
                }
              }
            } catch (e) {}
          }
          return 0;
        };

        // Sort chronologically in memory (newest first)
        sortedData.sort((a: any, b: any) => parseNotifTimestamp(b) - parseNotifTimestamp(a));
        
        // Paginate in memory
        const paginatedData = sortedData.slice(from, to + 1);
        return { data: paginatedData, count: count || sortedData.length };
      } catch (e: any) {
        console.error("Lỗi fetch notifications:", e.message || e);
        return { data: [], count: 0 };
      }
    };

    const fetchConfig = async () => {
      try {
        // Use loadSystemSettings which has caching
        const settings = await loadSystemSettings(client);
        return Object.entries(settings).map(([key, value]) => ({ key, value }));
      } catch (e: any) {
        console.error("Lỗi fetch config:", e.message || e);
        return [];
      }
    };

    const fetchBudgetLogs = async () => {
      if (!isAdmin) return { data: [], count: 0 }; // Only admin needs budget logs
      try {
        let query = client.from('budget_logs')
          .select('*', { count: 'exact' })
          .order('createdAt', { ascending: false });
        
        if (!isBackup) {
          query = query.limit(2000); // Increased from 30 to 2000 for accurate capital statistics
        }
        
        const { data, count, error } = await query;
        if (error) throw error;
        return { data: data || [], count: count || 0 };
      } catch (e: any) {
        console.error("Lỗi fetch budget logs:", e.message || e);
        return { data: [], count: 0 };
      }
    };

    // Parallelize queries
    const startFetch = Date.now();
    const [userRes, loanRes, notifRes, config, logRes] = await Promise.all([
      fetchUsers(),
      fetchLoans(),
      fetchNotifications(),
      fetchConfig(),
      fetchBudgetLogs()
    ]);
    const endFetch = Date.now();
    console.log(`[API] Data fetch took ${endFetch - startFetch}ms. Users: ${userRes.data.length}, Loans: ${loanRes.data.length}`);

    let budget = Number(config?.find(c => c.key === 'SYSTEM_BUDGET')?.value || config?.find(c => c.key === 'budget')?.value) || 0;
    const rankProfit = Number(config?.find(c => c.key === 'TOTAL_RANK_PROFIT')?.value || config?.find(c => c.key === 'rankProfit')?.value) || 0;
    const loanProfit = Number(config?.find(c => c.key === 'TOTAL_LOAN_PROFIT')?.value || config?.find(c => c.key === 'loanProfit')?.value) || 0;
    const monthlyStats = config?.find(c => c.key === 'MONTHLY_STATS')?.value || config?.find(c => c.key === 'monthlyStats')?.value || [];
    const lastKeepAlive = config?.find(c => c.key === 'lastKeepAlive')?.value || null;

    // Fetch dynamic visitor stats & currently online users real-time
    const now = new Date();
    const curMonthStr = (now.getMonth() + 1).toString().padStart(2, '0');
    const curYearStr = now.getFullYear().toString();
    const monthKey = `VISITORS_${curMonthStr}_${curYearStr}`;
    const monthlyVisitors = Number(config?.find(c => c.key === monthKey)?.value || 0);

    const getActiveUsersCount = req.app.get("getActiveUsersCount");
    const onlineUsers = getActiveUsersCount ? getActiveUsersCount() : 1;

    const payload = {
      users: userRes.data,
      loans: loanRes.data,
      notifications: notifRes.data,
      totalUsers: userRes.count,
      totalLoans: loanRes.count,
      totalNotifications: notifRes.count,
      budget,
      rankProfit,
      loanProfit,
      monthlyStats,
      lastKeepAlive,
      budgetLogs: logRes.data,
      totalBudgetLogs: logRes.count,
      monthlyVisitors,
      onlineUsers,
      configs: isBackup ? Object.fromEntries(config.map(c => [c.key, c.value])) : undefined // Proper way to export all configs
    };

    // Only calculate storage usage if explicitly requested
    let usage = 0;
    if (req.query.checkStorage === 'true') {
      usage = getStorageUsage(payload);
    }
    
    const isFull = usage > STORAGE_LIMIT_MB;

    // Run cleanup in background if usage is high
    if (usage > STORAGE_LIMIT_MB * 0.8) {
      autoCleanupStorage();
    }

    sendSafeJson(res, {
      ...payload,
      storageFull: isFull,
      storageUsage: usage.toFixed(2)
    });
  } catch (e: any) {
    console.error("Lỗi nghiêm trọng trong /api/data:", e);
    res.status(500).json({ 
      error: "Lỗi hệ thống", 
      message: `Đã xảy ra lỗi nghiêm trọng: ${e.message || "Không xác định"}. Vui lòng kiểm tra lại kết nối Supabase.` 
    });
  }
});

// Get single user details (full)
router.get("/users/:id", async (req: any, res) => {
  try {
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase chưa được cấu hình" });
    
    const userId = req.params.id;
    const isAdmin = req.user?.isAdmin === true;
    
    // SECURITY: Non-admins can only fetch their own details
    if (!isAdmin && userId !== req.user.id) {
      return res.status(403).json({ error: "Bạn không có quyền truy cập thông tin này" });
    }
    
    const { data, error } = await client
      .from('users')
      .select(USER_COLUMNS.join(','))
      .eq('id', userId)
      .single();
      
    if (error) {
       if (error.code === 'PGRST116') return res.status(404).json({ error: "Không tìm thấy người dùng" });
       throw error;
    }
    
    sendSafeJson(res, data);
  } catch (e: any) {
    console.error("Lỗi fetch user detail:", e);
    res.status(500).json({ error: "Lỗi hệ thống", message: e.message });
  }
});

router.post("/users", async (req: any, res) => {
  try {
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase chưa được cấu hình" });
    const incomingUsers = req.body;
    if (!Array.isArray(incomingUsers)) {
      return res.status(400).json({ error: "Dữ liệu phải là một mảng" });
    }

    // Security check: If not admin, can only update own record and CANNOT change isAdmin status
    if (!req.user?.isAdmin) {
      const otherUser = incomingUsers.find(u => u.id !== req.user.id);
      if (otherUser) {
        return res.status(403).json({ error: "Bạn không có quyền cập nhật dữ liệu của người khác" });
      }
      
      // Prevent privilege escalation: Ensure isAdmin is not changed or is explicitly false
      incomingUsers.forEach(u => {
        if (u.isAdmin !== undefined) {
          u.isAdmin = false; // Force to false for non-admins
        }
      });
    }

    // Hash passwords for new users
    const processedUsers = await Promise.all(incomingUsers.map(async (u) => {
      // Robust check for bcrypt hash: starts with $2a$, $2b$, or $2y$ and has correct length
      const isAlreadyHashed = typeof u.password === 'string' && 
                             /^\$2[aby]\$\d+\$.{53}$/.test(u.password);
                             
      if (u.password && typeof u.password === 'string' && !isAlreadyHashed) {
        const salt = await bcrypt.genSalt(10);
        u.password = await bcrypt.hash(u.password, salt);
      }
      return u;
    }));

    const sanitizedUsers = sanitizeData(processedUsers, USER_WRITE_COLUMNS);
    if (sanitizedUsers.length === 0) {
      return res.status(400).json({ error: "Không có dữ liệu hợp lệ để lưu" });
    }

    // Fetch existing users before upsert to detect limit/rank changes
    const userIds = sanitizedUsers.map(u => u.id);
    let existingUsers: any[] = [];
    try {
      const { data } = await client
        .from('users')
        .select('id, fullName, totalLimit, rank, fcmToken')
        .in('id', userIds);
      if (data) existingUsers = data;
    } catch (e) {
      console.error("Lỗi fetch existing users in API /users:", e);
    }

    console.log(`[API] Syncing ${sanitizedUsers.length} users to Supabase...`);
    
    // Bulk upsert with fallback for missing columns
    const { error } = await client.from('users').upsert(sanitizedUsers, { onConflict: 'id' });
    if (error) {
      // If it's a missing column error, try again without the new columns
      if (error.code === 'PGRST204' || error.code === '42703' || (error.message && (error.message.includes('column') && error.message.includes('does not exist')))) {
        console.warn("[API] Retrying users upsert without potentially missing columns...");
        // Identify common new columns that might be missing
        const commonNewColumns = ['idNumber', 'refZalo', 'spins', 'vouchers', 'totalProfit', 'fullSettlementCount', 'lastPenaltyDate', 'penaltyStreak', 'hasCustomLimit', 'isFreeUpgrade', 'payosOrderCode', 'payosCheckoutUrl', 'payosAmount', 'payosExpireAt', 'avatar', 'bankBin'];
        
        let saferColumns = USER_WRITE_COLUMNS;
        
        // If the error message mentions a specific column, remove it
        const missingColumnMatch = error.message.match(/column ['"]?([^'"]+)['"]? does not exist/i) || error.message.match(/find the ['"]?([^'"]+)['"]? column/i);
        if (missingColumnMatch && missingColumnMatch[1]) {
           let missingCol = missingColumnMatch[1];
           if (missingCol.includes('.')) missingCol = missingCol.split('.').pop() || missingCol;
           console.log(`[API] Removing missing column found in error msg: ${missingCol}`);
           saferColumns = saferColumns.filter(c => c !== missingCol.trim());
        } else {
           console.log("[API] Removing all potentially new columns for safety");
           saferColumns = USER_WRITE_COLUMNS.filter(c => !commonNewColumns.includes(c));
        }
          
        const saferUsers = sanitizeData(processedUsers, saferColumns);
        const { error: retryError } = await client.from('users').upsert(saferUsers, { onConflict: 'id' });
        
        if (!retryError) {
          console.log("[API] Retry upsert succeeded.");
          return res.status(200).json({ message: "Cập nhật thành công (bỏ qua cột thiếu)" });
        }
        
        console.error("[API ERROR] Retry upsert failed:", JSON.stringify(retryError));
        return res.status(500).json({ 
          error: "Lỗi cơ sở dữ liệu (Retry failed)", 
          message: retryError.message 
        });
      }

      console.error("[API ERROR] Supabase upsert failed for users:", JSON.stringify(error));
      return res.status(500).json({ 
        error: "Lỗi cơ sở dữ liệu", 
        message: error.message, 
        code: error.code 
      });
    }

    console.log(`[API] Users synced successfully.`);

    // Process automatic real-time notifications for limit/rank changes
    if (existingUsers && existingUsers.length > 0) {
      try {
        const { data: configRows } = await client.from('config').select('*');
        const systemConfig: Record<string, any> = {};
        configRows?.forEach((row: any) => {
          systemConfig[row.key] = row.value;
        });

        const rankConfigs = typeof systemConfig.RANK_CONFIG === 'string' 
          ? JSON.parse(systemConfig.RANK_CONFIG) 
          : (systemConfig.RANK_CONFIG || []);

        for (const u of sanitizedUsers) {
          const existing = existingUsers.find(e => e.id === u.id);
          if (existing) {
            const limitChanged = u.totalLimit !== undefined && Number(u.totalLimit) !== Number(existing.totalLimit);
            const rankChanged = u.rank && u.rank !== existing.rank;

            if (limitChanged || rankChanged) {
              const oldRankLabel = (rankConfigs.find((r: any) => r.id === existing.rank)?.name || existing.rank || "").toUpperCase();
              let newRankLabel = (rankConfigs.find((r: any) => r.id === u.rank)?.name || u.rank || "").toUpperCase();

              // Calculate maximum rank limit to define the system's maximum loan amount
              const maxLimitOverall = rankConfigs && rankConfigs.length > 0
                ? Math.max(...rankConfigs.map((r: any) => Number(r.maxLimit || 0)))
                : 50000000;

              const limitExceedsSystemMax = u.totalLimit !== undefined && Number(u.totalLimit) > maxLimitOverall;
              if (limitExceedsSystemMax) {
                newRankLabel = "VIP";
              }

              let title = "";
              let message = "";

              if (rankChanged && limitChanged) {
                title = "Nâng hạng & Tăng hạn mức";
                message = `Chúc mừng! Tài khoản của bạn đã được nâng lên hạng ${newRankLabel} với hạn mức vay mới là ${(Number(u.totalLimit)).toLocaleString('vi-VN')} đ.`;
              } else if (rankChanged) {
                title = "Nâng hạng thành viên";
                message = `Tài khoản của bạn đã được cập nhật lên hạng ${newRankLabel} thành công.`;
              } else if (limitChanged) {
                if (limitExceedsSystemMax) {
                  title = "Nâng hạng & Tăng hạn mức";
                  message = `Chúc mừng! Tài khoản của bạn đã được nâng lên hạng VIP với hạn mức vay mới là ${(Number(u.totalLimit)).toLocaleString('vi-VN')} đ.`;
                } else {
                  title = "Thay đổi hạn mức vay";
                  message = `Hạn mức vay của bạn đã được Admin điều chỉnh thành ${(Number(u.totalLimit)).toLocaleString('vi-VN')} đ.`;
                }
              }

              if (title && message) {
                const notifId = `SYS-NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                const timeStr = `${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${new Date().toLocaleDateString('vi-VN')}`;
                const newNotif = {
                  id: notifId,
                  userId: u.id,
                  title,
                  message,
                  time: timeStr,
                  read: false,
                  type: 'SYSTEM'
                };

                // Add to notifications table
                await client.from('notifications').insert([newNotif]);

                // Emit to user room so it syncs immediately in real-time
                const ioObj = req.app.get("io");
                if (ioObj) {
                  ioObj.to(`user_${u.id}`).emit("notification_updated", newNotif);
                }

                // Push notification to .apk
                await triggerPushForUser(u.id, title, message, client);
              }
            }
          }
        }
      } catch (notifyErr) {
        console.error("Lỗi tối ưu hóa thông báo tự động cho người dùng:", notifyErr);
      }
    }
    
    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      sanitizedUsers.forEach(u => {
        io.to(`user_${u.id}`).emit("user_updated", u);
        
        // Notify admin of important updates
        if (u.pendingUpgradeRank && u.rankUpgradeBill) {
          const notifyMsg = `Người dùng ${u.fullName || u.id} vừa gửi yêu cầu nâng hạng lên ${u.pendingUpgradeRank.toUpperCase()}.`;
          io.to("admin").emit("admin_notification", {
            type: "RANK_UPGRADE",
            message: notifyMsg
          });

          // Persistent admin notification
          client.from('notifications').insert([{
            id: `ADMIN-NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            userId: 'ADMIN',
            title: 'Yêu cầu nâng hạng mới',
            message: notifyMsg,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
            read: false,
            type: 'RANK'
          }]).then(({ error }) => { if (error) console.error("Lỗi lưu thông báo admin:", error); });

          // Telegram Notification
          getMergedSettings(client).then(settings => {
            const telegramMsg = `<b>⭐ YÊU CẦU NÂNG HẠNG MỚI</b>\n` +
              `• <b>Họ tên:</b> ${u.fullName || 'Chưa cung cấp'}\n` +
              `• <b>Số điện thoại:</b> <code>${u.phone || u.id}</code>\n` +
              `• <b>ID Hệ thống:</b> <code>${u.id}</code>\n` +
              `• <b>Hạng yêu cầu:</b> <code>${u.pendingUpgradeRank.toUpperCase()}</code>\n` +
              `• <b>Yêu cầu:</b> Chờ duyệt nâng hạng và hạn mức mới\n` +
              `• <b>Thời gian:</b> ${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')}`;
            sendTelegramNotification(telegramMsg, settings);
          }).catch(err => console.error("Lỗi lấy settings cho Telegram Rank:", err));
        }
      });
      io.to("admin").emit("users_updated", sanitizedUsers);
    }
    
    sendSafeJson(res, { success: true });
  } catch (e: any) {
    console.error("Lỗi trong /api/users:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

// New endpoint specifically for password changes with old password verification
router.post("/change-password", authenticateToken, async (req: any, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: "Không tìm thấy thông tin định danh" });
    if (!oldPassword || !newPassword) return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin" });

    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase chưa được cấu hình" });

    // 1. Fetch current user with password
    const { data: user, error: fetchError } = await client
      .from('users')
      .select('password')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    // 2. Verify old password
    const storedHash = user.password;
    let isMatch = false;

    if (typeof storedHash === 'string') {
      // Standard bcrypt regex (2a/2b/2y, 2-digit cost, 53 salt/hash chars)
      const isBcryptHash = /^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$/.test(storedHash);
      
      if (isBcryptHash) {
        try {
          isMatch = await bcrypt.compare(oldPassword, storedHash);
        } catch (compareError: any) {
          console.warn(`[PASSWORD_CHANGE] Bcrypt.compare failed for user ${userId}:`, compareError.message);
          // Failsafe fallback
          isMatch = oldPassword === storedHash;
        }
      } else {
        // Direct match for plain text
        isMatch = oldPassword === storedHash;
      }
    }

    if (!isMatch) {
      console.log(`[PASSWORD_CHANGE] Password mismatch for user ${userId}`);
      return res.status(400).json({ error: "MẬT KHẨU CŨ KHÔNG CHÍNH XÁC" });
    }

    // 3. Hash new password and update
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    const { error: updateError } = await client
      .from('users')
      .update({ password: newHash })
      .eq('id', userId);

    if (updateError) {
      return res.status(500).json({ error: "Lỗi hệ thống khi cập nhật mật khẩu" });
    }

    res.json({ success: true, message: "Đổi mật khẩu thành công" });
  } catch (e: any) {
    console.error("[API ERROR] Error in /change-password:", e);
    res.status(500).json({ error: e.message });
  }
});

router.post("/loans", async (req: any, res) => {
  try {
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase chưa được cấu hình" });
    const incomingLoans = req.body;
    if (!Array.isArray(incomingLoans)) {
      return res.status(400).json({ error: "Dữ liệu phải là một mảng" });
    }

    // Security check: If not admin, check for overdue loans and ensure they only update own data
    if (!req.user?.isAdmin) {
      const otherLoan = incomingLoans.find(l => l.userId !== req.user.id);
      if (otherLoan) {
        return res.status(403).json({ error: "Bạn không có quyền cập nhật khoản vay của người khác" });
      }

      // Check for overdue loans if this is a NEW loan application
      const isNewLoan = incomingLoans.some(l => !l.status || l.status === 'CHỜ DUYỆT');
      if (isNewLoan) {
        const { data: userLoans } = await client.from('loans').select('status, date').eq('userId', req.user.id);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const hasOverdue = userLoans?.some(l => {
          if (l.status === 'QUÁ HẠN' || l.status === 'OVERDUE') return true;
          if (['ĐANG NỢ', 'CHỜ TẤT TOÁN'].includes(l.status) && l.date) {
            const parts = l.date.split('/');
            if (parts.length === 3) {
              const [d, m, y] = parts.map(Number);
              const dueDate = new Date(y, m - 1, d);
              return dueDate < today;
            }
          }
          return false;
        });

        if (hasOverdue) {
          return res.status(400).json({ error: "Bạn đang có khoản vay quá hạn. Vui lòng tất toán trước khi đăng ký mới." });
        }
      }
    }

    // Anti-replay check for bankTransactionId
    for (const loan of incomingLoans) {
      if (loan.bankTransactionId) {
        const { data: existing, error: checkError } = await client
          .from('loans')
          .select('id')
          .eq('bankTransactionId', loan.bankTransactionId)
          .neq('id', loan.id)
          .limit(1);
        
        if (checkError) {
          console.error("Lỗi check bankTransactionId:", JSON.stringify(checkError));
        } else if (existing && existing.length > 0) {
          return res.status(400).json({ 
            error: "Giao dịch đã tồn tại", 
            message: `Mã giao dịch ${loan.bankTransactionId} đã được sử dụng cho một khoản vay khác. Vui lòng kiểm tra lại.` 
          });
        }
      }
    }

    const sanitizedLoans = sanitizeData(incomingLoans, LOAN_COLUMNS);
    if (sanitizedLoans.length === 0) {
      return res.status(400).json({ error: "Không có dữ liệu hợp lệ để lưu" });
    }

    // Fetch existing loans before upsert to detect status change
    const loanIds = sanitizedLoans.map((l: any) => l.id);
    let existingLoans: any[] = [];
    try {
      const { data } = await client
        .from('loans')
        .select('id, userId, status, amount')
        .in('id', loanIds);
      if (data) existingLoans = data;
    } catch (e) {
      console.error("Lỗi fetch existing loans in API:", e);
    }

    // Budget & Min Amount check for new loans (if not admin)
    if (!req.user?.isAdmin) {
      const newLoan = sanitizedLoans.find(l => l.status === 'CHỜ DUYỆT');
      if (newLoan) {
        const settings = await getMergedSettings(client);
        
        // 1. Check Rounding (Must be multiple of 1,000,000)
        if (newLoan.amount % 1000000 !== 0) {
          return res.status(400).json({ 
            error: "Số tiền không hợp lệ", 
            message: "Các khoản vay phải là bội số của 1.000.000 đ (ví dụ: 1tr, 2tr, 3tr...)." 
          });
        }

        // 2. Check Min Amount
        const minAmount = Number(settings.MIN_LOAN_AMOUNT || 1000000);
        if (newLoan.amount < minAmount) {
          return res.status(400).json({ 
            error: "Số tiền không hợp lệ", 
            message: `Số tiền vay tối thiểu là ${minAmount.toLocaleString()} đ.` 
          });
        }

        // 3. Check System Budget
        const minBudget = (settings.MIN_SYSTEM_BUDGET !== undefined && settings.MIN_SYSTEM_BUDGET !== null) ? Number(settings.MIN_SYSTEM_BUDGET) : 1000000;
        const currentBudget = Number(settings.SYSTEM_BUDGET || 0);
        
        if (currentBudget < minBudget) {
          return res.status(400).json({ 
            error: "Hệ thống bảo trì", 
            message: `Hệ thống đang bảo trì nguồn vốn (vốn còn lại dưới ${minBudget.toLocaleString()} đ). Vui lòng quay lại sau.` 
          });
        }
      }
    }

    // Consolidation Logic: If admin is disbursing a loan, check if user already has an active loan
    if (req.user?.isAdmin) {
      for (let i = 0; i < sanitizedLoans.length; i++) {
        const loan = sanitizedLoans[i];
        if (loan.status === 'ĐANG NỢ') {
          // Check for existing active loan (DISBURSED or OVERDUE) for this user
          // Important: Status names must match exactly what's used in the DB
          const { data: existingActiveLoans } = await client
            .from('loans')
            .select('*')
            .eq('userId', loan.userId)
            .in('status', ['ĐANG NỢ', 'QUÁ HẠN'])
            .neq('id', loan.id) // Don't match the current loan
            .limit(1);

          if (existingActiveLoans && existingActiveLoans.length > 0) {
            const primaryLoan = existingActiveLoans[0];
            
            // CONSOLIDATE: Update primary loan amount (Keep original due date)
            const newTotalAmount = Number(primaryLoan.amount || 0) + Number(loan.amount || 0);
            
            // We no longer update 'date: loan.date' to keep the original deadline
            await client.from('loans').update({
              amount: newTotalAmount,
              updatedAt: Date.now()
            }).eq('id', primaryLoan.id);

            // Update the primary loan if it exists in the current sync payload to prevent overwriting
            const primaryInSync = sanitizedLoans.find(l => l.id === primaryLoan.id);
            if (primaryInSync) {
              primaryInSync.amount = newTotalAmount;
              primaryInSync.updatedAt = Date.now();
            }

            // Also update User Balance in DB
            const { data: userData } = await client.from('users').select('balance, totalLimit').eq('id', loan.userId).single();
            if (userData) {
              const newBalance = Math.max(0, (userData.balance || 0) - loan.amount);
              await client.from('users').update({ balance: newBalance, updatedAt: Date.now() }).eq('id', loan.userId);
              
              const io = req.app.get("io");
              if (io) {
                io.to(`user_${loan.userId}`).emit("user_updated", { id: loan.userId, balance: newBalance });
              }
            }

            // Change current loan status to 'CONSOLIDATED'
            // This hides it from main debt view but keeps the record
            loan.status = 'CONSOLIDATED'; 
            loan.consolidatedInto = primaryLoan.id;

            // Notify User about Consolidation
            const ioObj = req.app.get("io");
            if (ioObj) {
              const notifId = `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
              const messageStr = `Yêu cầu vay ${Number(loan.amount).toLocaleString()} đ của bạn đã được duyệt và CỘNG DỒN vào khoản vay hiện tại (${primaryLoan.id}). Tổng dư nợ mới là ${newTotalAmount.toLocaleString()} đ.`;
              
              await client.from('notifications').insert([{
                id: notifId,
                userId: loan.userId,
                title: 'Khoản vay đã cộng dồn',
                message: messageStr,
                time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
                read: false,
                type: 'LOAN'
              }]);
              triggerPushForUser(loan.userId, 'Khoản vay đã cộng dồn', messageStr, client);
              
              ioObj.to(`user_${loan.userId}`).emit("notification_updated", {
                id: notifId,
                userId: loan.userId,
                title: 'Khoản vay đã cộng dồn',
                message: messageStr,
                type: 'LOAN'
              });

              // Also sync the primary loan update to the user
              ioObj.to(`user_${loan.userId}`).emit("loan_updated", {
                ...primaryLoan,
                amount: newTotalAmount,
                updatedAt: Date.now()
              });
            }
          }
        }
      }
    }

    // Bulk upsert with fallback for missing columns
    const { error } = await client.from('loans').upsert(sanitizedLoans, { onConflict: 'id' });
    if (error) {
      console.error("Lỗi upsert loans:", JSON.stringify(error));
      
      // If it's a missing column error, try again without the new columns
      if (error.code === '42703' || (error.message && (error.message.includes('column') && error.message.includes('does not exist')))) {
        console.warn("[API] Retrying loans upsert without potentially missing columns...");
        // Identify common new columns that might be missing
        const commonNewColumns = ['principalPaymentCount', 'partialAmount', 'partialPaymentCount', 'extensionCount', 'originalBaseId', 'payosOrderCode', 'payosCheckoutUrl', 'payosAmount', 'payosExpireAt', 'voucherId', 'settledAt'];
        const fallbackColumns = LOAN_COLUMNS.filter(c => !commonNewColumns.some(nc => error.message.includes(nc)));
        
        // If we couldn't identify specific columns from the error message, just remove all common new ones
        const saferColumns = fallbackColumns.length === LOAN_COLUMNS.length 
          ? LOAN_COLUMNS.filter(c => !commonNewColumns.includes(c))
          : fallbackColumns;
          
        const saferLoans = sanitizeData(incomingLoans, saferColumns);
        const { error: retryError } = await client.from('loans').upsert(saferLoans, { onConflict: 'id' });
        
        if (retryError) {
          return res.status(500).json({ 
            error: "Lỗi cơ sở dữ liệu", 
            message: retryError.message, 
            code: retryError.code 
          });
        }
      } else {
        return res.status(500).json({ 
          error: "Lỗi cơ sở dữ liệu", 
          message: error.message, 
          code: error.code,
          hint: error.hint || "Hãy đảm bảo bạn đã chạy SQL schema trong Supabase SQL Editor."
        });
      }
    }

    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      sanitizedLoans.forEach(l => {
        io.to(`user_${l.userId}`).emit("loan_updated", l);
        
        // Evaluate loan status change notifications and trigger push/sockets
        if (existingLoans && existingLoans.length > 0) {
          const oldLoan = existingLoans.find(e => e.id === l.id);
          if (oldLoan) {
            const oldNorm = String(oldLoan.status).toUpperCase().normalize('NFC');
            const newNorm = String(l.status).toUpperCase().normalize('NFC');
            
            if (oldNorm !== newNorm) {
              let title = "";
              let message = "";
              const amountStr = Number(l.amount).toLocaleString('vi-VN');
              
              if (oldNorm === 'CHỜ DUYỆT' && newNorm === 'ĐANG NỢ') {
                title = "Khoản vay được phê duyệt";
                message = `Chúc mừng! Hồ sơ vay mã ${l.id} trị giá ${amountStr} đ của bạn đã được phê duyệt thành công. Số dư khả dụng đã được cộng vào tài khoản của bạn.`;
              } else if (oldNorm === 'CHỜ DUYỆT' && newNorm === 'TỪ CHỐI') {
                title = "Khoản vay bị từ chối";
                message = `Rất tiếc! Hồ sơ đăng ký vay mã ${l.id} trị giá ${amountStr} đ của bạn đã bị từ chối do không đủ điều kiện phê duyệt từ hệ thống.`;
              } else if (oldNorm === 'CHỜ TẤT TOÁN' && (newNorm === 'ĐÃ TẤT TOÁN' || newNorm === 'ĐÃ TẤT TOÁN')) {
                title = "Tất toán thành công";
                message = `Yêu cầu thanh toán cho khoản vay mã ${l.id} trị giá ${amountStr} đ của bạn đã được Admin chấp nhận và hoàn tất tất toán thành công.`;
              } else if (newNorm === 'QUÁ HẠN') {
                title = "Khoản nợ QUÁ HẠN";
                message = `Cảnh báo! Khoản vay mã ${l.id} trị giá ${amountStr} đ đã chuyển sang trạng thái QUÁ HẠN. Vui lòng thanh toán ngay để tránh phát sinh phí phạt bổ sung.`;
              } else if (newNorm === 'GIA HẠN') {
                title = "Đã gia hạn thành công";
                message = `Yêu cầu xin gia hạn lùi ngày thanh toán cho khoản nợ mã ${l.id} của bạn đã được Admin duyệt và chấp nhận.`;
              } else if (newNorm === 'TTMP') {
                title = "Xác nhận Thanh toán một phần";
                message = `Giao dịch thanh toán một phần (TTMP) cho khoản vay mã ${l.id} đã được phê duyệt và ghi nhận thành công.`;
              } else {
                title = "Cập nhật trạng thái vay";
                if (newNorm === 'ĐÃ TẤT TOÁN' || newNorm === 'ĐÃ TẤT TOÁN') {
                  title = "Khoản vay đã tất toán";
                  message = `Khoản vay mã ${l.id} trị giá ${amountStr} đ của bạn đã được tất toán thành công.`;
                } else {
                  message = `Khoản vay mã ${l.id} của bạn đã được thay đổi trạng thái thành "${l.status}".`;
                }
              }
              
              if (title && message) {
                const notifId = `LOAN-NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                const timeStr = `${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${new Date().toLocaleDateString('vi-VN')}`;
                const notifyPayload = {
                  id: notifId,
                  userId: l.userId,
                  title,
                  message,
                  time: timeStr,
                  read: false,
                  type: 'LOAN'
                };
                
                // Save database notification record
                client.from('notifications').insert([notifyPayload]).then(({ error: notifErr }) => {
                  if (notifErr) console.error("Lỗi insert notification tự động cho loan:", notifErr);
                });
                
                // Sync via socket
                io.to(`user_${l.userId}`).emit("notification_updated", notifyPayload);
                
                // Trigger push notification to APK (.apk)
                triggerPushForUser(l.userId, title, message, client);
              }
            }
          }
        }
        
        // Notify admin of new loan requests or settlement requests
        if (l.status === 'CHỜ DUYỆT') {
          const notifyMsg = `Có yêu cầu vay mới (${l.amount.toLocaleString()} đ) từ người dùng ${l.userName || l.userId}.`;
          io.to("admin").emit("admin_notification", {
            type: "NEW_LOAN",
            message: notifyMsg
          });
          
          // Persistent admin notification
          client.from('notifications').insert([{
            id: `ADMIN-NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            userId: 'ADMIN',
            title: 'Yêu cầu vay mới',
            message: notifyMsg,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
            read: false,
            type: 'LOAN'
          }]).then(({ error }) => { if (error) console.error("Lỗi lưu thông báo admin:", error); });

          // Telegram Notification
          getMergedSettings(client).then(settings => {
            const telegramMsg = `<b>💸 CÓ YÊU CẦU VAY MỚI</b>\n` +
              `• <b>Người vay:</b> ${l.userName || 'Chưa cập nhật'}\n` +
              `• <b>ID User:</b> <code>${l.userId}</code>\n` +
              `• <b>Số tiền vay:</b> <code>${l.amount.toLocaleString()} đ</code>\n` +
              `• <b>Thời hạn:</b> ${l.term || 0} ngày\n` +
              `• <b>Trạng thái:</b> Chờ duyệt giải ngân\n` +
              `• <b>Thời gian:</b> ${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')}`;
            sendTelegramNotification(telegramMsg, settings);
          }).catch(err => console.error("Lỗi lấy settings cho Telegram Loan:", err));

        } else if (l.status === 'CHỜ TẤT TOÁN') {
          const typeLabel = l.settlementType === 'PRINCIPAL' ? 'gia hạn' : (l.settlementType === 'PARTIAL' ? 'TTMP' : 'tất toán');
          const notifyMsg = `Người dùng ${l.userName || l.userId} vừa gửi yêu cầu ${typeLabel} khoản vay (${l.amount.toLocaleString()} đ).`;
          io.to("admin").emit("admin_notification", {
            type: "PAYMENT",
            message: notifyMsg
          });
          
          // Persistent admin notification
          client.from('notifications').insert([{
            id: `ADMIN-NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            userId: 'ADMIN',
            title: 'Yêu cầu thanh toán mới',
            message: notifyMsg,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
            read: false,
            type: 'LOAN'
          }]).then(({ error }) => { if (error) console.error("Lỗi lưu thông báo admin:", error); });

          // Telegram Notification
          getMergedSettings(client).then(settings => {
            const labelUpper = typeLabel.toUpperCase();
            const telegramMsg = `<b>🔔 YÊU CẦU THANH TOÁN (${labelUpper})</b>\n` +
              `• <b>Khách hàng:</b> ${l.userName || 'Chưa cập nhật'}\n` +
              `• <b>ID User:</b> <code>${l.userId}</code>\n` +
              `• <b>Mã khoản vay:</b> <code>${l.id}</code>\n` +
              `• <b>Số tiền khoản vay:</b> ${l.amount.toLocaleString()} đ\n` +
              `• <b>Phân loại:</b> Yêu cầu ${typeLabel.toLowerCase()} (Đã up bill đối soát)\n` +
              `• <b>Trạng thái:</b> Chờ Admin xác nhận thanh toán\n` +
              `• <b>Thời gian:</b> ${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')}`;
            sendTelegramNotification(telegramMsg, settings);
          }).catch(err => console.error("Lỗi lấy settings cho Telegram Settle:", err));
        }
      });
      io.to("admin").emit("loans_updated", sanitizedLoans);
    }
    
    sendSafeJson(res, { success: true });
  } catch (e: any) {
    console.error("Lỗi trong /api/loans:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

router.post("/notifications", async (req: any, res) => {
  try {
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase chưa được cấu hình" });
    const incomingNotifs = req.body;
    if (!Array.isArray(incomingNotifs)) {
      return res.status(400).json({ error: "Dữ liệu phải là một mảng" });
    }

    // Security check: If not admin, can only update own notifications
    if (!req.user?.isAdmin) {
      const otherNotif = incomingNotifs.find(n => n.userId !== req.user.id);
      if (otherNotif) {
        return res.status(403).json({ error: "Bạn không có quyền cập nhật thông báo của người khác" });
      }
    }

    const sanitizedNotifs = sanitizeData(incomingNotifs, NOTIFICATION_COLUMNS);
    if (sanitizedNotifs.length === 0) {
      return res.status(400).json({ error: "Không có dữ liệu hợp lệ để lưu" });
    }

    // Capture existing notification IDs to identify newly created ones
    const incomingIds = sanitizedNotifs.map(n => n.id);
    const { data: existingNotifs } = await client
      .from('notifications')
      .select('id')
      .in('id', incomingIds);
    
    const existingIds = new Set((existingNotifs || []).map((e: any) => e.id));

    // Bulk upsert
    const { error } = await client.from('notifications').upsert(sanitizedNotifs, { onConflict: 'id' });
    if (error) {
      console.error("Lỗi upsert notifications:", JSON.stringify(error));
      return res.status(500).json({ 
        error: "Lỗi cơ sở dữ liệu", 
        message: error.message, 
        code: error.code,
        hint: error.hint || "Hãy đảm bảo bạn đã chạy SQL schema trong Supabase SQL Editor."
      });
    }

    // Trigger push notifications for brand new, unread notifications on devices
    sanitizedNotifs.forEach(n => {
      if (!existingIds.has(n.id) && n.userId !== 'ADMIN' && !n.read) {
        console.log(`[PUSH] Triggering push notification for newly created notification ${n.id} to user ${n.userId}`);
        triggerPushForUser(n.userId, n.title, n.message, client);
      }
    });
    
    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      sanitizedNotifs.forEach(n => {
        io.to(`user_${n.userId}`).emit("notification_updated", n);
      });
      io.to("admin").emit("notifications_updated", sanitizedNotifs);
    }
    
    sendSafeJson(res, { success: true });
  } catch (e: any) {
    console.error("Lỗi trong /api/notifications:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

router.post("/notifications/:id/read", async (req: any, res) => {
  try {
    const { id } = req.params;
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase chưa được cấu hình" });

    const { error } = await client
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (error) {
      console.error(`[API] Lỗi đánh dấu đã đọc thông báo ${id}:`, error);
      return res.status(500).json({ error: "Lỗi cơ sở dữ liệu", message: error.message });
    }

    // Emit real-time update that notification is read
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${req.user?.id}`).emit("notification_read_ack", { id });
    }

    sendSafeJson(res, { success: true });
  } catch (e: any) {
    console.error(`Lỗi trong /api/notifications/${req.params.id}/read:`, e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

router.post("/budget", async (req: any, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Chỉ Admin mới có quyền thực hiện thao tác này" });
    }
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase chưa được cấu hình" });
    const { budget, type, amount, log } = req.body;
    let finalBudget = budget;

    // Use server-side calculation if type and amount are provided to prevent stale state issues
    if (type && amount !== undefined && (type === 'ADD' || type === 'WITHDRAW' || type === 'INITIAL')) {
      const { data: currentBudgetData } = await client.from('config').select('value').eq('key', 'SYSTEM_BUDGET').single();
      const currentValue = Number(currentBudgetData?.value || 0);
      
      if (type === 'ADD') finalBudget = currentValue + amount;
      else if (type === 'WITHDRAW') finalBudget = currentValue - amount;
      else if (type === 'INITIAL') {
        const { data: loans } = await client.from('loans').select('amount, status');
        const activeStatuses = ['ĐANG NỢ', 'QUÁ HẠN', 'CHỜ TẤT TOÁN', 'ĐANG ĐỐI SOÁT'];
        const activeDebt = loans
          ? loans.filter((l: any) => activeStatuses.includes(l.status)).reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0)
          : 0;
        finalBudget = amount - activeDebt;
      }
    }

    const { error } = await client.from('config').upsert({ key: 'SYSTEM_BUDGET', value: finalBudget }, { onConflict: 'key' });
    if (error) throw error;

    // Send push notification broadcast for budget addition
    if (type === 'ADD' && amount !== undefined && amount >= 1000000) {
      const title = "Hệ thống bổ sung ngân sách giải ngân";
      const body = `Cập nhật: Nguồn quỹ giải ngân đã được bổ sung thêm ${Number(amount).toLocaleString('vi-VN')} đ. Quý khách có nhu cầu vay có thể đăng ký vay hoặc nâng hạng mức vay ngay bây giờ!`;
      broadcastPushNotification(title, body, client);
    }

    // Invalidate cache and emit real-time update
    settingsCache = null;
    const io = req.app.get("io");
    if (io) {
      const budgetNum = Number(finalBudget);
      io.emit("config_updated", [
        { key: 'SYSTEM_BUDGET', value: budgetNum },
        { key: 'budget', value: budgetNum }
      ]);
      io.emit("config_updated", { SYSTEM_BUDGET: budgetNum, budget: budgetNum });
    }

    if (log) {
      // Ensure log has correct balanceAfter if we recalculated server-side
      const logToSave = { ...log, balanceAfter: finalBudget };
      const sanitizedLog = sanitizeData([logToSave], BUDGET_LOG_COLUMNS)[0];
      if (sanitizedLog) {
        await client.from('budget_logs').upsert(sanitizedLog, { onConflict: 'id' });
      }
    }

    sendSafeJson(res, { success: true });
  } catch (e: any) {
    console.error("Lỗi trong /api/budget:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

router.post("/loan/delete", async (req: any, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Chỉ Admin mới có quyền thực hiện thao tác này" });
    }
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase chưa được cấu hình" });
    
    const { loanId } = req.body;
    if (!loanId) return res.status(400).json({ error: "Thiếu ID khoản vay" });

    // 1. Fetch loan details to know its impact
    const { data: loan, error: fetchError } = await client.from('loans').select('*').eq('id', loanId).single();
    
    if (loan) {
      // 2. Determine budget impact if it was already disbursed or had activity
      // Usually we look for budget logs associated with this loan
      const { data: relatedLogs } = await client.from('budget_logs').select('*').ilike('note', `%${loanId}%`);
      
      let budgetDelta = 0;
      let loanProfitDelta = 0;

      if (relatedLogs && relatedLogs.length > 0) {
        for (const log of relatedLogs) {
          switch (log.type) {
            case 'LOAN_DISBURSE':
              budgetDelta += log.amount; // Add back disbursed amount
              break;
            case 'LOAN_REPAY':
              budgetDelta -= log.amount; // Subtract repaid amount from budget
              // Reverse profit: repayment amount - loan principal
              if (log.amount > loan.amount) {
                loanProfitDelta -= (log.amount - loan.amount);
              }
              break;
          }
        }
      }

      if (budgetDelta !== 0 || loanProfitDelta !== 0) {
        const settings = await getMergedSettings(client);
        const updates: any = {};
        if (budgetDelta !== 0) updates.SYSTEM_BUDGET = Number(settings.SYSTEM_BUDGET || 0) + budgetDelta;
        if (loanProfitDelta !== 0) updates.TOTAL_LOAN_PROFIT = Math.max(0, Number(settings.TOTAL_LOAN_PROFIT || 0) + loanProfitDelta);
        
        await saveSystemSettings(client, updates);
        
        // Also delete these logs so they don't stay orphaned and misleading
        await client.from('budget_logs').delete().ilike('note', `%${loanId}%`);
        
        settingsCache = null;
        lastCacheUpdate = 0;
      }
    }

    const { error: deleteError } = await client.from('loans').delete().eq('id', loanId);
    if (deleteError) throw deleteError;

    // 3. Restore User Balance (Available Limit)
    if (loan && loan.userId) {
      const { data: user, error: userError } = await client.from('users').select('balance, totalLimit').eq('id', loan.userId).single();
      if (!userError && user) {
        // Restore balance only for non-settled/non-rejected loans that were actually "active"
        // Most common case is deleting a pending or active loan to fix client status
        const isActuallyDeducted = ['CHỜ DUYỆT', 'ĐÃ DUYỆT', 'ĐANG GIẢI NGÂN', 'ĐANG NỢ', 'CHỜ TẤT TOÁN', 'QUÁ HẠN'].includes(loan.status);
        
        if (isActuallyDeducted) {
          const newBalance = Math.min(user.totalLimit, (user.balance || 0) + loan.amount);
          await client.from('users').update({ balance: newBalance, updatedAt: Date.now() }).eq('id', loan.userId);
          
          // Notify user of balance update
          const io = req.app.get("io");
          if (io) {
            io.to(`user_${loan.userId}`).emit("user_updated", { id: loan.userId, balance: newBalance });
          }
        }
      }
      
      // Also notify user about the deletion
      const io = req.app.get("io");
      if (io) {
        io.to(`user_${loan.userId}`).emit("loan_deleted", { id: loanId });
      }
    }
    
    sendSafeJson(res, { success: true });
  } catch (e: any) {
    console.error("Lỗi trong /api/loan/delete:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

router.post("/budget-log/delete", async (req: any, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Chỉ Admin mới có quyền thực hiện thao tác này" });
    }
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase chưa được cấu hình" });
    
    const { logId } = req.body;
    if (!logId) return res.status(400).json({ error: "Thiếu ID log" });

    // 1. Fetch the log to know its type and amount
    const { data: log, error: fetchError } = await client.from('budget_logs').select('*').eq('id', logId).single();
    if (fetchError || !log) {
      return res.status(404).json({ error: "Không tìm thấy bản ghi log" });
    }

    // 2. Fetch current settings to update budget
    const settings = await getMergedSettings(client);
    let currentBudget = Number(settings.SYSTEM_BUDGET || 0);
    let loanProfit = Number(settings.TOTAL_LOAN_PROFIT || 0);
    let fineProfit = Number(settings.TOTAL_FINE_PROFIT || 0);

    // 3. Determine reversal impact and cascade effects
    // Log types: 'INITIAL' | 'ADD' | 'WITHDRAW' | 'LOAN_DISBURSE' | 'LOAN_REPAY' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'
    let budgetDelta = 0;
    let loanProfitDelta = 0;
    let fineProfitDelta = 0;
    let rankProfitDelta = 0;
    
    // Extract entity identifiers from note
    const loanMatch = log.note.match(/L-[a-zA-Z0-9]+/);
    const loanId = loanMatch ? loanMatch[0] : null;
    
    // For rank upgrades: [Tự động] PayOS: Nâng hạng {RANK} cho {USER}
    const rankMatch = log.note.match(/Nâng hạng (.*?) cho (.*)/);
    const upgradedRank = rankMatch ? rankMatch[1].trim() : null;
    const userIdentifier = rankMatch ? rankMatch[2].trim() : null;

    switch (log.type) {
      case 'INITIAL':
      case 'ADD':
      case 'ADJUSTMENT_IN':
        budgetDelta = -log.amount;
        break;
      case 'WITHDRAW':
      case 'ADJUSTMENT_OUT':
        budgetDelta = log.amount;
        break;
      case 'LOAN_DISBURSE':
        budgetDelta = log.amount;
        // User wants the loan deleted if disbursement log is deleted
        if (loanId) {
          const { data: loan } = await client.from('loans').select('userId, amount').eq('id', loanId).single();
          if (loan) {
            // Restore user balance
            const { data: user } = await client.from('users').select('balance').eq('id', loan.userId).single();
            if (user) {
              const newBalance = (user.balance || 0) + loan.amount;
              await client.from('users').update({ balance: newBalance, updatedAt: Date.now() }).eq('id', loan.userId);
              
              const io = req.app.get("io");
              if (io) {
                io.to(`user_${loan.userId}`).emit("user_updated", { id: loan.userId, balance: newBalance });
                io.to(`user_${loan.userId}`).emit("loan_deleted", { id: loanId });
              }
            }
          }
          await client.from('loans').delete().eq('id', loanId);
        }
        break;
      case 'LOAN_REPAY':
        budgetDelta = -log.amount;
        if (loanId) {
          // Find the loan and re-open it
          const { data: loan } = await client.from('loans').select('*').eq('id', loanId).single();
          if (loan) {
            // Re-deduct from user balance (because repayment had added it back)
            const { data: user } = await client.from('users').select('balance').eq('id', loan.userId).single();
            if (user) {
              const newBalance = Math.max(0, (user.balance || 0) - loan.amount);
              await client.from('users').update({ balance: newBalance, updatedAt: Date.now() }).eq('id', loan.userId);
              
              const io = req.app.get("io");
              if (io) {
                io.to(`user_${loan.userId}`).emit("user_updated", { id: loan.userId, balance: newBalance });
              }
            }

            // Restore loan to a state where it's still active
            let isOverdue = false;
            if (loan.date && typeof loan.date === 'string') {
              const [d, m, y] = loan.date.split('/').map(Number);
              if (d && m && y) {
                const dueDate = new Date(y, m - 1, d);
                dueDate.setHours(23, 59, 59, 999);
                isOverdue = new Date() > dueDate;
              }
            }
            await client.from('loans').update({ status: isOverdue ? 'QUÁ HẠN' : 'ĐANG NỢ', updatedAt: Date.now() }).eq('id', loanId);
            
            // Reverse profit: repayment amount - loan principal
            if (log.amount > loan.amount) {
              fineProfitDelta = -Math.round((log.amount - loan.amount) / 1000) * 1000;
            } else if (log.note.includes('Tất toán gốc') || log.note.includes('Tất toán một phần')) {
              // Usually these include the fee as profit
              const feePercent = Number(settings.PRE_DISBURSEMENT_FEE || 0) / 100;
              if (log.note.includes('Tất toán gốc')) {
                loanProfitDelta = -(loan.amount * feePercent);
              } else {
                loanProfitDelta = -(log.amount - (loan.partialAmount || 0));
              }
            }

            const io = req.app.get("io");
            if (io) {
              io.to(`user_${loan.userId}`).emit("loan_updated", { 
                ...loan, 
                status: isOverdue ? 'QUÁ HẠN' : 'ĐANG NỢ',
                updatedAt: Date.now()
              });
            }
          }
        }
        break;
    }

    // Handle Rank Upgrade Reversal
    if (upgradedRank && userIdentifier) {
      // Deleting a rank upgrade log
      rankProfitDelta = -log.amount;
      budgetDelta = -log.amount;
      
      // Try to find user and revert rank
      // This is best effort. Usually users table has the rank.
      const { data: user } = await client.from('users').select('*')
        .or(`phone.eq.${userIdentifier},fullName.eq.${userIdentifier}`)
        .single();
      
      if (user) {
        // Simple reversal: downgrade to previous rank if possible, or just set to BẠC if it was VÀNG, etc.
        const ranks = ['ĐỒNG', 'BẠC', 'VÀNG', 'KIM CƯƠNG'];
        const currentIdx = ranks.indexOf(user.rank || 'ĐỒNG');
        if (currentIdx > 0) {
          await client.from('users').update({ rank: ranks[currentIdx - 1] }).eq('id', user.id);
        }
      }
    }

    // 4. Perform updates to system stats
    const updates: any = {};
    if (budgetDelta !== 0) updates.SYSTEM_BUDGET = Number(settings.SYSTEM_BUDGET || 0) + budgetDelta;
    if (loanProfitDelta !== 0) updates.TOTAL_LOAN_PROFIT = Math.max(0, Number(settings.TOTAL_LOAN_PROFIT || 0) + loanProfitDelta);
    if (fineProfitDelta !== 0) updates.TOTAL_FINE_PROFIT = Math.max(0, Number(settings.TOTAL_FINE_PROFIT || 0) + fineProfitDelta);
    if (rankProfitDelta !== 0) updates.TOTAL_RANK_PROFIT = Math.max(0, Number(settings.TOTAL_RANK_PROFIT || 0) + rankProfitDelta);

    if (Object.keys(updates).length > 0) {
      const saved = await saveSystemSettings(client, updates);
      if (!saved) throw new Error("Không thể cập nhật cấu hình hệ thống");

      // Emit config update via Socket.io so it refreshes user-side in real-time
      const io = req.app.get("io");
      if (io) {
        const ioUpdates = [];
        const dict: any = {};
        
        if (updates.SYSTEM_BUDGET !== undefined) {
          const val = Number(updates.SYSTEM_BUDGET);
          ioUpdates.push({ key: 'SYSTEM_BUDGET', value: val });
          ioUpdates.push({ key: 'budget', value: val });
          dict['SYSTEM_BUDGET'] = val;
          dict['budget'] = val;
        }
        if (updates.TOTAL_RANK_PROFIT !== undefined) {
          const val = Number(updates.TOTAL_RANK_PROFIT);
          ioUpdates.push({ key: 'TOTAL_RANK_PROFIT', value: val });
          ioUpdates.push({ key: 'rankProfit', value: val });
          dict['TOTAL_RANK_PROFIT'] = val;
          dict['rankProfit'] = val;
        }
        if (updates.TOTAL_LOAN_PROFIT !== undefined) {
          const val = Number(updates.TOTAL_LOAN_PROFIT);
          ioUpdates.push({ key: 'TOTAL_LOAN_PROFIT', value: val });
          ioUpdates.push({ key: 'loanProfit', value: val });
          dict['TOTAL_LOAN_PROFIT'] = val;
          dict['loanProfit'] = val;
        }
        if (updates.TOTAL_FINE_PROFIT !== undefined) {
          const val = Number(updates.TOTAL_FINE_PROFIT);
          ioUpdates.push({ key: 'TOTAL_FINE_PROFIT', value: val });
          ioUpdates.push({ key: 'fineProfit', value: val });
          dict['TOTAL_FINE_PROFIT'] = val;
          dict['fineProfit'] = val;
        }

        if (ioUpdates.length > 0) {
          io.emit("config_updated", ioUpdates);
          io.emit("config_updated", dict);
        }
      }
    }

    // 5. Delete the log
    const { error: deleteError } = await client.from('budget_logs').delete().eq('id', logId);
    if (deleteError) throw deleteError;
    
    // Clear cache
    settingsCache = null;
    lastCacheUpdate = 0;

    sendSafeJson(res, { 
      success: true, 
      newBudget: updates.SYSTEM_BUDGET,
      newLoanProfit: updates.TOTAL_LOAN_PROFIT,
      newRankProfit: updates.TOTAL_RANK_PROFIT
    });
  } catch (e: any) {
    console.error("Lỗi trong /api/budget-log/delete:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

router.post("/admin/reset-budget-rewrite", async (req: any, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Chỉ Admin mới có quyền thực hiện thao tác này" });
    }
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase chưa được cấu hình" });
    
    const { budget, logs } = req.body;
    
    // 1. Update SYSTEM_BUDGET
    const { error: budgetError } = await client.from('config').upsert({ key: 'SYSTEM_BUDGET', value: budget }, { onConflict: 'key' });
    if (budgetError) throw budgetError;
    
    // 2. Clear all budget_logs
    const { error: deleteError } = await client.from('budget_logs').delete().neq('id', 'KEEP_NONE');
    if (deleteError) throw deleteError;
    
    // 3. Insert new logs in chunks
    if (logs && logs.length > 0) {
      // sanitize logs
      const sanitizedLogs = logs.map((log: any) => ({
        id: log.id,
        type: log.type,
        amount: log.amount,
        balanceAfter: log.balanceAfter,
        note: log.note,
        createdAt: log.createdAt
      }));
      
      for (let i = 0; i < sanitizedLogs.length; i += 50) {
        const chunk = sanitizedLogs.slice(i, i + 50);
        const { error: insertError } = await client.from('budget_logs').insert(chunk);
        if (insertError) throw insertError;
      }
    }
    
    // Invalidate cache and emit real-time update
    settingsCache = null;
    const io = req.app.get("io");
    if (io) {
      const budgetNum = Number(budget);
      io.emit("config_updated", [
        { key: 'SYSTEM_BUDGET', value: budgetNum },
        { key: 'budget', value: budgetNum }
      ]);
      io.emit("config_updated", { SYSTEM_BUDGET: budgetNum, budget: budgetNum });
    }
    
    sendSafeJson(res, { success: true });
  } catch (e: any) {
    console.error("Lỗi trong /api/admin/reset-budget-rewrite:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

router.post("/rankProfit", async (req: any, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Chỉ Admin mới có quyền thực hiện thao tác này" });
    }
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase chưa được cấu hình" });
    const { rankProfit } = req.body;
    const { error } = await client.from('config').upsert({ key: 'TOTAL_RANK_PROFIT', value: rankProfit }, { onConflict: 'key' });
    if (error) throw error;

    // Invalidate cache and emit real-time update
    settingsCache = null;
    const io = req.app.get("io");
    if (io) {
      io.emit("config_updated", [{ key: 'TOTAL_RANK_PROFIT', value: rankProfit }]);
    }

    sendSafeJson(res, { success: true });
  } catch (e: any) {
    console.error("Lỗi trong /api/rankProfit:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

router.post("/loanProfit", async (req: any, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Chỉ Admin mới có quyền thực hiện thao tác này" });
    }
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase chưa được cấu hình" });
    const { loanProfit } = req.body;
    const { error } = await client.from('config').upsert({ key: 'TOTAL_LOAN_PROFIT', value: loanProfit }, { onConflict: 'key' });
    if (error) throw error;

    // Invalidate cache and emit real-time update
    settingsCache = null;
    const io = req.app.get("io");
    if (io) {
      io.emit("config_updated", [{ key: 'TOTAL_LOAN_PROFIT', value: loanProfit }]);
    }

    sendSafeJson(res, { success: true });
  } catch (e: any) {
    console.error("Lỗi trong /api/loanProfit:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

router.post("/monthlyStats", async (req: any, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Chỉ Admin mới có quyền thực hiện thao tác này" });
    }
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase chưa được cấu hình" });
    const { monthlyStats } = req.body;
    const { error } = await client.from('config').upsert({ key: 'MONTHLY_STATS', value: monthlyStats }, { onConflict: 'key' });
    if (error) throw error;

    // Invalidate cache and emit real-time update
    settingsCache = null;
    const io = req.app.get("io");
    if (io) {
      io.emit("config_updated", [{ key: 'MONTHLY_STATS', value: monthlyStats }]);
    }

    sendSafeJson(res, { success: true });
  } catch (e: any) {
    console.error("Lỗi trong /api/monthlyStats:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

router.delete("/users/:id", async (req: any, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Chỉ Admin mới có quyền thực hiện thao tác này" });
    }
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase chưa được cấu hình" });
    const userId = req.params.id;

    // 1. Revert budget impact for all user's loans before deleting them
    const { data: userLoans } = await client.from('loans').select('id').eq('userId', userId);
    if (userLoans && userLoans.length > 0) {
      const loanIds = userLoans.map(l => l.id);
      
      // Find all logs related to these loans
      let totalBudgetDelta = 0;
      for (const loanId of loanIds) {
        const { data: relatedLogs } = await client.from('budget_logs').select('*').ilike('note', `%${loanId}%`);
        if (relatedLogs) {
          for (const log of relatedLogs) {
            if (log.type === 'LOAN_DISBURSE') totalBudgetDelta += log.amount;
            if (log.type === 'LOAN_REPAY') totalBudgetDelta -= log.amount;
          }
        }
        // Also delete these logs
        await client.from('budget_logs').delete().ilike('note', `%${loanId}%`);
      }

      // Find logs related to rank upgrades for this user by their ID in note if possible
      // Actually, rank upgrade logs usually mention full name. 
      // But we also search by userId if we stored it? Unlikely.
      // Let's at least handle the loans which is the biggest part.

      if (totalBudgetDelta !== 0) {
        const settings = await getMergedSettings(client);
        const currentBudget = Number(settings.SYSTEM_BUDGET || 0);
        const newBudgetNum = currentBudget + totalBudgetDelta;
        await saveSystemSettings(client, { SYSTEM_BUDGET: newBudgetNum });

        const io = req.app.get("io");
        if (io) {
          io.emit("config_updated", [
            { key: 'SYSTEM_BUDGET', value: newBudgetNum },
            { key: 'budget', value: newBudgetNum }
          ]);
          io.emit("config_updated", { SYSTEM_BUDGET: newBudgetNum, budget: newBudgetNum });
        }
      }
    }
    
    // Delete children first due to foreign key constraints
    await client.from('loans').delete().eq('userId', userId);
    await client.from('notifications').delete().eq('userId', userId);
    await client.from('users').delete().eq('id', userId);
    
    settingsCache = null;
    lastCacheUpdate = 0;

    sendSafeJson(res, { success: true });
  } catch (e: any) {
    console.error("Lỗi trong DELETE /api/users/:id:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

router.post("/admin/reset-password", authenticateToken, async (req: any, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Chỉ Admin mới có quyền thực hiện thao tác này" });
    }
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase chưa được cấu hình" });
    
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "Thiếu ID người dùng" });
    }
    
    // Hash default password '111111'
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('111111', salt);
    
    const { error } = await client
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', userId);
      
    if (error) throw error;
    
    sendSafeJson(res, { success: true, message: "Mật khẩu đã được reset về 111111" });
  } catch (e: any) {
    console.error("Lỗi trong /api/admin/reset-password:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

router.post("/admin/user/lock", authenticateToken, async (req: any, res) => {
  try {
    const { userId, reason } = req.body;
    if (!userId) return res.status(400).json({ error: "Thiếu userId" });
    if (!req.user?.isAdmin) return res.status(403).json({ error: "Không có quyền" });

    const client = initSupabase();
    if (!client) throw new Error("Supabase error");

    const lockedReasonText = reason || "Vi phạm điều khoản";

    const { error } = await client
      .from('users')
      .update({ 
        isLocked: true, 
        lockedAt: new Date().toISOString(), 
        lockedReason: lockedReasonText 
      })
      .eq('id', userId);

    if (error) throw error;

    // Fetch full updated user row and emit
    const { data: updatedUser } = await client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (updatedUser) {
      const io = req.app.get("io");
      if (io) {
        io.to(`user_${userId}`).emit("user_updated", updatedUser);
        
        // Add notification
        const notifId = `SYS-NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const timeStr = `${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${new Date().toLocaleDateString('vi-VN')}`;
        const lockNotif = {
          id: notifId,
          userId,
          title: "Tài khoản tạm khóa",
          message: `Tài khoản của bạn đã bị khóa tạm thời. Lý do: ${lockedReasonText}.`,
          time: timeStr,
          read: false,
          type: 'SYSTEM'
        };
        await client.from('notifications').insert([lockNotif]);
        io.to(`user_${userId}`).emit("notification_updated", lockNotif);
        await triggerPushForUser(userId, "Tài khoản tạm khóa", `Tài khoản của bạn đã bị khóa tạm thời. Lý do: ${lockedReasonText}`, client);
      }
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/admin/user/unlock", authenticateToken, async (req: any, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "Thiếu userId" });
    if (!req.user?.isAdmin) return res.status(403).json({ error: "Không có quyền" });

    const client = initSupabase();
    if (!client) throw new Error("Supabase error");

    const { error } = await client
      .from('users')
      .update({ 
        isLocked: false, 
        lockedAt: null, 
        lockedReason: null 
      })
      .eq('id', userId);

    if (error) throw error;

    // Fetch full updated user row and emit
    const { data: updatedUser } = await client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (updatedUser) {
      const io = req.app.get("io");
      if (io) {
        io.to(`user_${userId}`).emit("user_updated", updatedUser);

        // Add notification
        const notifId = `SYS-NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const timeStr = `${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${new Date().toLocaleDateString('vi-VN')}`;
        const unlockNotif = {
          id: notifId,
          userId,
          title: "Mở khóa tài khoản",
          message: "Tài khoản của bạn đã được hoạt động bình thường trở lại.",
          time: timeStr,
          read: false,
          type: 'SYSTEM'
        };
        await client.from('notifications').insert([unlockNotif]);
        io.to(`user_${userId}`).emit("notification_updated", unlockNotif);
        await triggerPushForUser(userId, "Mở khóa tài khoản", "Tài khoản của bạn đã được hoạt động bình thường trở lại.", client);
      }
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Manual endpoint for Admin to trigger daily system checks and auto-locking manually for instantaneous tests
router.post("/admin/run-daily-tasks", authenticateToken, async (req: any, res) => {
  try {
    if (!req.user?.isAdmin) return res.status(403).json({ error: "Không có quyền" });
    const io = req.app.get("io");
    
    console.log("[ManualTrigger] Admin triggered daily system tasks & checks manually.");
    
    // Run forced penalties and overdue locking checks instantly
    await runBatchPenalties(io);
    await runDailyOverdueChecksAndAutoLock(io);
    
    res.json({ success: true, message: "Đã chạy đối soát kỳ hạn, thông báo sắp đến hạn/quá hạn và tính năng tự động khóa tài khoản thành công!" });
  } catch (error: any) {
    console.error("[ManualTrigger] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Helper to filter object keys based on allowed columns
const sanitizeData = (data: any[], allowedColumns: string[], tableName: string = 'unknown') => {
  if (!Array.isArray(data)) {
    console.warn(`[Sanitize] ${tableName} data is not an array`);
    return [];
  }
  
  const result = data.map(item => {
    if (!item || typeof item !== 'object') return null;
    const sanitized: any = {};
    allowedColumns.forEach(col => {
      if (Object.prototype.hasOwnProperty.call(item, col)) {
        sanitized[col] = item[col];
      }
    });
    return sanitized;
  }).filter(item => {
    if (!item) return false;
    // Special case for config which doesn't use id, but sanitizeData isn't used for config anyway
    const hasId = item.id !== undefined && item.id !== null;
    if (!hasId) {
      console.warn(`[Sanitize] ${tableName} item missing ID:`, JSON.stringify(item).substring(0, 100));
    }
    return hasId;
  });

  console.log(`[Sanitize] ${tableName}: ${data.length} items -> ${result.length} sanitized items`);
  return result;
};

const USER_COLUMNS = [
  'id', 'phone', 'fullName', 'idNumber', 'balance', 'totalLimit', 'rank', 
  'rankProgress', 'isLoggedIn', 'isAdmin', 'pendingUpgradeRank', 
  'rankUpgradeBill', 'avatar', 'address', 'joinDate', 'idFront', 'idBack', 
  'refZalo', 'relationship', 'lastLoanSeq', 'bankName', 'bankBin', 
  'bankAccountNumber', 'bankAccountHolder', 'hasJoinedZalo', 
  'payosOrderCode', 'payosCheckoutUrl', 'payosAmount', 'payosExpireAt', 
  'spins', 'vouchers', 'totalProfit', 'fullSettlementCount', 'lastPenaltyDate', 'penaltyStreak', 'updatedAt',
  'hasCustomLimit', 'isFreeUpgrade', 'isLocked', 'lockedAt', 'lockedReason'
];

const USER_WRITE_COLUMNS = [...USER_COLUMNS, 'password'];

// Leaner summary for list views
const USER_SUMMARY_COLUMNS = [
  'id', 'phone', 'fullName', 'idNumber', 'balance', 'totalLimit', 'rank', 
  'rankProgress', 'isLoggedIn', 'isAdmin', 'pendingUpgradeRank', 'updatedAt', 
  'refZalo', 'joinDate', 'avatar', 'isLocked', 'lockedAt', 'lockedReason'
];

const LOAN_COLUMNS = [
  'id', 'userId', 'userName', 'amount', 'date', 'createdAt', 'status', 
  'fine', 'billImage', 'bankTransactionId', 'signature', 'loanPurpose', 'rejectionReason', 
  'settlementType', 'partialAmount', 'voucherId', 'settledAt', 'principalPaymentCount', 'extensionCount', 'partialPaymentCount',
  'originalBaseId', 'payosOrderCode', 'payosCheckoutUrl', 'payosAmount', 'payosExpireAt', 'consolidatedInto', 'updatedAt'
];

const LOAN_SUMMARY_COLUMNS = [
  'id', 'userId', 'userName', 'amount', 'date', 'createdAt', 'status', 
  'fine', 'rejectionReason', 'loanPurpose', 'originalBaseId', 'updatedAt',
  'signature', 'settlementType', 'partialAmount', 'extensionCount', 'partialPaymentCount', 'consolidatedInto'
];

const NOTIFICATION_COLUMNS = [
  'id', 'userId', 'title', 'message', 'time', 'read', 'type'
];

const NOTIFICATION_SUMMARY_COLUMNS = [
  'id', 'userId', 'title', 'message', 'time', 'read', 'type'
];

const BUDGET_LOG_COLUMNS = [
  'id', 'type', 'amount', 'balanceAfter', 'note', 'createdAt'
];

router.post("/admin/sync-formats", async (req: any, res) => {
  try {
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase chưa được cấu hình" });
    
    // Security check: must be admin to trigger formatting sync
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ error: "Không có quyền thực hiện hành động này." });
    }

    // 1. Fetch config settings
    const { data: configRows } = await client.from('config').select('key, value');
    const settings: any = {};
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
      return res.status(500).json({ error: "Lỗi kết nối database khi tra cứu danh sách để đồng bộ" });
    }

    // 3. Build Translation Map
    const translationMap: Record<string, string> = {};

    // Group loans by userId
    const loansByUser: Record<string, any[]> = {};
    loans.forEach((l: any) => {
      if (!l.userId) return;
      if (!loansByUser[l.userId]) {
        loansByUser[l.userId] = [];
      }
      loansByUser[l.userId].push(l);
    });

    const parseVietnameseDateTime = (str: string): number => {
      if (!str) return 0;
      try {
        const parts = str.split(' ');
        if (parts.length === 2) {
          const timeParts = parts[0].split(':');
          const dateParts = parts[1].split('/');
          if (timeParts.length >= 2 && dateParts.length === 3) {
            const hh = parseInt(timeParts[0]);
            const mm = parseInt(timeParts[1]);
            const ss = timeParts[2] ? parseInt(timeParts[2]) : 0;
            const d = parseInt(dateParts[0]);
            const m = parseInt(dateParts[1]) - 1;
            const y = parseInt(dateParts[2]);
            return new Date(y, m, d, hh, mm, ss).getTime();
          }
        }
      } catch(e) {}
      return 0;
    };

    Object.keys(loansByUser).forEach((userId) => {
      const userLoans = loansByUser[userId];
      
      // Classify base loans
      const baseLoans = userLoans.filter((loan: any) => {
        const isGop = loan.id.includes('-GOP');
        const isExtension = (Number(loan.extensionCount) > 0 || 
                             loan.id.toUpperCase().includes('GH') || 
                             loan.id.toUpperCase().includes('GIAHAN') ||
                             (loan.originalBaseId && loan.originalBaseId.toUpperCase().includes('GH'))) && 
                            !isGop;
        const isPartial = (Number(loan.partialPaymentCount) > 0 || 
                           loan.id.toUpperCase().includes('TTMP') || 
                           loan.id.toUpperCase().includes('TT') ||
                           (loan.originalBaseId && loan.originalBaseId.toUpperCase().includes('TT'))) && 
                          !isGop;
        return !isGop && !isExtension && !isPartial;
      });

      // Sort base loans chronologically
      baseLoans.sort((a: any, b: any) => {
        const timeA = parseVietnameseDateTime(a.createdAt) || Number(a.updatedAt) || 0;
        const timeB = parseVietnameseDateTime(b.createdAt) || Number(b.updatedAt) || 0;
        if (timeA !== timeB) return timeA - timeB;
        return a.id.localeCompare(b.id);
      });

      // Assign sequential numbers to valid base loans (exclude CỘNG DỒN / HỦY)
      let seqCounter = 0;
      const baseLoanSeqMap: Record<string, number> = {};
      baseLoans.forEach((loan: any) => {
        const isExcluded = loan.status === 'ĐÃ CỘNG DỒN' || loan.status === 'ĐÃ HỦY';
        if (!isExcluded) {
          seqCounter++;
          baseLoanSeqMap[loan.id] = seqCounter;
        } else {
          // Cancelled or consolidated loans default to their old index or 1
          const oldSeqMatch = loan.id.match(/NDV(\d+)/i);
          baseLoanSeqMap[loan.id] = oldSeqMatch ? parseInt(oldSeqMatch[1]) : 1;
        }
      });

      // Map each loan to the newly computed formatting sequence ID
      userLoans.forEach((loan: any) => {
        let newId = "";
        const isGop = loan.id.includes('-GOP');
        const isExtension = (Number(loan.extensionCount) > 0 || 
                             loan.id.toUpperCase().includes('GH') || 
                             loan.id.toUpperCase().includes('GIAHAN') ||
                             (loan.originalBaseId && loan.originalBaseId.toUpperCase().includes('GH'))) && 
                            !isGop;
        const isPartial = (Number(loan.partialPaymentCount) > 0 || 
                           loan.id.toUpperCase().includes('TTMP') || 
                           loan.id.toUpperCase().includes('TT') ||
                           (loan.originalBaseId && loan.originalBaseId.toUpperCase().includes('TT'))) && 
                          !isGop;

        if (isGop) {
          const baseId = loan.id.split('-GOP')[0];
          const bSeq = baseLoanSeqMap[baseId] || 1;
          const format = getSystemFormatServer(settings, 'contract', '{ID}NDV{N}');
          const newBaseId = resolveMasterConfigServer(format, settings, { userId: loan.userId, sequence: bSeq, n: bSeq });
          newId = `${newBaseId}-GOP`;
        } else if (isExtension) {
          const baseId = loan.originalBaseId || loan.id.split('GH')[0];
          const bSeq = baseLoanSeqMap[baseId] || 1;
          const format = getSystemFormatServer(settings, 'contract', '{ID}NDV{N}');
          const cleanBaseId = resolveMasterConfigServer(format, settings, { userId: loan.userId, sequence: bSeq, n: bSeq });
          const extFormat = getSystemContractFormatServer(settings, 'EXTENSION', '{ID}GH{N}');
          const currentExtCount = Number(loan.extensionCount) || 1;
          newId = resolveMasterConfigServer(extFormat, settings, {
            userId: loan.userId,
            originalId: cleanBaseId,
            sequence: currentExtCount,
            n: currentExtCount,
            slgh: currentExtCount,
            slttmp: Number(loan.partialPaymentCount) || 0
          });
        } else if (isPartial) {
          const baseId = loan.originalBaseId || loan.id.split('TTMP')[0];
          const bSeq = baseLoanSeqMap[baseId] || 1;
          const format = getSystemFormatServer(settings, 'contract', '{ID}NDV{N}');
          const cleanBaseId = resolveMasterConfigServer(format, settings, { userId: loan.userId, sequence: bSeq, n: bSeq });
          const partFormat = getSystemContractFormatServer(settings, 'PARTIAL_SETTLEMENT', '{ID}TTMP{N}');
          const currentPartCount = Number(loan.partialPaymentCount) || 1;
          newId = resolveMasterConfigServer(partFormat, settings, {
            userId: loan.userId,
            originalId: cleanBaseId,
            sequence: currentPartCount,
            n: currentPartCount,
            slgh: Number(loan.extensionCount) || 0,
            slttmp: currentPartCount
          });
        } else {
          const bSeq = baseLoanSeqMap[loan.id] || 1;
          const format = getSystemFormatServer(settings, 'contract', '{ID}NDV{N}');
          newId = resolveMasterConfigServer(format, settings, { userId: loan.userId, sequence: bSeq, n: bSeq });
        }

        if (newId) {
          translationMap[loan.id] = newId;
          const baseId = loan.originalBaseId;
          if (baseId && !translationMap[baseId]) {
            const bSeq = baseLoanSeqMap[baseId] || 1;
            const format = getSystemFormatServer(settings, 'contract', '{ID}NDV{N}');
            translationMap[baseId] = resolveMasterConfigServer(format, settings, { userId: loan.userId, sequence: bSeq, n: bSeq });
          }
        }
      });
    });

    // Ensure users mapping
    users.forEach((user: any) => {
      for (let n = 1; n <= 5; n++) {
        const oldBase = `${user.id}NDV${n}`;
        const format = getSystemFormatServer(settings, 'contract', '{ID}NDV{N}');
        const newBase = resolveMasterConfigServer(format, settings, { userId: user.id, sequence: n, n: n });
        if (!translationMap[oldBase]) translationMap[oldBase] = newBase;
        
        const oldGop = `${user.id}NDV${n}-GOP`;
        if (!translationMap[oldGop]) translationMap[oldGop] = `${newBase}-GOP`;

        const oldExt = `${user.id}GH${n}`;
        const extFormat = getSystemContractFormatServer(settings, 'EXTENSION', '{ID}GH{N}');
        const newExt = resolveMasterConfigServer(extFormat, settings, {
          userId: user.id,
          originalId: newBase,
          sequence: n,
          n,
          slgh: n,
          slttmp: 0
        });
        if (!translationMap[oldExt]) translationMap[oldExt] = newExt;
      }
    });

    let loansUpdated = 0;
    let budgetLogsUpdated = 0;
    let notificationsUpdated = 0;

    // 4. Perform Loans Migrations (insert new -> delete old to handle PK renamed safely)
    for (const loan of loans) {
      const newId = translationMap[loan.id];
      if (newId && newId !== loan.id) {
        const updatedOriginalBaseId = translationMap[loan.originalBaseId] || loan.originalBaseId;
        const updatedConsolidatedInto = loan.consolidatedInto ? (translationMap[loan.consolidatedInto] || loan.consolidatedInto) : null;
        
        const nextLoanPayload = {
           ...loan,
           id: newId,
           originalBaseId: updatedOriginalBaseId,
           consolidatedInto: updatedConsolidatedInto,
           updatedAt: Date.now()
        };

        const { error: insertError } = await client.from('loans').upsert([nextLoanPayload], { onConflict: 'id' });
        if (!insertError) {
           await client.from('loans').delete().eq('id', loan.id);
           loansUpdated++;
        }
      }
    }

    // 5. Update remaining reference columns of loans
    const { data: remainingLoans } = await client.from('loans').select('id, originalBaseId, consolidatedInto');
    if (remainingLoans) {
      for (const rem of remainingLoans) {
        const updatedBase = translationMap[rem.originalBaseId];
        const updatedConsolidated = rem.consolidatedInto ? translationMap[rem.consolidatedInto] : null;

        if (updatedBase || updatedConsolidated) {
           await client.from('loans').update({
             originalBaseId: updatedBase || rem.originalBaseId,
             consolidatedInto: updatedConsolidated || rem.consolidatedInto,
             updatedAt: Date.now()
           }).eq('id', rem.id);
        }
      }
    }

    // 6. Substring replace in `budget_logs` notes
    const { data: budgetLogs } = await client.from('budget_logs').select('*');
    if (budgetLogs) {
      for (const log of budgetLogs) {
        if (!log.note) continue;
        let updatedNote = log.note;
        let hasChange = false;
        
        Object.entries(translationMap).forEach(([oldId, newId]) => {
           if (updatedNote.includes(oldId)) {
              updatedNote = updatedNote.split(oldId).join(newId);
              hasChange = true;
           }
        });

        if (hasChange) {
           await client.from('budget_logs').update({ note: updatedNote }).eq('id', log.id);
           budgetLogsUpdated++;
        }
      }
    }

    // 7. Substring replace in `notifications` text
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
           await client.from('notifications').update({
              title: updatedTitle,
              content: updatedContent
           }).eq('id', n.id);
           notificationsUpdated++;
        }
      }
    }

    res.json({
      success: true,
      message: `Đồng bộ định dạng mã mới thành công! Đã xử lý ${loansUpdated} hợp đồng, ${budgetLogsUpdated} nhật ký ngân sách và ${notificationsUpdated} thông báo.`,
      stats: { loansUpdated, budgetLogsUpdated, notificationsUpdated }
    });

  } catch(e: any) {
    console.error("[API SYNC FORMATS ERROR]", e);
    res.status(500).json({ error: "Lỗi đồng bộ định dạng mã hợp đồng: " + e.message });
  }
});

router.post("/sync", async (req: any, res) => {
  try {
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase chưa được cấu hình" });
    const { users, loans, deletedLoanIds, notifications, budget, budgetDelta, budgetLog, rankProfit, loanProfit, fineProfit, monthlyStats } = req.body;
    
    const isAdmin = req.user?.isAdmin === true;
    let allNotificationsToProcess = notifications && Array.isArray(notifications) ? [...notifications] : [];

    // Security check for non-admin sync
    if (!isAdmin) {
      if (deletedLoanIds && Array.isArray(deletedLoanIds) && deletedLoanIds.length > 0) {
        return res.status(403).json({ error: "Chỉ Admin mới có quyền xóa dữ liệu qua sync" });
      }
      // Non-admins cannot update system config
      if (budget !== undefined || budgetDelta !== undefined || budgetLog !== undefined || rankProfit !== undefined || loanProfit !== undefined || monthlyStats !== undefined) {
        return res.status(403).json({ error: "Bạn không có quyền cập nhật cấu hình hệ thống" });
      }
      
      // Non-admins can only update their own data and CANNOT change isAdmin status
      if (users && Array.isArray(users)) {
        if (users.some(u => u.id !== req.user.id)) {
          return res.status(403).json({ error: "Bạn không có quyền cập nhật dữ liệu của người khác" });
        }
        // Force isAdmin to false for non-admins
        users.forEach(u => {
          if (u.isAdmin !== undefined) u.isAdmin = false;
        });
      }
      
      if (loans && Array.isArray(loans)) {
        if (loans.some(l => l.userId !== req.user.id)) {
          return res.status(403).json({ error: "Bạn không có quyền cập nhật khoản vay của người khác" });
        }
      }
      
      if (notifications && Array.isArray(notifications)) {
        if (notifications.some(n => n.userId !== req.user.id)) {
          return res.status(403).json({ error: "Bạn không có quyền cập nhật thông báo của người khác" });
        }
      }
    }

    // Handle deletions first
    if (deletedLoanIds && Array.isArray(deletedLoanIds) && deletedLoanIds.length > 0) {
      const { error: deleteError } = await client.from('loans').delete().in('id', deletedLoanIds);
      if (deleteError) {
        console.error("[SYNC] Deletion failed:", deleteError);
      }
    }

    // Use a sequential approach for critical updates to prevent race conditions
    // and ensure data integrity under high load
    
    // 1. Update Config first (Budget is critical)
    const configUpdates: { key: string; value: any }[] = [];
    let finalPayloadBudget = budget;
    let budgetWasIncreased = false;
    let extraBudget = 0;

    if (budgetDelta !== undefined && budgetDelta !== 0) {
      const { data: currentBudgetData } = await client.from('config').select('value').eq('key', 'SYSTEM_BUDGET').single();
      const currentVal = Number(currentBudgetData?.value || 0);
      finalPayloadBudget = currentVal + budgetDelta;
      configUpdates.push({ key: 'SYSTEM_BUDGET', value: finalPayloadBudget });
      if (budgetDelta >= 1000000) {
        budgetWasIncreased = true;
        extraBudget = budgetDelta;
      }
    } else if (budget !== undefined) {
      const { data: currentBudgetData } = await client.from('config').select('value').eq('key', 'SYSTEM_BUDGET').single();
      const currentBudget = Number(currentBudgetData?.value || 0);
      // Security: Validate budget change if it's a decrease (disbursement)
      if (budgetLog && budgetLog.type === 'LOAN_DISBURSE') {
        if (budget > currentBudget) {
          console.error("[SYNC] Security Alert: Client tried to increase budget during disbursement");
          return res.status(400).json({ error: "Dữ liệu ngân sách không hợp lệ" });
        }
      }
      configUpdates.push({ key: 'SYSTEM_BUDGET', value: budget });
      if (budget > currentBudget && (budget - currentBudget) >= 1000000) {
        budgetWasIncreased = true;
        extraBudget = budget - currentBudget;
      }
    }
    if (rankProfit !== undefined) configUpdates.push({ key: 'TOTAL_RANK_PROFIT', value: rankProfit });
    if (loanProfit !== undefined) configUpdates.push({ key: 'TOTAL_LOAN_PROFIT', value: loanProfit });
    if (fineProfit !== undefined) configUpdates.push({ key: 'TOTAL_FINE_PROFIT', value: fineProfit });
    if (monthlyStats !== undefined) configUpdates.push({ key: 'MONTHLY_STATS', value: monthlyStats });
    
    if (configUpdates.length > 0) {
      const { error } = await client.from('config').upsert(configUpdates, { onConflict: 'key' });
      if (error) throw error;
      // Invalidate cache
      settingsCache = null;

      // Send push notification broadcast for budget addition
      if (budgetWasIncreased) {
        const title = "Hệ thống bổ sung ngân sách giải ngân";
        const body = `Cập nhật: Nguồn quỹ giải ngân đã được bổ sung thêm ${extraBudget.toLocaleString('vi-VN')} đ. Quý khách có nhu cầu vay có thể đăng ký vay hoặc nâng hạng mức vay ngay bây giờ!`;
        broadcastPushNotification(title, body, client);
      }
    }

    // 2. Update Budget Log (Ensure balanceAfter matches server-side authoritative budget strictly)
    if (budgetLog) {
      if (finalPayloadBudget !== undefined) {
        budgetLog.balanceAfter = finalPayloadBudget;
      } else {
        const { data: dbBudget } = await client.from('config').select('value').eq('key', 'SYSTEM_BUDGET').single();
        budgetLog.balanceAfter = Number(dbBudget?.value || 0);
      }
      const sanitizedLog = sanitizeData([budgetLog], BUDGET_LOG_COLUMNS)[0];
      if (sanitizedLog) {
        const { error } = await client.from('budget_logs').upsert(sanitizedLog, { onConflict: 'id' });
        if (error) {
          console.error("[SYNC] Budget log upsert failed:", JSON.stringify(error));
        }
      }
    }

    // 3. Update Users
    if (users && Array.isArray(users) && users.length > 0) {
      // Hash passwords for users in sync if they are not already hashed
      const processedUsers = await Promise.all(users.map(async (u) => {
        const isAlreadyHashed = typeof u.password === 'string' && /^\$2[aby]\$\d+\$.{53}$/.test(u.password);
        if (u.password && typeof u.password === 'string' && !isAlreadyHashed) {
          const salt = await bcrypt.genSalt(10);
          u.password = await bcrypt.hash(u.password, salt);
        }
        return u;
      }));
      
      const sanitizedUsers = sanitizeData(processedUsers, USER_WRITE_COLUMNS);
      if (sanitizedUsers.length > 0) {
        const { error } = await client.from('users').upsert(sanitizedUsers, { onConflict: 'id' });
        if (error) {
          console.error("[SYNC] Users upsert failed:", JSON.stringify(error));
          // Retry for missing columns
          if (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('column')) {
            console.warn("[SYNC] Retrying users upsert without problematic columns...");
            const commonNewColumns = ['idNumber', 'refZalo', 'spins', 'vouchers', 'totalProfit', 'fullSettlementCount', 'lastPenaltyDate', 'penaltyStreak', 'hasCustomLimit', 'isFreeUpgrade', 'payosOrderCode', 'payosCheckoutUrl', 'payosAmount', 'payosExpireAt'];
            const saferColumns = USER_WRITE_COLUMNS.filter(c => !commonNewColumns.includes(c));
            
            const saferUsers = sanitizeData(processedUsers, saferColumns);
            const { error: retryError } = await client.from('users').upsert(saferUsers, { onConflict: 'id' });
            if (retryError) {
              console.error("[SYNC] Retry users upsert failed:", JSON.stringify(retryError));
              throw retryError;
            }
          } else {
            throw error;
          }
        }
      }
    }
    
    // 4. Update Loans
    if (loans && Array.isArray(loans) && loans.length > 0) {
      // SERVER-SIDE STATUS CHANGE DETECTION: Detect status transformations to generate system notifications & push automatically
      try {
        const incomingLoanIds = (loans as any[]).map((l: any) => l.id);
        const { data: dbLoans } = await client
          .from('loans')
          .select('id, status, amount, userId')
          .in('id', incomingLoanIds);

        const existingLoansMap = new Map<any, any>((dbLoans || []).map((l: any) => [l.id, l]));
        const newlyGeneratedNotifications: any[] = [];

        for (const l of (loans as any[])) {
          const oldLoan = existingLoansMap.get(l.id);
          if (oldLoan) {
            const oldNorm = String(oldLoan.status).toUpperCase().normalize('NFC');
            const newNorm = String(l.status).toUpperCase().normalize('NFC');
            
            if (oldNorm !== newNorm) {
              let title = "";
              let message = "";
              const amountStr = Number(l.amount || oldLoan.amount || 0).toLocaleString('vi-VN');
              
              if (newNorm === 'ĐÃ DUYỆT') {
                title = "Khoản vay được phê duyệt";
                message = `Chúc mừng! Hồ sơ vay mã ${l.id} trị giá ${amountStr} đ của bạn đã được phê duyệt thành công. Sắp có tiền giải ngân chuyển về tài khoản của bạn.`;
              } else if (newNorm === 'ĐANG NỢ') {
                title = "Giải ngân thành công";
                message = `Hồ sơ vay mã ${l.id} trị giá ${amountStr} đ của bạn đã được giải ngân thành công. Số dư khả dụng của bạn đã tăng thêm.`;
              } else if (newNorm === 'BỊ TỪ CHỐI' || newNorm === 'TỪ CHỐI') {
                title = "Khoản vay bị từ chối";
                message = `Rất tiếc! Hồ sơ đăng ký vay mã ${l.id} trị giá ${amountStr} đ của bạn đã bị từ chối do không đủ điều kiện phê duyệt từ hệ thống.`;
              } else if (newNorm === 'ĐÃ TẤT TOÁN' || newNorm === 'ĐÃ TẤT TOÁN') {
                title = "Tất toán thành công";
                message = `Yêu cầu thanh toán cho khoản vay mã ${l.id} trị giá ${amountStr} đ của bạn đã được duyệt và tất toán thành công.`;
              } else if (newNorm === 'QUÁ HẠN') {
                title = "Khoản nợ QUÁ HẠN";
                message = `Cảnh báo! Khoản vay mã ${l.id} trị giá ${amountStr} đ đã chuyển sang trạng thái QUÁ HẠN. Vui lòng thanh toán ngay để tránh phát sinh phí phạt bổ sung.`;
              } else if (newNorm === 'GIA HẠN') {
                title = "Đã gia hạn thành công";
                message = `Yêu cầu xin gia hạn lùi ngày thanh toán cho khoản nợ mã ${l.id} của bạn đã được Admin duyệt và chấp nhận.`;
              } else if (newNorm === 'TTMP') {
                title = "Xác nhận Thanh toán một phần";
                message = `Giao dịch thanh toán một phần (TTMP) cho khoản vay mã ${l.id} đã được phê duyệt và ghi nhận thành công.`;
              } else {
                title = "Cập nhật trạng thái vay";
                message = `Khoản vay mã ${l.id} của bạn đã được thay đổi trạng thái thành "${l.status}".`;
              }

              if (title && message) {
                const notifId = `LOAN-NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                const timeStr = `${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${new Date().toLocaleDateString('vi-VN')}`;
                
                const notifyPayload = {
                  id: notifId,
                  userId: l.userId || oldLoan.userId,
                  title,
                  message,
                  time: timeStr,
                  read: false,
                  type: 'LOAN'
                };

                newlyGeneratedNotifications.push(notifyPayload);
              }
            }
          }
        }

        if (newlyGeneratedNotifications.length > 0) {
          console.log(`[SYNC-NOTIF] Automatically created ${newlyGeneratedNotifications.length} notification(s) for status transitions`);
          allNotificationsToProcess = [...allNotificationsToProcess, ...newlyGeneratedNotifications];
        }
      } catch (errDet) {
        console.error("[SYNC] Error detecting loan status changes for notification trigger:", errDet);
      }

      // SERVER-SIDE CONSOLIDATION SAFETY: If a loan is being marked as consolidated,
      // we ensure the primary loan's balance is correctly updated in DB.
      // we ensure the primary loan's balance is correctly updated in DB.
      for (const loan of loans) {
        if (loan.status === 'ĐÃ CỘNG DỒN' && loan.consolidatedInto) {
          const { data: primaryLoan } = await client
            .from('loans')
            .select('amount, status')
            .eq('id', loan.consolidatedInto)
            .single();

          if (primaryLoan && (primaryLoan.status === 'ĐANG NỢ' || primaryLoan.status === 'QUÁ HẠN')) {
            // Check if the primary loan in the current sync payload already has the updated amount
            const primaryInPayload = loans.find(l => l.id === loan.consolidatedInto);
            const incrementalAmount = Number(loan.amount || 0);
            
            if (primaryInPayload) {
              // Ensure payload is correct (it should be if App.tsx logic is sound)
              // But if it's lagging or somehow wrong, we enforce it here
              const expectedTotal = Number(primaryLoan.amount) + incrementalAmount;
              if (Number(primaryInPayload.amount) < expectedTotal) {
                primaryInPayload.amount = expectedTotal;
              }
            } else {
              // Primary loan NOT in payload, update it directly in DB
              const newTotal = Number(primaryLoan.amount) + incrementalAmount;
              await client.from('loans').update({ amount: newTotal, updatedAt: Date.now() }).eq('id', loan.consolidatedInto);
            }
          }
        }
      }

      const sanitizedLoans = sanitizeData(loans, LOAN_COLUMNS);
      if (sanitizedLoans.length > 0) {
        const { error } = await client.from('loans').upsert(sanitizedLoans, { onConflict: 'id' });
        if (error) {
          console.error("[SYNC] Loans upsert failed:", JSON.stringify(error));
          // If it's a missing column error, try again without the new columns
          if (error.code === 'PGRST204' || error.code === '42703' || (error.message && (error.message.includes('column "principalPaymentCount" does not exist') || error.message.includes('column "partialAmount" does not exist')))) {
            console.warn("[SYNC] Retrying loans upsert without new columns...");
            const fallbackColumns = LOAN_COLUMNS.filter(c => c !== 'principalPaymentCount' && c !== 'partialAmount');
            const saferLoans = sanitizeData(loans, fallbackColumns);
            const { error: retryError } = await client.from('loans').upsert(saferLoans, { onConflict: 'id' });
            if (retryError) throw retryError;
          } else {
            throw error;
          }
        }
      }
    }
    
    // 5. Update Notifications
    const existingNotificationIds = new Set<string>();
    if (allNotificationsToProcess && Array.isArray(allNotificationsToProcess) && allNotificationsToProcess.length > 0) {
      const sanitizedNotifications = sanitizeData(allNotificationsToProcess, NOTIFICATION_COLUMNS);
      if (sanitizedNotifications.length > 0) {
        // Query existing notification IDs first to check for duplicates
        const incomingIds = sanitizedNotifications.map(n => n.id);
        const { data: existingNotifs } = await client
          .from('notifications')
          .select('id')
          .in('id', incomingIds);
          
        if (existingNotifs) {
          existingNotifs.forEach((e: any) => existingNotificationIds.add(e.id));
        }

        const { error } = await client.from('notifications').upsert(sanitizedNotifications, { onConflict: 'id' });
        if (error) {
          console.error("[SYNC] Notifications upsert failed:", JSON.stringify(error));
          throw error;
        }
      }
    }
    
    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      if (users) {
        users.forEach((u: any) => io.to(`user_${u.id}`).emit("user_updated", u));
        io.to("admin").emit("users_updated", users);
      }
      if (loans) {
        loans.forEach((l: any) => io.to(`user_${l.userId}`).emit("loan_updated", l));
        io.to("admin").emit("loans_updated", loans);
      }
      if (allNotificationsToProcess && allNotificationsToProcess.length > 0) {
        allNotificationsToProcess.forEach((n: any) => {
          io.to(`user_${n.userId}`).emit("notification_updated", n);
          // Only trigger push for BRAND NEW unread notifications, not updates or existing ones
          if (!existingNotificationIds.has(n.id) && n.userId !== 'ADMIN' && !n.read) {
            triggerPushForUser(n.userId, n.title, n.message, client);
          }
        });
        io.to("admin").emit("notifications_updated", allNotificationsToProcess);
      }
      
      // Always notify admin of sync
      io.to("admin").emit("sync_completed", { users, loans, notifications: allNotificationsToProcess, configUpdates });
      
      // If config changed, notify everyone
      if (configUpdates.length > 0) {
        io.emit("config_updated", configUpdates);
        
        // Also emit as a dictionary to ensure all clients capture the changes immediately
        const dict: any = {};
        configUpdates.forEach(item => {
          dict[item.key] = item.value;
          if (item.key === 'SYSTEM_BUDGET') dict['budget'] = item.value;
          if (item.key === 'TOTAL_RANK_PROFIT') dict['rankProfit'] = item.value;
          if (item.key === 'TOTAL_LOAN_PROFIT') dict['loanProfit'] = item.value;
          if (item.key === 'TOTAL_FINE_PROFIT') dict['fineProfit'] = item.value;
        });
        io.emit("config_updated", dict);
      }
    }
    
    sendSafeJson(res, { success: true });
  } catch (e: any) {
    console.error("Lỗi trong /api/sync:", e);
    res.status(500).json({ 
      success: false,
      error: "Lỗi máy chủ nội bộ", 
      message: e.message || "Lỗi đồng bộ dữ liệu"
    });
  }
});

const parseDateStringServer = (str: string | undefined | null): Date | null => {
  if (!str) return null;
  if (typeof str === 'number') return new Date(str);
  const cleaned = str.trim();
  
  if (/^\d+$/.test(cleaned)) {
    return new Date(parseInt(cleaned, 10));
  }

  const nativeDate = new Date(cleaned);
  if (!isNaN(nativeDate.getTime()) && cleaned.includes('-')) {
    return nativeDate;
  }

  const dateRegex = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
  const dateMatch = cleaned.match(dateRegex);
  
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10) - 1;
    const year = parseInt(dateMatch[3], 10);
    
    const timeRegex = /(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/;
    const timeMatch = cleaned.match(timeRegex);
    
    let hour = 0, minute = 0, second = 0;
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10) || 0;
      minute = parseInt(timeMatch[2], 10) || 0;
      second = parseInt(timeMatch[3], 10) || 0;
    }
    
    const d = new Date(year, month, day, hour, minute, second);
    if (!isNaN(d.getTime())) return d;
  }
  
  return isNaN(nativeDate.getTime()) ? null : nativeDate;
};

const isDateOnOrAfterServer = (dateStr: string | undefined | null, benchmarkStr: string | null): boolean => {
  if (!dateStr || !benchmarkStr) return true;
  try {
    const testDate = parseDateStringServer(dateStr);
    if (!testDate || isNaN(testDate.getTime())) return false;
    
    const benchmarkParts = benchmarkStr.split('-');
    const benchmarkDate = new Date(Number(benchmarkParts[0]), Number(benchmarkParts[1]) - 1, Number(benchmarkParts[2]), 0, 0, 0);
    
    const testMidnight = new Date(testDate.getFullYear(), testDate.getMonth(), testDate.getDate()).getTime();
    const benchmarkMidnight = new Date(benchmarkDate.getFullYear(), benchmarkDate.getMonth(), benchmarkDate.getDate()).getTime();
    
    return testMidnight >= benchmarkMidnight;
  } catch (e) {
    return true;
  }
};

router.post("/re-establish", async (req: any, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Chỉ Admin mới có quyền thực hiện thao tác này" });
    }
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase not configured" });

    // Run legacy upgrades correction to mark them all as free (to correct statistics)
    await runFreeUpgradeMigration(client);

    const io = req.app.get("io");

    const { startDate, startingCapital, deleteOldLogs } = req.body;
    if (!startDate) return res.status(400).json({ error: "Vui lòng chọn ngày bắt đầu" });

    const capital = Number(startingCapital || 0);

    // Dynamic Reconstruction and recovery of actual data
    const [{ data: users }, { data: loans }, { data: settingsList }] = await Promise.all([
      client.from('users').select('*'),
      client.from('loans').select('*'),
      client.from('config').select('*')
    ]);

    const settings: any = {};
    if (settingsList) {
      settingsList.forEach((r: any) => {
        settings[r.key] = r.value;
      });
    }

    const upgradePercent = Number(settings.UPGRADE_PERCENT || 5);
    const feePercent = Number(settings.PRE_DISBURSEMENT_FEE || 15) / 100;
    
    // Calculate Rank Profit
    let derivedRankProfit = 0;
    const sortedRanks = settings.RANK_CONFIG ? (typeof settings.RANK_CONFIG === 'string' ? JSON.parse(settings.RANK_CONFIG) : settings.RANK_CONFIG).sort((a: any, b: any) => a.maxLimit - b.maxLimit) : [];
    const lowestRankId = sortedRanks.length > 0 ? sortedRanks[0].id : 'bronze';

    if (users) {
      users.forEach((u: any) => {
        if (u.isAdmin || u.phone === 'admin' || !u.phone || u.phone.length < 10) return;
        if (u.id === '5444' || u.fullName?.toLowerCase().includes('test')) return;

        const isUpgradedAfterStart = isDateOnOrAfterServer(u.updatedAt ? new Date(Number(u.updatedAt)).toISOString() : u.joinDate, startDate);
        if (isUpgradedAfterStart && u.rank && u.rank !== lowestRankId && !u.isFreeUpgrade && u.rankApproved !== false) {
          const rankConf = sortedRanks.find((r: any) => r.id === u.rank);
          if (rankConf) {
            derivedRankProfit += (rankConf.maxLimit * (upgradePercent / 100));
          }
        }
      });
    }

    // Calculate Loan & Fine Profit
    let derivedFeeProfit = 0;
    let derivedFineProfit = 0;
    let activeDebt = 0;
    const activeStatuses = ['ĐANG NỢ', 'QUÁ HẠN', 'CHỜ TẤT TOÁN', 'ĐANG ĐỐI SOÁT', 'CHỜ DUYỆT TÍNH PHÍ'];

    if (loans) {
      loans.forEach((loan: any) => {
        const loanUser = users ? users.find((u: any) => u.id === loan.userId) : null;
        if (loanUser && (loanUser.isAdmin || !loanUser.phone)) return;

        const isCreatedAfterStart = isDateOnOrAfterServer(loan.createdAt || loan.date, startDate);
        const isSettledAfterStart = isDateOnOrAfterServer(loan.settledAt || loan.createdAt || loan.date, startDate);

        if (isCreatedAfterStart) {
          if (['ĐANG NỢ', 'ĐÃ TẤT TOÁN', 'CHỜ TẤT TOÁN', 'ĐANG ĐỐI SOÁT', 'QUÁ HẠN', 'ĐANG GIẢI NGÂN'].includes(loan.status)) {
            derivedFeeProfit += (Number(loan.amount || 0) * feePercent);
          }
          if (activeStatuses.includes(loan.status)) {
            activeDebt += Number(loan.amount || 0);
          }
        }
        if (isSettledAfterStart) {
          if ((loan.status === 'ĐÃ TẤT TOÁN' || loan.status === 'CHỜ TẤT TOÁN') && loan.fine) {
            derivedFineProfit += Math.round((Number(loan.fine) || 0) / 1000) * 1000;
          }
        }
      });
    }

    // Reconstruct Monthly stats
    const monthlyData: Record<string, { month: string, rankProfit: number, loanProfit: number, fineProfit: number, totalProfit: number }> = {};
    if (users) {
      users.forEach((u: any) => {
        if (u.isAdmin || u.phone === 'admin' || !u.phone || u.phone.length < 10) return;
        if (u.id === '5444' || u.fullName?.toLowerCase().includes('test')) return;

        const dateStr = u.updatedAt ? new Date(Number(u.updatedAt)).toISOString() : u.joinDate;
        const parsedDate = parseDateStringServer(dateStr);
        if (!parsedDate || isNaN(parsedDate.getTime())) return;

        const isUpgradedAfter = isDateOnOrAfterServer(dateStr, startDate);
        if (isUpgradedAfter && u.rank && u.rank !== lowestRankId && !u.isFreeUpgrade && u.rankApproved !== false) {
          const rankConf = sortedRanks.find((r: any) => r.id === u.rank);
          if (rankConf) {
            const mKey = `${(parsedDate.getMonth() + 1).toString().padStart(2, '0')}/${parsedDate.getFullYear()}`;
            if (!monthlyData[mKey]) {
              monthlyData[mKey] = { month: mKey, rankProfit: 0, loanProfit: 0, fineProfit: 0, totalProfit: 0 };
            }
            const amt = (rankConf.maxLimit * (upgradePercent / 100));
            monthlyData[mKey].rankProfit += amt;
            monthlyData[mKey].totalProfit += amt;
          }
        }
      });
    }

    if (loans) {
      loans.forEach((loan: any) => {
        const loanUser = users ? users.find((u: any) => u.id === loan.userId) : null;
        if (loanUser && (loanUser.isAdmin || !loanUser.phone)) return;

        const createdDate = parseDateStringServer(loan.createdAt || loan.date);
        if (createdDate && !isNaN(createdDate.getTime())) {
          const isCreatedAfter = isDateOnOrAfterServer(loan.createdAt || loan.date, startDate);
          if (isCreatedAfter && ['ĐANG NỢ', 'ĐÃ TẤT TOÁN', 'CHỜ TẤT TOÁN', 'ĐANG ĐỐI SOÁT', 'QUÁ HẠN', 'ĐANG GIẢI NGÂN'].includes(loan.status)) {
            const mKey = `${(createdDate.getMonth() + 1).toString().padStart(2, '0')}/${createdDate.getFullYear()}`;
            if (!monthlyData[mKey]) {
              monthlyData[mKey] = { month: mKey, rankProfit: 0, loanProfit: 0, fineProfit: 0, totalProfit: 0 };
            }
            const amt = (Number(loan.amount) || 0) * feePercent;
            monthlyData[mKey].loanProfit += amt;
            monthlyData[mKey].totalProfit += amt;
          }
        }

        const settledDate = parseDateStringServer(loan.settledAt || loan.createdAt || loan.date);
        if (settledDate && !isNaN(settledDate.getTime())) {
          const isSettledAfter = isDateOnOrAfterServer(loan.settledAt || loan.createdAt || loan.date, startDate);
          if (isSettledAfter && (loan.status === 'ĐÃ TẤT TOÁN' || loan.status === 'CHỜ TẤT TOÁN') && loan.fine) {
            const mKey = `${(settledDate.getMonth() + 1).toString().padStart(2, '0')}/${settledDate.getFullYear()}`;
            if (!monthlyData[mKey]) {
              monthlyData[mKey] = { month: mKey, rankProfit: 0, loanProfit: 0, fineProfit: 0, totalProfit: 0 };
            }
            const amt = Math.round((Number(loan.fine) || 0) / 1000) * 1000;
            monthlyData[mKey].fineProfit += amt;
            monthlyData[mKey].totalProfit += amt;
          }
        }
      });
    }

    const monthlyStats = Object.values(monthlyData).sort((a: any, b: any) => {
      const [aM, aY] = a.month.split('/').map(Number);
      const [bM, bY] = b.month.split('/').map(Number);
      return (bY - aY) !== 0 ? (bY - aY) : (bM - aM);
    }).slice(0, 6);

    // Maintain Budget Logs
    const { data: existingLogs } = await client.from('budget_logs').select('*');
    const manualLogs = existingLogs ? existingLogs.filter((log: any) => 
      (log.type === 'ADD' || log.type === 'WITHDRAW') && 
      !log.note?.includes('[Hệ thống]') && 
      !log.note?.includes('PayOS:')
    ) : [];

    const compiledEvents: any[] = [];
    
    // Add manual logs
    manualLogs.forEach((log: any) => {
      const logDate = parseDateStringServer(log.createdAt);
      if (logDate && isDateOnOrAfterServer(log.createdAt, startDate)) {
        compiledEvents.push({
          id: log.id,
          type: log.type,
          amount: Number(log.amount),
          note: log.note,
          createdAt: logDate
        });
      }
    });

    // Reconstruct VIP upgrades
    if (users) {
      users.forEach((u: any) => {
        if (u.isAdmin || u.phone === 'admin' || !u.phone || u.phone.length < 10) return;
        if (u.id === '5444' || u.fullName?.toLowerCase().includes('test')) return;

        const dateStr = u.updatedAt ? new Date(Number(u.updatedAt)).toISOString() : u.joinDate;
        const parsedDate = parseDateStringServer(dateStr);
        if (!parsedDate) return;

        const isUpgradedAfter = isDateOnOrAfterServer(dateStr, startDate);
        if (isUpgradedAfter && u.rank && u.rank !== lowestRankId && !u.isFreeUpgrade && u.rankApproved !== false) {
          const rankConf = sortedRanks.find((r: any) => r.id === u.rank);
          if (rankConf) {
            const amt = (rankConf.maxLimit * (upgradePercent / 100));
            compiledEvents.push({
              id: `UPGRADE_${u.id}_${parsedDate.getTime()}`,
              type: 'ADD',
              amount: amt,
              note: `[Hệ thống] Nâng hạng ${rankConf.name} của ${(u.fullName || '').toUpperCase()} (${u.id})`,
              createdAt: parsedDate
            });
          }
        }
      });
    }

    // Reconstruct loan disbursements & collections
    if (loans) {
      loans.forEach((loan: any) => {
        const loanUser = users ? users.find((u: any) => u.id === loan.userId) : null;
        if (loanUser && (loanUser.isAdmin || !loanUser.phone)) return;

        const isCreatedAfterStart = isDateOnOrAfterServer(loan.createdAt || loan.date, startDate);
        const isSettledAfterStart = isDateOnOrAfterServer(loan.settledAt || loan.createdAt || loan.date, startDate);

        if (isCreatedAfterStart && ['ĐANG NỢ', 'ĐÃ TẤT TOÁN', 'CHỜ TẤT TOÁN', 'ĐANG ĐỐI SOÁT', 'QUÁ HẠN', 'ĐANG GIẢI NGÂN'].includes(loan.status)) {
          const cDate = parseDateStringServer(loan.createdAt || loan.date);
          if (cDate) {
            const disburseActual = Number(loan.amount) * (1 - feePercent);
            compiledEvents.push({
              id: `DISBURSE_${loan.id}_${cDate.getTime()}`,
              type: 'LOAN_DISBURSE',
              amount: disburseActual,
              note: `[Hệ thống] Giải ngân cho ${(loanUser?.fullName || loan.userName || 'KH').toUpperCase()} (${loanUser?.id || loan.userId || ''})`,
              createdAt: cDate
            });
          }
        }

        if (isSettledAfterStart && (loan.status === 'ĐÃ TẤT TOÁN' || loan.status === 'CHỜ TẤT TOÁN')) {
          const sDate = parseDateStringServer(loan.settledAt || loan.createdAt || loan.date);
          if (sDate) {
            let sType = loan.settlementType;
            if (!sType) {
              const baseId = (loan.originalBaseId || loan.id).trim().toLowerCase();
              const nextLc = loans.find((l: any) => {
                const lBase = (l.originalBaseId || l.id).trim().toLowerCase();
                return lBase === baseId && Number(l.principalPaymentCount || 0) === (Number(loan.principalPaymentCount || 0) + 1);
              });
              if (nextLc) {
                if (Number(nextLc.extensionCount || 0) > Number(loan.extensionCount || 0)) {
                  sType = 'PRINCIPAL';
                } else if (Number(nextLc.partialPaymentCount || 0) > Number(loan.partialPaymentCount || 0)) {
                  sType = 'PARTIAL';
                } else {
                  sType = 'PRINCIPAL';
                }
              } else {
                sType = 'ALL';
              }
            }

            const settleName = sType === 'PRINCIPAL' ? 'Gia hạn' : sType === 'PARTIAL' ? 'TTMP' : 'Tất toán';
            let repayAmt = 0;
            if (sType === 'PRINCIPAL') {
              repayAmt = (Number(loan.amount) * feePercent) + (Number(loan.fine) || 0);
            } else if (sType === 'PARTIAL') {
              const pAmount = Number(loan.partialAmount || 0);
              const remainingPrincipal = Number(loan.amount) - pAmount;
              repayAmt = pAmount + (remainingPrincipal * feePercent) + (Number(loan.fine) || 0);
            } else {
              let voucherDiscount = 0;
              if (loan.voucherId && loanUser && loanUser.vouchers) {
                const vouchersList = typeof loanUser.vouchers === 'string' ? JSON.parse(loanUser.vouchers) : loanUser.vouchers;
                if (Array.isArray(vouchersList)) {
                  const v = vouchersList.find((v: any) => v.id === loan.voucherId);
                  if (v) {
                    voucherDiscount = Number(v.amount) || 0;
                  }
                }
              }
              repayAmt = Math.max(0, (Number(loan.amount) + (Number(loan.fine) || 0)) - voucherDiscount);
            }

            compiledEvents.push({
              id: `REPAY_${loan.id}_${sDate.getTime()}`,
              type: 'LOAN_REPAY',
              amount: repayAmt,
              note: `[Hệ thống] Thu hồi (${settleName}) của ${(loanUser?.fullName || loan.userName || 'KH').toUpperCase()} (${loanUser?.id || loan.userId || ''})`,
              createdAt: sDate
            });
          }
        }
      });
    }

    // Sort chronologically ascending
    compiledEvents.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Trace logs chronologically to determine peak deficit and auto-re-adjust initial capital
    let testBalance = capital;
    let peakDeficit = 0;
    compiledEvents.forEach((ev: any) => {
      if (ev.type === 'ADD' || ev.type === 'LOAN_REPAY') {
        testBalance += ev.amount;
      } else if (ev.type === 'LOAN_DISBURSE' || ev.type === 'WITHDRAW') {
        testBalance -= ev.amount;
      }
      if (testBalance < 0) {
        const gap = Math.abs(testBalance);
        if (gap > peakDeficit) {
          peakDeficit = gap;
        }
      }
    });

    const finalStartingCapital = capital + peakDeficit;

    // Generate rolling balances starting with finalStartingCapital
    let runningBalance = finalStartingCapital;
    const reconstructedLogs: any[] = [];

    reconstructedLogs.push({
      id: `INITIAL_${Date.now()}`,
      type: 'INITIAL',
      amount: finalStartingCapital,
      balanceAfter: finalStartingCapital,
      note: `Khởi tạo Vốn Lưu Động ban đầu: ${finalStartingCapital.toLocaleString()}đ (Thiết lập dự án bắt đầu từ ngày ${startDate})${peakDeficit > 0 ? ' [Tự động cân đối bù trừ âm]' : ''}`,
      createdAt: new Date(startDate).toISOString()
    });

    compiledEvents.forEach((ev: any) => {
      if (ev.type === 'ADD' || ev.type === 'LOAN_REPAY') {
        runningBalance += ev.amount;
      } else if (ev.type === 'LOAN_DISBURSE' || ev.type === 'WITHDRAW') {
        runningBalance = Math.max(0, runningBalance - ev.amount);
      }
      reconstructedLogs.push({
        id: ev.id,
        type: ev.type,
        amount: ev.amount,
        balanceAfter: runningBalance,
        note: ev.note,
        createdAt: ev.createdAt.toISOString()
      });
    });

    // Calculate final budget safely using simulated runningBalance (never negative!)
    const finalBudget = Math.max(0, runningBalance);

    // Save accurate configuration keys
    const configUpdates = [
      { key: 'SYSTEM_START_DATE', value: startDate },
      { key: 'SYSTEM_BUDGET', value: finalBudget.toString() },
      { key: 'TOTAL_LOAN_PROFIT', value: derivedFeeProfit.toString() },
      { key: 'TOTAL_FINE_PROFIT', value: derivedFineProfit.toString() },
      { key: 'TOTAL_RANK_PROFIT', value: derivedRankProfit.toString() },
      { key: 'MONTHLY_STATS', value: JSON.stringify(monthlyStats) }
    ];

    const { error: cfgErr } = await client.from('config').upsert(configUpdates, { onConflict: 'key' });
    if (cfgErr) throw cfgErr;

    // Wipe previous logs and save chunked reconstructed logs
    const { error: clearErr } = await client.from('budget_logs').delete().neq('id', 'KEEP_NONE');
    if (clearErr) throw clearErr;

    if (reconstructedLogs.length > 0) {
      reconstructedLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      for (let i = 0; i < reconstructedLogs.length; i += 200) {
        const chunk = reconstructedLogs.slice(i, i + 200);
        const { error: insErr } = await client.from('budget_logs').insert(chunk);
        if (insErr) {
          console.error(`[RE-ESTABLISH] Error inserting logs at chunk ${i}:`, insErr);
        }
      }
    }

    // Emit configuration updates instantly to all clients
    if (io) {
      io.emit("config_updated", [
        { key: 'SYSTEM_START_DATE', value: startDate },
        { key: 'SYSTEM_BUDGET', value: finalBudget.toString() },
        { key: 'TOTAL_LOAN_PROFIT', value: derivedFeeProfit.toString() },
        { key: 'TOTAL_FINE_PROFIT', value: derivedFineProfit.toString() },
        { key: 'TOTAL_RANK_PROFIT', value: derivedRankProfit.toString() },
        { key: 'MONTHLY_STATS', value: JSON.stringify(monthlyStats) }
      ]);
      io.to("admin").emit("sync_completed", { 
        users: users || [], 
        loans: loans || [], 
        configUpdates 
      });
    }

    sendSafeJson(res, { 
      success: true, 
      message: `Hệ thống đã được đồng bộ phục hồi thành công dữ liệu thực tế từ Ngày ${startDate}. Vốn lưu động còn lại: ${finalBudget.toLocaleString()} đ, Phí dịch vụ: ${derivedFeeProfit.toLocaleString()} đ, Phạt: ${derivedFineProfit.toLocaleString()} đ, Phí nâng hạng: ${derivedRankProfit.toLocaleString()} đ, Tổng số Log tích lũy: ${reconstructedLogs.length}.`
    });
  } catch (e: any) {
    console.error("Lỗi trong /api/re-establish:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

router.post("/reset", async (req: any, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Chỉ Admin mới có quyền thực hiện thao tác này" });
    }
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase not configured" });
    
    // Delete all data except admin
    // Must delete children first due to foreign key constraints
    const { error: loanError } = await client.from('loans').delete().neq('id', 'KEEP_NONE');
    if (loanError) {
      console.error("[RESET] Error deleting loans:", loanError);
      return res.status(500).json({ error: "Lỗi khi xóa dữ liệu khoản vay", details: loanError });
    }
    
    const { error: notifError } = await client.from('notifications').delete().neq('id', 'KEEP_NONE');
    if (notifError) {
      console.error("[RESET] Error deleting notifications:", notifError);
      return res.status(500).json({ error: "Lỗi khi xóa thông báo", details: notifError });
    }
    
    const { error: budgetError } = await client.from('budget_logs').delete().neq('id', 'KEEP_NONE');
    if (budgetError) {
      console.error("[RESET] Error deleting budget logs:", budgetError);
      return res.status(500).json({ error: "Lỗi khi xóa nhật ký ngân sách", details: budgetError });
    }
    
    // Robust delete for non-admins (including NULL isAdmin)
    const { error: userError } = await client.from('users').delete().or('isAdmin.eq.false,isAdmin.is.null');
    if (userError) {
      console.error("[RESET] Error deleting users:", userError);
      return res.status(500).json({ error: "Lỗi khi xóa người dùng", details: userError });
    }

    // Verify deletion
    const { count, error: countError } = await client.from('users').select('*', { count: 'exact', head: true });
    if (!countError) {
      console.log(`[RESET] Users remaining after reset: ${count}`);
    }
    
    // Reset config values
    await Promise.all([
      client.from('config').upsert({ key: 'SYSTEM_BUDGET', value: 0 }, { onConflict: 'key' }),
      client.from('config').upsert({ key: 'TOTAL_RANK_PROFIT', value: 0 }, { onConflict: 'key' }),
      client.from('config').upsert({ key: 'TOTAL_LOAN_PROFIT', value: 0 }, { onConflict: 'key' }),
      client.from('config').upsert({ key: 'MONTHLY_STATS', value: [] }, { onConflict: 'key' })
    ]);
    
    sendSafeJson(res, { success: true });
  } catch (e: any) {
    console.error("Lỗi trong /api/reset:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

router.post("/execute-sql", async (req: any, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Chỉ Admin mới có quyền thực hiện thao tác này" });
    }
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase not configured" });
    
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: "Thiếu mã SQL" });

    // Try to execute via RPC
    const { error } = await client.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error("[SQL EXEC ERROR]", error);
      // Check if function doesn't exist
      if (error.code === 'PGRST202' || error.message?.includes('function') && error.message?.includes('does not exist')) {
        return res.status(400).json({ 
          error: "RPC_NOT_FOUND", 
          message: "Tính năng tự động cập nhật chưa được kích hoạt. Vui lòng chạy lệnh SQL khởi tạo một lần duy nhất trong Supabase SQL Editor." 
        });
      }
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, message: "Thực thi SQL thành công." });
  } catch (e: any) {
    console.error("Lỗi thực thi SQL:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

router.post("/migrate", async (req: any, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Chỉ Admin mới có quyền thực hiện thao tác này" });
    }
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase not configured" });
    
    console.log("[Migration] Checking database structure...");
    
    // Check loans table
    const { error: loanError } = await client.from('loans').select('principalPaymentCount, partialAmount, payosOrderCode, payosCheckoutUrl, payosAmount, payosExpireAt, extensionCount, partialPaymentCount, originalBaseId, voucherId, settledAt').limit(1);
    
    if (loanError && loanError.code === '42703') {
      return res.status(400).json({
        success: false,
        error: "Thiếu cột trong Loans",
        message: "Bảng 'loans' thiếu một số cột cần thiết cho PayOS hoặc quản lý thanh toán. Vui lòng chạy SQL Schema đầy đủ trong Supabase SQL Editor."
      });
    }

    // Check users table
    const { error: userError } = await client.from('users').select('payosOrderCode, payosCheckoutUrl, payosAmount, payosExpireAt, pendingUpgradeRank, rankUpgradeBill').limit(1);
    
    if (userError && userError.code === '42703') {
      return res.status(400).json({
        success: false,
        error: "Thiếu cột trong Users",
        message: "Bảng 'users' thiếu một số cột cần thiết cho PayOS hoặc nâng hạng. Vui lòng chạy SQL Schema đầy đủ trong Supabase SQL Editor."
      });
    }
    
    const { error: configError } = await client.from('config').select('key').limit(1);
    if (configError && configError.code === 'PGRST116') {
      // Table might exist but is empty, that's fine
    } else if (configError) {
      console.warn("[Migration] Config table check error:", configError);
    }

    res.json({ success: true, message: "Cấu trúc cơ sở dữ liệu đã chính xác." });
  } catch (e: any) {
    console.error("Lỗi trong /api/migrate:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

router.post("/import", async (req: any, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Chỉ Admin mới có quyền thực hiện thao tác này" });
    }
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase not configured" });
    
    // Extract data from backup file
    const { users, loans, notifications, budget, rankProfit, loanProfit, monthlyStats, budgetLogs, configs } = req.body;
    
    console.log(`[IMPORT] Starting system restoration: users=${users?.length}, loans=${loans?.length}, budgetLogs=${budgetLogs?.length}`);
    
    const now = Date.now();
    const importResults: any[] = [];

    // 1. Restore Users (Sequential)
    if (users && Array.isArray(users) && users.length > 0) {
      const processedUsers = await Promise.all(users.map(async (u) => {
        // Preserving hashed password if exists
        const isAlreadyHashed = typeof u.password === 'string' && /^\$2[aby]\$\d+\$.{53}$/.test(u.password);
        if (u.password && typeof u.password === 'string' && !isAlreadyHashed) {
          const salt = await bcrypt.genSalt(10);
          u.password = await bcrypt.hash(u.password, salt);
        }
        if (!u.updatedAt) u.updatedAt = now;
        return u;
      }));

      const sanitizedUsers = sanitizeData(processedUsers, USER_WRITE_COLUMNS, 'users');
      if (sanitizedUsers.length > 0) {
        const chunkSize = 50;
        for (let i = 0; i < sanitizedUsers.length; i += chunkSize) {
          const chunk = sanitizedUsers.slice(i, i + chunkSize);
          const { error } = await client.from('users').upsert(chunk, { onConflict: 'id' });
          if (error) {
             console.error(`[IMPORT] Error upserting users at chunk ${i}:`, error);
             return res.status(500).json({ success: false, message: "Lỗi khôi phục người dùng", details: error });
          }
        }
        importResults.push({ table: 'users', count: sanitizedUsers.length });
      }
    }
    
    // 2. Restore Loans (Sequential)
    if (loans && Array.isArray(loans) && loans.length > 0) {
      const processedLoans = loans.map(l => ({ ...l, updatedAt: l.updatedAt || now }));
      const sanitizedLoans = sanitizeData(processedLoans, LOAN_COLUMNS, 'loans');
      if (sanitizedLoans.length > 0) {
        const chunkSize = 50;
        for (let i = 0; i < sanitizedLoans.length; i += chunkSize) {
          const chunk = sanitizedLoans.slice(i, i + chunkSize);
          const { error } = await client.from('loans').upsert(chunk, { onConflict: 'id' });
          if (error) {
            console.error(`[IMPORT] Error upserting loans at chunk ${i}:`, error);
            return res.status(500).json({ success: false, message: "Lỗi khôi phục khoản vay", details: error });
          }
        }
        importResults.push({ table: 'loans', count: sanitizedLoans.length });
      }
    }
    
    // 3. Restore Notifications (Sequential)
    if (notifications && Array.isArray(notifications) && notifications.length > 0) {
      const sanitizedNotifications = sanitizeData(notifications, NOTIFICATION_COLUMNS, 'notifications');
      if (sanitizedNotifications.length > 0) {
        const { error } = await client.from('notifications').upsert(sanitizedNotifications, { onConflict: 'id' });
        if (error) {
          console.error("[IMPORT] Error upserting notifications:", error);
          return res.status(500).json({ success: false, message: "Lỗi khôi phục thông báo", details: error });
        }
        importResults.push({ table: 'notifications', count: sanitizedNotifications.length });
      }
    }

    // 4. Restore Budget Logs (Sequential)
    if (budgetLogs && Array.isArray(budgetLogs) && budgetLogs.length > 0) {
      const sanitizedBudgetLogs = sanitizeData(budgetLogs, BUDGET_LOG_COLUMNS, 'budget_logs');
      if (sanitizedBudgetLogs.length > 0) {
        const chunkSize = 50;
        for (let i = 0; i < sanitizedBudgetLogs.length; i += chunkSize) {
          const chunk = sanitizedBudgetLogs.slice(i, i + chunkSize);
          const { error } = await client.from('budget_logs').upsert(chunk, { onConflict: 'id' });
          if (error) {
            console.error(`[IMPORT] Error upserting budget_logs at chunk ${i}:`, error);
            return res.status(500).json({ success: false, message: "Lỗi khôi phục nhật ký ngân sách", details: error });
          }
        }
        importResults.push({ table: 'budget_logs', count: sanitizedBudgetLogs.length });
      }
    }
    
    // 5. Restore Configs (Bulk then Parallel)
    const configTasks = [];
    if (configs && typeof configs === 'object') {
      Object.entries(configs).forEach(([key, value]) => {
        configTasks.push(client.from('config').upsert({ key, value }, { onConflict: 'key' }));
      });
    }

    // Explicit overrides for budget and stats
    if (budget !== undefined) configTasks.push(client.from('config').upsert({ key: 'SYSTEM_BUDGET', value: budget }, { onConflict: 'key' }));
    if (rankProfit !== undefined) configTasks.push(client.from('config').upsert({ key: 'TOTAL_RANK_PROFIT', value: rankProfit }, { onConflict: 'key' }));
    if (loanProfit !== undefined) configTasks.push(client.from('config').upsert({ key: 'TOTAL_LOAN_PROFIT', value: loanProfit }, { onConflict: 'key' }));
    if (monthlyStats !== undefined) configTasks.push(client.from('config').upsert({ key: 'MONTHLY_STATS', value: monthlyStats }, { onConflict: 'key' }));
    
    if (configTasks.length > 0) {
      const results = await Promise.all(configTasks);
      const errors = results.filter(r => r.error).map(r => r.error);
      if (errors.length > 0) {
        console.error("[IMPORT] Error upserting configs:", errors);
      }
      importResults.push({ table: 'configs', count: configTasks.length });
    }
    
    console.log("[IMPORT] Successfully completed system restoration:", JSON.stringify(importResults));
    sendSafeJson(res, { success: true, details: importResults });
  } catch (e: any) {
    console.error("Lỗi trong /api/import:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

// Specific health check for Vercel deployment verification
router.get("/api-health", (req, res) => {
  const client = initSupabase();
  res.json({ 
    status: "ok", 
    environment: process.env.NODE_ENV || 'production', 
    supabase: !!client,
    payos: !!process.env.PAYOS_API_KEY,
    timestamp: new Date().toISOString(),
    url: req.url,
    method: req.method
  });
});

// --- PAYOS PAYMENT ROUTES ---

// Create Payment Link
router.post("/payment/create-link", async (req, res) => {
  try {
    const { type, id, amount, description, targetRank, screen, settleType, partialAmount } = req.body; // type: 'SETTLE' | 'UPGRADE', id: loanId or userId
    
    if (!id || !amount) {
      return res.status(400).json({ error: "Thiếu thông tin hoặc số tiền" });
    }

    const client = initSupabase();
    
    const settings = await getMergedSettings(client);
    const payosInstance = getPayOS(settings);

    const orderCode = Date.now();
    const domain = settings.APP_URL || `http://localhost:3000`;
    const expireAt = Date.now() + 15 * 60 * 1000; // 15 mins
    
    let finalDescription = description;
    if (!finalDescription) {
      const masterConfigs = Array.isArray(settings?.MASTER_CONFIGS) ? settings.MASTER_CONFIGS : [];
      
      if (type === 'UPGRADE') {
        const masterUpgrade = masterConfigs.find((c: any) => c.systemMeaning === 'transfer_upgrade' || c.systemMeaning === 'UPGRADE');
        const template = masterUpgrade?.format || "HANG {RANK} {USER}";
        
        const rankNames: Record<string, string> = {
          'standard': 'TIEU CHUAN',
          'bronze': 'DONG',
          'silver': 'BAC',
          'gold': 'VANG',
          'diamond': 'KIM CUONG'
        };
        const rankName = rankNames[targetRank || ''] || targetRank || '';
        
        // Fetch user to get phone number
        const { data: userData } = await client.from('users').select('phone').eq('id', id).single();
        const userPhone = userData?.phone || '';

        finalDescription = resolveMasterConfigServer(template, settings, {
          userId: id,
          phone: userPhone,
          rank: rankName,
          abbr: masterUpgrade?.abbreviation || 'NH'
        });

        // Perfect client-side equivalence pass for trailing custom variables
        finalDescription = finalDescription
          .replace(/\{ID\}|\{Mã Hợp Đồng\}|\{LOAN_ID\}|\{MHD\}|\{HD\}|\{CONTRACT\}/gi, id)
          .replace(/\{USER_ID\}|\{USER\}|\{MÃ USER\}|\{NGƯỜI DÙNG\}/gi, id)
          .replace(/\{PHONE\}|\{SĐT\}|\{SDT\}|\{SỐ ĐIỆN THOẠI\}|\{SO DIEN THOAI\}/gi, userPhone)
          .replace(/\{RANK\}|\{HẠNG\}|\{HANG\}|\{TÊN HẠNG CẦN NÂNG\}|\{TEN HANG NANG CAP\}|\{TEN HANG\}|\{TÊN HẠNG\}/gi, rankName)
          .replace(/\{VT\}|\{VIẾT TẮT\}|\{VIET TAT\}/gi, masterUpgrade?.abbreviation || 'NH');
      } else {
        let template = "";
        let loanData: any = null;
        let currentAbbr = "";
        
        if (settleType === 'PARTIAL' || settleType === 'PRINCIPAL') {
          // Fetch loan to get counts and originalBaseId
          const { data } = await client.from('loans').select('extensionCount, partialPaymentCount, originalBaseId, userId, users(phone)').eq('id', id).single();
          loanData = data;
          
          if (settleType === 'PARTIAL') {
            const masterPartial = masterConfigs.find((c: any) => c.systemMeaning === 'transfer_partial' || c.systemMeaning === 'PARTIAL_SETTLEMENT');
            template = masterPartial?.format || "TTMP {ID} LAN {SLTTMP}";
            currentAbbr = masterPartial?.abbreviation || 'TTMP';
          } else {
            const masterExtension = masterConfigs.find((c: any) => c.systemMeaning === 'transfer_extension' || c.systemMeaning === 'EXTENSION');
            template = masterExtension?.format || "GIA HAN {ID} LAN {SLGH}";
            currentAbbr = masterExtension?.abbreviation || 'GH';
          }
        } else {
          // Fetch loan for full settlement to get user info and originalBaseId
          const { data } = await client.from('loans').select('userId, originalBaseId, users(phone)').eq('id', id).single();
          loanData = data;
          const masterFull = masterConfigs.find((c: any) => c.systemMeaning === 'transfer_full' || c.systemMeaning === 'FULL_SETTLEMENT');
          template = masterFull?.format || "TAT TOAN {ID}";
          currentAbbr = masterFull?.abbreviation || 'TT';
        }
        
        const userPhone = loanData?.users?.phone || loanData?.userPhone || '';
        let partialCount = loanData?.partialPaymentCount || 0;
        const extensionCount = loanData?.extensionCount || 0;

        // Fallback: try to extract partial count from ID if it's 0 and the ID looks like it has one
        if (partialCount === 0 && id.toLowerCase().includes('ttmp')) {
          const match = id.match(/(?:LAN|LẦN|L|#)\s*(\d+)$/i);
          if (match) partialCount = parseInt(match[1]);
        }
        
        // Use originalBaseId if available, otherwise strip prefixes from current ID
        let baseId = loanData?.originalBaseId || '';
        if (!baseId) {
          const cleanId = id;
          const allAbbrs = masterConfigs
            .filter((c: any) => c.category === 'ABBREVIATION' || c.category === 'TRANSFER_CONTENT' || c.category === 'CONTRACT_NEW')
            .map((c: any) => c.abbreviation)
            .filter(Boolean);
          const systemAbbrs = ['TTMP', 'GH', 'GN', 'NH', 'TT', 'TATTOAN', 'GIAHAN', 'GIAINGAN'];
          const combinedAbbrs = [...new Set([...allAbbrs, ...systemAbbrs])];
          const stripRegex = new RegExp(`^(${combinedAbbrs.join('|')})`, 'i');
          
          const oldId = cleanId;
          baseId = cleanId.replace(stripRegex, '').trim();
          if (oldId !== baseId) {
            baseId = baseId.replace(/(LAN|LẦN|L|#)\s*\d+$/i, '').replace(/\d+$/, '').trim();
          }
        }

        finalDescription = resolveMasterConfigServer(template, settings, {
          userId: loanData?.userId || '',
          originalId: settleType === 'ALL' ? id : (baseId || id),
          fullId: id,
          sequence: settleType === 'PARTIAL' ? (partialCount + 1) : (extensionCount + 1),
          n: settleType === 'PARTIAL' ? (partialCount + 1) : (extensionCount + 1),
          slgh: extensionCount + 1,
          slttmp: partialCount + 1,
          phone: userPhone,
          rank: '',
          abbr: currentAbbr
        });

        // Perfect client-side equivalence pass for trailing custom variables
        finalDescription = finalDescription
          .replace(/\{ID\}|\{Mã Hợp Đồng\}|\{LOAN_ID\}|\{MHD\}|\{HD\}|\{CONTRACT\}/gi, id)
          .replace(/\{USER_ID\}|\{USER\}|\{MÃ USER\}|\{NGƯỜI DÙNG\}/gi, loanData?.userId || id.split('NDV')[0] || id.slice(-4).toUpperCase())
          .replace(/\{PHONE\}|\{SĐT\}|\{SDT\}|\{SỐ ĐIỆN THOẠI\}|\{SO DIEN THOAI\}/gi, userPhone)
          .replace(/\{SLGH\}|\{SỐ LẦN GIA HẠN\}|\{EXTENSION_COUNT\}/gi, settleType === 'PRINCIPAL' ? (extensionCount + 1).toString() : '')
          .replace(/\{SLTTMP\}|\{SỐ LẦN TTMP\}|\{PARTIAL_COUNT\}/gi, settleType === 'PARTIAL' ? (partialCount + 1).toString() : '')
          .replace(/\{VT\}|\{VIẾT TẮT\}|\{VIET TAT\}/gi, currentAbbr);
      }
    }

    // PayOS strictly limits description to 25 characters and rejects accents or special symbols.
    finalDescription = finalDescription
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toUpperCase()
      .replace(/[^A-Z0-9\s-_]/g, '') // Only standard alphanumeric characters plus space, dash, or underscore
      .replace(/\s+/g, ' ')
      .trim();

    if (finalDescription.length > 25) {
      finalDescription = finalDescription.substring(0, 25);
    }

    const body = {
      orderCode: orderCode,
      amount: Number(amount),
      description: finalDescription,
      cancelUrl: `${domain}/api/payment-result?payment=cancel&type=${type}&id=${id}&screen=${screen || ''}`,
      returnUrl: `${domain}/api/payment-result?payment=success&type=${type}&id=${id}&screen=${screen || ''}`,
    };

    const paymentLinkResponse = await payosInstance.paymentRequests.create(body);
    
    // Save link info to DB
    if (type === 'SETTLE') {
      await client.from('loans').update({ 
        payosCheckoutUrl: paymentLinkResponse.checkoutUrl,
        payosOrderCode: orderCode,
        payosAmount: Number(amount),
        payosExpireAt: expireAt,
        settlementType: settleType || 'ALL',
        partialAmount: partialAmount || null,
        voucherId: req.body.voucherId || null,
        updatedAt: Date.now()
      }).eq('id', id);
    } else if (type === 'UPGRADE') {
      await client.from('users').update({ 
        payosCheckoutUrl: paymentLinkResponse.checkoutUrl,
        payosOrderCode: orderCode,
        payosAmount: Number(amount),
        payosExpireAt: expireAt,
        pendingUpgradeRank: targetRank || null,
        updatedAt: Date.now()
      }).eq('id', id);
    }

    res.json({ 
      success: true, 
      checkoutUrl: paymentLinkResponse.checkoutUrl,
      paymentLinkId: paymentLinkResponse.paymentLinkId,
      orderCode: orderCode
    });
  } catch (e: any) {
    console.error("PayOS Create Link Error:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

// Cancel Pending Upgrade
router.post("/payment/cancel-upgrade", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const client = initSupabase();
    
    // Only clear if it was a PayOS attempt (no bill image)
    await client.from('users').update({
      pendingUpgradeRank: null,
      rankUpgradeBill: null,
      payosCheckoutUrl: null,
      payosOrderCode: null,
      updatedAt: Date.now()
    }).eq('id', userId);
    
    res.json({ success: true });
  } catch (e: any) {
    console.error("Cancel Upgrade Error:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
  }
});

// PayOS Webhook
router.post("/payment/webhook", async (req, res) => {
  try {
    console.log("[PAYOS] Webhook received:", JSON.stringify(req.body));
    
    const client = initSupabase();
    const settings = await getMergedSettings(client);
    const payosInstance = getPayOS(settings);

    // Verify the webhook data
    const webhookData = await payosInstance.webhooks.verify(req.body);
    console.log("[PAYOS] Webhook verified data:", JSON.stringify(webhookData));
    
    if (webhookData.code === '00' || webhookData.desc === 'success') {
      // Get current settings for statistics update
      const { data: config } = await client.from('config').select('*');
      const settings: any = {};
      config?.forEach(item => {
        // Ensure numeric values are parsed as numbers for calculation
        if (['SYSTEM_BUDGET', 'TOTAL_LOAN_PROFIT', 'TOTAL_RANK_PROFIT', 'MIN_SYSTEM_BUDGET'].includes(item.key)) {
          settings[item.key] = Number(item.value) || 0;
        } else if (item.key === 'MONTHLY_STATS') {
          try {
            settings[item.key] = typeof item.value === 'string' ? JSON.parse(item.value) : (item.value || []);
          } catch (e) {
            settings[item.key] = [];
          }
        } else {
          settings[item.key] = item.value;
        }
      });

      const orderCode = webhookData.orderCode;
      const amount = webhookData.amount;
      console.log(`[PAYOS] Webhook verified data for orderCode: ${orderCode}, amount: ${amount}`);
      
      // 1. Try to find a loan with this orderCode
      const { data: loan, error: loanError } = await client
        .from('loans')
        .select('*')
        .eq('payosOrderCode', orderCode)
        .maybeSingle();
        
      if (loanError) {
        console.error(`[PAYOS] Error searching for loan with orderCode ${orderCode}:`, JSON.stringify(loanError));
      }
        
      if (loan) {
        console.log(`[PAYOS] Found loan: ${loan.id} for user: ${loan.userId}`);
        const settleType = loan.settlementType || 'ALL';
        const loanId = loan.id;
        
        // Mark current loan as settled
        const { error: updateError } = await client
          .from('loans')
          .update({ 
            status: 'ĐÃ TẤT TOÁN', 
            settledAt: new Date().toISOString(),
            updatedAt: Date.now()
          })
          .eq('id', loanId);
          
        if (updateError) {
          console.error(`[PAYOS] Error updating loan ${loanId} to settled:`, JSON.stringify(updateError));
        } else {
          console.log(`[PAYOS] Loan ${loanId} updated to settled successfully.`);
        }
          
        if (!updateError) {
          const { data: user, error: userError } = await client
            .from('users')
            .select('*')
            .eq('id', loan.userId)
            .single();
            
          if (user && !userError) {
            const io = req.app.get("io");
            // Calculate profit and budget updates
            let feeAmount = 0;
            let fineAmount = Math.round((loan.fine || 0) / 1000) * 1000;
            let budgetUpdate = 0;
            const feePercent = Number(settings.PRE_DISBURSEMENT_FEE || 0) / 100;

            // Handle voucher usage
            let voucherDiscount = 0;
            let updatedVouchers = user.vouchers || [];
            if (loan.voucherId && updatedVouchers.length > 0) {
              const vIdx = updatedVouchers.findIndex((v: any) => v.id === loan.voucherId);
              if (vIdx !== -1 && !updatedVouchers[vIdx].isUsed) {
                voucherDiscount = updatedVouchers[vIdx].amount;
                updatedVouchers[vIdx].isUsed = true;
                updatedVouchers[vIdx].usedAt = new Date().toISOString();
              }
            }

            if (settleType === 'PRINCIPAL') {
              feeAmount = loan.amount * feePercent;
              fineAmount = Math.round((loan.fine || 0) / 1000) * 1000;
              budgetUpdate = feeAmount + fineAmount;
            } else if (settleType === 'PARTIAL') {
              const pAmount = loan.partialAmount || 0;
              const remainingPrincipal = loan.amount - pAmount;
              feeAmount = remainingPrincipal * feePercent;
              fineAmount = Math.round((loan.fine || 0) / 1000) * 1000;
              budgetUpdate = pAmount + feeAmount + fineAmount;
            } else {
              // Full Settlement
              feeAmount = 0; 
              fineAmount = Math.round((loan.fine || 0) / 1000) * 1000;
              budgetUpdate = Math.max(0, (loan.amount + fineAmount) - voucherDiscount);
            }

            // Update system stats
            const currentTotalFeeProfit = (Number(settings.TOTAL_LOAN_PROFIT) || 0);
            const currentTotalFineProfit = (Number(settings.TOTAL_FINE_PROFIT) || 0);
            
            const newBudget = (Number(settings.SYSTEM_BUDGET) || 0) + budgetUpdate;
            const newLoanProfit = currentTotalFeeProfit + feeAmount;
            const newFineProfit = currentTotalFineProfit + fineAmount;
            
            let newMonthlyStats = Array.isArray(settings.MONTHLY_STATS) ? [...settings.MONTHLY_STATS] : [];
            const now = new Date();
            const monthKey = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
            const existingIdx = newMonthlyStats.findIndex((s: any) => s.month === monthKey);
            
            if (existingIdx !== -1) {
              const stat = { ...newMonthlyStats[existingIdx] };
              stat.loanProfit = (Number(stat.loanProfit) || 0) + feeAmount;
              stat.fineProfit = (Number(stat.fineProfit) || 0) + fineAmount;
              stat.totalProfit = (Number(stat.rankProfit) || 0) + (Number(stat.loanProfit) || 0) + (Number(stat.fineProfit) || 0);
              newMonthlyStats[existingIdx] = stat;
            } else {
              newMonthlyStats = [{ 
                month: monthKey, 
                rankProfit: 0, 
                loanProfit: feeAmount, 
                fineProfit: fineAmount,
                totalProfit: feeAmount + fineAmount 
              }, ...newMonthlyStats].slice(0, 6);
            }

            await client.from('config').upsert([
              { key: 'SYSTEM_BUDGET', value: newBudget.toString() },
              { key: 'TOTAL_LOAN_PROFIT', value: newLoanProfit.toString() },
              { key: 'TOTAL_FINE_PROFIT', value: newFineProfit.toString() },
              { key: 'MONTHLY_STATS', value: JSON.stringify(newMonthlyStats) }
            ], { onConflict: 'key' });

            if (io) {
              const ioUpdates = [
                { key: 'SYSTEM_BUDGET', value: newBudget },
                { key: 'budget', value: newBudget },
                { key: 'TOTAL_LOAN_PROFIT', value: newLoanProfit },
                { key: 'loanProfit', value: newLoanProfit },
                { key: 'TOTAL_FINE_PROFIT', value: newFineProfit },
                { key: 'fineProfit', value: newFineProfit },
                { key: 'MONTHLY_STATS', value: newMonthlyStats }
              ];
              io.emit("config_updated", ioUpdates);
              io.emit("config_updated", {
                SYSTEM_BUDGET: newBudget,
                budget: newBudget,
                TOTAL_LOAN_PROFIT: newLoanProfit,
                loanProfit: newLoanProfit,
                TOTAL_FINE_PROFIT: newFineProfit,
                fineProfit: newFineProfit,
                MONTHLY_STATS: newMonthlyStats
              });
            }

            const profitAmount = feeAmount + fineAmount;

            // Create Budget Log for Loan Settlement
            const budgetLogId = `BL${Date.now()}`;
            const settleLabelShort = settleType === 'ALL' ? 'Tất toán' : (settleType === 'PARTIAL' ? 'TTMP' : 'Gia hạn');
            const budgetLog = {
              id: budgetLogId,
              type: 'LOAN_REPAY',
              amount: budgetUpdate,
              balanceAfter: newBudget,
              note: `[Tự động] Thu hồi (${settleLabelShort}) của ${(user.fullName || user.phone || 'KH').toUpperCase()} (${user.id || user.phone || ''})`,
              createdAt: new Date().toISOString()
            };
            await client.from('budget_logs').insert([budgetLog]);

            // Handle different settlement types
            let nextLoan: any = null;
            
            if (settleType === 'ALL') {
              // Full Settlement: Restore balance
              const maxOnTimePayments = Number(settings.MAX_ON_TIME_PAYMENTS_FOR_UPGRADE || 10);
              const newBalance = Math.min(user.totalLimit, (user.balance || 0) + loan.amount);
              const newRankProgress = Math.min(maxOnTimePayments, (user.rankProgress || 0) + 1);
              const newFullSettlementCount = (user.fullSettlementCount || 0) + 1;
              
              // Award lucky spin if on time AND meets the required payments count
              let newSpins = user.spins || 0;
              const dueDateParts = (loan.date || "").split('/');
              if (dueDateParts.length === 3) {
                const dueDate = new Date(parseInt(dueDateParts[2]), parseInt(dueDateParts[1]) - 1, parseInt(dueDateParts[0]));
                dueDate.setHours(23, 59, 59, 999);
                
                // Only award if on time
                if (new Date() <= dueDate) {
                  const requiredPayments = Number(settings.LUCKY_SPIN_PAYMENTS_REQUIRED || 1);
                  if (newFullSettlementCount % requiredPayments === 0) {
                    newSpins += 1;
                  }
                }
              }

              const newTotalProfit = (user.totalProfit || 0) + profitAmount;

              await client
                .from('users')
                .update({ 
                  balance: newBalance, 
                  rankProgress: newRankProgress, 
                  fullSettlementCount: newFullSettlementCount,
                  spins: newSpins,
                  vouchers: updatedVouchers,
                  totalProfit: newTotalProfit,
                  updatedAt: Date.now() 
                })
                .eq('id', loan.userId);
            } else {
              // PRINCIPAL (Gia hạn) or PARTIAL (TTMP): Update total profit
              const newTotalProfit = (user.totalProfit || 0) + profitAmount;
              await client
                .from('users')
                .update({ 
                  vouchers: updatedVouchers,
                  totalProfit: newTotalProfit,
                  updatedAt: Date.now() 
                })
                .eq('id', loan.userId);

            // PRINCIPAL (Gia hạn) or PARTIAL (TTMP): Create next cycle loan
            const nextCount = (loan.principalPaymentCount || 0) + 1;
            const nextExtensionCount = settleType === 'PRINCIPAL' ? (loan.extensionCount || 0) + 1 : (loan.extensionCount || 0);
            const nextPartialCount = settleType === 'PARTIAL' ? (loan.partialPaymentCount || 0) + 1 : (loan.partialPaymentCount || 0);
            
            // Use originalBaseId if available, otherwise strip prefixes from current ID
            let cleanBaseId = loan.originalBaseId || loan.id;
            if (!loan.originalBaseId) {
              const allAbbrs = (settings.MASTER_CONFIGS || [])
                .filter((c: any) => c.category === 'ABBREVIATION' || c.category === 'TRANSFER_CONTENT' || c.category === 'CONTRACT_NEW')
                .map((c: any) => c.abbreviation)
                .filter(Boolean);
              const systemAbbrs = ['TTMP', 'GH', 'GN', 'NH', 'TT', 'TATTOAN', 'GIAHAN', 'GIAINGAN'];
              const combinedAbbrs = [...new Set([...allAbbrs, ...systemAbbrs])];
              const stripRegex = new RegExp(`^(${combinedAbbrs.join('|')})`, 'i');
              
              const oldId = cleanBaseId;
              cleanBaseId = cleanBaseId.replace(stripRegex, '').trim();
              if (oldId !== cleanBaseId) {
                cleanBaseId = cleanBaseId.replace(/(LAN|LẦN|L|#)\s*\d+$/i, '').replace(/\d+$/, '').trim();
              }
            }

            // Generate new ID using Admin configured formats
            const format = settleType === 'PRINCIPAL' 
              ? getFormatFromSettings(settings, 'EXTENSION', settings.CONTRACT_FORMAT_EXTENSION || "{ID}GH{N}", 'SYSTEM_CONTRACT_FORMATS_CONFIG')
              : getFormatFromSettings(settings, 'PARTIAL_SETTLEMENT', settings.CONTRACT_FORMAT_PARTIAL_SETTLEMENT || "{ID}TTMP{N}", 'SYSTEM_CONTRACT_FORMATS_CONFIG');
            
            const newId = generateContractIdServer(loan.userId, format, settings, cleanBaseId, undefined, nextCount, nextExtensionCount, nextPartialCount);
            
            // Calculate new due date (1st of next month)
            let newDueDate = loan.date;
            if (loan.date && typeof loan.date === 'string') {
              const [d, m, y] = loan.date.split('/').map(Number);
              const currentDueDate = new Date(y, m - 1, d);
              const nextCycleDate = new Date(currentDueDate.getFullYear(), currentDueDate.getMonth() + 1, 1);
              const dayStr = nextCycleDate.getDate().toString().padStart(2, '0');
              const monthStr = (nextCycleDate.getMonth() + 1).toString().padStart(2, '0');
              newDueDate = `${dayStr}/${monthStr}/${nextCycleDate.getFullYear()}`;
            }
            
            const nextLoanAmount = settleType === 'PARTIAL' ? (loan.amount - (loan.partialAmount || 0)) : loan.amount;
            
            nextLoan = {
              ...loan,
              id: newId,
              originalBaseId: cleanBaseId,
              status: 'ĐANG NỢ',
              date: newDueDate,
              amount: nextLoanAmount,
              principalPaymentCount: nextCount,
              extensionCount: nextExtensionCount,
              partialPaymentCount: nextPartialCount,
              billImage: null,
              settlementType: null,
              partialAmount: null,
              fine: 0,
              payosOrderCode: null,
              payosCheckoutUrl: null,
              payosExpireAt: null,
              updatedAt: Date.now()
            };
              
              await client.from('loans').insert([nextLoan]);
              
              // Update user rank progress and balance if partial
              let newBalance = user.balance;
              if (settleType === 'PARTIAL') {
                newBalance = Math.min(user.totalLimit, (user.balance || 0) + (loan.partialAmount || 0));
              }
              const maxOnTimePayments = Number(settings.MAX_ON_TIME_PAYMENTS_FOR_UPGRADE || 10);
              const newRankProgress = Math.min(maxOnTimePayments, (user.rankProgress || 0) + 1);
              await client
                .from('users')
                .update({ balance: newBalance, rankProgress: newRankProgress, updatedAt: Date.now() })
                .eq('id', loan.userId);
            }
            
            if (io) {
              io.to(`user_${loan.userId}`).emit("payment_success", { 
                loanId, 
                amount, 
                message: `Khoản vay của bạn đã được ${settleType === 'ALL' ? 'tất toán' : (settleType === 'PARTIAL' ? 'thanh toán một phần' : 'gia hạn')} tự động!` 
              });
              
              // Broadcast updated loans to admin and user
              const loansToEmit = [
                { ...loan, status: 'ĐÃ TẤT TOÁN', settledAt: new Date().toISOString(), updatedAt: Date.now() }
              ];
              if (settleType !== 'ALL') {
                loansToEmit.push(nextLoan);
              }
              
              io.to(`user_${loan.userId}`).emit("loans_updated", loansToEmit);
              io.to("admin").emit("loans_updated", loansToEmit);
              
              // Update user balance/rankProgress locally for admin
              const { data: updatedUser } = await client.from('users').select('*').eq('id', loan.userId).single();
              if (updatedUser) {
                io.to(`user_${loan.userId}`).emit("user_updated", updatedUser);
                io.to("admin").emit("user_updated", updatedUser);
              }

              io.to("admin").emit("admin_notification", {
                type: "PAYMENT",
                message: `Người dùng ${loan.userId} đã ${settleType === 'ALL' ? 'tất toán' : (settleType === 'PARTIAL' ? 'TTMP' : 'gia hạn')} khoản vay ${loanId} qua PayOS.`
              });
            }

            // Add persistent notification for user
            const notifId = `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const settleLabel = settleType === 'ALL' ? 'tất toán toàn bộ' : (settleType === 'PARTIAL' ? 'thanh toán một phần gốc' : 'gia hạn thành công');
            const detailMsg = settleType === 'ALL' 
              ? `Chúc mừng! Khoản vay ${loanId} của bạn đã được ${settleLabel} tự động thông qua hệ thống PayOS. Cảm ơn bạn đã tin dùng dịch vụ.`
              : `Khoản nợ mã số ${loanId} đã được ${settleLabel} tự động. Dư nợ và kỳ hạn của bạn đã được cập nhật chính xác trên hệ thống.`;

            await client.from('notifications').insert([{
              id: notifId,
              userId: loan.userId,
              title: 'Thanh toán tự động thành công',
              message: detailMsg,
              time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
              read: false,
              type: 'LOAN'
            }]);
            triggerPushForUser(loan.userId, 'Thanh toán tự động thành công', detailMsg, client);

            // Add persistent notification for Admin
            await client.from('notifications').insert([{
              id: `ADMIN-NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              userId: 'ADMIN', // Special marker for admin notifications
              title: 'Thanh toán PayOS thành công',
              message: `Người dùng ${user.fullName || user.phone} đã ${settleLabel} khoản vay ${loanId} qua PayOS.`,
              time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
              read: false,
              type: 'SYSTEM'
            }]);

            // Telegram Notification
            getMergedSettings(client).then(settings => {
              const labelUpper = settleLabel.toUpperCase();
              const telegramMsg = `<b>💸 THANH TOÁN TỰ ĐỘNG THÀNH CÔNG (PAYOS)</b>\n` +
                `• <b>Khách hàng:</b> ${user.fullName || 'Chưa cập nhật'}\n` +
                `• <b>Số điện thoại:</b> <code>${user.phone}</code>\n` +
                `• <b>Mã khoản vay:</b> <code>${loanId}</code>\n` +
                `• <b>Hệ thống PayOS:</b> GD thanh toán tự động thành công\n` +
                `• <b>Phân loại:</b> ${labelUpper}\n` +
                `• <b>Số tiền nạp:</b> ${amount.toLocaleString()} đ\n` +
                `• <b>Thời gian:</b> ${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')}`;
              sendTelegramNotification(telegramMsg, settings);
            }).catch(err => console.error("Lỗi lấy settings cho Telegram PayOS:", err));
          }
        }
      } 
      // 2. If not a loan, try to find a user with this orderCode (Rank Upgrade)
      else {
        console.log(`[PAYOS] No loan found for orderCode ${orderCode}, searching for user upgrade...`);
        const { data: user, error: userError } = await client
          .from('users')
          .select('*')
          .eq('payosOrderCode', orderCode)
          .maybeSingle();
          
        if (userError) {
          console.error(`[PAYOS] Error searching for user with orderCode ${orderCode}:`, JSON.stringify(userError));
        }
          
        if (user && !userError) {
          console.log(`[PAYOS] Found user: ${user.id} for rank upgrade to: ${user.pendingUpgradeRank}`);
          // Process Rank Upgrade
          const targetRank = user.pendingUpgradeRank;
          if (targetRank) {
            const rankConfigs = settings.RANK_CONFIG || [];
            const targetConfig = rankConfigs.find((r: any) => r.id === targetRank);
            const newLimit = targetConfig ? targetConfig.maxLimit : user.totalLimit;
            const limitDiff = newLimit - user.totalLimit;
            const newBalance = (user.balance || 0) + limitDiff;
            const upgradeFee = Math.round(newLimit * (settings.UPGRADE_PERCENT / 100));

            await client
              .from('users')
              .update({ 
                rank: targetRank, 
                totalLimit: newLimit,
                balance: newBalance,
                pendingUpgradeRank: null,
                rankUpgradeBill: 'PAYOS_SUCCESS',
                isFreeUpgrade: false,
                updatedAt: Date.now()
              })
              .eq('id', user.id);

            // Update system stats
            const newBudget = (Number(settings.SYSTEM_BUDGET) || 0) + upgradeFee;
            const newRankProfit = (Number(settings.TOTAL_RANK_PROFIT) || 0) + upgradeFee;
            
            let newMonthlyStats = Array.isArray(settings.MONTHLY_STATS) ? [...settings.MONTHLY_STATS] : [];
            const now = new Date();
            const monthKey = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
            const existingIdx = newMonthlyStats.findIndex((s: any) => s.month === monthKey);
            
            if (existingIdx !== -1) {
              const stat = { ...newMonthlyStats[existingIdx] };
              stat.rankProfit = (Number(stat.rankProfit) || 0) + upgradeFee;
              stat.totalProfit = (Number(stat.rankProfit) || 0) + (Number(stat.loanProfit) || 0);
              newMonthlyStats[existingIdx] = stat;
            } else {
              newMonthlyStats = [{ month: monthKey, rankProfit: upgradeFee, loanProfit: 0, totalProfit: upgradeFee }, ...newMonthlyStats].slice(0, 6);
            }

            await client.from('config').upsert([
              { key: 'SYSTEM_BUDGET', value: newBudget.toString() },
              { key: 'TOTAL_RANK_PROFIT', value: newRankProfit.toString() },
              { key: 'MONTHLY_STATS', value: JSON.stringify(newMonthlyStats) }
            ], { onConflict: 'key' });

            // Create Budget Log for Rank Upgrade
            const budgetLogId = `BL${Date.now()}`;
            const rankLabel = targetConfig ? targetConfig.name : targetRank.toUpperCase();
            
            const budgetLog = {
              id: budgetLogId,
              type: 'ADD',
              amount: upgradeFee,
              balanceAfter: newBudget,
              note: `[Tự động] Nâng hạng ${rankLabel} của ${(user.fullName || user.phone || 'KH').toUpperCase()} (${user.id})`,
              createdAt: new Date().toISOString()
            };
            await client.from('budget_logs').insert([budgetLog]);
              
            const io = req.app.get("io");
            if (io) {
              // Fetch latest user data for real-time update
              const { data: updatedUser } = await client.from('users').select('*').eq('id', user.id).single();
              if (updatedUser) {
                io.to(`user_${user.id}`).emit("user_updated", updatedUser);
                io.to("admin").emit("user_updated", updatedUser);
              }

              io.to(`user_${user.id}`).emit("payment_success", { 
                type: 'UPGRADE',
                message: `Chúc mừng! Bạn đã được nâng hạng lên ${rankLabel} thành công!` 
              });
              io.to(`user_${user.id}`).emit("rank_upgrade_success", { 
                rank: targetRank, 
                message: `Chúc mừng! Bạn đã được nâng hạng lên ${rankLabel} thành công!` 
              });
              io.to("admin").emit("admin_notification", {
                type: "RANK_UPGRADE",
                message: `Người dùng ${user.id} đã nâng hạng lên ${rankLabel} qua PayOS.`
              });
              
              // Telegram Notification
              getMergedSettings(client).then(settings => {
                const telegramMsg = `<b>⭐ NÂNG HẠNG TỰ ĐỘNG THÀNH CÔNG (PAYOS)</b>\n` +
                  `• <b>Khách hàng:</b> ${user.fullName || 'Chưa cập nhật'}\n` +
                  `• <b>Số điện thoại:</b> <code>${user.phone || user.id}</code>\n` +
                  `• <b>Hạng mới nâng cấp:</b> <b>${rankLabel.toUpperCase()}</b>\n` +
                  `• <b>Hệ thống PayOS:</b> GD thanh toán nâng cấp thành công\n` +
                  `• <b>Phí nâng cấp:</b> ${upgradeFee.toLocaleString()} đ\n` +
                  `• <b>Thời gian:</b> ${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')}`;
                sendTelegramNotification(telegramMsg, settings);
              }).catch(err => console.error("Lỗi lấy settings cho Telegram Rank upgrade:", err));
              
              // Notify all clients of config changes
              io.emit("config_updated", {
                SYSTEM_BUDGET: newBudget,
                budget: newBudget,
                TOTAL_RANK_PROFIT: newRankProfit,
                rankProfit: newRankProfit,
                MONTHLY_STATS: newMonthlyStats
              });
              io.emit("config_updated", [
                { key: 'SYSTEM_BUDGET', value: newBudget },
                { key: 'budget', value: newBudget },
                { key: 'TOTAL_RANK_PROFIT', value: newRankProfit },
                { key: 'rankProfit', value: newRankProfit },
                { key: 'MONTHLY_STATS', value: newMonthlyStats }
              ]);
            }

            // Add persistent notification
            const notifId = `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const rankBenefit = settings.RANK_CONFIG?.find((r: any) => r.id === targetRank.toLowerCase())?.maxLimit;
            const benefitMsg = rankBenefit ? ` Hạn mức vay của bạn đã được nâng lên tối đa ${rankBenefit.toLocaleString()} đ.` : '';

            await client.from('notifications').insert([{
              id: notifId,
              userId: user.id,
              title: 'Nâng hạng thành công',
              message: `Chúc mừng! Bạn đã được nâng hạng lên ${rankLabel} thành công qua PayOS!${benefitMsg} Hãy khám phá các ưu đãi mới ngay.`,
              time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
              read: false,
              type: 'RANK'
            }]);
            triggerPushForUser(user.id, 'Nâng hạng thành công', `Chúc mừng! Bạn đã được nâng hạng lên ${rankLabel} thành công qua PayOS!${benefitMsg}`, client);
          }
        }
      }
    }
    
    res.json({ status: "ok" });
  } catch (e: any) {
    console.error("PayOS Webhook Error:", e);
    res.json({ status: "error", message: e.message });
  }
});

router.get("/payment-result", (req, res) => {
  const { payment, type, id, screen } = req.query;
  res.send(`
    <html>
      <head>
        <title>Kết quả thanh toán</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            height: 100vh; 
            background: #000; 
            color: #fff; 
            margin: 0;
            text-align: center;
          }
          .loader { 
            border: 4px solid #1a1a1a; 
            border-top: 4px solid #ff8c00; 
            border-radius: 50%; 
            width: 50px; 
            height: 50px; 
            animation: spin 1s linear infinite; 
            margin-bottom: 24px; 
            box-shadow: 0 0 20px rgba(255, 140, 0, 0.2);
          }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          h1 { font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 8px 0; }
          p { font-size: 12px; color: #888; margin: 0; }
        </style>
      </head>
      <body>
        <div class="loader"></div>
        <h1>Đang xử lý</h1>
        <p>Hệ thống đang đồng bộ kết quả thanh toán...</p>
        <script>
          // Notify the opener if it exists
          try {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ 
                type: 'PAYOS_PAYMENT_RESULT', 
                payment: '${payment}', 
                paymentType: '${type}', 
                id: '${id}', 
                screen: '${screen}' 
              }, '*');
              
              // Give it a moment to process before closing
              setTimeout(() => {
                window.close();
              }, 500);
            } else {
              // If no opener, redirect to dashboard
              window.location.href = '/dashboard?payment=${payment}&type=${type}&id=${id}&screen=${screen}';
            }
          } catch (e) {
            console.error('Error notifying opener:', e);
            window.location.href = '/dashboard?payment=${payment}&type=${type}&id=${id}&screen=${screen}';
          }
        </script>
      </body>
    </html>
  `);
});

// Export the router
export { router as apiRouter };
export default app;
