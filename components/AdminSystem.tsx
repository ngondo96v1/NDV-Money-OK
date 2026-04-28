
import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { motion, Reorder } from 'framer-motion';
import { 
  Database, 
  Settings, 
  RefreshCw, 
  Check, 
  Copy, 
  ChevronDown, 
  ChevronUp, 
  User, 
  Shield, 
  CreditCard, 
  Wrench, 
  Globe,
  AlertCircle, 
  Info,
  Loader2, 
  X, 
  Hash,
  TrendingUp,
  Download,
  Upload,
  Search,
  MessageCircle,
  Eye,
  EyeOff,
  Zap,
  Gift,
  Plus,
  Trash2,
  Percent,
  Coins,
  FileText,
  Wallet,
  Trophy,
  Dices,
  GripVertical,
  ChevronRight,
  Power
} from 'lucide-react';
import BankSearchableSelect from './BankSearchableSelect';

interface AdminSystemProps {
  onReset: () => void;
  onImportSuccess: () => void;
  onBack: () => void;
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  settings: any;
  onSettingsUpdate: (newSettings: any) => void;
}

const ICON_COLORS = [
  { name: 'Xám', color: '#6b7280' },
  { name: 'Đồng', color: '#fdba74' },
  { name: 'Bạc', color: '#bfdbfe' },
  { name: 'Vàng', color: '#facc15' },
  { name: 'Kim Cương', color: '#60a5fa' },
  { name: 'Đỏ', color: '#ef4444' },
  { name: 'Xanh lá', color: '#22c55e' },
  { name: 'Tím', color: '#a855f7' },
  { name: 'Hồng', color: '#ec4899' },
  { name: 'Cam', color: '#f97316' },
];

const AdminSystem: React.FC<AdminSystemProps> = ({ onReset, onImportSuccess, onBack, authenticatedFetch, settings, onSettingsUpdate }) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isMigratingUnified, setIsMigratingUnified] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'settings'>('settings');
  const [isCheckingBank, setIsCheckingBank] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    technical: false,
    business: false,
    finance: false,
    rewards: false,
    security: false,
    master: false,
    utilities: false,
    contract: false
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});
  const [expandedConfigs, setExpandedConfigs] = useState<Record<string, boolean>>({});
  const [expandedMasterCategories, setExpandedMasterCategories] = useState<Record<string, boolean>>({
    'ABBREVIATION': false,
    'ID_FORMAT': false,
    'CONTRACT_NEW': false,
    'TRANSFER_CONTENT': false
  });

  const toggleMasterCategory = (category: string) => {
    setExpandedMasterCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const toggleConfigExpansion = (key: string) => {
    setExpandedConfigs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleVisibility = (field: string) => {
    setVisibleFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const isCurrentlyExpanded = prev[section];
      const newState: Record<string, boolean> = {};
      Object.keys(prev).forEach(key => {
        newState[key] = false;
      });
      newState[section] = !isCurrentlyExpanded;
      return newState;
    });
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatNumberWithDots = (val: number | string) => {
    if (val === undefined || val === null || val === '') return '';
    const num = typeof val === 'string' ? val.replace(/\./g, '') : val.toString();
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const parseNumberFromDots = (val: string) => {
    if (!val) return 0;
    return Number(val.replace(/\./g, ''));
  };

  const sqlSchema = `-- SQL Schema for NDV-SAFE App
-- Run this in your Supabase SQL Editor

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  "fullName" TEXT,
  "idNumber" TEXT UNIQUE,
  balance NUMERIC DEFAULT 0,
  "totalLimit" NUMERIC DEFAULT 0,
  rank TEXT DEFAULT 'standard',
  "rankProgress" NUMERIC DEFAULT 0,
  "isLoggedIn" BOOLEAN DEFAULT false,
  "isAdmin" BOOLEAN DEFAULT false,
  "pendingUpgradeRank" TEXT,
  "rankUpgradeBill" TEXT,
  address TEXT,
  "joinDate" TEXT,
  "idFront" TEXT,
  "idBack" TEXT,
  "refZalo" TEXT UNIQUE,
  relationship TEXT,
  password TEXT,
  "lastLoanSeq" INTEGER DEFAULT 0,
  "bankName" TEXT,
  "bankBin" TEXT,
  "bankAccountNumber" TEXT,
  "bankAccountHolder" TEXT,
  "hasJoinedZalo" BOOLEAN DEFAULT false,
  "payosOrderCode" BIGINT,
  "payosCheckoutUrl" TEXT,
  "payosAmount" NUMERIC,
  "payosExpireAt" BIGINT,
  "spins" INTEGER DEFAULT 0,
  "vouchers" JSONB DEFAULT '[]',
  "totalProfit" NUMERIC DEFAULT 0,
  "fullSettlementCount" INTEGER DEFAULT 0,
  "lastPenaltyDate" TEXT,
  "penaltyStreak" INTEGER DEFAULT 0,
  "avatar" TEXT,
  "updatedAt" BIGINT,
  "hasCustomLimit" BOOLEAN DEFAULT false,
  "isFreeUpgrade" BOOLEAN DEFAULT false
);

-- 2. Loans Table
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id),
  "userName" TEXT,
  amount NUMERIC NOT NULL,
  date TEXT,
  "createdAt" TEXT,
  status TEXT NOT NULL,
  fine NUMERIC DEFAULT 0,
  "billImage" TEXT,
  "bankTransactionId" TEXT,
  "settlementType" TEXT,
  "partialAmount" NUMERIC DEFAULT 0,
  signature TEXT,
  "rejectionReason" TEXT,
  "principalPaymentCount" INTEGER DEFAULT 0,
  "extensionCount" INTEGER DEFAULT 0,
  "partialPaymentCount" INTEGER DEFAULT 0,
  "payosOrderCode" BIGINT,
  "payosCheckoutUrl" TEXT,
  "payosAmount" NUMERIC,
  "payosExpireAt" BIGINT,
  "loanPurpose" TEXT,
  "voucherId" TEXT,
  "settledAt" TEXT,
  "originalBaseId" TEXT,
  "updatedAt" BIGINT
);

-- 3. Budget Logs Table
CREATE TABLE IF NOT EXISTS budget_logs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  "balanceAfter" NUMERIC NOT NULL,
  note TEXT,
  "createdAt" TEXT NOT NULL
);

-- 4. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id),
  title TEXT,
  message TEXT,
  time TEXT,
  read BOOLEAN DEFAULT false,
  type TEXT
);

-- 4. Config Table (for system settings)
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value JSONB
);

-- Insert default config values
INSERT INTO config (key, value) VALUES 
('SYSTEM_BUDGET', '0'),
('TOTAL_RANK_PROFIT', '0'),
('TOTAL_LOAN_PROFIT', '0'),
('MONTHLY_STATS', '[]')
ON CONFLICT (key) DO NOTHING;

-- Add missing columns to existing tables (if they don't exist)
DO $$ 
BEGIN 
    -- Users table columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='payosOrderCode') THEN
        ALTER TABLE users ADD COLUMN "payosOrderCode" BIGINT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='payosCheckoutUrl') THEN
        ALTER TABLE users ADD COLUMN "payosCheckoutUrl" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='payosAmount') THEN
        ALTER TABLE users ADD COLUMN "payosAmount" NUMERIC;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='payosExpireAt') THEN
        ALTER TABLE users ADD COLUMN "payosExpireAt" BIGINT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='idNumber') THEN
        ALTER TABLE users ADD COLUMN "idNumber" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='refZalo') THEN
        ALTER TABLE users ADD COLUMN "refZalo" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='spins') THEN
        ALTER TABLE users ADD COLUMN "spins" INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='vouchers') THEN
        ALTER TABLE users ADD COLUMN "vouchers" JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='totalProfit') THEN
        ALTER TABLE users ADD COLUMN "totalProfit" NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='fullSettlementCount') THEN
        ALTER TABLE users ADD COLUMN "fullSettlementCount" INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='lastPenaltyDate') THEN
        ALTER TABLE users ADD COLUMN "lastPenaltyDate" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='penaltyStreak') THEN
        ALTER TABLE users ADD COLUMN "penaltyStreak" INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='avatar') THEN
        ALTER TABLE users ADD COLUMN "avatar" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='bankBin') THEN
        ALTER TABLE users ADD COLUMN "bankBin" TEXT;
    END IF;

    -- Loans table columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='payosOrderCode') THEN
        ALTER TABLE loans ADD COLUMN "payosOrderCode" BIGINT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='payosCheckoutUrl') THEN
        ALTER TABLE loans ADD COLUMN "payosCheckoutUrl" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='payosAmount') THEN
        ALTER TABLE loans ADD COLUMN "payosAmount" NUMERIC;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='payosExpireAt') THEN
        ALTER TABLE loans ADD COLUMN "payosExpireAt" BIGINT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='partialAmount') THEN
        ALTER TABLE loans ADD COLUMN "partialAmount" NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='principalPaymentCount') THEN
        ALTER TABLE loans ADD COLUMN "principalPaymentCount" INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='extensionCount') THEN
        ALTER TABLE loans ADD COLUMN "extensionCount" INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='partialPaymentCount') THEN
        ALTER TABLE loans ADD COLUMN "partialPaymentCount" INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='voucherId') THEN
        ALTER TABLE loans ADD COLUMN "voucherId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='originalBaseId') THEN
        ALTER TABLE loans ADD COLUMN "originalBaseId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='settledAt') THEN
        ALTER TABLE loans ADD COLUMN "settledAt" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='loanPurpose') THEN
        ALTER TABLE loans ADD COLUMN "loanPurpose" TEXT;
    END IF;

    -- Constraints (Safe addition)
    BEGIN
        ALTER TABLE users ADD CONSTRAINT users_idNumber_unique UNIQUE ("idNumber");
    EXCEPTION WHEN duplicate_table THEN
        -- Do nothing if constraint already exists
    END;
    
    BEGIN
        ALTER TABLE users ADD CONSTRAINT users_refZalo_unique UNIQUE ("refZalo");
    EXCEPTION WHEN duplicate_table THEN
        -- Do nothing if constraint already exists
    END;

    -- Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
    CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users("isAdmin");
    CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans("userId");
    CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
    CREATE INDEX IF NOT EXISTS idx_loans_created_at ON loans("createdAt");
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications("userId");
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    CREATE INDEX IF NOT EXISTS idx_budget_logs_created_at ON budget_logs("createdAt");
END $$;`;
  
  const defaultSettings = {
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    IMGBB_API_KEY: '',
    PAYMENT_ACCOUNT: { bankName: '', bankBin: '', accountNumber: '', accountName: '' },
    PRE_DISBURSEMENT_FEE: '',
    MAX_EXTENSIONS: '',
    UPGRADE_PERCENT: '',
    FINE_RATE: '2',
    MAX_FINE_PERCENT: '30',
    MAX_LOAN_PER_CYCLE: '10000000',
    MIN_SYSTEM_BUDGET: '1000000',
    MAX_SINGLE_LOAN_AMOUNT: '10000000',
    MIN_LOAN_AMOUNT: '1000000',
    PAYOS_CLIENT_ID: '',
    PAYOS_API_KEY: '',
    PAYOS_CHECKSUM_KEY: '',
    JWT_SECRET: '',
    ADMIN_PHONE: '',
    ADMIN_PASSWORD: '',
    PAYMENT_CONTENT_FULL_SETTLEMENT: 'TAT TOAN TAT CA {ID}',
    PAYMENT_CONTENT_PARTIAL_SETTLEMENT: 'TAT TOAN 1 PHAN {ID}',
    PAYMENT_CONTENT_EXTENSION: 'GIA HAN {SLGH}',
    PAYMENT_CONTENT_UPGRADE: 'NANG HANG {TEN HANG}',
    CONTRACT_CODE_FORMAT: 'HD-{MHD}',
    USER_ID_FORMAT: 'US-{RANDOM}',
    LUCKY_SPIN_VOUCHERS: [
      { minProfit: 1000000, voucherValue: 50000 },
      { minProfit: 2000000, voucherValue: 100000 },
      { minProfit: 5000000, voucherValue: 200000 }
    ],
    LUCKY_SPIN_WIN_RATE: '30',
    LUCKY_SPIN_PAYMENTS_REQUIRED: '3',
    MAX_ON_TIME_PAYMENTS_FOR_UPGRADE: '5',
    ZALO_GROUP_LINK: 'https://zalo.me/g/...',
    SYSTEM_NOTIFICATION: 'Chào mừng bạn đến với hệ thống tài chính thông minh. Vui lòng hoàn tất hồ sơ để nhận hạn mức vay lên đến 50.000.000đ ngay hôm nay!',
    CONTRACT_CLAUSES: {
      title: 'Hợp đồng vay tiêu dùng cá nhân',
      subtitle: 'XÁC THỰC ĐIỆN TỬ NDV-SAFE • BẢO MẬT & PHÁP LÝ',
      clauses: [
        { 
          title: 'Các bên giao kết', 
          content: 'BÊN A (BÊN CHO VAY):\nHệ thống Tài chính NDV FINANCIAL\nTòa nhà NDV Tower, TP. Hà Nội\nĐại diện: Ban Quản trị Hệ thống\n\n[COLUMN_SPLIT]\n\nBÊN B (BÊN VAY):\nHọ tên: {FULL_NAME}\nCMND/CCCD: {ID_NUMBER}\nĐiện thoại: {PHONE}\nĐịa chỉ: {ADDRESS}\nHạng: {RANK}' 
        },
        { 
          title: 'Thỏa thuận vay & Giải ngân', 
          content: '2.1. Số tiền vay: {AMOUNT}\n2.2. Mục đích: {LOAN_PURPOSE}\n2.3. Lãi suất: 0% (Ưu đãi thành viên mới)\n2.4. Giải ngân qua: {BANK_NAME} - STK: {BANK_ACCOUNT}\n2.5. Ngày xác lập: {DATE_NOW}' 
        },
        { 
          title: 'Nghĩa vụ thanh toán', 
          content: '3.1. Bên B cam kết hoàn trả gốc vào ngày {DATE}.\n3.2. Thanh toán qua chuyển khoản theo hướng dẫn tại mục "Tất toán".\n3.3. Phí phạt quá hạn áp dụng theo quy định hệ thống nếu chậm trả.' 
        },
        { 
          title: 'Cam kết & Bảo mật', 
          content: '4.1. Bên B cam kết thông tin cung cấp là chính xác.\n4.2. Bên B chịu trách nhiệm bảo mật tài khoản và hợp đồng.\n4.3. Vi phạm nghĩa vụ thanh toán sẽ dẫn đến nợ xấu và thu hồi nợ.' 
        },
        { 
          title: 'Điều khoản chung', 
          content: '5.1. Hợp đồng điện tử có giá trị pháp lý tương đương văn bản giấy.\n5.2. Tranh chấp được giải quyết tại Tòa án nơi Bên A đặt trụ sở.\n5.3. Bên B xác nhận đã đọc, hiểu và tự nguyện ký kết.' 
        }
      ]
    }
  };

  const [localSettings, setLocalSettings] = useState<any>(() => {
    const merged = { ...defaultSettings, ...(settings || {}) };
    
    // Ensure CONTRACT_CLAUSES are pre-populated if missing or empty
    if (!merged.CONTRACT_CLAUSES || !merged.CONTRACT_CLAUSES.clauses || merged.CONTRACT_CLAUSES.clauses.length === 0) {
      merged.CONTRACT_CLAUSES = defaultSettings.CONTRACT_CLAUSES;
    }

    return {
      ...merged,
      PAYMENT_ACCOUNT: {
        ...(merged.PAYMENT_ACCOUNT || {})
      }
    };
  });

  useEffect(() => {
    if (settings) {
      const merged = { ...defaultSettings, ...settings };
      
      // Ensure CONTRACT_CLAUSES are pre-populated if missing or empty
      if (!merged.CONTRACT_CLAUSES || !merged.CONTRACT_CLAUSES.clauses || merged.CONTRACT_CLAUSES.clauses.length === 0) {
        merged.CONTRACT_CLAUSES = defaultSettings.CONTRACT_CLAUSES;
      }

      setLocalSettings({
        ...merged,
        PAYMENT_ACCOUNT: {
          ...(merged.PAYMENT_ACCOUNT || {})
        }
      });
    }
  }, [settings]);

  const [isScanning, setIsScanning] = useState(false);

  const handleOneClickSetup = () => {
    setIsScanning(true);
    toast.info("Đang quét chuyên sâu hệ thống...");
    
    setTimeout(() => {
      const now = Date.now();
      
      // 1. Master Configs - Ultra Simplified (Spaces only, No hyphens)
      const standardConfigs = [
        // Variables
        { id: `v1_${now}`, category: 'ABBREVIATION', originalName: 'Ngẫu nhiên', abbreviation: 'RD', format: '', systemMeaning: 'random' },
        { id: `v2_${now}`, category: 'ABBREVIATION', originalName: 'Ngày tháng', abbreviation: 'DT', format: '', systemMeaning: 'date_now' },
        { id: `v3_${now}`, category: 'ABBREVIATION', originalName: 'Hạng', abbreviation: 'RK', format: '', systemMeaning: 'rank' },
        { id: `v4_${now}`, category: 'ABBREVIATION', originalName: 'Lần vay', abbreviation: 'LV', format: '', systemMeaning: 'sequence' },
        { id: `v5_${now}`, category: 'ABBREVIATION', originalName: 'Lần GH', abbreviation: 'GH', format: '', systemMeaning: 'slgh' },
        { id: `v6_${now}`, category: 'ABBREVIATION', originalName: 'Lần TP', abbreviation: 'TP', format: '', systemMeaning: 'slttmp' },
        
        // ID Formats
        { id: `i1_${now}`, category: 'ID_FORMAT', originalName: 'ID User', abbreviation: 'ID', format: 'US {RD}', systemMeaning: 'user_format' },
        { id: `i2_${now}`, category: 'ID_FORMAT', originalName: 'Mã HĐ', abbreviation: 'HD', format: 'HD {ID} {DT} {RD}', systemMeaning: 'contract_original_format' },
        
        // Contract Formats
        { id: `h1_${now}`, category: 'CONTRACT_NEW', originalName: 'HĐ TP', abbreviation: 'H1', format: 'TTMP {LV} {HD}', systemMeaning: 'contract_partial_format' },
        { id: `h2_${now}`, category: 'CONTRACT_NEW', originalName: 'HĐ GH', abbreviation: 'H2', format: 'GH {GH} {HD}', systemMeaning: 'contract_extension_format' },
        
        // Transfer Contents
        { id: `t1_${now}`, category: 'TRANSFER_CONTENT', originalName: 'CK Full', abbreviation: 'T1', format: 'TT {HD}', systemMeaning: 'transfer_full' },
        { id: `t2_${now}`, category: 'TRANSFER_CONTENT', originalName: 'CK TP', abbreviation: 'T2', format: 'TP {TP} {HD}', systemMeaning: 'transfer_partial' },
        { id: `t3_${now}`, category: 'TRANSFER_CONTENT', originalName: 'CK GH', abbreviation: 'T3', format: 'GH {GH} {HD}', systemMeaning: 'transfer_extension' },
        { id: `t4_${now}`, category: 'TRANSFER_CONTENT', originalName: 'CK NH', abbreviation: 'T4', format: 'NH {RK} {ID}', systemMeaning: 'transfer_upgrade' },
        { id: `t5_${now}`, category: 'TRANSFER_CONTENT', originalName: 'CK GN', abbreviation: 'T5', format: 'GN {LV} {HD}', systemMeaning: 'transfer_disburse' }
      ];

      // 2. Rank Config - Professional Tiers
      const standardRanks = [
        { id: 'standard', name: 'Hạng Tiêu Chuẩn', minLimit: 0, maxLimit: 2000000, color: '#6b7280', features: ['Hạn mức 2 triệu', 'Cơ bản'] },
        { id: 'bronze', name: 'Hạng Đồng', minLimit: 2000000, maxLimit: 5000000, color: '#cd7f32', features: ['Hạn mức 5 triệu', 'Ưu tiên'] },
        { id: 'silver', name: 'Hạng Bạc', minLimit: 5000000, maxLimit: 10000000, color: '#C0C0C0', features: ['Hạn mức 10 triệu', 'Phí ưu đãi', 'Hỗ trợ 24/7'] },
        { id: 'gold', name: 'Hạng Vàng', minLimit: 10000000, maxLimit: 30000000, color: '#FFD700', features: ['Hạn mức 30 triệu', 'Duyệt nhanh', 'Quay thưởng x2'] },
        { id: 'diamond', name: 'Hạng Kim Cương', minLimit: 30000000, maxLimit: 50000000, color: '#B9F2FF', features: ['Hạn mức 50 triệu', 'Lãi suất 0%', 'Đặc quyền VIP'] }
      ];

      // 3. Lucky Spin Vouchers
      const standardVouchers = [
        { id: `v1_${now}`, minProfit: 500000, voucherValue: 20000 },
        { id: `v2_${now}`, minProfit: 1000000, voucherValue: 50000 },
        { id: `v3_${now}`, minProfit: 5000000, voucherValue: 200000 }
      ];

      // Apply all professional settings
      setLocalSettings({ 
        ...localSettings, 
        MASTER_CONFIGS: standardConfigs,
        RANK_CONFIG: standardRanks,
        LUCKY_SPIN_VOUCHERS: standardVouchers,
        PRE_DISBURSEMENT_FEE: 5,
        UPGRADE_PERCENT: 10,
        FINE_RATE: '0.5',
        MAX_SINGLE_LOAN_AMOUNT: 50000000,
        MIN_LOAN_AMOUNT: 1000000,
        MAX_EXTENSIONS: 3,
        MAX_FINE_PERCENT: 50,
        MAX_LOAN_PER_CYCLE: 50000000,
        MIN_SYSTEM_BUDGET: 30000000,
        LUCKY_SPIN_WIN_RATE: '35',
        LUCKY_SPIN_PAYMENTS_REQUIRED: 1,
        SHOW_SYSTEM_NOTIFICATION: true,
        SYSTEM_NOTIFICATION: 'Chào mừng bạn đến với hệ thống tài chính thông minh. Vui lòng hoàn tất hồ sơ để nhận hạn mức vay lên đến 50.000.000đ ngay hôm nay!',
        CONTRACT_CLAUSES: defaultSettings.CONTRACT_CLAUSES
      });

      setIsScanning(false);
      toast.success("Hệ thống đã được thiết lập ONE-CLICK thành công! Hãy bấm LƯU TẤT CẢ để áp dụng.");
    }, 1500);
  };

  const handleSaveSettings = async (filterKeys?: string[]) => {
    setIsSavingSettings(true);
    try {
      const changedSettings: any = {};
      
      const allKeys = [
        'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'IMGBB_API_KEY', 'PAYMENT_ACCOUNT',
        'PRE_DISBURSEMENT_FEE', 'MAX_EXTENSIONS', 'UPGRADE_PERCENT', 'ENABLE_PAYOS',
        'ENABLE_VIETQR', 'FINE_RATE', 'MAX_FINE_PERCENT', 'MAX_LOAN_PER_CYCLE',
        'MIN_SYSTEM_BUDGET', 'MAX_SINGLE_LOAN_AMOUNT', 'INITIAL_LIMIT', 'MIN_LOAN_AMOUNT', 'PAYOS_CLIENT_ID', 'PAYOS_API_KEY',
        'PAYOS_CHECKSUM_KEY', 'JWT_SECRET', 'ADMIN_PHONE', 'ADMIN_PASSWORD',
        'ZALO_GROUP_LINK', 'SYSTEM_NOTIFICATION', 'SHOW_SYSTEM_NOTIFICATION', 'MAINTENANCE_MODE',
        'LUCKY_SPIN_PAYMENTS_REQUIRED', 'LUCKY_SPIN_VOUCHERS', 'LUCKY_SPIN_WIN_RATE',
        'MAX_ON_TIME_PAYMENTS_FOR_UPGRADE', 'CONTRACT_CLAUSES',
        'SYSTEM_FORMATS_CONFIG', 'BUSINESS_OPERATIONS_CONFIG', 'RANK_CONFIG',
        'CONTRACT_FORMATS_CONFIG', 'TRANSFER_CONTENTS_CONFIG', 'SYSTEM_CONTRACT_FORMATS_CONFIG', 'MASTER_CONFIGS'
      ];

      const keysToCheck = filterKeys || allKeys;

      keysToCheck.forEach(key => {
        const localVal = localSettings[key];
        const remoteVal = settings?.[key];
        
        if (JSON.stringify(localVal) !== JSON.stringify(remoteVal)) {
          changedSettings[key] = localVal;
        }
      });

      if (Object.keys(changedSettings).length === 0) {
        toast.error('Không có thay đổi nào để lưu');
        setIsSavingSettings(false);
        return;
      }

      const response = await authenticatedFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(changedSettings)
      });
      const result = await response.json();
      if (response.ok) {
        toast.success(result.message || 'Đã lưu cấu hình thành công');
        setExpandedConfigs({}); // Thu gọn tất cả sau khi lưu
        setHasChanges(false); // Reset changes state
        if (result.settings) {
          onSettingsUpdate(result.settings);
        } else {
          onSettingsUpdate({ ...settings, ...changedSettings });
        }
      } else {
        toast.error(result.error || 'Lỗi khi lưu cài đặt');
      }
    } catch (e) {
      toast.error('Lỗi kết nối khi lưu cài đặt');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCheckBankAccount = async () => {
    if (!localSettings.PAYMENT_ACCOUNT.bankName || !localSettings.PAYMENT_ACCOUNT.accountNumber) {
      toast.error("Vui lòng nhập Ngân hàng và Số tài khoản");
      return;
    }

    setIsCheckingBank(true);
    try {
      // Find bank BIN (Bank Identification Number)
      // This is a simplified list, in a real app you'd fetch this from VietQR
      const banks = [
        { name: "MB Bank", bin: "970422" },
        { name: "Vietcombank", bin: "970436" },
        { name: "Techcombank", bin: "970407" },
        { name: "VietinBank", bin: "970415" },
        { name: "BIDV", bin: "970418" },
        { name: "Agribank", bin: "970405" },
        { name: "VPBank", bin: "970432" },
        { name: "TPBank", bin: "970423" },
        { name: "Sacombank", bin: "970403" },
        { name: "ACB", bin: "970416" }
      ];

      const bank = banks.find(b => b.name === localSettings.PAYMENT_ACCOUNT.bankName);
      if (!bank) {
        toast.warning("Ngân hàng này chưa hỗ trợ tra cứu tự động. Vui lòng nhập tên thủ công.");
        setIsCheckingBank(false);
        return;
      }

      const response = await authenticatedFetch(`/api/check-bank-account?bin=${bank.bin}&accountNumber=${localSettings.PAYMENT_ACCOUNT.accountNumber}`);
      const result = await response.json();
      
      if (response.ok && result.accountName) {
        setLocalSettings({
          ...localSettings,
          PAYMENT_ACCOUNT: {
            ...localSettings.PAYMENT_ACCOUNT,
            accountName: result.accountName
          }
        });
      } else {
        toast.error(result.error || "Không tìm thấy tài khoản ngân hàng");
      }
    } catch (e) {
      toast.error("Lỗi khi tra cứu tài khoản");
    } finally {
      setIsCheckingBank(false);
    }
  };

  const handleResetExecute = () => {
    onReset();
    setShowResetConfirm(false);
  };

  const [showSqlModal, setShowSqlModal] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

  const handleSqlAutoUpdate = async () => {
    setIsMigratingUnified(true);
    setMigrationStatus({ type: 'info', message: 'Đang kiểm tra cấu trúc cơ sở dữ liệu...' });
    
    try {
      const response = await authenticatedFetch('/api/migrate', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        setMigrationStatus({ type: 'success', message: 'Cơ sở dữ liệu đã sẵn sàng và đầy đủ.' });
        toast.success('Cơ sở dữ liệu đã chính xác');
      } else {
        // If missing columns, try to auto-fix
        setMigrationStatus({ type: 'info', message: 'Phát hiện thiếu cột. Đang cố gắng tự động cập nhật...' });
        
        const sqlToRun = `
          -- Add missing columns to loans
          ALTER TABLE loans ADD COLUMN IF NOT EXISTS "principalPaymentCount" INTEGER DEFAULT 0;
          ALTER TABLE loans ADD COLUMN IF NOT EXISTS "partialAmount" NUMERIC DEFAULT 0;
          ALTER TABLE loans ADD COLUMN IF NOT EXISTS "payosOrderCode" BIGINT;
          ALTER TABLE loans ADD COLUMN IF NOT EXISTS "payosCheckoutUrl" TEXT;
          ALTER TABLE loans ADD COLUMN IF NOT EXISTS "payosAmount" NUMERIC;
          ALTER TABLE loans ADD COLUMN IF NOT EXISTS "payosExpireAt" BIGINT;
          ALTER TABLE loans ADD COLUMN IF NOT EXISTS "extensionCount" INTEGER DEFAULT 0;
          ALTER TABLE loans ADD COLUMN IF NOT EXISTS "partialPaymentCount" INTEGER DEFAULT 0;
          ALTER TABLE loans ADD COLUMN IF NOT EXISTS "originalBaseId" TEXT;
          ALTER TABLE loans ADD COLUMN IF NOT EXISTS "voucherId" TEXT;
          ALTER TABLE loans ADD COLUMN IF NOT EXISTS "settledAt" BIGINT;

          -- Add missing columns to users
          ALTER TABLE users ADD COLUMN IF NOT EXISTS "payosOrderCode" BIGINT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS "payosCheckoutUrl" TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS "payosAmount" NUMERIC;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS "payosExpireAt" BIGINT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS "pendingUpgradeRank" TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS "rankUpgradeBill" TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS "idNumber" TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS "refZalo" TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS "fullSettlementCount" INTEGER DEFAULT 0;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastPenaltyDate" TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS "penaltyStreak" INTEGER DEFAULT 0;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS "hasCustomLimit" BOOLEAN DEFAULT false;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS "isFreeUpgrade" BOOLEAN DEFAULT false;
        `;

        const execResponse = await authenticatedFetch('/api/execute-sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql: sqlToRun })
        });

        const execData = await execResponse.json();
        
        if (execData.success) {
          setMigrationStatus({ type: 'success', message: 'Cập nhật cơ sở dữ liệu thành công!' });
          toast.success('Đã cập nhật SQL thành công');
        } else if (execData.error === 'RPC_NOT_FOUND') {
          setMigrationStatus({ type: 'error', message: 'Cần kích hoạt quyền thực thi SQL.' });
          setShowSqlModal(true);
        } else {
          setMigrationStatus({ type: 'error', message: `Lỗi: ${execData.message || execData.error}` });
          toast.error('Lỗi cập nhật SQL');
        }
      }
    } catch (e: any) {
      console.error("Lỗi migration:", e);
      setMigrationStatus({ type: 'error', message: 'Lỗi kết nối máy chủ.' });
    } finally {
      setIsMigratingUnified(false);
    }
  };

  const handleMigrateUnified = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn hợp nhất toàn bộ cấu hình? Hệ thống sẽ tự động chuyển đổi dữ liệu cũ sang cấu trúc mới.")) return;
    
    setIsMigratingUnified(true);
    try {
      const response = await authenticatedFetch('/api/migrate-unified-config', { method: 'POST' });
      const result = await response.json();
      if (response.ok) {
        toast.success(result.message);
        // Refresh settings
        const settingsRes = await authenticatedFetch('/api/settings');
        const newSettings = await settingsRes.json();
        onSettingsUpdate(newSettings);
      } else {
        toast.error(result.error || result.message);
      }
    } catch (e) {
      toast.error('Lỗi kết nối khi thực hiện migration');
    } finally {
      setIsMigratingUnified(false);
    }
  };

  const handleAddMasterConfig = (category: string = 'ABBREVIATION') => {
    const newConfigs = [...(localSettings.MASTER_CONFIGS || [])];
    const newIdx = newConfigs.length;
    newConfigs.push({
      id: `master_${Date.now()}`,
      category: category as any,
      originalName: '',
      abbreviation: '',
      format: '',
      systemMeaning: ''
    });
    setLocalSettings({ ...localSettings, MASTER_CONFIGS: newConfigs });
    setExpandedConfigs(prev => ({ ...prev, [`master_${newIdx}`]: true }));
    setExpandedMasterCategories(prev => ({ ...prev, [category]: true }));
  };

  const handleRemoveMasterConfig = (idx: number) => {
    const newConfigs = [...(localSettings.MASTER_CONFIGS || [])];
    newConfigs.splice(idx, 1);
    setLocalSettings({ ...localSettings, MASTER_CONFIGS: newConfigs });
  };

  const handleMasterConfigUpdate = (idx: number, field: string, value: any) => {
    const newConfigs = [...(localSettings.MASTER_CONFIGS || [])];
    const current = { ...newConfigs[idx], [field]: value };
    
    if (field === 'systemMeaning') {
      const meaning = value as string;
      if (!current.abbreviation) {
        if (meaning === 'random') current.abbreviation = 'RD';
        else if (meaning === 'sequence') current.abbreviation = 'N';
        else if (meaning === 'user_id') current.abbreviation = 'USER';
        else if (meaning === 'contract_id_original') current.abbreviation = 'MHD';
        else if (meaning === 'date_now') current.abbreviation = 'DATE';
        else if (meaning === 'rank') current.abbreviation = 'RANK';
        else if (meaning === 'prefix') current.abbreviation = 'PREFIX';
      }
    }

    if (field === 'originalName') {
      const lowerVal = (value || '').trim().toLowerCase();
      
      // Auto-suggest Category if it's currently default (ABBREVIATION) and name matches other categories
      if (current.category === 'ABBREVIATION') {
        if (lowerVal.includes('định dạng user') || lowerVal.includes('định dạng mhd') || lowerVal.includes('định dạng id')) {
          current.category = 'ID_FORMAT';
        } else if (lowerVal.includes('mhd mới') || lowerVal.includes('hợp đồng mới')) {
          current.category = 'CONTRACT_NEW';
        } else if (lowerVal.includes('nội dung') || lowerVal.includes('chuyển khoản')) {
          current.category = 'TRANSFER_CONTENT';
        }
      }
      
      // Auto-fill logic: if name matches an existing config, copy its abbreviation and format
      const existingConfig = (localSettings.MASTER_CONFIGS || []).find((c: any, i: number) => 
        i !== idx && c.originalName && c.originalName.trim().toLowerCase() === lowerVal
      );
      
      if (existingConfig) {
        current.abbreviation = existingConfig.abbreviation;
        current.format = existingConfig.format;
        current.category = existingConfig.category;
        current.systemMeaning = existingConfig.systemMeaning;
      } else {
        // Auto-suggestion logic for System Meaning based on Category and Original Name
        if (current.category === 'ABBREVIATION') {
          if (lowerVal.includes('ngẫu nhiên') || lowerVal.includes('random')) {
            current.systemMeaning = 'random';
          } else if (lowerVal.includes('user') || lowerVal.includes('người dùng')) {
            current.systemMeaning = 'user_id';
          } else if (lowerVal.includes('mhd gốc') || lowerVal.includes('hợp đồng gốc')) {
            current.systemMeaning = 'contract_id_original';
          } else if (lowerVal.includes('mhd mới') || lowerVal.includes('hợp đồng mới')) {
            current.systemMeaning = 'contract_id_new';
          } else if (lowerVal.includes('hợp đồng') || lowerVal.includes('mhd')) {
            current.systemMeaning = 'contract_id';
          } else if (lowerVal.includes('lần') || lowerVal.includes('thứ tự') || lowerVal.includes('n')) {
            current.systemMeaning = 'sequence';
          } else if (lowerVal.includes('tiền tố') || lowerVal.includes('prefix')) {
            current.systemMeaning = 'prefix';
          } else if (lowerVal.includes('hạng') || lowerVal.includes('rank')) {
            current.systemMeaning = 'rank';
          } else if (lowerVal.includes('ngày') || lowerVal.includes('tháng') || lowerVal.includes('năm') || lowerVal.includes('date')) {
            current.systemMeaning = 'date_now';
          }
        } else if (current.category === 'ID_FORMAT') {
          if (lowerVal.includes('user') || lowerVal.includes('người dùng')) {
            current.systemMeaning = 'user_format';
          } else if (lowerVal.includes('gốc') || lowerVal.includes('mhd gốc')) {
            current.systemMeaning = 'contract_original_format';
          }
        } else if (current.category === 'CONTRACT_NEW') {
          if (lowerVal.includes('tất toán một phần') || lowerVal.includes('ttmp')) {
            current.systemMeaning = 'contract_partial_format';
          } else if (lowerVal.includes('gia hạn')) {
            current.systemMeaning = 'contract_extension_format';
          }
        } else if (current.category === 'TRANSFER_CONTENT') {
          if (lowerVal.includes('toàn bộ') || lowerVal.includes('tất toán')) {
            current.systemMeaning = 'transfer_full';
          } else if (lowerVal.includes('một phần') || lowerVal.includes('ttmp')) {
            current.systemMeaning = 'transfer_partial';
          } else if (lowerVal.includes('gia hạn')) {
            current.systemMeaning = 'transfer_extension';
          } else if (lowerVal.includes('nâng hạng')) {
            current.systemMeaning = 'transfer_upgrade';
          }
        }
      }
    }
    
    newConfigs[idx] = current;
    setLocalSettings({ ...localSettings, MASTER_CONFIGS: newConfigs });
  };

  const handleExport = async () => {
    if (!settings.ADMIN_PHONE) {
      toast.error('Thiếu thông tin quyền hạn Admin để xuất dữ liệu');
      return;
    }
    
    setIsExporting(true);
    try {
      const response = await authenticatedFetch('/api/data?isAdmin=true&full=true&backup=true');
      
      if (response.status === 403) {
        throw new Error('Hệ thống từ chối sao lưu: Phiên đăng nhập Admin đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.');
      }
      
      if (!response.ok) throw new Error('Không thể tải dữ liệu để sao lưu từ máy chủ');
      const data = await response.json();
      
      if (!data.users || data.users.length === 0) {
        toast.warning('Cảnh báo: Bản sao lưu không chứa dữ liệu người dùng.');
      }
      
      // Remove sensitive or unnecessary fields if needed
      const exportData = {
        ...data,
        exportDate: new Date().toISOString(),
        version: '1.26'
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ndv_money_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export error:', e);
      toast.error('Lỗi khi xuất dữ liệu');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportMessage(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const data = JSON.parse(content);

          // Basic validation
          if (!data.users || !data.loans) {
            throw new Error('Định dạng file không hợp lệ');
          }
          
          const response = await authenticatedFetch('/api/import', {
            method: 'POST',
            body: JSON.stringify(data)
          });
          
          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Lỗi khi nhập dữ liệu');
          }

          setImportMessage({ type: 'success', text: 'Nhập dữ liệu thành công! Hệ thống đang cập nhật...' });
          setTimeout(() => onImportSuccess(), 1500);
        } catch (err: any) {
          setImportMessage({ type: 'error', text: err.message || 'Lỗi khi xử lý file' });
        } finally {
          setIsImporting(false);
        }
      };
      reader.readAsText(file);
    } catch (e) {
      setIsImporting(false);
      setImportMessage({ type: 'error', text: 'Lỗi khi đọc file' });
    }
    
    // Reset input
    e.target.value = '';
  };

  const generateRandomRankFeatures = (name: string, maxLimit: number) => {
    if (!name || !maxLimit) return [];
    
    const lowerName = name.toLowerCase();
    const limitInMillion = maxLimit / 1000000;
    
    let primaryFeatures: string[] = [];
    let secondaryFeatures: string[] = [];

    if (lowerName.includes('tiêu chuẩn') || lowerName.includes('standard')) {
      primaryFeatures = [
        `Hạn mức 1 - ${limitInMillion} triệu Duyệt trong 24h`,
        `Hạn mức ${limitInMillion} triệu Giải ngân nhanh`,
        `Hạn mức tối đa ${limitInMillion} triệu đồng`,
        `Gói vay cơ bản ${limitInMillion} triệu`
      ];
      secondaryFeatures = [
        "Thủ tục đơn giản", 
        "Hỗ trợ cơ bản", 
        "Minh bạch 100%", 
        "Không phí ẩn", 
        "Đăng ký 5 phút", 
        "Hồ sơ online",
        "Uy tín hàng đầu",
        "Tiện lợi nhanh chóng"
      ];
    } else if (lowerName.includes('đồng') || lowerName.includes('bronze')) {
      primaryFeatures = [
        `Hạn mức 1 - ${limitInMillion} triệu Ưu tiên duyệt`,
        `Hạn mức ${limitInMillion} triệu Lãi suất 0%`,
        `Vay nhanh ${limitInMillion} triệu Ưu đãi mới`,
        `Hạn mức đồng ${limitInMillion} triệu`
      ];
      secondaryFeatures = [
        "Ưu tiên xét duyệt", 
        "Tỉ lệ duyệt cao", 
        "Hỗ trợ nhiệt tình", 
        "Nhận tiền trong ngày", 
        "Không gọi người thân", 
        "Bảo mật tuyệt đối",
        "Ưu đãi thành viên mới",
        "Xử lý hồ sơ ưu tiên"
      ];
    } else if (lowerName.includes('bạc') || lowerName.includes('silver')) {
      primaryFeatures = [
        `Hạn mức 1 - ${limitInMillion} triệu Hỗ trợ 24/7`,
        `Hạn mức ${limitInMillion} triệu Duyệt siêu tốc`,
        `Hạn mức Bạc ${limitInMillion} triệu Cực nhanh`,
        `Hạn mức ${limitInMillion} triệu Không thẩm định`
      ];
      secondaryFeatures = [
        "Chuyên viên hỗ trợ riêng", 
        "Xử lý hồ sơ nhanh", 
        "Bảo mật thông tin", 
        "Duyệt tự động 24/7", 
        "Ưu tiên giải ngân", 
        "Tăng tỉ lệ duyệt 80%",
        "Hỗ trợ nợ xấu nhẹ",
        "Thủ tục siêu gọn"
      ];
    } else if (lowerName.includes('vàng') || lowerName.includes('gold')) {
      primaryFeatures = [
        `Hạn mức 1 - ${limitInMillion} triệu Giảm 10% phí`,
        `Hạn mức ${limitInMillion} triệu Đặc quyền VIP`,
        `Hạn mức Vàng ${limitInMillion} triệu Đẳng cấp`,
        `Hạn mức ${limitInMillion} triệu Duyệt ưu tiên`
      ];
      secondaryFeatures = [
        "Giảm phí phạt quá hạn", 
        "Duyệt lệnh ưu tiên", 
        "Quà tặng sinh nhật", 
        "Hoàn tiền 1% mỗi kỳ", 
        "Tăng tỉ lệ duyệt 95%", 
        "Hỗ trợ VIP tận tâm",
        "Không cần chứng minh thu nhập",
        "Giải ngân sau 10 phút"
      ];
    } else if (lowerName.includes('kim cương') || lowerName.includes('diamond')) {
      primaryFeatures = [
        `Hạn mức 1 - ${limitInMillion} triệu Duyệt tức thì`,
        `Hạn mức ${limitInMillion} triệu Giải ngân 1s`,
        `Hạn mức Kim Cương ${limitInMillion} triệu`,
        `Hạn mức ${limitInMillion} triệu Độc quyền AI`
      ];
      secondaryFeatures = [
        "Duyệt lệnh tự động AI", 
        "Hỗ trợ VIP 24/7", 
        "Không cần thẩm định", 
        "Miễn phí tất toán trước hạn", 
        "Duyệt 100% hồ sơ", 
        "Hạn mức cao nhất hệ thống",
        "Ưu tiên giải ngân đầu tiên",
        "Đặc quyền thượng lưu"
      ];
    } else {
      primaryFeatures = [
        `Hạn mức 1 - ${limitInMillion} triệu Duyệt nhanh`,
        `Hạn mức ${limitInMillion} triệu Uy tín`,
        `Gói vay ${limitInMillion} triệu`
      ];
      secondaryFeatures = [
        "Dịch vụ chuyên nghiệp", 
        "Uy tín hàng đầu", 
        "Hỗ trợ tận tâm", 
        "Nhanh chóng an toàn", 
        "Bảo mật 2 lớp",
        "Thủ tục linh hoạt"
      ];
    }

    const mainFeature = primaryFeatures[Math.floor(Math.random() * primaryFeatures.length)];
    // Chọn 2 feature phụ khác nhau
    const shuffledSecondary = [...secondaryFeatures].sort(() => 0.5 - Math.random());
    const selectedSecondary = shuffledSecondary.slice(0, 2);
    
    return [mainFeature, ...selectedSecondary];
  };

  const handleRankUpdate = (index: number, field: string, value: any) => {
    const newRanks = [...(localSettings.RANK_CONFIG || [])];
    const currentRank = { ...newRanks[index] };
    
    if (field === 'features') {
      currentRank.features = typeof value === 'string' ? value.split(',').map((s: string) => s.trim()).filter(Boolean) : value;
    } else {
      currentRank[field] = value;
      
      // Tự động cập nhật chú thích (features) nếu đang thay đổi tên hoặc hạn mức
      if (field === 'name' || field === 'maxLimit') {
        const name = field === 'name' ? value : currentRank.name;
        const maxLimit = field === 'maxLimit' ? value : currentRank.maxLimit;
        
        if (name && maxLimit > 0) {
          // Chỉ tự động cập nhật nếu features đang trống hoặc có vẻ là feature tự động cũ
          if (!currentRank.features || currentRank.features.length === 0 || (currentRank.features[0] && (currentRank.features[0].startsWith('Hạn mức 1 -') || currentRank.features[0].startsWith('Hạn mức ')))) {
            currentRank.features = generateRandomRankFeatures(name, maxLimit);
          }
        }
      }
    }
    
    newRanks[index] = currentRank;
    setLocalSettings({ ...localSettings, RANK_CONFIG: newRanks });
  };

  const handleRegenerateRankFeatures = (index: number) => {
    const newRanks = [...(localSettings.RANK_CONFIG || [])];
    const currentRank = { ...newRanks[index] };
    
    if (currentRank.name && currentRank.maxLimit) {
      currentRank.features = generateRandomRankFeatures(currentRank.name, currentRank.maxLimit);
      newRanks[index] = currentRank;
      setLocalSettings({ ...localSettings, RANK_CONFIG: newRanks });
    }
  };

  const handleAddRank = () => {
    const newRanks = [...(localSettings.RANK_CONFIG || [])];
    const newIdx = newRanks.length;
    newRanks.push({
      id: `custom_${Date.now()}` as any,
      name: '',
      minLimit: 0,
      maxLimit: 0,
      color: '#ffffff',
      features: ['Hạn mức 1 - 0 triệu Duyệt lệnh nhanh']
    });
    setLocalSettings({ ...localSettings, RANK_CONFIG: newRanks });
    setExpandedConfigs(prev => ({ ...prev, [`rank_${newIdx}`]: true }));
  };

  const handleRemoveRank = (idx: number) => {
    const newRanks = [...(localSettings.RANK_CONFIG || [])];
    newRanks.splice(idx, 1);
    setLocalSettings({ ...localSettings, RANK_CONFIG: newRanks });
  };

  const handleAddVoucherMilestone = () => {
    const newVouchers = [...(localSettings.LUCKY_SPIN_VOUCHERS || [])];
    const newIdx = newVouchers.length;
    newVouchers.push({ id: `voucher_${Date.now()}`, minProfit: undefined, voucherValue: undefined });
    setLocalSettings({ ...localSettings, LUCKY_SPIN_VOUCHERS: newVouchers });
    setExpandedConfigs(prev => ({ ...prev, [`voucher_${newIdx}`]: true }));
  };

  const handleRemoveVoucherMilestone = (idx: number) => {
    const newVouchers = [...(localSettings.LUCKY_SPIN_VOUCHERS || [])];
    newVouchers.splice(idx, 1);
    setLocalSettings({ ...localSettings, LUCKY_SPIN_VOUCHERS: newVouchers });
  };

  const handleVoucherMilestoneUpdate = (idx: number, field: string, value: any) => {
    const newVouchers = [...(localSettings.LUCKY_SPIN_VOUCHERS || [])];
    newVouchers[idx] = { ...newVouchers[idx], [field]: value };
    setLocalSettings({ ...localSettings, LUCKY_SPIN_VOUCHERS: newVouchers });
  };

  const handleAddBusinessOp = () => {
    const newOps = [...(localSettings.BUSINESS_OPERATIONS_CONFIG || [])];
    const newIdx = newOps.length;
    newOps.push({
      key: `CUSTOM_OP_${Date.now()}`,
      label: 'Nghiệp vụ mới',
      abbr: '',
      original: '',
      hasContent: false,
      hasFormat: false,
      placeholders: '{ID}, {USER}'
    });
    setLocalSettings({ ...localSettings, BUSINESS_OPERATIONS_CONFIG: newOps });
    setExpandedConfigs(prev => ({ ...prev, [`busOp_${newIdx}`]: true }));
  };

  const handleRemoveBusinessOp = (idx: number) => {
    const newOps = [...(localSettings.BUSINESS_OPERATIONS_CONFIG || [])];
    newOps.splice(idx, 1);
    setLocalSettings({ ...localSettings, BUSINESS_OPERATIONS_CONFIG: newOps });
  };

  const handleBusinessOpUpdate = (idx: number, field: string, value: any) => {
    const newOps = [...(localSettings.BUSINESS_OPERATIONS_CONFIG || [])];
    const currentOp = { ...newOps[idx], [field]: value };
    
    if (field === 'original') {
      currentOp.label = value || 'Nghiệp vụ mới';
      
      // Tự động gợi ý Ý nghĩa hệ thống (Logic) dựa trên từ khóa
      const lowerVal = (value || '').toLowerCase();
      
      if (lowerVal.includes('ngẫu nhiên') || lowerVal.includes('random') || lowerVal.includes('số')) {
        currentOp.type = 'random';
      } else if (lowerVal.includes('user') || lowerVal.includes('người dùng') || lowerVal.includes('id')) {
        currentOp.type = 'user_id';
      } else if (lowerVal.includes('hợp đồng') || lowerVal.includes('mhd')) {
        currentOp.type = 'contract_id';
      } else if (lowerVal.includes('lần') || lowerVal.includes('thứ tự') || lowerVal.includes('số lần') || lowerVal.includes('n')) {
        currentOp.type = 'sequence';
      } else if (lowerVal.includes('điện thoại') || lowerVal.includes('sđt') || lowerVal.includes('phone')) {
        currentOp.type = 'phone';
      } else if (lowerVal.includes('ngày') && !lowerVal.includes('tháng')) {
        currentOp.type = 'day';
      } else if (lowerVal.includes('tháng')) {
        currentOp.type = 'month';
      } else if (lowerVal.includes('năm')) {
        currentOp.type = 'year';
      } else if (lowerVal.includes('date') || (lowerVal.includes('ngày') && lowerVal.includes('tháng'))) {
        currentOp.type = 'date';
      } else if (lowerVal.includes('hạng') || lowerVal.includes('rank')) {
        currentOp.type = 'rank';
      }
    }
    
    newOps[idx] = currentOp;
    setLocalSettings({ ...localSettings, BUSINESS_OPERATIONS_CONFIG: newOps });
  };

  const handleAddContractFormat = () => {
    const newFormats = [...(localSettings.CONTRACT_FORMATS_CONFIG || [])];
    const newIdx = newFormats.length;
    newFormats.push({
      key: `CONTRACT_${Date.now()}`,
      label: 'Loại hợp đồng mới',
      original: '',
      abbr: '',
      value: '',
      hasContent: false,
      hasFormat: false
    });
    setLocalSettings({ ...localSettings, CONTRACT_FORMATS_CONFIG: newFormats });
    setExpandedConfigs(prev => ({ ...prev, [`contract_${newIdx}`]: true }));
  };

  const handleRemoveContractFormat = (idx: number) => {
    const newFormats = [...(localSettings.CONTRACT_FORMATS_CONFIG || [])];
    newFormats.splice(idx, 1);
    setLocalSettings({ ...localSettings, CONTRACT_FORMATS_CONFIG: newFormats });
  };

  const handleContractFormatUpdate = (idx: number, field: string, value: any) => {
    const newFormats = [...(localSettings.CONTRACT_FORMATS_CONFIG || [])];
    newFormats[idx] = { ...newFormats[idx], [field]: value };
    if (field === 'original') {
      newFormats[idx].label = value || 'Loại hợp đồng mới';
    }
    setLocalSettings({ ...localSettings, CONTRACT_FORMATS_CONFIG: newFormats });
  };

  const handleAddTransferContent = () => {
    const newContents = [...(localSettings.TRANSFER_CONTENTS_CONFIG || [])];
    const newIdx = newContents.length;
    newContents.push({
      key: `TRANSFER_${Date.now()}`,
      label: 'Loại nội dung mới',
      original: '',
      abbr: '',
      value: '',
      hasContent: false,
      hasFormat: false
    });
    setLocalSettings({ ...localSettings, TRANSFER_CONTENTS_CONFIG: newContents });
    setExpandedConfigs(prev => ({ ...prev, [`transfer_${newIdx}`]: true }));
  };

  const handleRemoveTransferContent = (idx: number) => {
    const newContents = [...(localSettings.TRANSFER_CONTENTS_CONFIG || [])];
    newContents.splice(idx, 1);
    setLocalSettings({ ...localSettings, TRANSFER_CONTENTS_CONFIG: newContents });
  };

  const handleTransferContentUpdate = (idx: number, field: string, value: any) => {
    const newContents = [...(localSettings.TRANSFER_CONTENTS_CONFIG || [])];
    newContents[idx] = { ...newContents[idx], [field]: value };
    if (field === 'original') {
      newContents[idx].label = value || 'Loại nội dung mới';
    }
    setLocalSettings({ ...localSettings, TRANSFER_CONTENTS_CONFIG: newContents });
  };

  const handleAddSystemContractFormat = () => {
    const newFormats = [...(localSettings.SYSTEM_CONTRACT_FORMATS_CONFIG || [])];
    const newIdx = newFormats.length;
    newFormats.push({
      key: `SYS_CONTRACT_${Date.now()}`,
      label: 'Định dạng mới',
      original: '',
      abbr: '',
      value: '',
      hasContent: false,
      hasFormat: false
    });
    setLocalSettings({ ...localSettings, SYSTEM_CONTRACT_FORMATS_CONFIG: newFormats });
    setExpandedConfigs(prev => ({ ...prev, [`sysContract_${newIdx}`]: true }));
  };

  const handleRemoveSystemContractFormat = (idx: number) => {
    const newFormats = [...(localSettings.SYSTEM_CONTRACT_FORMATS_CONFIG || [])];
    newFormats.splice(idx, 1);
    setLocalSettings({ ...localSettings, SYSTEM_CONTRACT_FORMATS_CONFIG: newFormats });
  };

  const handleSystemContractFormatUpdate = (idx: number, field: string, value: any) => {
    const newFormats = [...(localSettings.SYSTEM_CONTRACT_FORMATS_CONFIG || [])];
    newFormats[idx] = { ...newFormats[idx], [field]: value };
    if (field === 'original') {
      newFormats[idx].label = value || 'Định dạng mới';
    }
    setLocalSettings({ ...localSettings, SYSTEM_CONTRACT_FORMATS_CONFIG: newFormats });
  };

  const handleAddSystemFormat = () => {
    const newFormats = [...(localSettings.SYSTEM_FORMATS_CONFIG || [])];
    const newIdx = newFormats.length;
    newFormats.push({
      key: `SYS_FORMAT_${Date.now()}`,
      label: 'Định dạng hệ thống mới',
      original: '',
      value: '',
    });
    setLocalSettings({ ...localSettings, SYSTEM_FORMATS_CONFIG: newFormats });
    setExpandedConfigs(prev => ({ ...prev, [`sysFormat_${newIdx}`]: true }));
  };

  const handleRemoveSystemFormat = (idx: number) => {
    const newFormats = [...(localSettings.SYSTEM_FORMATS_CONFIG || [])];
    newFormats.splice(idx, 1);
    setLocalSettings({ ...localSettings, SYSTEM_FORMATS_CONFIG: newFormats });
  };

  const handleSystemFormatUpdate = (idx: number, field: string, value: any) => {
    const newFormats = [...(localSettings.SYSTEM_FORMATS_CONFIG || [])];
    newFormats[idx] = { ...newFormats[idx], [field]: value };
    if (field === 'original') {
      newFormats[idx].label = value || 'Định dạng hệ thống mới';
    }
    setLocalSettings({ ...localSettings, SYSTEM_FORMATS_CONFIG: newFormats });
  };

  return (
    <div className="w-full bg-black px-5 pb-10 animate-in fade-in duration-500">
      {/* Header Area */}
      <div className="flex items-center justify-between pt-8 mb-6 px-1">
        <h1 className="text-xl font-black text-white uppercase tracking-tighter leading-none">
          CÀI ĐẶT HỆ THỐNG
        </h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowResetConfirm(true)}
            className="bg-red-600/10 border border-red-500/20 text-red-500 font-black px-3 py-2 rounded-xl text-[8px] uppercase tracking-widest hover:bg-red-600/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <RefreshCw size={12} />
            THỰC THI RESET
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex p-1 bg-white/5 border border-white/10 rounded-2xl mb-6">
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'settings' ? 'bg-[#ff8c00] text-black shadow-lg shadow-orange-900/20' : 'text-gray-500 hover:text-white'
          }`}
        >
          <Settings size={14} />
          THIẾT LẬP VẬN HÀNH
        </button>
        <button 
          onClick={() => setActiveTab('data')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'data' ? 'bg-[#ff8c00] text-black shadow-lg shadow-orange-900/20' : 'text-gray-500 hover:text-white'
          }`}
        >
          <Database size={14} />
          DỮ LIỆU & HỆ THỐNG
        </button>
      </div>

      {activeTab === 'data' ? (
        /* Data Management Section */
        <div className="bg-[#111111] border border-white/5 rounded-3xl p-6 space-y-6 mb-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-2.5">
            <Database className="text-[#ff8c00]" size={18} />
            <h4 className="text-[10px] font-black text-white uppercase tracking-widest">TRÌNH QUẢN TRỊ DỮ LIỆU</h4>
          </div>

          {/* Backup & Restore */}
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={handleExport}
              disabled={isExporting}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col items-center gap-3 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                {isExporting ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
              </div>
              <div className="text-center">
                <h5 className="text-[9px] font-black text-white uppercase tracking-widest">XUẤT DỮ LIỆU</h5>
                <p className="text-[7px] font-bold text-gray-500 uppercase mt-1">Xuất toàn bộ cấu hình ra file</p>
              </div>
            </button>

            <button 
              onClick={handleImportClick}
              disabled={isImporting}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col items-center gap-3 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500">
                {isImporting ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
              </div>
              <div className="text-center">
                <h5 className="text-[9px] font-black text-white uppercase tracking-widest">NHẬP DỮ LIỆU</h5>
                <p className="text-[7px] font-bold text-gray-500 uppercase mt-1">Nạp dữ liệu từ file backup</p>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".json" 
                className="hidden" 
              />
            </button>
          </div>

          {/* SQL Migration Button */}
          <div className="pt-2">
            <button 
              onClick={handleSqlAutoUpdate}
              disabled={isMigratingUnified}
              className="w-full bg-blue-600/10 border border-blue-500/20 rounded-2xl p-4 flex items-center justify-between hover:bg-blue-600/20 active:scale-95 transition-all disabled:opacity-50 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                  {isMigratingUnified ? <Loader2 className="animate-spin" size={20} /> : <Database size={20} />}
                </div>
                <div className="text-left">
                  <h5 className="text-[9px] font-black text-white uppercase tracking-widest">ĐỒNG BỘ CẤU TRÚC SQL</h5>
                  <p className="text-[7px] font-bold text-gray-500 uppercase mt-1">Tự động chuẩn hóa Schema & Database</p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                <ChevronRight size={16} />
              </div>
            </button>
            
            {migrationStatus && (
              <div className={`mt-3 p-3 rounded-xl border text-[8px] font-bold uppercase tracking-widest flex items-center gap-2 ${
                migrationStatus.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                migrationStatus.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                'bg-blue-500/10 border-blue-500/20 text-blue-500'
              }`}>
                {migrationStatus.type === 'success' ? <Check size={12} /> : 
                 migrationStatus.type === 'error' ? <AlertCircle size={12} /> : 
                 <Loader2 size={12} className="animate-spin" />}
                {migrationStatus.message}
              </div>
            )}
          </div>

          {importMessage && (
            <div className={`p-4 rounded-2xl border text-[9px] font-black uppercase tracking-widest flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${
              importMessage.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
            }`}>
              {importMessage.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
              {importMessage.text}
            </div>
          )}
        </div>
      ) : (
        /* Advanced Settings Section */
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Security Audit Section */}
          <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden shadow-sm">
            <button 
              onClick={() => setExpandedSections(prev => ({ ...prev, security: !prev.security }))}
              className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                  <Shield size={20} />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-black text-white uppercase tracking-tight">CHỈ SỐ AN NINH</h3>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Giám sát trạng thái an toàn hệ thống</p>
                </div>
              </div>
              <div className={`text-gray-600 transition-transform duration-300 ${expandedSections.security ? 'rotate-180' : ''}`}>
                <ChevronDown size={20} />
              </div>
            </button>

            {expandedSections.security && (
              <div className="p-5 pt-0 space-y-4 border-t border-white/5 bg-black/20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  {/* JWT Secret Check */}
                  <div className={`p-4 rounded-2xl border ${settings.JWT_SECRET === 'your-secret-key' ? 'bg-red-500/5 border-red-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${settings.JWT_SECRET === 'your-secret-key' ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                        {settings.JWT_SECRET === 'your-secret-key' ? <AlertCircle size={16} /> : <Check size={16} />}
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-white uppercase tracking-tight">JWT Secret Key</p>
                        <p className="text-[9px] font-bold text-gray-500 leading-relaxed">
                          {settings.JWT_SECRET === 'your-secret-key' 
                            ? 'CẢNH BÁO: Bạn đang sử dụng Key mặc định. Vui lòng đổi ngay để tránh bị hack tài khoản.' 
                            : 'An toàn: Bạn đã thay đổi Key bảo mật.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Admin Password Check */}
                  <div className={`p-4 rounded-2xl border ${settings.ADMIN_PASSWORD === 'admin123' ? 'bg-red-500/5 border-red-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${settings.ADMIN_PASSWORD === 'admin123' ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                        {settings.ADMIN_PASSWORD === 'admin123' ? <AlertCircle size={16} /> : <Check size={16} />}
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-white uppercase tracking-tight">Mật khẩu Admin</p>
                        <p className="text-[9px] font-bold text-gray-500 leading-relaxed">
                          {settings.ADMIN_PASSWORD === 'admin123' 
                            ? 'CẢNH BÁO: Mật khẩu admin quá yếu hoặc đang để mặc định (admin123).' 
                            : 'An toàn: Mật khẩu admin đã được thay đổi.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ImgBB Check */}
                  <div className={`p-4 rounded-2xl border ${!settings.IMGBB_API_KEY || settings.IMGBB_API_KEY.includes('your-imgbb') ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${!settings.IMGBB_API_KEY || settings.IMGBB_API_KEY.includes('your-imgbb') ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'}`}>
                        {!settings.IMGBB_API_KEY || settings.IMGBB_API_KEY.includes('your-imgbb') ? <Info size={16} /> : <Check size={16} />}
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-white uppercase tracking-tight">ImgBB API Key</p>
                        <p className="text-[9px] font-bold text-gray-500 leading-relaxed">
                          {!settings.IMGBB_API_KEY || settings.IMGBB_API_KEY.includes('your-imgbb') 
                            ? 'Lưu ý: Chưa cấu hình ImgBB. Ảnh sẽ được lưu dưới dạng Base64 (nặng database).' 
                            : 'Đã cấu hình: Ảnh sẽ được tải lên Cloud.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* PayOS Check */}
                  <div className={`p-4 rounded-2xl border ${!settings.PAYOS_API_KEY ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${!settings.PAYOS_API_KEY ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'}`}>
                        {!settings.PAYOS_API_KEY ? <Info size={16} /> : <Check size={16} />}
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-white uppercase tracking-tight">Cổng thanh toán PayOS</p>
                        <p className="text-[9px] font-bold text-gray-500 leading-relaxed">
                          {!settings.PAYOS_API_KEY 
                            ? 'Lưu ý: Chưa cấu hình PayOS. Các tính năng thanh toán tự động sẽ không hoạt động.' 
                            : 'Đã cấu hình: Hệ thống thanh toán tự động sẵn sàng.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[9px] font-bold text-gray-400 uppercase leading-relaxed">
                    <span className="text-[#ff8c00]">Mẹo:</span> Để bảo mật tối đa, hãy sử dụng mật khẩu có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt. Thay đổi JWT Secret định kỳ cũng là một thói quen tốt.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
            {/* 1. Technical & Security Card */}
            <div className="bg-[#111111] border border-white/5 rounded-3xl p-5 space-y-4">
              <button 
                onClick={() => toggleSection('technical')}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-xl bg-[#ff8c00]/10 flex items-center justify-center">
                      <Shield size={16} className="text-[#ff8c00]" />
                    </div>
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border-2 border-black animate-pulse"></div>
                  </div>
                  <div className="text-left">
                    <h5 className="text-[9px] font-black text-white uppercase tracking-widest">CƠ SỞ HẠ TẦNG</h5>
                    <p className="text-[7px] font-bold text-gray-500 uppercase mt-0.5">Cơ sở dữ liệu, API & Chìa khóa bảo mật</p>
                  </div>
                </div>
                {expandedSections.technical ? <ChevronUp size={14} className="text-[#ff8c00]" /> : <ChevronDown size={14} className="text-gray-600" />}
              </button>
              
              {expandedSections.technical && (
                <div className="space-y-6 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* API Keys & Database */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">Supabase URL</label>
                      <input 
                        type="text" 
                        value={localSettings.SUPABASE_URL || ''}
                        placeholder={defaultSettings.SUPABASE_URL}
                        onChange={(e) => setLocalSettings({...localSettings, SUPABASE_URL: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white focus:border-[#ff8c00] outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">Service Key</label>
                      <input 
                        type="password" 
                        value={localSettings.SUPABASE_SERVICE_ROLE_KEY || ''}
                        placeholder={defaultSettings.SUPABASE_SERVICE_ROLE_KEY}
                        onChange={(e) => setLocalSettings({...localSettings, SUPABASE_SERVICE_ROLE_KEY: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white focus:border-[#ff8c00] outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">ImgBB API Key</label>
                      <input 
                        type="text" 
                        value={localSettings.IMGBB_API_KEY || ''}
                        placeholder={defaultSettings.IMGBB_API_KEY}
                        onChange={(e) => setLocalSettings({...localSettings, IMGBB_API_KEY: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white focus:border-[#ff8c00] outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">JWT Secret Key</label>
                      <input 
                        type="text" 
                        value={localSettings.JWT_SECRET || ''}
                        placeholder={defaultSettings.JWT_SECRET}
                        onChange={(e) => setLocalSettings({...localSettings, JWT_SECRET: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white focus:border-[#ff8c00] outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">PayOS Client ID</label>
                      <input 
                        type="text" 
                        value={localSettings.PAYOS_CLIENT_ID || ''}
                        placeholder={defaultSettings.PAYOS_CLIENT_ID}
                        onChange={(e) => setLocalSettings({...localSettings, PAYOS_CLIENT_ID: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white focus:border-[#ff8c00] outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">PayOS API Key</label>
                      <input 
                        type="text" 
                        value={localSettings.PAYOS_API_KEY || ''}
                        placeholder={defaultSettings.PAYOS_API_KEY}
                        onChange={(e) => setLocalSettings({...localSettings, PAYOS_API_KEY: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white focus:border-[#ff8c00] outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">PayOS Checksum</label>
                      <input 
                        type="text" 
                        value={localSettings.PAYOS_CHECKSUM_KEY || ''}
                        placeholder={defaultSettings.PAYOS_CHECKSUM_KEY}
                        onChange={(e) => setLocalSettings({...localSettings, PAYOS_CHECKSUM_KEY: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white focus:border-[#ff8c00] outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">SĐT HOTLINE</label>
                      <input 
                        type="text" 
                        value={localSettings.ADMIN_PHONE || ''}
                        placeholder={defaultSettings.ADMIN_PHONE}
                        onChange={(e) => setLocalSettings({...localSettings, ADMIN_PHONE: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white focus:border-[#ff8c00] outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">MÃ TRUY CẬP ADMIN</label>
                      <div className="relative">
                        <input 
                          type={showAdminPassword ? "text" : "password"}
                          value={localSettings.ADMIN_PASSWORD || ''}
                          placeholder={defaultSettings.ADMIN_PASSWORD}
                          onChange={(e) => setLocalSettings({...localSettings, ADMIN_PASSWORD: e.target.value})}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white focus:border-[#ff8c00] outline-none transition-all pr-10"
                        />
                        <button 
                          onClick={() => setShowAdminPassword(!showAdminPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
                        >
                          {showAdminPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleSaveSettings(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'IMGBB_API_KEY', 'JWT_SECRET', 'PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY', 'ADMIN_PHONE', 'ADMIN_PASSWORD'])}
                    disabled={isSavingSettings}
                    className="w-full bg-[#ff8c00]/10 border border-[#ff8c00]/20 hover:bg-[#ff8c00]/20 text-[#ff8c00] font-black py-3 rounded-xl text-[8px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSavingSettings ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />}
                    LƯU CẤU HÌNH KỸ THUẬT
                  </button>
                </div>
              )}
            </div>

            {/* 2. Business & Operations Card */}
            <div className="bg-[#111111] border border-white/5 rounded-3xl p-5 space-y-4">
              <button 
                onClick={() => toggleSection('business')}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-xl bg-[#ff8c00]/10 flex items-center justify-center">
                      <FileText size={16} className="text-[#ff8c00]" />
                    </div>
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-black animate-pulse"></div>
                  </div>
                  <div className="text-left">
                    <h5 className="text-[9px] font-black text-white uppercase tracking-widest">QUY TRÌNH VẬN HÀNH</h5>
                    <p className="text-[7px] font-bold text-gray-500 uppercase mt-0.5">Thanh toán, Mã vận hành & Thông báo</p>
                  </div>
                </div>
                {expandedSections.business ? <ChevronUp size={14} className="text-[#ff8c00]" /> : <ChevronDown size={14} className="text-gray-600" />}
              </button>

              {expandedSections.business && (
                <div className="space-y-6 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* CẤU HÌNH BẢO TRÌ */}
                  <div className="space-y-3">
                    <h6 className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">Tình trạng hệ thống</h6>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Power size={14} className={localSettings.MAINTENANCE_MODE ? "text-yellow-500" : "text-gray-600"} />
                        <span className="text-[9px] font-black text-white uppercase">Chế độ bảo trì hệ thống</span>
                      </div>
                      <button 
                        onClick={() => setLocalSettings({...localSettings, MAINTENANCE_MODE: !localSettings.MAINTENANCE_MODE})}
                        className={`w-8 h-4 rounded-full relative transition-all ${localSettings.MAINTENANCE_MODE ? 'bg-yellow-500' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${localSettings.MAINTENANCE_MODE ? 'left-4.5' : 'left-0.5'}`}></div>
                      </button>
                    </div>
                    {localSettings.MAINTENANCE_MODE && (
                      <p className="px-1 text-[7px] font-bold text-yellow-500/80 uppercase italic">
                        * Khi bật, mọi User (ngoại trừ Admin) sẽ không thể thao tác trên App.
                      </p>
                    )}
                  </div>

                  {/* 0. CẤU HÌNH THANH TOÁN */}
                  <div className="space-y-3">
                    <h6 className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">Cấu hình Thanh toán</h6>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap size={14} className={localSettings.ENABLE_PAYOS ? "text-[#ff8c00]" : "text-gray-600"} />
                          <span className="text-[9px] font-black text-white uppercase">Tự động (PayOS)</span>
                        </div>
                        <button 
                          onClick={() => setLocalSettings({...localSettings, ENABLE_PAYOS: !localSettings.ENABLE_PAYOS})}
                          className={`w-8 h-4 rounded-full relative transition-all ${localSettings.ENABLE_PAYOS ? 'bg-[#ff8c00]' : 'bg-white/10'}`}
                        >
                          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${localSettings.ENABLE_PAYOS ? 'left-4.5' : 'left-0.5'}`}></div>
                        </button>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard size={14} className={localSettings.ENABLE_VIETQR ? "text-[#ff8c00]" : "text-gray-600"} />
                          <span className="text-[9px] font-black text-white uppercase">Thủ công (VietQR)</span>
                        </div>
                        <button 
                          onClick={() => setLocalSettings({...localSettings, ENABLE_VIETQR: !localSettings.ENABLE_VIETQR})}
                          className={`w-8 h-4 rounded-full relative transition-all ${localSettings.ENABLE_VIETQR ? 'bg-[#ff8c00]' : 'bg-white/10'}`}
                        >
                          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${localSettings.ENABLE_VIETQR ? 'left-4.5' : 'left-0.5'}`}></div>
                        </button>
                      </div>
                    </div>

                    {localSettings.ENABLE_VIETQR && (
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-1 h-3 bg-[#ff8c00] rounded-full"></div>
                          <h6 className="text-[8px] font-black text-white uppercase tracking-widest">Thông tin nhận thanh toán</h6>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[7px] font-black text-gray-500 uppercase px-1">Ngân hàng thụ hưởng</label>
                            <BankSearchableSelect 
                              value={localSettings.PAYMENT_ACCOUNT.bankName}
                              onChange={(name, bin) => setLocalSettings({
                                ...localSettings, 
                                PAYMENT_ACCOUNT: { ...localSettings.PAYMENT_ACCOUNT, bankName: name, bankBin: bin }
                              })}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-[7px] font-black text-gray-500 uppercase px-1">Số tài khoản</label>
                              <div className="relative">
                                <input 
                                  type="text"
                                  value={localSettings.PAYMENT_ACCOUNT.accountNumber}
                                  onChange={(e) => setLocalSettings({
                                    ...localSettings, 
                                    PAYMENT_ACCOUNT: { ...localSettings.PAYMENT_ACCOUNT, accountNumber: e.target.value }
                                  })}
                                  className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-[9px] font-bold text-white outline-none focus:border-[#ff8c00]/50 transition-all"
                                  placeholder="Nhập số tài khoản"
                                />
                                <button 
                                  onClick={handleCheckBankAccount}
                                  disabled={isCheckingBank}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#ff8c00] hover:text-[#ff8c00]/80 disabled:opacity-50"
                                >
                                  {isCheckingBank ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[7px] font-black text-gray-500 uppercase px-1">Tên chủ tài khoản</label>
                              <input 
                                type="text"
                                value={localSettings.PAYMENT_ACCOUNT.accountName}
                                onChange={(e) => setLocalSettings({
                                  ...localSettings, 
                                  PAYMENT_ACCOUNT: { ...localSettings.PAYMENT_ACCOUNT, accountName: e.target.value.toUpperCase() }
                                })}
                                className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-[9px] font-bold text-[#ff8c00] outline-none focus:border-[#ff8c00]/50 transition-all"
                                placeholder="TÊN CHỦ TÀI KHOẢN"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* UNIFIED MASTER CONFIGURATION */}
                  <div className="space-y-4 pt-6 border-t border-white/5">
                    <button 
                      onClick={() => setExpandedSections(prev => ({ ...prev, master: !prev.master }))}
                      className="w-full flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#ff8c00] shadow-[0_0_8px_#ff8c00]"></div>
                        <div className="text-left">
                          <h6 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">THIẾT LẬP NÂNG CAO (MASTER)</h6>
                          <p className="text-[7px] text-gray-500 font-bold uppercase tracking-widest">Quản lý định dạng ID và Nội dung chuyển khoản tự động</p>
                        </div>
                      </div>
                      {expandedSections.master ? <ChevronUp size={14} className="text-[#ff8c00]" /> : <ChevronDown size={14} className="text-gray-600" />}
                    </button>

                    {expandedSections.master && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <p className="text-[7px] text-gray-400 font-bold uppercase tracking-widest">Thiết lập các quy tắc định dạng và biến hệ thống 4-trong-1</p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10">
                              {(!localSettings.MASTER_CONFIGS || localSettings.MASTER_CONFIGS.length === 0) && (
                                <button 
                                  onClick={handleMigrateUnified}
                                  disabled={isMigratingUnified}
                                  className="text-orange-500 text-[7px] font-black px-3 py-1.5 rounded-lg hover:bg-orange-500/10 transition-all flex items-center gap-1.5"
                                  title="Chuyển đổi dữ liệu cũ sang hệ thống mới"
                                >
                                  {isMigratingUnified ? <Loader2 size={10} className="animate-spin" /> : <Database size={10} />}
                                  MIGRATE
                                </button>
                              )}
                              <button 
                                onClick={handleOneClickSetup}
                                disabled={isScanning}
                                className="text-blue-500 text-[7px] font-black px-3 py-1.5 rounded-lg hover:bg-blue-500/10 transition-all flex items-center gap-1.5 disabled:opacity-50"
                                title="Tự động thiết lập toàn bộ hệ thống"
                              >
                                {isScanning ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                                QUICK SETUP
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Help Section - More compact */}
                        <div className="p-3 bg-gradient-to-r from-blue-500/10 to-transparent border-l-2 border-blue-500 rounded-r-2xl">
                          <p className="text-[7px] text-gray-400 font-bold uppercase leading-relaxed">
                            <span className="text-blue-400 mr-1">Mẹo:</span>
                            Dùng <span className="text-[#00ffcc] font-black">{'{'}Biến{'}'}</span> để lắp ghép: 
                            <span className="text-white mx-1">1. Phân loại</span> • 
                            <span className="text-white mx-1">2. Tên</span> • 
                            <span className="text-white mx-1">3. Biến</span> • 
                            <span className="text-white mx-1">4. Hành động</span> • 
                            <span className="text-white mx-1">5. Định dạng</span>
                          </p>
                        </div>

                    {(() => {
                      const categoryInfo: Record<string, { label: string, color: string, desc: string, icon: any }> = {
                        'ABBREVIATION': { 
                          label: 'BIẾN & VIẾT TẮT', 
                          color: 'text-blue-400 bg-blue-400/10',
                          desc: 'Định nghĩa các biến (ví dụ: {RD}, {N})',
                          icon: <Hash size={10} />
                        },
                        'ID_FORMAT': { 
                          label: 'ĐỊNH DẠNG ID GỐC', 
                          color: 'text-purple-400 bg-purple-400/10',
                          desc: 'Cấu trúc ID User & Mã HĐ gốc',
                          icon: <User size={10} />
                        },
                        'CONTRACT_NEW': { 
                          label: 'ĐỊNH DẠNG HĐ MỚI', 
                          color: 'text-emerald-400 bg-emerald-400/10',
                          desc: 'Mã HĐ khi TTMP hoặc Gia hạn',
                          icon: <FileText size={10} />
                        },
                        'TRANSFER_CONTENT': { 
                          label: 'NỘI DUNG CHUYỂN KHOẢN', 
                          color: 'text-orange-400 bg-orange-400/10',
                          desc: 'Nội dung tin nhắn thanh toán',
                          icon: <MessageCircle size={10} />
                        }
                      };

                      const allConfigs = localSettings.MASTER_CONFIGS || [];

                      return (
                        <div className="space-y-4">
                          {/* Quick Add Bar - More streamlined */}
                          <div className="flex items-center gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar">
                            <div className="flex items-center gap-1.5 px-3 border-r border-white/10 mr-1">
                              <Plus size={12} className="text-gray-500" />
                              <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Thêm mới:</span>
                            </div>
                            {Object.entries(categoryInfo).map(([catKey, info]) => (
                              <button 
                                key={catKey}
                                onClick={() => handleAddMasterConfig(catKey)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all active:scale-95 whitespace-nowrap ${info.color.replace('text-', 'border-').split(' ')[0]} ${info.color} hover:bg-white/10`}
                              >
                                {info.icon}
                                <span className="text-[7px] font-black uppercase tracking-tight">{info.label}</span>
                              </button>
                            ))}
                          </div>

                          {/* Unified List - Grid Layout */}
                          <div className="space-y-3">
                            {allConfigs.length === 0 ? (
                              <div className="py-12 px-4 bg-white/[0.02] border border-dashed border-white/10 rounded-[2rem] flex flex-col items-center justify-center gap-3 text-center">
                                <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center text-gray-600 border border-white/5">
                                  <Settings size={28} />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] font-black text-white uppercase tracking-widest">Hệ thống đang trống</p>
                                  <p className="text-[7px] text-gray-500 font-bold uppercase max-w-[200px]">Sử dụng Quick Setup hoặc Thêm mới để bắt đầu cấu hình</p>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {allConfigs.map((config: any, idx: number) => {
                                  const isExpanded = expandedConfigs[`master_${idx}`];
                                  const info = categoryInfo[config.category] || categoryInfo['ABBREVIATION'];
                                  
                                  return (
                                    <div 
                                      key={config.id || `master_${idx}`} 
                                      className={`group bg-white/[0.03] border rounded-[1.5rem] overflow-hidden transition-all duration-300 ${isExpanded ? 'border-[#ff8c00]/40 ring-1 ring-[#ff8c00]/20 bg-white/[0.05]' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.05]'}`}
                                    >
                                      <div 
                                        className="flex items-center justify-between p-4 cursor-pointer"
                                        onClick={() => toggleConfigExpansion(`master_${idx}`)}
                                      >
                                        <div className="flex items-center gap-4">
                                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner ${info.color}`}>
                                            {info.icon}
                                          </div>
                                          <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                              <h6 className="text-[10px] font-black text-white uppercase leading-none group-hover:text-[#ff8c00] transition-colors">{config.originalName || 'Cấu hình mới'}</h6>
                                              <span className={`text-[5px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter ${info.color}`}>{info.label}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-[6px] font-bold text-gray-500 uppercase tracking-widest">{config.systemMeaning || 'Chờ thiết lập'}</span>
                                              {config.abbreviation && (
                                                <span className="text-[7px] font-black text-[#00ffcc] bg-[#00ffcc]/5 px-2 py-0.5 rounded-lg border border-[#00ffcc]/10">
                                                  {'{'}{config.abbreviation}{'}'}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleRemoveMasterConfig(idx); }} 
                                            className="text-red-500/30 hover:text-red-500 transition-all p-2 hover:bg-red-500/10 rounded-xl"
                                            title="Xóa cấu hình"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                          <div className={`p-2 rounded-xl transition-all ${isExpanded ? 'bg-[#ff8c00]/10 text-[#ff8c00] rotate-180' : 'text-gray-600'}`}>
                                            <ChevronDown size={14} />
                                          </div>
                                        </div>
                                      </div>

                                      {isExpanded && (
                                        <div className="p-5 pt-0 space-y-5 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                                          <div className="grid grid-cols-2 gap-4 mt-4">
                                            <div className="space-y-2">
                                              <label className="text-[7px] font-black text-gray-500 uppercase px-1 tracking-[0.15em]">1. Phân loại</label>
                                              <div className="relative">
                                                <select 
                                                  value={config.category}
                                                  onChange={(e) => handleMasterConfigUpdate(idx, 'category', e.target.value)}
                                                  className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2.5 text-[9px] font-black text-white outline-none appearance-none focus:border-[#ff8c00]/50 transition-all"
                                                >
                                                  {Object.entries(categoryInfo).map(([key, info]) => (
                                                    <option key={key} value={key}>{info.label}</option>
                                                  ))}
                                                </select>
                                                <ChevronDown size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                              </div>
                                            </div>
                                            <div className="space-y-2">
                                              <label className="text-[7px] font-black text-gray-500 uppercase px-1 tracking-[0.15em]">2. Tên gợi nhớ</label>
                                              <input 
                                                type="text"
                                                value={config.originalName || ''}
                                                onChange={(e) => handleMasterConfigUpdate(idx, 'originalName', e.target.value)}
                                                className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2.5 text-[9px] font-black text-white outline-none focus:border-[#ff8c00]/50 placeholder:text-gray-700 transition-all"
                                                placeholder="Ví dụ: Mã ngẫu nhiên..."
                                              />
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                              <label className="text-[7px] font-black text-gray-500 uppercase px-1 tracking-[0.15em]">3. Biến đại diện</label>
                                              <div className="relative group/input">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-black text-[10px] group-focus-within/input:text-[#00ffcc] transition-colors">{'{'}</span>
                                                <input 
                                                  type="text"
                                                  value={config.abbreviation || ''}
                                                  onChange={(e) => handleMasterConfigUpdate(idx, 'abbreviation', e.target.value.toUpperCase())}
                                                  className="w-full bg-black/60 border border-white/10 rounded-2xl pl-7 pr-7 py-2.5 text-[10px] font-black text-[#00ffcc] outline-none focus:border-[#ff8c00]/50 transition-all"
                                                  placeholder="RD, ID, MHD..."
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 font-black text-[10px] group-focus-within/input:text-[#00ffcc] transition-colors">{'}'}</span>
                                              </div>
                                            </div>
                                            <div className="space-y-2">
                                              <label className="text-[7px] font-black text-gray-500 uppercase px-1 tracking-[0.15em]">4. Hành động</label>
                                              <div className="relative">
                                                <select 
                                                  value={config.systemMeaning || ''}
                                                  onChange={(e) => handleMasterConfigUpdate(idx, 'systemMeaning', e.target.value)}
                                                  className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2.5 text-[9px] font-black text-[#ff8c00] outline-none appearance-none focus:border-[#ff8c00]/50 transition-all"
                                                >
                                                  <option value="">Chọn chức năng...</option>
                                                  <optgroup label="Cơ bản & Biến" className="bg-black text-white">
                                                    <option value="random">Số ngẫu nhiên</option>
                                                    <option value="sequence">Số thứ tự tăng dần</option>
                                                    <option value="prefix">Tiền tố cố định</option>
                                                    <option value="date_now">Ngày hiện tại (DDMMYY)</option>
                                                  </optgroup>
                                                  <optgroup label="Dữ liệu Người dùng" className="bg-black text-white">
                                                    <option value="user_id">ID Người dùng (Gốc)</option>
                                                    <option value="phone">Số điện thoại</option>
                                                    <option value="rank">Tên hạng thành viên</option>
                                                  </optgroup>
                                                  <optgroup label="Dữ liệu Hợp đồng" className="bg-black text-white">
                                                    <option value="contract_id_original">Mã Hợp đồng (Gốc)</option>
                                                    <option value="slgh">Số lần gia hạn</option>
                                                    <option value="slttmp">Số lần tất toán một phần</option>
                                                  </optgroup>
                                                  <optgroup label="Định dạng ID Gốc" className="bg-black text-white">
                                                    <option value="user_format">Cấu trúc ID User</option>
                                                    <option value="contract_original_format">Cấu trúc Mã HĐ Gốc</option>
                                                  </optgroup>
                                                  <optgroup label="Định dạng HĐ Mới" className="bg-black text-white">
                                                    <option value="contract_partial_format">HĐ Tất toán 1 phần</option>
                                                    <option value="contract_extension_format">HĐ Gia hạn</option>
                                                  </optgroup>
                                                  <optgroup label="Nội dung Chuyển khoản" className="bg-black text-white">
                                                    <option value="transfer_full">CK Tất toán toàn bộ</option>
                                                    <option value="transfer_partial">CK Tất toán 1 phần</option>
                                                    <option value="transfer_extension">CK Gia hạn</option>
                                                    <option value="transfer_upgrade">CK Nâng hạng</option>
                                                    <option value="transfer_disburse">CK Giải ngân</option>
                                                  </optgroup>
                                                </select>
                                                <ChevronDown size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                              </div>
                                            </div>
                                          </div>

                                          <div className="space-y-2">
                                            <label className="text-[7px] font-black text-gray-500 uppercase px-1 tracking-[0.15em]">5. Định dạng (Format)</label>
                                            <input 
                                              type="text"
                                              value={config.format || ''}
                                              onChange={(e) => handleMasterConfigUpdate(idx, 'format', e.target.value)}
                                              className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-3 text-[10px] font-black text-white outline-none focus:border-[#ff8c00]/50 placeholder:text-gray-700 transition-all"
                                              placeholder="Ví dụ: NDV-{RD}-{ID}..."
                                            />
                                          </div>

                                          {/* Preview Section - More polished */}
                                          <div className="mt-2 p-4 bg-black/80 border border-white/5 rounded-[1.25rem] relative overflow-hidden group/preview">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00ffcc]/5 blur-[40px] rounded-full -mr-16 -mt-16"></div>
                                            
                                            <div className="flex items-center justify-between mb-3 relative z-10">
                                              <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-lg bg-white/5 flex items-center justify-center">
                                                  <Eye size={10} className="text-gray-400" />
                                                </div>
                                                <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Mô phỏng thực tế</span>
                                              </div>
                                              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 rounded-full border border-green-500/20">
                                                <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
                                                <span className="text-[5px] text-green-500 font-black uppercase tracking-widest">Live</span>
                                              </div>
                                            </div>
                                            
                                            <div className="p-3 bg-white/5 rounded-xl border border-white/5 relative z-10">
                                              <code className="text-[11px] font-mono text-[#00ffcc] break-all selection:bg-[#00ffcc]/20">
                                                {(() => {
                                                  const getBaseMockValue = (cfg: any) => {
                                                    const type = cfg.systemMeaning;
                                                    const name = (cfg.originalName || '').toLowerCase();
                                                    
                                                    if (type === 'random') {
                                                      const match = name.match(/\d+/);
                                                      const len = match ? parseInt(match[0]) : 6;
                                                      return '1234567890'.slice(0, len);
                                                    }
                                                    if (type === 'sequence') return '1';
                                                    if (type === 'slgh') return '1';
                                                    if (type === 'slttmp') return '2';
                                                    if (type === 'prefix') return cfg.format || 'NDV';
                                                    if (type === 'rank') return 'VANG';
                                                    if (type === 'user_id') return 'USER123';
                                                    if (type === 'contract_id_original') return 'HD0001';
                                                    if (type === 'contract_id_new') return 'HD0001NEW';
                                                    if (type === 'date_now') return new Date().toLocaleDateString('vi-VN').replace(/\//g, '');
                                                    if (type === 'phone') return '0987654321';
                                                    return '';
                                                  };

                                                  const resolveConfig = (cfg: any, depth = 0): string => {
                                                    if (depth > 5) return '...';
                                                    
                                                    let res = cfg.format || getBaseMockValue(cfg) || '---';
                                                    
                                                    allConfigs.forEach((c: any) => {
                                                      if (c.abbreviation) {
                                                        const regex = new RegExp(`\\{${c.abbreviation}\\}`, 'gi');
                                                        if (regex.test(res)) {
                                                          const replacement = (c === cfg) ? getBaseMockValue(c) : resolveConfig(c, depth + 1);
                                                          res = res.replace(regex, replacement);
                                                        }
                                                      }
                                                    });

                                                    res = res.replace(/\{RD\}|\{RANDOM\}/gi, '123456')
                                                             .replace(/\{N\}|\{SEQUENCE\}/gi, '1');
                                                    
                                                    if (res.includes('{ID}') || res.includes('{USER}')) {
                                                      res = res.replace(/\{ID\}|\{USER\}/gi, 'USER123');
                                                    }
                                                    if (res.includes('{MHD}') || res.includes('{CONTRACT}')) {
                                                      res = res.replace(/\{MHD\}|\{CONTRACT\}/gi, 'HD0001');
                                                    }
                                                    
                                                    return res.replace(/\{DATE\}/gi, '120426')
                                                             .replace(/\{RANK\}/gi, 'VANG');
                                                  };

                                                  return resolveConfig(config);
                                                })()}
                                              </code>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <button 
                onClick={() => handleSaveSettings([
                  'ENABLE_PAYOS', 'ENABLE_VIETQR', 'PAYMENT_ACCOUNT', 
                  'MASTER_CONFIGS'
                ])}
                    disabled={isSavingSettings}
                    className="w-full bg-[#ff8c00]/10 border border-[#ff8c00]/20 hover:bg-[#ff8c00]/20 text-[#ff8c00] font-black py-3 rounded-xl text-[8px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSavingSettings ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />}
                    LƯU CẤU HÌNH NGHIỆP VỤ
                  </button>
                </div>
              )}
            </div>

            {/* 3. Contract & Legal Configuration Card */}
            <div className="bg-[#111111] border border-white/5 rounded-3xl p-5 space-y-4">
              <button 
                onClick={() => toggleSection('contract')}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <FileText size={16} className="text-blue-500" />
                    </div>
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-black animate-pulse"></div>
                  </div>
                  <div className="text-left">
                    <h5 className="text-[9px] font-black text-white uppercase tracking-widest">NỘI DUNG HỢP ĐỒNG</h5>
                    <p className="text-[7px] font-bold text-gray-500 uppercase mt-0.5">Văn bản pháp lý & Chứng nhận điện tử</p>
                  </div>
                </div>
                {expandedSections.contract ? <ChevronUp size={14} className="text-blue-500" /> : <ChevronDown size={14} className="text-gray-600" />}
              </button>

              {expandedSections.contract && (
                <div className="space-y-6 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[7px] font-black text-gray-500 uppercase px-1">Tiêu đề hợp đồng</label>
                        <input 
                          type="text"
                          value={localSettings.CONTRACT_CLAUSES?.title}
                          onChange={(e) => {
                            setLocalSettings({
                              ...localSettings, 
                              CONTRACT_CLAUSES: { ...localSettings.CONTRACT_CLAUSES, title: e.target.value }
                            });
                            setHasChanges(true);
                          }}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-[9px] font-bold text-white outline-none focus:border-[#ff8c00]/50 transition-all"
                          placeholder="Ví dụ: Hợp đồng vay tiêu dùng"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[7px] font-black text-gray-500 uppercase px-1">Nhãn xác thực (Subtitle)</label>
                        <input 
                          type="text"
                          value={localSettings.CONTRACT_CLAUSES?.subtitle}
                          onChange={(e) => {
                            setLocalSettings({
                              ...localSettings, 
                              CONTRACT_CLAUSES: { ...localSettings.CONTRACT_CLAUSES, subtitle: e.target.value }
                            });
                            setHasChanges(true);
                          }}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-[9px] font-bold text-white outline-none focus:border-[#ff8c00]/50 transition-all"
                          placeholder="Ví dụ: XÁC THỰC ĐIỆN TỬ NDV-SAFE"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Compact Variables List */}
                      <div className="bg-black/40 border border-white/5 rounded-2xl p-3 space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Biến hỗ trợ (Click để chép)</label>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                if (window.confirm("Bạn có chắc chắn muốn đồng bộ lại toàn bộ điều khoản từ phác thảo? Hành động này sẽ ghi đè nội dung hiện tại.")) {
                                  setLocalSettings({
                                    ...localSettings,
                                    CONTRACT_CLAUSES: defaultSettings.CONTRACT_CLAUSES
                                  });
                                  setHasChanges(true);
                                  toast.success("Đã đồng bộ nội dung chuyên nghiệp!");
                                }
                              }}
                              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#ff8c00]/10 text-[#ff8c00] text-[6px] font-black uppercase hover:bg-[#ff8c00]/20 transition-all border border-[#ff8c00]/20"
                            >
                              <RefreshCw size={8} />
                              Đồng bộ phác thảo
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar no-scrollbar">
                          {[
                            { tag: '{FULL_NAME}', label: 'Tên' },
                            { tag: '{ID_NUMBER}', label: 'CCCD' },
                            { tag: '{AMOUNT}', label: 'Tiền', important: true },
                            { tag: '{DATE}', label: 'Hạn', important: true },
                            { tag: '{LOAN_PURPOSE}', label: 'Mục đích' },
                            { tag: '{BANK_NAME}', label: 'Bank' },
                            { tag: '{BANK_ACCOUNT}', label: 'STK' },
                            { tag: '{PHONE}', label: 'SĐT' },
                            { tag: '{ADDRESS}', label: 'Địa chỉ' },
                            { tag: '{RANK}', label: 'Hạng' },
                            { tag: '{DATE_NOW}', label: 'Ngày' }
                          ].map((v, i) => (
                            <button
                              key={i}
                              onClick={() => copyToClipboard(v.tag, `var-${i}`)}
                              className={`flex-none px-2 py-1 rounded-md text-[6px] font-black uppercase transition-all flex items-center gap-1 border ${
                                v.important 
                                  ? 'bg-[#ff8c00]/20 text-[#ff8c00] border-[#ff8c00]/30' 
                                  : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                              }`}
                            >
                              {v.tag}
                              {copiedField === `var-${i}` && <Check size={8} className="text-green-500" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[7px] font-black text-gray-500 uppercase">Danh sách điều khoản</label>
                          <button 
                            onClick={() => {
                              const newClauses = [...(localSettings.CONTRACT_CLAUSES?.clauses || [])];
                              newClauses.push({ title: `Điều ${newClauses.length + 1}`, content: '' });
                              setLocalSettings({
                                ...localSettings,
                                CONTRACT_CLAUSES: { ...localSettings.CONTRACT_CLAUSES, clauses: newClauses }
                              });
                              setHasChanges(true);
                            }}
                            className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 hover:bg-blue-500/20 transition-all border border-blue-500/20"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {(localSettings.CONTRACT_CLAUSES?.clauses || []).map((clause: any, index: number) => (
                          <div key={index} className="bg-black/30 border border-white/5 rounded-xl p-3 space-y-2 relative group">
                            <button 
                              onClick={() => {
                                const newClauses = localSettings.CONTRACT_CLAUSES.clauses.filter((_: any, i: number) => i !== index);
                                setLocalSettings({
                                  ...localSettings,
                                  CONTRACT_CLAUSES: { ...localSettings.CONTRACT_CLAUSES, clauses: newClauses }
                                });
                                setHasChanges(true);
                              }}
                              className="absolute top-2 right-2 w-5 h-5 rounded-md bg-red-500/10 flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 size={10} />
                            </button>
                            <input 
                              type="text"
                              value={clause.title}
                              onChange={(e) => {
                                const newClauses = [...localSettings.CONTRACT_CLAUSES.clauses];
                                newClauses[index].title = e.target.value;
                                setLocalSettings({
                                  ...localSettings,
                                  CONTRACT_CLAUSES: { ...localSettings.CONTRACT_CLAUSES, clauses: newClauses }
                                });
                                // Mark as changed to enable save button
                                setHasChanges(true);
                              }}
                              className="w-full bg-transparent border-b border-white/10 pb-1 text-[8px] font-black text-[#ff8c00] uppercase outline-none focus:border-[#ff8c00]/50"
                              placeholder="Tiêu đề điều khoản"
                            />
                            <div className="relative">
                              <textarea 
                                value={clause.content}
                                onChange={(e) => {
                                  const newClauses = [...localSettings.CONTRACT_CLAUSES.clauses];
                                  newClauses[index].content = e.target.value;
                                  setLocalSettings({
                                    ...localSettings,
                                    CONTRACT_CLAUSES: { ...localSettings.CONTRACT_CLAUSES, clauses: newClauses }
                                  });
                                  // Mark as changed to enable save button
                                  setHasChanges(true);
                                }}
                                className="w-full bg-black/50 border border-white/5 rounded-lg px-3 py-2 text-[8px] font-bold text-gray-400 outline-none focus:border-[#ff8c00]/30 transition-all min-h-[80px] resize-none"
                                placeholder="Nội dung chi tiết điều khoản..."
                              />
                              <button 
                                onClick={() => {
                                  const newClauses = [...localSettings.CONTRACT_CLAUSES.clauses];
                                  const currentContent = newClauses[index].content;
                                  newClauses[index].content = currentContent + "\n\n[COLUMN_SPLIT]\n\n";
                                  setLocalSettings({
                                    ...localSettings,
                                    CONTRACT_CLAUSES: { ...localSettings.CONTRACT_CLAUSES, clauses: newClauses }
                                  });
                                  setHasChanges(true);
                                  toast.info("Đã thêm ngắt cột (Grid 1x2)");
                                }}
                                className="absolute bottom-2 right-2 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[6px] font-black text-gray-500 uppercase border border-white/10 transition-all"
                              >
                                Chia cột (1x2)
                              </button>
                            </div>
                            <div className="mt-2 p-3 bg-black/40 border border-white/5 rounded-xl shadow-inner">
                              <p className="text-[6px] font-black text-blue-500 uppercase mb-2 flex items-center gap-1.5">
                                <Eye size={8} />
                                Xem trước bản in (Demo):
                              </p>
                              <div className="text-[7px] text-gray-300 font-medium leading-relaxed whitespace-pre-line">
                                {(() => {
                                  let content = clause.content || "";
                                  
                                  // 1. Replace Placeholders with highlighted values
                                  const demoData: any = {
                                    '{FULL_NAME}': 'NGUYỄN VĂN A',
                                    '{ID_NUMBER}': '012345678901',
                                    '{PHONE}': '0987654321',
                                    '{ADDRESS}': '123 Đường ABC, Hà Nội',
                                    '{LOAN_PURPOSE}': 'Tiêu dùng cá nhân',
                                    '{AMOUNT}': '5.000.000 ₫',
                                    '{DATE}': '20/04/2026',
                                    '{BANK_NAME}': 'MB BANK',
                                    '{BANK_ACCOUNT}': '190011022033',
                                    '{CONTRACT_ID}': 'HD-123456',
                                    '{RANK}': 'GOLD',
                                    '{DATE_NOW}': new Date().toLocaleDateString('vi-VN')
                                  };

                                  // Check for column split
                                  if (content.includes('[COLUMN_SPLIT]')) {
                                    const parts = content.split('[COLUMN_SPLIT]');
                                    const sideA = parts[0] || "";
                                    const sideB = parts[1] || "";
                                    
                                    const linesA = sideA.split('\n').map(l => l.trim()).filter(Boolean);
                                    const linesB = sideB.split('\n').map(l => l.trim()).filter(Boolean);
                                    const maxLines = Math.max(linesA.length, linesB.length);

                                    const processLine = (line: string) => {
                                      let processedLine: any[] = [line];
                                      Object.entries(demoData).forEach(([k, v]) => {
                                        const newProcessed: any[] = [];
                                        processedLine.forEach(item => {
                                          if (typeof item === 'string') {
                                            const segments = item.split(k);
                                            segments.forEach((seg, sIdx) => {
                                              newProcessed.push(seg);
                                              if (sIdx < segments.length - 1) {
                                                const isBankAccount = k === '{BANK_ACCOUNT}';
                                                newProcessed.push(
                                                  <span 
                                                    key={`${k}-${sIdx}`} 
                                                    className={`font-black px-1 rounded-sm ${
                                                      isBankAccount 
                                                        ? "text-blue-600 bg-blue-50 border border-blue-100" 
                                                        : "text-[#ff8c00] bg-[#ff8c00]/10 border border-[#ff8c00]/10"
                                                    }`}
                                                  >
                                                    {v as string}
                                                  </span>
                                                );
                                              }
                                            });
                                          } else {
                                            newProcessed.push(item);
                                          }
                                        });
                                        processedLine = newProcessed;
                                      });
                                      return processedLine;
                                    };

                                    return (
                                      <div className="border-t border-b border-white/5 py-2 my-1 space-y-1">
                                        {Array.from({ length: maxLines }).map((_, i) => (
                                          <div key={i} className="grid grid-cols-2 gap-4 items-start">
                                            <div className="text-[7px] font-bold text-gray-400 leading-tight border-r border-white/5 pr-2 min-h-[1.2em]">
                                              {processLine(linesA[i] || '')}
                                            </div>
                                            <div className="text-[7px] font-bold text-gray-400 leading-tight min-h-[1.2em]">
                                              {processLine(linesB[i] || '')}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  }

                                  // Standard rendering with highlights
                                  return content.split('\n').map((line, lIdx) => {
                                    let processedLine: any[] = [line];
                                    Object.entries(demoData).forEach(([k, v]) => {
                                      const newProcessed: any[] = [];
                                      processedLine.forEach(item => {
                                        if (typeof item === 'string') {
                                          const segments = item.split(k);
                                          segments.forEach((seg, sIdx) => {
                                            newProcessed.push(seg);
                                            if (sIdx < segments.length - 1) {
                                              const isBankAccount = k === '{BANK_ACCOUNT}';
                                              newProcessed.push(
                                                <span 
                                                  key={`${k}-${sIdx}`} 
                                                  className={`font-black px-1 rounded-sm ${
                                                    isBankAccount 
                                                      ? "text-blue-600 bg-blue-50 border border-blue-100" 
                                                      : "text-[#ff8c00] bg-[#ff8c00]/10 border border-[#ff8c00]/10"
                                                  }`}
                                                >
                                                  {v as string}
                                                </span>
                                              );
                                            }
                                          });
                                        } else {
                                          newProcessed.push(item);
                                        }
                                      });
                                      processedLine = newProcessed;
                                    });
                                    return <div key={lIdx}>{processedLine}</div>;
                                  });
                                })()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                    <button 
                      onClick={() => handleSaveSettings(['CONTRACT_CLAUSES'])}
                      disabled={isSavingSettings || !hasChanges}
                      className={`w-full font-black py-3 rounded-xl text-[8px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                        hasChanges 
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20 border-transparent" 
                          : "bg-blue-500/10 border border-blue-500/20 text-blue-500"
                      }`}
                    >
                      {isSavingSettings ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />}
                      {hasChanges ? 'LƯU CẤU HÌNH HỢP ĐỒNG' : 'ĐÃ LƯU CẤU HÌNH'}
                    </button>
                </div>
              )}
            </div>

            {/* 2.5. Utilities & Tools Card */}
            <div className="bg-[#111111] border border-white/5 rounded-3xl p-5 space-y-4">
              <button 
                onClick={() => toggleSection('utilities')}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-xl bg-[#ff8c00]/10 flex items-center justify-center">
                      <Wrench size={16} className="text-[#ff8c00]" />
                    </div>
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-500 rounded-full border-2 border-black animate-pulse"></div>
                  </div>
                  <div className="text-left">
                    <h5 className="text-[9px] font-black text-white uppercase tracking-widest">TIỆN ÍCH HỆ THỐNG</h5>
                    <p className="text-[7px] font-bold text-gray-500 uppercase mt-0.5">Công cụ bổ trợ, Webhook & Liên kết ngoài</p>
                  </div>
                </div>
                {expandedSections.utilities ? <ChevronUp size={14} className="text-[#ff8c00]" /> : <ChevronDown size={14} className="text-gray-600" />}
              </button>

              {expandedSections.utilities && (
                <div className="space-y-6 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* Tools & Utilities (Moved from Technical) */}
                  <div className="space-y-3">
                    <h6 className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">Tiện ích & Công cụ</h6>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => copyToClipboard(sqlSchema, 'sql')}
                        className="flex items-center justify-between px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group"
                      >
                        <div className="flex items-center gap-2">
                          <Database size={12} className="text-[#ff8c00]" />
                          <span className="text-[8px] font-black text-white uppercase tracking-widest">SQL Schema</span>
                        </div>
                        {copiedField === 'sql' ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-gray-500" />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(`${window.location.origin}/api/payment/webhook`, 'webhook')}
                        className="flex items-center justify-between px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group"
                      >
                        <div className="flex items-center gap-2">
                          <RefreshCw size={12} className="text-[#ff8c00]" />
                          <span className="text-[8px] font-black text-white uppercase tracking-widest">Webhook URL</span>
                        </div>
                        {copiedField === 'webhook' ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-gray-500" />}
                      </button>
                    </div>
                  </div>

                  {/* Zalo Link (Moved from Business) */}
                  <div className="space-y-1.5 pt-4 border-t border-white/5">
                    <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">Link Nhóm Zalo Hỗ trợ</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={localSettings.ZALO_GROUP_LINK || ''}
                        placeholder={defaultSettings.ZALO_GROUP_LINK}
                        onChange={(e) => setLocalSettings({...localSettings, ZALO_GROUP_LINK: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00] pr-10"
                      />
                      <Globe size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600" />
                    </div>
                  </div>

                  {/* System Notification (Moved from Business) */}
                  <div className="space-y-3 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <h6 className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Thông báo hệ thống</h6>
                      <button 
                        onClick={() => setLocalSettings({...localSettings, SHOW_SYSTEM_NOTIFICATION: !localSettings.SHOW_SYSTEM_NOTIFICATION})}
                        className={`w-8 h-4 rounded-full relative transition-all ${localSettings.SHOW_SYSTEM_NOTIFICATION ? 'bg-[#ff8c00]' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${localSettings.SHOW_SYSTEM_NOTIFICATION ? 'left-4.5' : 'left-0.5'}`}></div>
                      </button>
                    </div>
                    <textarea 
                      value={localSettings.SYSTEM_NOTIFICATION || ''}
                      placeholder={defaultSettings.SYSTEM_NOTIFICATION}
                      onChange={(e) => setLocalSettings({...localSettings, SYSTEM_NOTIFICATION: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[9px] font-bold text-white outline-none min-h-[60px] resize-none"
                    />
                  </div>

                  <button 
                    onClick={() => handleSaveSettings(['ZALO_GROUP_LINK', 'SYSTEM_NOTIFICATION', 'SHOW_SYSTEM_NOTIFICATION'])}
                    disabled={isSavingSettings}
                    className="w-full bg-[#ff8c00]/10 border border-[#ff8c00]/20 hover:bg-[#ff8c00]/20 text-[#ff8c00] font-black py-3 rounded-xl text-[8px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSavingSettings ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />}
                    LƯU CẤU HÌNH TIỆN ÍCH
                  </button>
                </div>
              )}
            </div>

            {/* 3. Finance & Limits Card */}
            <div className="bg-[#111111] border border-white/5 rounded-3xl p-5 space-y-4">
              <button 
                onClick={() => toggleSection('finance')}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-xl bg-[#ff8c00]/10 flex items-center justify-center">
                      <Wallet size={16} className="text-[#ff8c00]" />
                    </div>
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border-2 border-black animate-pulse"></div>
                  </div>
                  <div className="text-left">
                    <h5 className="text-[9px] font-black text-white uppercase tracking-widest">CHÍNH SÁCH TÀI CHÍNH</h5>
                    <p className="text-[7px] font-bold text-gray-500 uppercase mt-0.5">Phí dịch vụ, Lãi suất & Phân hạng khách hàng</p>
                  </div>
                </div>
                {expandedSections.finance ? <ChevronUp size={14} className="text-[#ff8c00]" /> : <ChevronDown size={14} className="text-gray-600" />}
              </button>

              {expandedSections.finance && (
                <div className="space-y-6 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* Fees & Rates */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">PHÍ DỊCH VỤ (%)</label>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        value={formatNumberWithDots(localSettings.PRE_DISBURSEMENT_FEE)}
                        placeholder={formatNumberWithDots(defaultSettings.PRE_DISBURSEMENT_FEE)}
                        onChange={(e) => setLocalSettings({...localSettings, PRE_DISBURSEMENT_FEE: parseNumberFromDots(e.target.value)})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">PHÍ NÂNG HẠNG (%)</label>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        value={formatNumberWithDots(localSettings.UPGRADE_PERCENT)}
                        placeholder={formatNumberWithDots(defaultSettings.UPGRADE_PERCENT)}
                        onChange={(e) => setLocalSettings({...localSettings, UPGRADE_PERCENT: parseNumberFromDots(e.target.value)})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">TỈ LỆ PHÍ PHẠT (%)</label>
                      <input 
                        type="text" 
                        value={localSettings.FINE_RATE || ''}
                        placeholder={defaultSettings.FINE_RATE}
                        onChange={(e) => setLocalSettings({...localSettings, FINE_RATE: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">HẠN MỨC VAY TỐI ĐA</label>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        value={formatNumberWithDots(localSettings.MAX_SINGLE_LOAN_AMOUNT)}
                        placeholder={formatNumberWithDots(defaultSettings.MAX_SINGLE_LOAN_AMOUNT)}
                        onChange={(e) => setLocalSettings({...localSettings, MAX_SINGLE_LOAN_AMOUNT: parseNumberFromDots(e.target.value)})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">SỐ TIỀN VAY TỐI THIỂU</label>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        value={formatNumberWithDots(localSettings.MIN_LOAN_AMOUNT)}
                        placeholder={formatNumberWithDots(defaultSettings.MIN_LOAN_AMOUNT)}
                        onChange={(e) => setLocalSettings({...localSettings, MIN_LOAN_AMOUNT: parseNumberFromDots(e.target.value)})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">SỐ LẦN GIA HẠN TỐI ĐA</label>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        value={formatNumberWithDots(localSettings.MAX_EXTENSIONS)}
                        placeholder={formatNumberWithDots(defaultSettings.MAX_EXTENSIONS)}
                        onChange={(e) => setLocalSettings({...localSettings, MAX_EXTENSIONS: parseNumberFromDots(e.target.value)})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">PHÍ PHẠT TỐI ĐA (%)</label>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        value={formatNumberWithDots(localSettings.MAX_FINE_PERCENT)}
                        placeholder={formatNumberWithDots(defaultSettings.MAX_FINE_PERCENT)}
                        onChange={(e) => setLocalSettings({...localSettings, MAX_FINE_PERCENT: parseNumberFromDots(e.target.value)})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">NGÂN SÁCH TỐI THIỂU</label>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        value={formatNumberWithDots(localSettings.MIN_SYSTEM_BUDGET)}
                        placeholder={formatNumberWithDots(defaultSettings.MIN_SYSTEM_BUDGET)}
                        onChange={(e) => setLocalSettings({...localSettings, MIN_SYSTEM_BUDGET: parseNumberFromDots(e.target.value)})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">TỔNG VAY TRONG KỲ</label>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        value={formatNumberWithDots(localSettings.MAX_LOAN_PER_CYCLE)}
                        placeholder={formatNumberWithDots(defaultSettings.MAX_LOAN_PER_CYCLE)}
                        onChange={(e) => setLocalSettings({...localSettings, MAX_LOAN_PER_CYCLE: parseNumberFromDots(e.target.value)})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">ĐIỀU KIỆN NÂNG HẠNG</label>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        value={formatNumberWithDots(localSettings.MAX_ON_TIME_PAYMENTS_FOR_UPGRADE)}
                        placeholder={formatNumberWithDots(defaultSettings.MAX_ON_TIME_PAYMENTS_FOR_UPGRADE)}
                        onChange={(e) => setLocalSettings({...localSettings, MAX_ON_TIME_PAYMENTS_FOR_UPGRADE: parseNumberFromDots(e.target.value)})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                      />
                    </div>
                  </div>

                  {/* Rank Config Summary */}
                  <div className="space-y-3 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <h6 className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Cấu hình Hạng thành viên</h6>
                      <button 
                        onClick={handleAddRank}
                        className="w-6 h-6 rounded-lg bg-[#ff8c00]/10 flex items-center justify-center text-[#ff8c00] hover:bg-[#ff8c00]/20 transition-all"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <Reorder.Group 
                      axis="y" 
                      values={localSettings.RANK_CONFIG || []} 
                      onReorder={(newOrder) => setLocalSettings({...localSettings, RANK_CONFIG: newOrder})}
                      className="grid grid-cols-1 gap-3"
                    >
                      {(localSettings.RANK_CONFIG || []).map((rank: any, idx: number) => {
                        const isExpanded = expandedConfigs[`rank_${idx}`];
                        return (
                          <Reorder.Item 
                            key={rank.id || `rank_${idx}`} 
                            value={rank}
                            className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                          >
                            <div 
                              className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-all"
                              onClick={() => toggleConfigExpansion(`rank_${idx}`)}
                            >
                              <div className="flex items-center gap-2">
                                <div className="p-1 cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400">
                                  <GripVertical size={14} />
                                </div>
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: rank.color }}></div>
                                <h6 className="text-[9px] font-black text-white uppercase">{rank.name || 'Hạng mới'}</h6>
                                {rank.maxLimit > 0 && <span className="text-[7px] font-bold text-gray-500 bg-white/5 px-1.5 py-0.5 rounded uppercase">Max: {formatNumberWithDots(rank.maxLimit)}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleRemoveRank(idx); }} 
                                  className="text-red-500/50 hover:text-red-500 transition-all p-1"
                                >
                                  <Trash2 size={12} />
                                </button>
                                {isExpanded ? <ChevronUp size={12} className="text-gray-500" /> : <ChevronDown size={12} className="text-gray-500" />}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="p-3 pt-0 space-y-3 border-t border-white/5 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <label className="text-[6px] font-bold text-gray-500 uppercase px-1">Tên hạng</label>
                                    <input 
                                      type="text"
                                      value={rank.name || ''}
                                      onChange={(e) => handleRankUpdate(idx, 'name', e.target.value)}
                                      className="w-full bg-black/40 border border-white/5 rounded-xl px-2 py-1.5 text-[8px] font-bold text-white outline-none"
                                      placeholder="Tên hạng mới"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[6px] font-bold text-gray-500 uppercase px-1">Hạn mức tối đa</label>
                                    <input 
                                      type="text"
                                      inputMode="numeric"
                                      value={rank.maxLimit ? formatNumberWithDots(rank.maxLimit) : ''}
                                      onChange={(e) => handleRankUpdate(idx, 'maxLimit', parseNumberFromDots(e.target.value))}
                                      className="w-full bg-black/40 border border-white/5 rounded-xl px-2 py-1.5 text-[8px] font-bold text-white outline-none"
                                      placeholder="1.000.000"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[6px] font-bold text-gray-500 uppercase px-1">Chọn Icon Màu (Hạng)</label>
                                  <div className="flex flex-wrap gap-2 p-2 bg-black/20 rounded-xl border border-white/5">
                                    {ICON_COLORS.map((ic) => (
                                      <button
                                        key={ic.color}
                                        type="button"
                                        onClick={() => handleRankUpdate(idx, 'color', ic.color)}
                                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all relative ${rank.color === ic.color ? 'ring-2 ring-[#ff8c00] ring-offset-2 ring-offset-black scale-110 shadow-lg' : 'opacity-60 hover:opacity-100 hover:scale-105'}`}
                                        style={{ backgroundColor: ic.color }}
                                        title={ic.name}
                                      >
                                        <Trophy size={14} className={rank.color === ic.color ? 'text-white' : 'text-white/40'} />
                                        {rank.color === ic.color && (
                                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#ff8c00] rounded-full flex items-center justify-center border border-black">
                                            <Check size={8} className="text-black" />
                                          </div>
                                        )}
                                      </button>
                                    ))}
                                    <div className="w-full mt-1 flex items-center gap-2 border-t border-white/5 pt-2">
                                      <input 
                                        type="color"
                                        value={rank.color}
                                        onChange={(e) => handleRankUpdate(idx, 'color', e.target.value)}
                                        className="w-5 h-5 bg-transparent border-none outline-none cursor-pointer"
                                      />
                                      <span className="text-[7px] font-bold text-gray-500 uppercase">Màu tùy chỉnh: {rank.color}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between px-1">
                                    <label className="text-[6px] font-bold text-gray-500 uppercase">Đặc quyền / Chú thích (ngăn cách bởi dấu phẩy)</label>
                                    <button 
                                      onClick={() => handleRegenerateRankFeatures(idx)}
                                      className="text-[#ff8c00] hover:rotate-180 transition-all duration-500 p-1"
                                      title="Tạo lại ngẫu nhiên"
                                    >
                                      <RefreshCw size={10} />
                                    </button>
                                  </div>
                                  <textarea 
                                    value={rank.features?.join(', ') || ''}
                                    onChange={(e) => handleRankUpdate(idx, 'features', e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl px-2 py-1.5 text-[8px] font-bold text-white outline-none min-h-[40px] resize-none"
                                    placeholder="Hạn mức 1 - 10 triệu, Duyệt lệnh tức thì"
                                  />
                                </div>
                              </div>
                            )}
                          </Reorder.Item>
                        );
                      })}
                    </Reorder.Group>
                  </div>

                  <button 
                    onClick={() => handleSaveSettings(['PRE_DISBURSEMENT_FEE', 'UPGRADE_PERCENT', 'FINE_RATE', 'MAX_SINGLE_LOAN_AMOUNT', 'MIN_LOAN_AMOUNT', 'RANK_CONFIG', 'MAX_EXTENSIONS', 'MAX_FINE_PERCENT', 'MAX_LOAN_PER_CYCLE', 'MIN_SYSTEM_BUDGET', 'MAX_ON_TIME_PAYMENTS_FOR_UPGRADE'])}
                    disabled={isSavingSettings}
                    className="w-full bg-[#ff8c00]/10 border border-[#ff8c00]/20 hover:bg-[#ff8c00]/20 text-[#ff8c00] font-black py-3 rounded-xl text-[8px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSavingSettings ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />}
                    LƯU CẤU HÌNH TÀI CHÍNH
                  </button>
                </div>
              )}
            </div>

            {/* 4. Rewards & Engagement Card */}
            <div className="bg-[#111111] border border-white/5 rounded-3xl p-5 space-y-4">
              <button 
                onClick={() => toggleSection('rewards')}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-xl bg-[#ff8c00]/10 flex items-center justify-center">
                      <Trophy size={16} className="text-[#ff8c00]" />
                    </div>
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-500 rounded-full border-2 border-black animate-pulse"></div>
                  </div>
                  <div className="text-left">
                    <h5 className="text-[9px] font-black text-white uppercase tracking-widest">ƯU ĐÃI & QUÀ TẶNG</h5>
                    <p className="text-[7px] font-bold text-gray-500 uppercase mt-0.5">Khuyến mãi, Vòng quay may mắn & Voucher</p>
                  </div>
                </div>
                {expandedSections.rewards ? <ChevronUp size={14} className="text-[#ff8c00]" /> : <ChevronDown size={14} className="text-gray-600" />}
              </button>

              {expandedSections.rewards && (
                <div className="space-y-5 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Tỉ lệ trúng Voucher (%)</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range" 
                        min="0"
                        max="100"
                        value={localSettings.LUCKY_SPIN_WIN_RATE || '30'}
                        onChange={(e) => setLocalSettings({...localSettings, LUCKY_SPIN_WIN_RATE: e.target.value})}
                        className="flex-1 accent-[#ff8c00]"
                      />
                      <span className="text-[10px] font-black text-[#ff8c00] w-8">{localSettings.LUCKY_SPIN_WIN_RATE}%</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Số lần thanh toán để nhận lượt quay</label>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      value={formatNumberWithDots(localSettings.LUCKY_SPIN_PAYMENTS_REQUIRED)}
                      placeholder={formatNumberWithDots(defaultSettings.LUCKY_SPIN_PAYMENTS_REQUIRED)}
                      onChange={(e) => setLocalSettings({...localSettings, LUCKY_SPIN_PAYMENTS_REQUIRED: parseNumberFromDots(e.target.value)})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h6 className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Mốc Voucher trúng thưởng</h6>
                      <button 
                        onClick={handleAddVoucherMilestone}
                        className="w-6 h-6 rounded-lg bg-[#ff8c00]/10 flex items-center justify-center text-[#ff8c00] hover:bg-[#ff8c00]/20 transition-all"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <Reorder.Group 
                      axis="y" 
                      values={localSettings.LUCKY_SPIN_VOUCHERS || []} 
                      onReorder={(newOrder) => setLocalSettings({...localSettings, LUCKY_SPIN_VOUCHERS: newOrder})}
                      className="grid grid-cols-1 gap-2"
                    >
                      {(localSettings.LUCKY_SPIN_VOUCHERS || []).map((v: any, idx: number) => {
                        const isExpanded = expandedConfigs[`voucher_${idx}`];
                        return (
                          <Reorder.Item 
                            key={v.id || `voucher_${idx}`} 
                            value={v}
                            className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                          >
                            <div 
                              className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-all"
                              onClick={() => toggleConfigExpansion(`voucher_${idx}`)}
                            >
                              <div className="flex items-center gap-2">
                                <div className="p-1 cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400">
                                  <GripVertical size={14} />
                                </div>
                                <div className="w-1.5 h-1.5 rounded-full bg-[#ff8c00]"></div>
                                <h6 className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Mốc {idx + 1}</h6>
                                {v.voucherValue > 0 && <span className="text-[7px] font-bold text-[#ff8c00] bg-[#ff8c00]/10 px-1.5 py-0.5 rounded uppercase">{formatNumberWithDots(v.voucherValue)} đ</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleRemoveVoucherMilestone(idx); }} 
                                  className="text-red-500/50 hover:text-red-500 transition-all p-1"
                                >
                                  <Trash2 size={12} />
                                </button>
                                {isExpanded ? <ChevronUp size={12} className="text-gray-500" /> : <ChevronDown size={12} className="text-gray-500" />}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="p-3 pt-0 space-y-3 border-t border-white/5 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <label className="text-[6px] font-bold text-gray-500 uppercase px-1">Lợi nhuận tối thiểu</label>
                                    <input 
                                      type="text"
                                      inputMode="numeric"
                                      value={v.minProfit ? formatNumberWithDots(v.minProfit) : ''}
                                      onChange={(e) => handleVoucherMilestoneUpdate(idx, 'minProfit', parseNumberFromDots(e.target.value))}
                                      className="w-full bg-black/40 border border-white/5 rounded-xl px-2 py-1.5 text-[8px] font-bold text-white outline-none"
                                      placeholder="1.000.000"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[6px] font-bold text-gray-500 uppercase px-1">Giá trị Voucher</label>
                                    <input 
                                      type="text"
                                      inputMode="numeric"
                                      value={v.voucherValue ? formatNumberWithDots(v.voucherValue) : ''}
                                      onChange={(e) => handleVoucherMilestoneUpdate(idx, 'voucherValue', parseNumberFromDots(e.target.value))}
                                      className="w-full bg-black/40 border border-white/5 rounded-xl px-2 py-1.5 text-[8px] font-bold text-white outline-none"
                                      placeholder="50.000"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </Reorder.Item>
                        );
                      })}
                    </Reorder.Group>
                  </div>

                  <button 
                    onClick={() => handleSaveSettings(['LUCKY_SPIN_VOUCHERS', 'LUCKY_SPIN_WIN_RATE', 'LUCKY_SPIN_PAYMENTS_REQUIRED'])}
                    disabled={isSavingSettings}
                    className="w-full bg-[#ff8c00]/10 border border-[#ff8c00]/20 hover:bg-[#ff8c00]/20 text-[#ff8c00] font-black py-3 rounded-xl text-[8px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSavingSettings ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />}
                    LƯU CẤU HÌNH PHẦN THƯỞNG
                  </button>
                </div>
              )}
            </div>



          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-10 text-center opacity-30">
        <p className="text-[7px] font-black text-gray-500 uppercase tracking-[0.3em]">System Kernel v1.26 PRO</p>
      </div>

      {/* SQL Enable Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-[#111111] border border-white/10 rounded-[32px] p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
            
            <button 
              onClick={() => setShowSqlModal(false)}
              className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-blue-500/10 rounded-3xl flex items-center justify-center text-blue-500 mb-2">
                <Zap size={32} />
              </div>
              
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Kích hoạt Tự động Cập nhật</h3>
              <p className="text-[11px] font-bold text-gray-400 leading-relaxed uppercase tracking-wide">
                Để hệ thống có thể tự động sửa lỗi cơ sở dữ liệu, bạn cần chạy lệnh SQL này một lần duy nhất trong Supabase SQL Editor.
              </p>

              <div className="w-full bg-black border border-white/5 rounded-2xl p-4 mt-4 relative group">
                <pre className="text-[9px] font-mono text-blue-400 overflow-x-auto whitespace-pre-wrap text-left leading-relaxed">
{`CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
RETURNS void AS $$
BEGIN
  EXECUTE sql_query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`}
                </pre>
                <button 
                  onClick={() => copyToClipboard(`CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
RETURNS void AS $$
BEGIN
  EXECUTE sql_query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`, 'rpc_sql')}
                  className="absolute top-3 right-3 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all"
                >
                  {copiedField === 'rpc_sql' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>

              <div className="w-full space-y-3 pt-4">
                <a 
                  href="https://supabase.com/dashboard/project/_/sql" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full bg-blue-600 text-black font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                >
                  Mở Supabase SQL Editor
                  <Globe size={14} />
                </a>
                <button 
                  onClick={() => setShowSqlModal(false)}
                  className="w-full bg-white/5 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup xác nhận Reset hệ thống */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in duration-300">
          <div className="bg-[#111111] border border-red-500/20 w-full max-w-sm rounded-3xl p-6 space-y-6 relative shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-600"></div>
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 bg-red-600/10 rounded-full flex items-center justify-center text-red-600">
                 <AlertCircle size={28} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black text-white uppercase tracking-tighter">RESET HỆ THỐNG?</h3>
                <p className="text-[9px] font-bold text-gray-400 uppercase leading-relaxed px-3">
                  Thao tác này sẽ <span className="text-red-500 font-black">XÓA VĨNH VIỄN</span> toàn bộ khách hàng, lịch sử vay và <span className="text-red-500 font-black">dòng tiền</span>. Ngân sách sẽ quay về <span className="text-white font-black">0 đ</span>.
                </p>
              </div>
            </div>

            <div className="flex gap-2.5">
               <button 
                 onClick={() => setShowResetConfirm(false)}
                 className="flex-1 py-3.5 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-gray-500 uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                 <X size={12} /> HỦY BỎ
               </button>
               <button 
                 onClick={handleResetExecute}
                 className="flex-1 py-3.5 bg-red-600 rounded-xl text-[9px] font-black text-white uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/40"
               >
                 <Check size={12} /> ĐỒNG Ý RESET
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSystem;
