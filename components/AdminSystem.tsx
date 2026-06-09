
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
  Sparkles,
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
import AdminSystemSettingsPanel from './AdminSystemSettingsPanel';

interface AdminSystemProps {
  onReset: () => void;
  onImportSuccess: () => void;
  onBack: () => void;
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  settings: any;
  onSettingsUpdate: (newSettings: any) => void;
  onRefreshData?: () => Promise<void>;
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

const AdminSystem: React.FC<AdminSystemProps> = ({ onReset, onImportSuccess, onBack, authenticatedFetch, settings, onSettingsUpdate, onRefreshData }) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isMigratingUnified, setIsMigratingUnified] = useState(false);
  const [isSyncingFormats, setIsSyncingFormats] = useState(false);
  const [isCheckingOverdueTasks, setIsCheckingOverdueTasks] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'settings'>('settings');
  const [settingsTab, setSettingsTab] = useState<'security_tech' | 'payment_gate' | 'finance_ranks' | 'contracts_formats' | 'gift_rewards' | 'system_utils'>('security_tech');
  const [isCheckingBank, setIsCheckingBank] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // States for Re-establishment (Phương án B)
  const [reEstablishStartDate, setReEstablishStartDate] = useState('2026-07-01');
  const [reEstablishCapital, setReEstablishCapital] = useState<number>(0);
  const [deleteOldLogs, setDeleteOldLogs] = useState(false);
  const [isReEstablishing, setIsReEstablishing] = useState(false);
  const [showReEstablishConfirm, setShowReEstablishConfirm] = useState(false);
  const [showReEstablishModal, setShowReEstablishModal] = useState(false);

  const handleReEstablishExecute = async () => {
    setIsReEstablishing(true);
    try {
      const response = await authenticatedFetch('/api/re-establish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startDate: reEstablishStartDate,
          startingCapital: reEstablishCapital,
          deleteOldLogs
        })
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success(result.message);
        setShowReEstablishModal(false);
        if (onRefreshData) {
          await onRefreshData().catch(e => console.error(e));
        }
        if (onImportSuccess) {
          onImportSuccess(); // Refresh page/state hierarchy
        }
      } else {
        toast.error(result.error || "Không thể xác lập hệ thống");
      }
    } catch (e) {
      toast.error("Lỗi kết nối máy chủ");
    } finally {
      setIsReEstablishing(false);
      setShowReEstablishConfirm(false);
    }
  };
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

  const [isSendingPush, setIsSendingPush] = useState(false);
  const [pushForm, setPushForm] = useState({ title: '', body: '', all: true });

  const handleSendPush = async () => {
    if (!pushForm.title || !pushForm.body) {
      toast.error("Vui lòng nhập tiêu đề và nội dung thông báo");
      return;
    }

    setIsSendingPush(true);
    try {
      const response = await authenticatedFetch('/api/send-push', {
        method: 'POST',
        body: JSON.stringify(pushForm)
      });
      const result = await response.json();
      if (response.ok) {
        toast.success(result.message || "Gửi thông báo thành công!");
        setPushForm({ ...pushForm, title: '', body: '' });
      } else {
        toast.error(result.error || "Gửi thông báo thất bại");
      }
    } catch (e) {
      toast.error("Lỗi kết nối máy chủ");
    } finally {
      setIsSendingPush(false);
    }
  };

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
  "isLocked" BOOLEAN DEFAULT false,
  "lockedAt" TEXT,
  "lockedReason" TEXT,
  "updatedAt" BIGINT,
  "hasCustomLimit" BOOLEAN DEFAULT false,
  "isFreeUpgrade" BOOLEAN DEFAULT false,
  "rankUpgradeDate" TEXT,
  "fcmToken" TEXT
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
    PAYMENT_CONTENT_FULL_SETTLEMENT: '{ID}',
    PAYMENT_CONTENT_PARTIAL_SETTLEMENT: 'TTMP {ID}',
    PAYMENT_CONTENT_EXTENSION: 'GH {ID}',
    PAYMENT_CONTENT_UPGRADE: 'NH {RANK} {ID}',
    CONTRACT_CODE_FORMAT: '{ID}NDV{N}',
    USER_ID_FORMAT: 'US-{RANDOM}',
    LUCKY_SPIN_VOUCHERS: [
      { minProfit: 1000000, voucherValue: 50000 },
      { minProfit: 2000000, voucherValue: 100000 },
      { minProfit: 5000000, voucherValue: 200000 }
    ],
    LUCKY_SPIN_WIN_RATE: '30',
    LUCKY_SPIN_PAYMENTS_REQUIRED: '3',
    MAX_ON_TIME_PAYMENTS_FOR_UPGRADE: '5',
    ENABLE_SIMULATION: true,
    SIMULATION_INTERVAL: '15',
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

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

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
        { id: `i2_${now}`, category: 'ID_FORMAT', originalName: 'Mã HĐ', abbreviation: 'HD', format: '{ID}NDV{N}', systemMeaning: 'contract_original_format' },
        
        // Contract Formats
        { id: `h1_${now}`, category: 'CONTRACT_NEW', originalName: 'HĐ TP', abbreviation: 'H1', format: 'TTMP {HD}', systemMeaning: 'contract_partial_format' },
        { id: `h2_${now}`, category: 'CONTRACT_NEW', originalName: 'HĐ GH', abbreviation: 'H2', format: 'GH {HD}', systemMeaning: 'contract_extension_format' },
        
        // Transfer Contents
        { id: `t1_${now}`, category: 'TRANSFER_CONTENT', originalName: 'CK Full', abbreviation: 'T1', format: '{HD}', systemMeaning: 'transfer_full' },
        { id: `t2_${now}`, category: 'TRANSFER_CONTENT', originalName: 'CK TP', abbreviation: 'T2', format: 'TP {HD}', systemMeaning: 'transfer_partial' },
        { id: `t3_${now}`, category: 'TRANSFER_CONTENT', originalName: 'CK GH', abbreviation: 'T3', format: 'GH {HD}', systemMeaning: 'transfer_extension' },
        { id: `t4_${now}`, category: 'TRANSFER_CONTENT', originalName: 'CK NH', abbreviation: 'T4', format: 'NH {RK} {ID}', systemMeaning: 'transfer_upgrade' },
        { id: `t5_${now}`, category: 'TRANSFER_CONTENT', originalName: 'CK GN', abbreviation: 'T5', format: 'GN {HD}', systemMeaning: 'transfer_disburse' }
      ];

      // 2. Rank Config - Professional Tiers
      const standardRanks = [
        { id: 'bronze', name: 'Hạng Đồng', minLimit: 1000000, maxLimit: 5000000, color: '#cd7f32', features: ['Hạn mức 5 triệu', 'Ưu tiên'] },
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
        'ENABLE_SIMULATION', 'SIMULATION_INTERVAL',
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
          ALTER TABLE users ADD COLUMN IF NOT EXISTS "rankUpgradeDate" TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS "fcmToken" TEXT;
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

  const handleMigrateUnifiedExecute = async () => {
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

  const handleMigrateUnified = () => {
    setConfirmDialog({
      title: "HỢP NHẤT CẤU HÌNH?",
      message: "Bạn có chắc chắn muốn hợp nhất toàn bộ cấu hình? Hệ thống sẽ tự động chuyển đổi dữ liệu cũ sang cấu trúc mới.",
      onConfirm: handleMigrateUnifiedExecute
    });
  };

  const handleSyncFormatsExecute = async () => {
    setIsSyncingFormats(true);
    setMigrationStatus({ type: 'info', message: 'Đang bắt đầu đồng bộ định dạng mã hợp đồng...' });
    try {
      const response = await authenticatedFetch('/api/admin/sync-formats', { method: 'POST' });
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success(result.message);
        setMigrationStatus({ type: 'success', message: result.message });
        if (onRefreshData) {
          await onRefreshData().catch(e => console.error("Lỗi làm mới dữ liệu sau đồng bộ:", e));
        }
      } else {
        const errMsg = result.error || 'Lỗi bất ngờ xảy ra khi đồng bộ';
        toast.error(errMsg);
        setMigrationStatus({ type: 'error', message: errMsg });
      }
    } catch (e: any) {
      toast.error('Lỗi kết nối khi thực hiện đồng bộ');
      setMigrationStatus({ type: 'error', message: e.message || 'Lỗi kết nối máy chủ' });
    } finally {
      setIsSyncingFormats(false);
    }
  };

  const handleSyncFormats = () => {
    setConfirmDialog({
      title: "ĐỒNG BỘ ĐỊNH DẠNG MÃ?",
      message: "Bạn có muốn đồng bộ định dạng mã mới cho tất cả các khoản vay & lịch sử giao dịch hiện tại không? Hành động này sẽ cập nhật toàn bộ cơ sở dữ liệu đồng loạt.",
      onConfirm: handleSyncFormatsExecute
    });
  };

  const handleRunDailyOverdueChecksExecute = async () => {
    setIsCheckingOverdueTasks(true);
    try {
      const response = await authenticatedFetch('/api/admin/run-daily-tasks', { method: 'POST' });
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success(result.message || "Đã rà soát & tự động khóa nợ quá hạn thành công!");
        if (onRefreshData) {
          await onRefreshData().catch(e => console.error("Lỗi làm mới dữ liệu sau đối soát:", e));
        }
      } else {
        toast.error(result.error || 'Lỗi bất ngờ xảy ra khi chạy đối soát');
      }
    } catch (e: any) {
      toast.error('Lỗi kết nối khi gửi yêu cầu đối soát');
    } finally {
      setIsCheckingOverdueTasks(false);
    }
  };

  const handleRunDailyOverdueChecks = () => {
    setConfirmDialog({
      title: "CHẠY ĐỐI SOÁT & KHÓA NỢ QUÁ HẠN?",
      message: "Bạn có muốn khởi chạy hệ thống rà soát kỳ hạn các khoản vay, tự động gửi thông báo sắp đến hạn/quá hạn đến app APK của user và quét tự động KHÓA các tài khoản nợ quá hạn trên 15 ngày ngay lập tức không?",
      onConfirm: handleRunDailyOverdueChecksExecute
    });
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
        <div className="bg-[#111111] border border-white/5 rounded-3xl p-6 mb-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-2.5 mb-5">
            <Database className="text-[#ff8c00]" size={18} />
            <h4 className="text-[10px] font-black text-white uppercase tracking-widest">TRÌNH QUẢN TRỊ DỮ LIỆU</h4>
          </div>

          {/* New Space-Saving Grid of Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            {/* Export */}
            <button 
              onClick={handleExport}
              disabled={isExporting}
              className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50 text-center"
            >
              <div className="w-8 h-8 bg-blue-500/15 rounded-xl flex items-center justify-center text-blue-500">
                {isExporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
              </div>
              <h5 className="text-[9px] font-black text-white uppercase tracking-wider">XUẤT SAO LƯU</h5>
              <p className="text-[6.5px] font-bold text-gray-500 uppercase tracking-tight">Tải cấu hình hệ thống về máy</p>
            </button>

            {/* Import */}
            <button 
              onClick={handleImportClick}
              disabled={isImporting}
              className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50 text-center"
            >
              <div className="w-8 h-8 bg-green-500/15 rounded-xl flex items-center justify-center text-green-500">
                {isImporting ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
              </div>
              <h5 className="text-[9px] font-black text-white uppercase tracking-wider">NHẬP SAO LƯU</h5>
              <p className="text-[6.5px] font-bold text-gray-500 uppercase tracking-tight">Nạp dữ liệu từ file backup</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".json" 
                className="hidden" 
              />
            </button>

            {/* SQL Sync */}
            <button 
              onClick={handleSqlAutoUpdate}
              disabled={isMigratingUnified}
              className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50 text-center"
            >
              <div className="w-8 h-8 bg-cyan-500/15 rounded-xl flex items-center justify-center text-cyan-500">
                {isMigratingUnified ? <Loader2 className="animate-spin" size={16} /> : <Database size={16} />}
              </div>
              <h5 className="text-[9px] font-black text-white uppercase tracking-wider">ĐỒNG BỘ SQL</h5>
              <p className="text-[6.5px] font-bold text-gray-500 uppercase tracking-tight">Chuẩn hóa cấu trúc Database</p>
            </button>

            {/* Format Sync */}
            <button 
              onClick={handleSyncFormats}
              disabled={isSyncingFormats}
              className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50 text-center"
            >
              <div className="w-8 h-8 bg-orange-500/15 rounded-xl flex items-center justify-center text-orange-500">
                {isSyncingFormats ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
              </div>
              <h5 className="text-[9px] font-black text-white uppercase tracking-wider">CHUẨN MÃ HĐ</h5>
              <p className="text-[6.5px] font-bold text-gray-500 uppercase tracking-tight">Đồng bộ chuẩn định dạng mã hợp đồng</p>
            </button>

            {/* Re-establish System Configuration (Phương án B) */}
            <button 
              onClick={() => setShowReEstablishModal(true)}
              className="col-span-2 bg-[#ff8c00]/10 border border-[#ff8c00]/20 rounded-2xl p-4 flex items-center justify-center gap-3 hover:bg-[#ff8c00]/20 active:scale-95 transition-all"
            >
              <div className="w-8 h-8 bg-[#ff8c00]/20 rounded-xl flex items-center justify-center text-[#ff8c00]">
                <Zap size={16} />
              </div>
              <div className="text-left">
                <h5 className="text-[9px] font-black text-white uppercase tracking-wider">XÁC LẬP CHU KỲ MỚI (PHƯƠNG ÁN B)</h5>
                <p className="text-[6.5px] font-bold text-[#ff8c00] uppercase tracking-normal mt-0.5">Xác lập thời điểm bắt đầu và vốn lưu động ban đầu</p>
              </div>
            </button>
          </div>

          {/* Outcome logging / outputs */}
          {migrationStatus && (
            <div className={`mt-4 p-3 rounded-xl border text-[8px] font-bold uppercase tracking-widest flex items-center gap-2 ${
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

          {importMessage && (
            <div className={`mt-4 p-4 rounded-2xl border text-[9px] font-black uppercase tracking-widest flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${
              importMessage.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
            }`}>
              {importMessage.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
              {importMessage.text}
            </div>
          )}
        </div>
      ) : (
        /* Advanced Settings Section */
        <AdminSystemSettingsPanel
          localSettings={localSettings}
          setLocalSettings={setLocalSettings}
          defaultSettings={defaultSettings}
          isSavingSettings={isSavingSettings}
          hasChanges={hasChanges}
          setHasChanges={setHasChanges}
          showAdminPassword={showAdminPassword}
          setShowAdminPassword={setShowAdminPassword}
          isCheckingBank={isCheckingBank}
          setIsCheckingBank={setIsCheckingBank}
          copiedField={copiedField}
          setCopiedField={setCopiedField}
          copyToClipboard={copyToClipboard}
          pushForm={pushForm}
          setPushForm={setPushForm}
          isSendingPush={isSendingPush}
          handleSendPush={handleSendPush}
          expandedConfigs={expandedConfigs}
          toggleConfigExpansion={toggleConfigExpansion}
          handleAddRank={handleAddRank}
          handleRemoveRank={handleRemoveRank}
          handleRankUpdate={handleRankUpdate}
          handleRegenerateRankFeatures={handleRegenerateRankFeatures}
          handleAddVoucherMilestone={handleAddVoucherMilestone}
          handleRemoveVoucherMilestone={handleRemoveVoucherMilestone}
          handleVoucherMilestoneUpdate={handleVoucherMilestoneUpdate}
          handleAddMasterConfig={handleAddMasterConfig}
          handleRemoveMasterConfig={handleRemoveMasterConfig}
          handleMasterConfigUpdate={handleMasterConfigUpdate}
          handleMigrateUnified={handleMigrateUnified}
          handleOneClickSetup={handleOneClickSetup}
          isMigratingUnified={isMigratingUnified}
          isScanning={isScanning}
          handleCheckBankAccount={handleCheckBankAccount}
          setConfirmDialog={setConfirmDialog}
          formatNumberWithDots={formatNumberWithDots}
          parseNumberFromDots={parseNumberFromDots}
          handleSaveSettings={handleSaveSettings}
          sqlSchema={sqlSchema}
          handleRunDailyOverdueChecks={handleRunDailyOverdueChecks}
          isCheckingOverdueTasks={isCheckingOverdueTasks}
        />
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

      {/* Modal Cấu hình Xác lập Hệ thống theo Phương án B */}
      {showReEstablishModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#111111] border border-white/10 w-full max-w-sm rounded-[32px] p-6 space-y-5 relative shadow-2xl overflow-y-auto max-h-[90vh]">
            <button 
              onClick={() => setShowReEstablishModal(false)}
              className="absolute top-5 right-5 text-gray-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
              <div className="w-8 h-8 bg-[#ff8c00]/15 rounded-xl flex items-center justify-center text-[#ff8c00]">
                <Zap size={16} />
              </div>
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-widest">XÁC LẬP HOẠT ĐỘNG</h3>
                <p className="text-[7px] font-bold text-gray-500 uppercase tracking-wider">Thiết lập mốc hoạt động mới</p>
              </div>
            </div>

            {/* Date Input */}
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">NGÀY BẮT ĐẦU HOẠT ĐỘNG</label>
              <input 
                type="date" 
                value={reEstablishStartDate}
                onChange={(e) => setReEstablishStartDate(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl text-white text-xs p-3 focus:border-orange-500 focus:outline-none placeholder-gray-600 font-bold uppercase tracking-widest"
              />
            </div>

            {/* Starting Capital Input */}
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">VỐN LƯU ĐỘNG TIỀM MẶT BAN ĐẦU (ĐỒNG)</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={formatNumberWithDots(reEstablishCapital)}
                  onChange={(e) => setReEstablishCapital(parseNumberFromDots(e.target.value))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl text-white text-xs p-3 pr-10 focus:border-orange-500 focus:outline-none placeholder-gray-600 font-bold"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-gray-500">ĐỒNG</span>
              </div>
              <div className="bg-orange-500/5 p-2 rounded-lg border border-orange-500/10 text-[7px] font-bold text-gray-400 leading-normal uppercase tracking-wider">
                💡 Thực tế hệ thống thu phí dịch vụ trước giải ngân. Đối với các khoản vay ĐANG NỢ hiện hành, khi người dùng thanh toán/tất toán quá hạn trên hệ thống sau ngày {reEstablishStartDate}, toàn bộ vốn gốc thu về sẽ tự động cộng dồn vào quỹ Vốn Lưu Động thực tế!
              </div>
            </div>

            {/* Delete Old Logs Checkbox */}
            <div className="flex items-center gap-3 p-1">
              <input 
                type="checkbox" 
                id="deleteOldLogsCheckboxModal"
                checked={deleteOldLogs}
                onChange={(e) => setDeleteOldLogs(e.target.checked)}
                className="w-4 h-4 rounded border-white/10 text-orange-500 bg-black focus:ring-orange-500 focus:ring-2"
              />
              <label htmlFor="deleteOldLogsCheckboxModal" className="text-[8px] font-black text-gray-300 uppercase tracking-wider cursor-pointer select-none">
                Dọn dẹp lịch sử biến động số dư cũ theo quy tắc hệ thống (&gt;60 ngày)
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setShowReEstablishModal(false)}
                className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-white transition-all active:scale-95"
              >
                HỦY BỎ
              </button>
              <button 
                onClick={() => setShowReEstablishConfirm(true)}
                disabled={isReEstablishing || !reEstablishStartDate}
                className="flex-[1.5] py-3 bg-orange-500 text-black font-black rounded-xl text-[9px] uppercase tracking-widest hover:bg-orange-400 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-orange-950/20 disabled:opacity-50"
              >
                {isReEstablishing ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={11} />}
                XÁC LẬP NGAY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup xác nhận Xác lập Hệ thống theo Phương án B */}
      {showReEstablishConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in duration-300">
          <div className="bg-[#111111] border border-orange-500/20 w-full max-w-sm rounded-[32px] p-6 space-y-6 relative shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-orange-500"></div>
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 bg-orange-500/10 rounded-full flex items-center justify-center text-orange-500 animate-pulse">
                 <AlertCircle size={28} />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-black text-white uppercase tracking-tight">KÍCH HOẠT PHƯƠNG ÁN B?</h3>
                <p className="text-[9px] font-bold text-gray-400 uppercase leading-relaxed px-3">
                  Thời điểm hoạt động mới của toàn bộ tài chính sẽ được thiết lập vào ngày <span className="text-orange-500 font-extrabold">{reEstablishStartDate}</span>.
                </p>
                <p className="text-[8px] font-bold text-gray-500 uppercase leading-relaxed px-2">
                  Toàn bộ các khoản vay <span className="text-white font-extrabold">ĐANG HOẠT ĐỘNG (ĐANG NỢ)</span> vẫn được giữ nguyên không đổi. Hệ thống sẽ bắt đầu thống kê doanh thu và tích vốn lưu động từ các giao dịch phát sinh kể từ ngày này trở đi.
                </p>
              </div>
            </div>

            <div className="flex gap-2.5">
               <button 
                 onClick={() => setShowReEstablishConfirm(false)}
                 className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-gray-500 uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1.5"
               >
                 <X size={11} /> HUỶ BỎ
               </button>
               <button 
                 onClick={handleReEstablishExecute}
                 className="flex-1 py-3 bg-orange-500 text-black rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-orange-950/40"
               >
                 <Check size={11} /> XÁC NHẬN
               </button>
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

      {/* Popup xác nhận tuỳ chỉnh thay thế cho window.confirm bị trình duyệt chặn */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in duration-200">
          <div className="bg-[#111111] border border-[#ff8c00]/30 w-full max-w-sm rounded-3xl p-6 space-y-5 relative shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#ff8c00]"></div>
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 bg-[#ff8c00]/15 rounded-full flex items-center justify-center text-[#ff8c00] animate-pulse">
                <AlertCircle size={24} />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-sm font-black text-white uppercase tracking-wider">{confirmDialog.title}</h4>
                <p className="text-[10px] font-bold text-gray-300 leading-relaxed px-1">
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button 
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-gray-400 hover:text-white uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <X size={11} /> HUỶ BỎ
              </button>
              <button 
                onClick={() => {
                  const onConfirm = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  onConfirm();
                }}
                className="flex-1 py-3 bg-[#ff8c00] rounded-xl text-[9px] font-black text-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1.5 hover:bg-[#ff8c00]/95 shadow-md shadow-[#ff8c00]/10"
              >
                <Check size={11} /> XÁC NHẬN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSystem;
