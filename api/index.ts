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

// Load environment variables as early as possible
dotenv.config();
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

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
        'SYSTEM_BUDGET', 'TOTAL_LOAN_PROFIT', 'TOTAL_RANK_PROFIT', 'MONTHLY_STATS',
        'ENABLE_PAYOS', 'ENABLE_VIETQR', 'LUCKY_SPIN_VOUCHERS', 'LUCKY_SPIN_WIN_RATE',
        'LUCKY_SPIN_PAYMENTS_REQUIRED', 'MAX_ON_TIME_PAYMENTS_FOR_UPGRADE', 'CONTRACT_CLAUSES',
        'RANK_CONFIG', 'SYSTEM_FORMATS_CONFIG', 'BUSINESS_OPERATIONS_CONFIG', 
        'CONTRACT_FORMATS_CONFIG', 'TRANSFER_CONTENTS_CONFIG', 'SYSTEM_CONTRACT_FORMATS_CONFIG', 'MASTER_CONFIGS', 'lastKeepAlive'
      ];
      if (systemKeys.includes(item.key)) {
        if (['MONTHLY_STATS', 'PAYMENT_ACCOUNT', 'LUCKY_SPIN_VOUCHERS', 'RANK_CONFIG', 'SYSTEM_FORMATS_CONFIG', 'BUSINESS_OPERATIONS_CONFIG', 'CONTRACT_FORMATS_CONFIG', 'TRANSFER_CONTENTS_CONFIG', 'SYSTEM_CONTRACT_FORMATS_CONFIG', 'MASTER_CONFIGS', 'CONTRACT_CLAUSES'].includes(item.key)) {
          try {
            settings[item.key] = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
          } catch (e) {
            settings[item.key] = item.value;
          }
        } else if (['SYSTEM_BUDGET', 'TOTAL_LOAN_PROFIT', 'TOTAL_RANK_PROFIT', 'UPGRADE_PERCENT', 'PRE_DISBURSEMENT_FEE', 'MAX_EXTENSIONS', 'FINE_RATE', 'MAX_FINE_PERCENT', 'MAX_LOAN_PER_CYCLE', 'MIN_SYSTEM_BUDGET', 'MAX_SINGLE_LOAN_AMOUNT', 'INITIAL_LIMIT', 'MIN_LOAN_AMOUNT', 'LUCKY_SPIN_WIN_RATE', 'LUCKY_SPIN_PAYMENTS_REQUIRED', 'MAX_ON_TIME_PAYMENTS_FOR_UPGRADE'].includes(item.key)) {
          settings[item.key] = Number(item.value);
        } else if (['ENABLE_PAYOS', 'ENABLE_VIETQR', 'SHOW_SYSTEM_NOTIFICATION', 'MAINTENANCE_MODE'].includes(item.key)) {
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
    CONTRACT_CLAUSES: dbSettings.CONTRACT_CLAUSES || config.CONTRACT_CLAUSES || null,
    RANK_CONFIG: dbSettings.RANK_CONFIG || config.RANK_CONFIG || [
      { id: 'standard', name: 'TIÊU CHUẨN', minLimit: 1000000, maxLimit: 2000000, color: '#6b7280', features: ['Hạn mức 1 - 2 triệu', 'Duyệt trong 24h'] },
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
    MASTER_CONFIGS: dbSettings.MASTER_CONFIGS || config.MASTER_CONFIGS || []
  };
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
      .select('id,userId,status,date')
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
    'RANK_CONFIG', 'SYSTEM_FORMATS_CONFIG', 'BUSINESS_OPERATIONS_CONFIG',
    'CONTRACT_FORMATS_CONFIG', 'TRANSFER_CONTENTS_CONFIG', 'SYSTEM_CONTRACT_FORMATS_CONFIG', 'MASTER_CONFIGS'
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
  
  // 1. Check in MASTER_CONFIGS if available
  if (Array.isArray(settings.MASTER_CONFIGS) && settings.MASTER_CONFIGS.length > 0) {
    const config = settings.MASTER_CONFIGS.find((f: any) => {
      const matchCategory = category ? f.category === category : true;
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
  // {ID} and {USER} become userId
  // {MHD} and {CONTRACT} become originalId
  result = result.replace(/\{ID\}|\{USER\}/gi, userPart);
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
        
        // Check password
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
              
              return res.json({ success: true, user: { ...userNoPwd, isAdmin }, token });
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
      return res.json({
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
    let defaultRank = 'standard' as any;
    let initialLimit = 1000000;
    
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

    const token = jwt.sign({ id: sanitizedUser.id, isAdmin: false }, settings.JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
      success: true,
      token
    });
  } catch (e: any) {
    console.error("Lỗi register:", e);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ", message: e.message });
  }
});

let lastPingTime = 0;
const PING_INTERVAL = 1 * 60 * 60 * 1000; // 1 hour

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
      newRank = 'standard';
      newProgress = 0;
      const standardConf = rankConfig.find((r: any) => r.id === 'standard');
      newLimit = standardConf ? standardConf.maxLimit : 2000000;
      notifications.push({
        title: 'Hạ cấp bậc: QUÁ HẠN 5 NGÀY',
        message: `Tài khoản của bạn đã quá hạn 5 ngày. Hệ thống hạ cấp bậc về TIÊU CHUẨN và xóa toàn bộ điểm tiến trình.`
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

  const updatedUserWithPenalty = {
    ...user,
    rank: newRank,
    rankProgress: newProgress,
    totalLimit: newLimit,
    penaltyStreak: endDay,
    lastPenaltyDate: todayStr,
    updatedAt: Date.now()
  };

  // Persist to DB
  await client.from('users').update({
    rank: newRank,
    rankProgress: newProgress,
    totalLimit: newLimit,
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
    }
    io.to(`user_${user.id}`).emit("user_updated", updatedUserWithPenalty);
  }

  return updatedUserWithPenalty;
};

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
             const commonNewColumns = ['payosOrderCode', 'payosCheckoutUrl', 'payosAmount', 'payosExpireAt', 'idNumber', 'refZalo', 'spins', 'vouchers', 'totalProfit', 'fullSettlementCount', 'lastPenaltyDate', 'penaltyStreak', 'hasCustomLimit', 'isFreeUpgrade', 'avatar', 'bankName', 'bankBin', 'bankAccountNumber', 'bankAccountHolder'];
             
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
            const { data: userLoans } = await client.from('loans').select('id,userId,status,date').eq('userId', data[0].id);
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
        let query = client.from('notifications').select(columns, { count: 'exact' }).order('id', { ascending: false });
        
        if (!isAdmin && userIdFromQuery) {
          query = query.eq('userId', userIdFromQuery);
        } else if (isAdmin) {
          // Fetch notifications for Admin or specific user
          query = query.or(`userId.eq.${userIdFromQuery},userId.eq.ADMIN`);
        }

        // Delta update for notifications is less critical but good to have
        // However, since we use range, we can just let it be or add updatedAt if table has it
        
        const { data, count, error } = await query.range(from, to);
        if (error) throw error;
        return { data: data || [], count: count || 0 };
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
          query = query.limit(30); // Reduced from 50 to 30 for faster initial load
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

    const budget = Number(config?.find(c => c.key === 'SYSTEM_BUDGET')?.value || config?.find(c => c.key === 'budget')?.value) || 0;
    const rankProfit = Number(config?.find(c => c.key === 'TOTAL_RANK_PROFIT')?.value || config?.find(c => c.key === 'rankProfit')?.value) || 0;
    const loanProfit = Number(config?.find(c => c.key === 'TOTAL_LOAN_PROFIT')?.value || config?.find(c => c.key === 'loanProfit')?.value) || 0;
    const monthlyStats = config?.find(c => c.key === 'MONTHLY_STATS')?.value || config?.find(c => c.key === 'monthlyStats')?.value || [];
    const lastKeepAlive = config?.find(c => c.key === 'lastKeepAlive')?.value || null;

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
    
    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      sanitizedUsers.forEach(u => {
        io.to(`user_${u.id}`).emit("user_updated", u);
        
        // Notify admin of important updates
        if (u.pendingUpgradeRank && u.rankUpgradeBill) {
          io.to("admin").emit("admin_notification", {
            type: "RANK_UPGRADE",
            message: `Người dùng ${u.fullName || u.id} vừa gửi yêu cầu nâng hạng lên ${u.pendingUpgradeRank.toUpperCase()}.`
          });

          // Persistent admin notification
          client.from('notifications').insert([{
            id: `ADMIN-NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            userId: 'ADMIN',
            title: 'Yêu cầu nâng hạng mới',
            message: `Người dùng ${u.fullName || u.id} vừa gửi yêu cầu nâng hạng lên ${u.pendingUpgradeRank.toUpperCase()}.`,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
            read: false,
            type: 'RANK'
          }]).then(({ error }) => { if (error) console.error("Lỗi lưu thông báo admin:", error); });
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
        const minBudget = Number(settings.MIN_SYSTEM_BUDGET || 1000000);
        const currentBudget = Number(settings.SYSTEM_BUDGET || 0);
        
        if (currentBudget < minBudget) {
          return res.status(400).json({ 
            error: "Hệ thống bảo trì", 
            message: "Hệ thống đang bảo trì nguồn vốn (vốn còn lại dưới 1 triệu). Vui lòng quay lại sau." 
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
            loan.status = 'ĐÃ CỘNG DỒN'; 
            loan.consolidatedInto = primaryLoan.id;

            // Notify User about Consolidation
            const io = req.app.get("io");
            if (io) {
              const notifId = `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
              const message = `Yêu cầu vay ${Number(loan.amount).toLocaleString()} đ của bạn đã được duyệt và CỘNG DỒN vào khoản vay hiện tại (${primaryLoan.id}). Tổng dư nợ mới là ${newTotalAmount.toLocaleString()} đ.`;
              
              await client.from('notifications').insert([{
                id: notifId,
                userId: loan.userId,
                title: 'Khoản vay đã cộng dồn',
                message: message,
                time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
                read: false,
                type: 'LOAN'
              }]);
              
              io.to(`user_${loan.userId}`).emit("notification_updated", {
                id: notifId,
                userId: loan.userId,
                title: 'Khoản vay đã cộng dồn',
                message: message,
                type: 'LOAN'
              });

              // Also sync the primary loan update to the user
              io.to(`user_${loan.userId}`).emit("loan_updated", {
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
        
        // Notify admin of new loan requests or settlement requests
        if (l.status === 'CHỜ DUYỆT') {
          io.to("admin").emit("admin_notification", {
            type: "NEW_LOAN",
            message: `Có yêu cầu vay mới (${l.amount.toLocaleString()} đ) từ người dùng ${l.userName || l.userId}.`
          });

          // Persistent admin notification
          client.from('notifications').insert([{
            id: `ADMIN-NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            userId: 'ADMIN',
            title: 'Yêu cầu vay mới',
            message: `Có yêu cầu vay mới (${l.amount.toLocaleString()} đ) từ người dùng ${l.userName || l.userId}.`,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
            read: false,
            type: 'LOAN'
          }]).then(({ error }) => { if (error) console.error("Lỗi lưu thông báo admin:", error); });
        } else if (l.status === 'CHỜ TẤT TOÁN') {
          const typeLabel = l.settlementType === 'PRINCIPAL' ? 'gia hạn' : (l.settlementType === 'PARTIAL' ? 'TTMP' : 'tất toán');
          io.to("admin").emit("admin_notification", {
            type: "PAYMENT",
            message: `Người dùng ${l.userName || l.userId} vừa gửi yêu cầu ${typeLabel} khoản vay (${l.amount.toLocaleString()} đ).`
          });

          // Persistent admin notification
          client.from('notifications').insert([{
            id: `ADMIN-NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            userId: 'ADMIN',
            title: 'Yêu cầu thanh toán mới',
            message: `Người dùng ${l.userName || l.userId} vừa gửi yêu cầu ${typeLabel} khoản vay (${l.amount.toLocaleString()} đ).`,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
            read: false,
            type: 'LOAN'
          }]).then(({ error }) => { if (error) console.error("Lỗi lưu thông báo admin:", error); });
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

    // Invalidate cache and emit real-time update
    settingsCache = null;
    const io = req.app.get("io");
    if (io) {
      io.emit("config_updated", [{ key: 'SYSTEM_BUDGET', value: finalBudget }]);
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

    // 3. Determine reversal impact and cascade effects
    // Log types: 'INITIAL' | 'ADD' | 'WITHDRAW' | 'LOAN_DISBURSE' | 'LOAN_REPAY' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'
    let budgetDelta = 0;
    let loanProfitDelta = 0;
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
            
            // Revert profit estimate if any
            if (log.amount > loan.amount) {
              loanProfitDelta = -(log.amount - loan.amount);
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
    if (rankProfitDelta !== 0) updates.TOTAL_RANK_PROFIT = Math.max(0, Number(settings.TOTAL_RANK_PROFIT || 0) + rankProfitDelta);

    if (Object.keys(updates).length > 0) {
      const saved = await saveSystemSettings(client, updates);
      if (!saved) throw new Error("Không thể cập nhật cấu hình hệ thống");
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
      io.emit("config_updated", [{ key: 'SYSTEM_BUDGET', value: budget }]);
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
        await saveSystemSettings(client, { SYSTEM_BUDGET: currentBudget + totalBudgetDelta });
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
  'hasCustomLimit', 'isFreeUpgrade'
];

const USER_WRITE_COLUMNS = [...USER_COLUMNS, 'password'];

// Leaner summary for list views
const USER_SUMMARY_COLUMNS = [
  'id', 'phone', 'fullName', 'idNumber', 'balance', 'totalLimit', 'rank', 
  'rankProgress', 'isLoggedIn', 'isAdmin', 'pendingUpgradeRank', 'updatedAt', 
  'refZalo', 'joinDate', 'avatar'
];

const LOAN_COLUMNS = [
  'id', 'userId', 'userName', 'amount', 'date', 'createdAt', 'status', 
  'fine', 'billImage', 'bankTransactionId', 'signature', 'loanPurpose', 'rejectionReason', 
  'settlementType', 'partialAmount', 'voucherId', 'settledAt', 'principalPaymentCount', 'extensionCount', 'partialPaymentCount',
  'originalBaseId', 'payosOrderCode', 'payosCheckoutUrl', 'payosAmount', 'payosExpireAt', 'consolidatedInto', 'updatedAt'
];

const LOAN_SUMMARY_COLUMNS = [
  'id', 'userId', 'userName', 'amount', 'date', 'createdAt', 'status', 
  'fine', 'rejectionReason', 'loanPurpose', 'originalBaseId', 'updatedAt'
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

router.post("/sync", async (req: any, res) => {
  try {
    const client = initSupabase();
    if (!client) return res.status(503).json({ error: "Supabase chưa được cấu hình" });
    const { users, loans, notifications, budget, budgetDelta, budgetLog, rankProfit, loanProfit, monthlyStats } = req.body;
    
    const isAdmin = req.user?.isAdmin === true;

    // Security check for non-admin sync
    if (!isAdmin) {
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

    // Use a sequential approach for critical updates to prevent race conditions
    // and ensure data integrity under high load
    
    // 1. Update Config first (Budget is critical)
    const configUpdates: { key: string; value: any }[] = [];
    let finalPayloadBudget = budget;

    if (budgetDelta !== undefined && budgetDelta !== 0) {
      const { data: currentBudgetData } = await client.from('config').select('value').eq('key', 'SYSTEM_BUDGET').single();
      const currentVal = Number(currentBudgetData?.value || 0);
      finalPayloadBudget = currentVal + budgetDelta;
      configUpdates.push({ key: 'SYSTEM_BUDGET', value: finalPayloadBudget });
    } else if (budget !== undefined) {
      // Security: Validate budget change if it's a decrease (disbursement)
      if (budgetLog && budgetLog.type === 'LOAN_DISBURSE') {
        const { data: currentBudgetData } = await client.from('config').select('value').eq('key', 'SYSTEM_BUDGET').single();
        const currentBudget = Number(currentBudgetData?.value || 0);
        if (budget > currentBudget) {
          console.error("[SYNC] Security Alert: Client tried to increase budget during disbursement");
          return res.status(400).json({ error: "Dữ liệu ngân sách không hợp lệ" });
        }
      }
      configUpdates.push({ key: 'SYSTEM_BUDGET', value: budget });
    }
    if (rankProfit !== undefined) configUpdates.push({ key: 'TOTAL_RANK_PROFIT', value: rankProfit });
    if (loanProfit !== undefined) configUpdates.push({ key: 'TOTAL_LOAN_PROFIT', value: loanProfit });
    if (monthlyStats !== undefined) configUpdates.push({ key: 'MONTHLY_STATS', value: monthlyStats });
    
    if (configUpdates.length > 0) {
      const { error } = await client.from('config').upsert(configUpdates, { onConflict: 'key' });
      if (error) throw error;
      // Invalidate cache
      settingsCache = null;
    }

    // 2. Update Budget Log
    if (budgetLog) {
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
      // CONSOLIDATION LOGIC: If a loan is being updated to 'ĐANG NỢ' (Disbursed),
      // we check if the user already has an active or overdue loan to merge into.
      if (isAdmin) {
        for (let i = 0; i < loans.length; i++) {
          const loan = loans[i];
          if (loan.status === 'ĐANG NỢ') {
            const { data: existingActiveLoans } = await client
              .from('loans')
              .select('*')
              .eq('userId', loan.userId)
              .in('status', ['ĐANG NỢ', 'QUÁ HẠN'])
              .neq('id', loan.id)
              .limit(1);

            if (existingActiveLoans && existingActiveLoans.length > 0) {
              const primaryLoan = existingActiveLoans[0];
              // Use current amount from payload if available for most up-to-date calculation, otherwise use DB
              const primaryInSync = (loans as any[]).find(l => l.id === primaryLoan.id);
              const baseAmount = primaryInSync ? Number(primaryInSync.amount || 0) : Number(primaryLoan.amount || 0);
              
              const consolidatedAmount = Number(loan.amount || 0);
              
              // Only update if there's a real mismatch between DB+incremental and what we expect
              const expectedAmount = Number(primaryLoan.amount || 0) + consolidatedAmount;
              
              if (baseAmount < expectedAmount) {
                await client.from('loans').update({
                  amount: expectedAmount,
                  updatedAt: Date.now()
                }).eq('id', primaryLoan.id);
                
                if (primaryInSync) {
                  primaryInSync.amount = expectedAmount;
                  primaryInSync.updatedAt = Date.now();
                }
              }

              // 2. Mark this loan as consolidated in the payload
              loan.status = 'ĐÃ CỘNG DỒN';
              loan.consolidatedInto = primaryLoan.id;

              // 4. Update User Balance in DB and Payload
              const { data: userData } = await client.from('users').select('balance').eq('id', loan.userId).single();
              if (userData) {
                // If this is a NEW disbursement that hasn't affected balance yet
                // (Note: Usually disburse logic in App.tsx already deducted from balance, 
                // but we must be sure the server and client are in sync)
                const newBalance = Math.max(0, (userData.balance || 0) - consolidatedAmount);
                await client.from('users').update({ balance: newBalance, updatedAt: Date.now() }).eq('id', loan.userId);
                
                // Update User in payload if present
                if (users && Array.isArray(users)) {
                  const userInPayload = users.find((u: any) => u.id === loan.userId);
                  if (userInPayload) {
                    userInPayload.balance = newBalance;
                    userInPayload.updatedAt = Date.now();
                  }
                }

                const io = req.app.get("io");
                if (io) {
                  io.to(`user_${loan.userId}`).emit("user_updated", { id: loan.userId, balance: newBalance });
                }
              }
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
    if (notifications && Array.isArray(notifications) && notifications.length > 0) {
      const sanitizedNotifications = sanitizeData(notifications, NOTIFICATION_COLUMNS);
      if (sanitizedNotifications.length > 0) {
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
      if (notifications) {
        notifications.forEach((n: any) => io.to(`user_${n.userId}`).emit("notification_updated", n));
        io.to("admin").emit("notifications_updated", notifications);
      }
      
      // Always notify admin of sync
      io.to("admin").emit("sync_completed", { users, loans, notifications, configUpdates });
      
      // If config changed, notify everyone
      if (configUpdates.length > 0) {
        io.emit("config_updated", configUpdates);
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
        const masterUpgrade = masterConfigs.find((c: any) => c.systemMeaning === 'transfer_upgrade');
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
      } else {
        let template = "";
        let loanData: any = null;
        let currentAbbr = "";
        
        if (settleType === 'PARTIAL' || settleType === 'PRINCIPAL') {
          // Fetch loan to get counts and originalBaseId
          const { data } = await client.from('loans').select('extensionCount, partialPaymentCount, originalBaseId, userId, users(phone)').eq('id', id).single();
          loanData = data;
          
          if (settleType === 'PARTIAL') {
            const masterPartial = masterConfigs.find((c: any) => c.systemMeaning === 'transfer_partial');
            template = masterPartial?.format || "TTMP {ID} LAN {SLTTMP}";
            currentAbbr = masterPartial?.abbreviation || 'TTMP';
          } else {
            const masterExtension = masterConfigs.find((c: any) => c.systemMeaning === 'transfer_extension');
            template = masterExtension?.format || "GIA HAN {ID} LAN {SLGH}";
            currentAbbr = masterExtension?.abbreviation || 'GH';
          }
        } else {
          // Fetch loan for full settlement to get user info and originalBaseId
          const { data } = await client.from('loans').select('userId, originalBaseId, users(phone)').eq('id', id).single();
          loanData = data;
          const masterFull = masterConfigs.find((c: any) => c.systemMeaning === 'transfer_full');
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
          originalId: baseId || id,
          fullId: id,
          sequence: settleType === 'PARTIAL' ? (partialCount + 1) : (extensionCount + 1),
          n: settleType === 'PARTIAL' ? (partialCount + 1) : (extensionCount + 1),
          slgh: extensionCount + 1,
          slttmp: partialCount + 1,
          phone: userPhone,
          rank: '',
          abbr: currentAbbr
        });
      }
    }

    // PayOS strictly limits description to 25 characters. 
    // We must truncate to avoid API errors, but we should do it after all replacements.
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
            // Calculate profit and budget updates
            let profitAmount = 0;
            let budgetUpdate = 0;
            const feePercent = Number(settings.PRE_DISBURSEMENT_FEE || 0) / 100;
            const fine = loan.fine || 0;

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
              profitAmount = (loan.amount * feePercent) + fine;
              budgetUpdate = profitAmount;
            } else if (settleType === 'PARTIAL') {
              const pAmount = loan.partialAmount || 0;
              const remainingPrincipal = loan.amount - pAmount;
              profitAmount = (remainingPrincipal * feePercent) + fine;
              budgetUpdate = pAmount + profitAmount;
            } else {
              profitAmount = fine;
              budgetUpdate = Math.max(0, (loan.amount + fine) - voucherDiscount);
            }

            // Update system stats
            const newBudget = (Number(settings.SYSTEM_BUDGET) || 0) + budgetUpdate;
            const newLoanProfit = (Number(settings.TOTAL_LOAN_PROFIT) || 0) + profitAmount;
            
            let newMonthlyStats = Array.isArray(settings.MONTHLY_STATS) ? [...settings.MONTHLY_STATS] : [];
            const now = new Date();
            const monthKey = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
            const existingIdx = newMonthlyStats.findIndex((s: any) => s.month === monthKey);
            
            if (existingIdx !== -1) {
              const stat = { ...newMonthlyStats[existingIdx] };
              stat.loanProfit = (Number(stat.loanProfit) || 0) + profitAmount;
              stat.totalProfit = (Number(stat.rankProfit) || 0) + (Number(stat.loanProfit) || 0);
              newMonthlyStats[existingIdx] = stat;
            } else {
              newMonthlyStats = [{ month: monthKey, rankProfit: 0, loanProfit: profitAmount, totalProfit: profitAmount }, ...newMonthlyStats].slice(0, 6);
            }

            await client.from('config').upsert([
              { key: 'SYSTEM_BUDGET', value: newBudget.toString() },
              { key: 'TOTAL_LOAN_PROFIT', value: newLoanProfit.toString() },
              { key: 'MONTHLY_STATS', value: JSON.stringify(newMonthlyStats) }
            ], { onConflict: 'key' });

            // Create Budget Log for Loan Settlement
            const budgetLogId = `BL${Date.now()}`;
            const settleLabelShort = settleType === 'ALL' ? 'Tất toán' : (settleType === 'PARTIAL' ? 'TTMP' : 'Gia hạn');
            const budgetLog = {
              id: budgetLogId,
              type: 'LOAN_REPAY',
              amount: budgetUpdate,
              balanceAfter: newBudget,
              note: `[Tự động] PayOS: ${settleLabelShort} khoản vay ${loanId} từ ${user.fullName || user.phone}`,
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
            
            // Generate new ID using Admin configured formats
            const format = settleType === 'PRINCIPAL' 
              ? getFormatFromSettings(settings, 'EXTENSION', settings.CONTRACT_FORMAT_EXTENSION || "{ID}GH{N}", 'SYSTEM_CONTRACT_FORMATS_CONFIG')
              : getFormatFromSettings(settings, 'PARTIAL_SETTLEMENT', settings.CONTRACT_FORMAT_PARTIAL_SETTLEMENT || "{ID}TTMP{N}", 'SYSTEM_CONTRACT_FORMATS_CONFIG');
            
            const newId = generateContractIdServer(loan.userId, format, settings, loan.id, undefined, nextCount, nextExtensionCount, nextPartialCount);
            
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
            
            const io = req.app.get("io");
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
              note: `[Tự động] PayOS: Nâng hạng ${rankLabel} cho ${user.fullName || user.phone}`,
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
              
              // Notify admin of config changes
              io.to("admin").emit("config_updated", {
                SYSTEM_BUDGET: newBudget,
                TOTAL_RANK_PROFIT: newRankProfit,
                MONTHLY_STATS: newMonthlyStats
              });
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
