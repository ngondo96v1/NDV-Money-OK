import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LoanRecord, MonthlyStat, AppSettings, BudgetLog, Notification } from '../types';
import { 
  Activity, 
  Wallet, 
  TrendingUp, 
  Users, 
  ClipboardList, 
  LogOut, 
  AlertCircle,
  Clock,
  ShieldAlert,
  RotateCcw,
  RefreshCcw,
  X,
  Check,
  Database,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Zap,
  ShieldCheck,
  History,
  ArrowRight,
  Bell,
  Power,
  Trash2
} from 'lucide-react';
import * as d3 from 'd3';

import DatabaseErrorModal from './DatabaseErrorModal';
import NotificationModal from './NotificationModal';

interface AdminDashboardProps {
  user: User | null;
  loans: LoanRecord[];
  registeredUsersCount: number;
  systemBudget: number;
  rankProfit: number;
  loanProfit: number;
  monthlyStats: MonthlyStat[];
  budgetLogs: BudgetLog[];
  lastKeepAlive: string | null;
  onResetRankProfit: () => void;
  onResetLoanProfit: () => void;
  onNavigateToUsers: () => void;
  onNavigateToBudget: () => void;
  onLogout: () => void;
  onDeleteLog?: (logId: string) => void;
  onRefresh?: () => void;
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  settings: AppSettings;
  notifications: Notification[];
  onMarkNotificationRead: (id: string) => void;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = React.memo(({ 
  user, 
  loans, 
  registeredUsersCount, 
  systemBudget, 
  rankProfit, 
  loanProfit,
  monthlyStats,
  budgetLogs,
  lastKeepAlive,
  onResetRankProfit, 
  onResetLoanProfit,
  onNavigateToUsers,
  onNavigateToBudget,
  onLogout,
  onDeleteLog,
  onRefresh,
  authenticatedFetch,
  settings,
  notifications,
  onMarkNotificationRead,
  onUpdateSettings
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showLoanResetConfirm, setShowLoanResetConfirm] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; message?: string; error?: string } | null>(null);
  const [showDbErrorModal, setShowDbErrorModal] = useState(false);
  const [isCheckingDb, setIsCheckingDb] = useState(false);
  
  const checkDbStatus = async () => {
    setIsCheckingDb(true);
    try {
      const response = await authenticatedFetch('/api/supabase-status');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Server không trả về JSON (Content-Type: ${contentType}). Nội dung: ${text.substring(0, 50)}...`);
      }

      const data = await response.json();
      setDbStatus(data);
      if (!data.connected) {
        setShowDbErrorModal(true);
      }
    } catch (e: any) {
      console.error("Database status check error:", e);
      const errorMsg = `Lỗi kết nối API: ${e.message || 'Lỗi không xác định'}`;
      setDbStatus({ connected: false, error: errorMsg });
      setShowDbErrorModal(true);
    } finally {
      setIsCheckingDb(false);
    }
  };

  useEffect(() => {
    checkDbStatus();
  }, []);

  // Loan Statistics
  const { settledLoans, pendingLoans, activeLoans, overdueLoans } = useMemo(() => {
    const today = new Date();
    return {
      settledLoans: loans.filter(l => l.status === 'ĐÃ TẤT TOÁN'),
      pendingLoans: loans.filter(l => l.status === 'CHỜ DUYỆT' || l.status === 'CHỜ TẤT TOÁN'),
      activeLoans: loans.filter(l => l.status === 'ĐANG NỢ'),
      overdueLoans: loans.filter(l => {
        if ((l.status !== 'ĐANG NỢ' && l.status !== 'CHỜ TẤT TOÁN') || !l.date || typeof l.date !== 'string') return false;
        const [d, m, y] = l.date.split('/').map(Number);
        const dueDate = new Date(y, m - 1, d);
        return dueDate < today;
      })
    };
  }, [loans]);
  
  // Financial Statistics
  const { totalDisbursed, totalCollected, activeDebt, collectionRate } = useMemo(() => {
    const activeStatuses = ['ĐANG NỢ', 'QUÁ HẠN', 'CHỜ TẤT TOÁN', 'ĐANG ĐỐI SOÁT'];
    const disbursed = loans.filter(l => l.status !== 'BỊ TỪ CHỐI' && l.status !== 'CHỜ DUYỆT' && l.status !== 'ĐÃ CỘNG DỒN').reduce((acc, curr) => acc + curr.amount, 0);
    const collected = settledLoans.reduce((acc, curr) => acc + curr.amount, 0);
    const debt = loans
      ? loans.filter((l: any) => activeStatuses.includes(l.status)).reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0)
      : 0;
    const rate = disbursed > 0 ? (collected / disbursed) * 100 : 0;
    return {
      totalDisbursed: disbursed,
      totalCollected: collected,
      activeDebt: debt,
      collectionRate: rate
    };
  }, [loans, settledLoans]);

  const isBudgetAlarm = useMemo(() => systemBudget <= Number(settings.MIN_SYSTEM_BUDGET || 2000000), [systemBudget, settings.MIN_SYSTEM_BUDGET]);
  
  // Capital Statistics
  const capitalStats = useMemo(() => {
    return budgetLogs.reduce((acc, log) => {
      if (log.type === 'INITIAL') {
        acc.initial += log.amount;
      } else if (log.type === 'ADD' || log.type === 'ADJUSTMENT_IN') {
        acc.added += log.amount;
      } else if (log.type === 'WITHDRAW' || log.type === 'ADJUSTMENT_OUT') {
        acc.withdrawn += log.amount;
      }
      return acc;
    }, { initial: 0, added: 0, withdrawn: 0 });
  }, [budgetLogs]);

  const netCapital = capitalStats.initial + capitalStats.added - capitalStats.withdrawn;
  const currentTotalValue = systemBudget + activeDebt;
  const currentTotalProfit = currentTotalValue - netCapital;

  const formatLogNote = (note: string) => {
    if (!note) return 'Giao dịch hệ thống';
    let formattedNote = note;
    
    // Resolve rank IDs in log notes
    if (settings.RANK_CONFIG && settings.RANK_CONFIG.length > 0) {
      settings.RANK_CONFIG.forEach(rank => {
        if (rank.id && rank.name) {
          // Replace both standalone and parenthesized IDs
          formattedNote = formattedNote.replace(new RegExp(`\\(${rank.id}\\)`, 'g'), `(${rank.name})`);
          formattedNote = formattedNote.replace(new RegExp(`Nâng hạng ${rank.id}`, 'gi'), `Nâng hạng ${rank.name}`);
          // Fallback simple replacement if it's just the ID
          if (formattedNote.includes(rank.id) && !formattedNote.includes(rank.name)) {
             formattedNote = formattedNote.replace(rank.id, rank.name);
          }
        }
      });
    }
    return formattedNote;
  };

  const securityAudit = useMemo(() => {
    const issues = [];
    if (settings.JWT_SECRET === 'your-secret-key') issues.push('JWT Secret mặc định');
    if (settings.ADMIN_PASSWORD === 'admin123') issues.push('Mật khẩu Admin mặc định');
    if (!settings.IMGBB_API_KEY || settings.IMGBB_API_KEY.includes('your-imgbb')) issues.push('Chưa cấu hình ImgBB');
    if (!settings.PAYOS_API_KEY) issues.push('Chưa cấu hình PayOS');
    
    const score = 100 - (issues.length * 25);
    return { score, issues };
  }, [settings]);

  const handleConfirmReset = () => {
    onResetRankProfit();
    setShowResetConfirm(false);
  };

  const handleConfirmLoanReset = () => {
    onResetLoanProfit();
    setShowLoanResetConfirm(false);
  };

  const recentLogs = budgetLogs.slice(0, 3);
  
  return (
    <div className="w-full bg-[#0a0a0a] px-5 space-y-6 pt-4 pb-20 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex justify-between items-center px-1 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-[#ff8c00] to-[#ff5f00] rounded-2xl flex items-center justify-center font-black text-black text-sm shadow-xl shadow-orange-500/20">
            NDV
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tighter uppercase leading-none">BIỂU ĐỒ TỔNG QUAN</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em]">Hệ thống bảo mật trực tuyến</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onUpdateSettings({ MAINTENANCE_MODE: !settings.MAINTENANCE_MODE })}
            className={`w-10 h-10 border rounded-xl flex items-center justify-center transition-all active:scale-90 shadow-lg ${
              settings.MAINTENANCE_MODE 
                ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' 
                : 'bg-white/5 border-white/5 text-gray-500 hover:text-yellow-500 hover:bg-yellow-500/10'
            }`}
            title={settings.MAINTENANCE_MODE ? "Tắt bảo trì" : "Bật bảo trì"}
          >
            <Power size={18} />
          </button>

          <button onClick={onLogout} className="w-10 h-10 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-90 shadow-lg">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Security Warning Banner */}
      {securityAudit.score < 100 && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-500">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-tight">Cảnh báo Bảo mật ({securityAudit.score}%)</h4>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Phát hiện {securityAudit.issues.length} vấn đề cần xử lý: {securityAudit.issues.join(', ')}
              </p>
            </div>
          </div>
          <div className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-3 py-1.5 rounded-xl border border-red-500/20">
            Cần xử lý ngay
          </div>
        </motion.div>
      )}

      {/* Capital Management Stats Row */}
      <div className="grid grid-cols-4 gap-2 px-1">
        {[
          { label: 'VỐN ĐẦU', value: capitalStats.initial, color: 'text-blue-400' },
          { label: 'THÊM VỐN', value: capitalStats.added, color: 'text-green-400' },
          { label: 'RÚT VỐN', value: capitalStats.withdrawn, color: 'text-red-400' },
          { label: 'VỐN RÒNG', value: netCapital, color: 'text-white' }
        ].map((item, idx) => (
          <div key={idx} className="bg-[#111111] border border-white/5 rounded-2xl p-2.5 flex flex-col items-center justify-center text-center">
            <p className="text-[6px] font-black text-gray-600 uppercase tracking-widest leading-none mb-1">{item.label}</p>
            <p className={`text-[10px] font-black tracking-tighter ${item.color}`}>
              {item.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Profit Card */}
        <div className="col-span-2 bg-gradient-to-br from-[#111111] to-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 blur-3xl rounded-full -mr-16 -mt-16"></div>
          <div className="relative z-10 flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">TỔNG DOANH THU HỆ THỐNG</p>
              <h3 className="text-3xl font-black text-[#00ffcc] tracking-tighter drop-shadow-[0_0_15px_rgba(0,255,204,0.3)]">
                {(loanProfit + rankProfit).toLocaleString()} <span className="text-xs font-bold text-[#00ffcc]/60 uppercase ml-0.5">VND</span>
              </h3>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1 bg-[#00ffcc]/10 px-2 py-0.5 rounded-full border border-[#00ffcc]/10">
                  <ArrowUpRight size={10} className="text-[#00ffcc]" />
                  <span className="text-[8px] font-black text-[#00ffcc] uppercase tracking-widest">TĂNG TRƯỞNG ỔN ĐỊNH</span>
                </div>
              </div>
            </div>
            
            <div className="bg-black/60 border border-white/10 rounded-2xl p-2.5 shadow-xl backdrop-blur-md flex items-center gap-3">
              <div className="flex flex-col gap-2 pr-3 border-r border-white/10">
                <button 
                  onClick={checkDbStatus}
                  disabled={isCheckingDb}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <Database size={12} className={dbStatus?.connected ? 'text-green-500' : 'text-red-500'} />
                  <span className={`text-[8px] font-black uppercase tracking-widest ${dbStatus?.connected ? 'text-green-500' : 'text-red-500'}`}>
                    {dbStatus?.connected ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  <Clock size={12} className="text-blue-400" />
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">
                    {lastKeepAlive ? new Date(lastKeepAlive).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '00:00'}
                  </span>
                </div>
              </div>
              <div className="text-[#00ffcc] drop-shadow-[0_0_10px_rgba(0,255,204,0.4)]">
                <TrendingUp size={24} />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/5">
            <div className="space-y-1 group">
              <div className="flex items-center gap-1.5 mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
                <div className="w-1.5 h-1.5 bg-[#ff8c00] rounded-full shadow-[0_0_5px_#ff8c00]"></div>
                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">PHÍ & LÃI SUẤT</p>
              </div>
              <p className="text-sm font-black text-white group-hover:text-[#ff8c00] transition-colors">{loanProfit.toLocaleString()} đ</p>
            </div>
            <div className="space-y-1 group">
              <div className="flex items-center gap-1.5 mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full shadow-[0_0_5px_#a855f7]"></div>
                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">DỊCH VỤ NÂNG HẠNG</p>
              </div>
              <p className="text-sm font-black text-white group-hover:text-purple-500 transition-colors">{rankProfit.toLocaleString()} đ</p>
            </div>
          </div>
        </div>

        {/* System Budget Card */}
        <div className="bg-[#111111] border border-white/5 rounded-[2rem] p-5 space-y-4 shadow-xl group hover:border-orange-500/20 transition-all duration-500">
          <div className="flex justify-between items-center">
            <div className="w-9 h-9 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500 border border-orange-500/10">
              <Wallet size={18} />
            </div>
            {isBudgetAlarm && <AlertCircle size={14} className="text-red-500 animate-pulse" />}
          </div>
          <div className="space-y-0.5">
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em]">NGUỒN VỐN LƯU ĐỘNG</p>
            <p className={`text-lg font-black tracking-tight ${isBudgetAlarm ? 'text-red-500' : 'text-white'}`}>
              {systemBudget.toLocaleString()} <span className="text-[10px] opacity-40">đ</span>
            </p>
          </div>
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${isBudgetAlarm ? 'bg-red-500' : 'bg-[#ff8c00] shadow-[0_0_10px_#ff8c00]'}`} 
              style={{ width: `${Math.min(100, (systemBudget / 50000000) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Active Debt Card */}
        <div className="bg-[#111111] border border-white/5 rounded-[2rem] p-5 space-y-4 shadow-xl group hover:border-red-500/20 transition-all duration-500">
          <div className="flex justify-between items-center">
            <div className="w-9 h-9 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500 border border-red-500/10">
              <ShieldAlert size={18} />
            </div>
            <div className="flex items-center gap-1 bg-red-500/10 px-1.5 py-0.5 rounded-md">
              <ArrowDownRight size={8} className="text-red-500" />
              <span className="text-[6px] font-black text-red-500 uppercase">RỦI RO</span>
            </div>
          </div>
          <div className="space-y-0.5">
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em]">DƯ NỢ THỊ TRƯỜNG</p>
            <p className="text-lg font-black text-white tracking-tight">
              {activeDebt.toLocaleString()} <span className="text-[10px] opacity-40">đ</span>
            </p>
          </div>
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-red-500 transition-all duration-1000 shadow-[0_0_10px_#ef4444]" 
              style={{ width: `${Math.min(100, (activeDebt / (totalDisbursed || 1)) * 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Detailed Statistics Section */}
      <div className="bg-[#111111] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#ff8c00]/10 rounded-xl flex items-center justify-center text-[#ff8c00] border border-[#ff8c00]/10">
              <BarChart3 size={18} />
            </div>
            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">BÁO CÁO VẬN HÀNH CHI TIẾT</h3>
          </div>
          <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-full border border-white/10">
            <Users size={10} className="text-[#ff8c00]" />
            <span className="text-[8px] font-black text-white uppercase tracking-widest">{registeredUsersCount} THÀNH VIÊN</span>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Loan Status Breakdown */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">PHÂN TÍCH TRẠNG THÁI KHOẢN VAY</p>
              <div className="flex items-center gap-1 text-blue-400">
                <PieChart size={10} />
                <span className="text-[8px] font-black uppercase tracking-tighter">PHÂN BỔ REAL-TIME</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors group">
                <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
                  <Clock size={16} />
                </div>
                <div>
                  <p className="text-[7px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">CHỜ XỬ LÝ</p>
                  <p className="text-base font-black text-white">{pendingLoans.length}</p>
                </div>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors group">
                <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                  <ShieldAlert size={16} />
                </div>
                <div>
                  <p className="text-[7px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">RỦI RO CAO</p>
                  <p className="text-base font-black text-red-500">{overdueLoans.length}</p>
                </div>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors group">
                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <Activity size={16} />
                </div>
                <div>
                  <p className="text-[7px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">ĐANG LƯU HÀNH</p>
                  <p className="text-base font-black text-white">{activeLoans.length}</p>
                </div>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors group">
                <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center text-green-500 group-hover:scale-110 transition-transform">
                  <Check size={16} />
                </div>
                <div>
                  <p className="text-[7px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">ĐÃ TẤT TOÁN</p>
                  <p className="text-base font-black text-white">{settledLoans.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Efficiency Stats */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <div className="flex justify-between items-end">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">HIỆU SUẤT THU HỒI VỐN</p>
              <div className="flex items-center gap-1 text-green-500">
                <span className="text-[11px] font-black uppercase tracking-tighter">{Math.floor(collectionRate)}</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">CUNG ỨNG VỐN (THỰC)</span>
                </div>
                <span className="text-[10px] font-black text-white">{totalDisbursed.toLocaleString()} đ</span>
              </div>
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">THU HỒI HOÀN TẤT</span>
                </div>
                <span className="text-[10px] font-black text-green-500">{totalCollected.toLocaleString()} đ</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 via-emerald-500 to-green-500 transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                  style={{ width: `${collectionRate}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Recent Budget Activity */}
          {recentLogs.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex justify-between items-center">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">LỊCH SỬ THU / CHI</p>
                <button 
                  onClick={onNavigateToBudget}
                  className="flex items-center gap-1 text-[#ff8c00] active:scale-95 transition-all"
                >
                  <span className="text-[7px] font-black uppercase">Xem tất cả</span>
                  <ArrowRight size={8} />
                </button>
              </div>
              <div className="space-y-2">
                {recentLogs.map((log) => (
                  <div key={log.id} className="bg-black/20 border border-white/5 rounded-xl p-3 flex items-center justify-between group/item">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        log.type === 'ADD' || log.type === 'LOAN_REPAY' || log.type === 'INITIAL' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {log.type === 'ADD' || log.type === 'LOAN_REPAY' || log.type === 'INITIAL' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-white leading-tight">{formatLogNote(log.note)}</p>
                        <p className="text-[6px] font-bold text-gray-500 uppercase mt-0.5">
                          {new Date(log.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • {new Date(log.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className={`text-[10px] font-black ${
                        log.type === 'ADD' || log.type === 'LOAN_REPAY' || log.type === 'INITIAL' ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {log.type === 'ADD' || log.type === 'LOAN_REPAY' || log.type === 'INITIAL' ? '+' : '-'}{log.amount.toLocaleString()}
                      </p>
                      {onDeleteLog && (
                        <button 
                          onClick={() => {
                            if (window.confirm('Bạn có chắc muốn xóa bản ghi này? Hệ thống sẽ hoàn lại số dư tương ứng.')) {
                              onDeleteLog(log.id);
                            }
                          }}
                          className="w-7 h-7 bg-red-500/10 text-red-500 rounded-lg flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity active:scale-90"
                          title="Xóa log"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-5 animate-in fade-in duration-300">
          <div className="bg-[#111111] border border-orange-500/20 w-full max-w-sm rounded-3xl p-6 space-y-6 relative shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-orange-500"></div>
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 bg-orange-500/10 rounded-full flex items-center justify-center text-orange-500">
                 <RotateCcw size={28} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black text-white uppercase tracking-tighter">RESET THỐNG KÊ?</h3>
                <p className="text-[9px] font-bold text-gray-400 uppercase leading-relaxed px-3">
                  Bạn có chắc chắn muốn đặt lại thống kê <span className="text-orange-500">Phí Nâng Hạng</span> về 0? Hành động này không ảnh hưởng đến số dư người dùng.
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
                 onClick={handleConfirmReset}
                 className="flex-1 py-3.5 bg-orange-600 rounded-xl text-[9px] font-black text-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/40"
               >
                 <Check size={12} /> ĐỒNG Ý
               </button>
            </div>
          </div>
        </div>
      )}

      {showLoanResetConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-5 animate-in fade-in duration-300">
          <div className="bg-[#111111] border border-orange-500/20 w-full max-w-sm rounded-3xl p-6 space-y-6 relative shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-orange-500"></div>
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 bg-orange-500/10 rounded-full flex items-center justify-center text-orange-500">
                 <RotateCcw size={28} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black text-white uppercase tracking-tighter">RESET LỢI NHUẬN?</h3>
                <p className="text-[9px] font-bold text-gray-400 uppercase leading-relaxed px-3">
                  Bạn có chắc chắn muốn đặt lại thống kê <span className="text-orange-500">Lợi nhuận từ Phí & Phạt</span> về 0? Hành động này không ảnh hưởng đến số dư người dùng.
                </p>
              </div>
            </div>

            <div className="flex gap-2.5">
               <button 
                 onClick={() => setShowLoanResetConfirm(false)}
                 className="flex-1 py-3.5 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-gray-500 uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                 <X size={12} /> HỦY BỎ
               </button>
               <button 
                 onClick={handleConfirmLoanReset}
                 className="flex-1 py-3.5 bg-orange-600 rounded-xl text-[9px] font-black text-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/40"
               >
                 <Check size={12} /> ĐỒNG Ý
               </button>
            </div>
          </div>
        </div>
      )}

      {showDbErrorModal && dbStatus?.error && (
        <DatabaseErrorModal 
          error={dbStatus.error} 
          onRetry={() => {
            setShowDbErrorModal(false);
            checkDbStatus();
          }} 
          onClose={() => setShowDbErrorModal(false)} 
        />
      )}

    </div>
  );
});

export default AdminDashboard;
