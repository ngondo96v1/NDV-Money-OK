import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
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
  ShieldOff,
  History,
  ArrowRight,
  Bell,
  Power,
  Trash2,
  Calendar
} from 'lucide-react';
import * as d3 from 'd3';

import DatabaseErrorModal from './DatabaseErrorModal';
import NotificationModal from './NotificationModal';

interface AdminDashboardProps {
  user: User | null;
  loans: LoanRecord[];
  users: User[];
  systemBudget: number;
  rankProfit: number;
  loanProfit: number;
  fineProfit: number;
  monthlyStats: MonthlyStat[];
  budgetLogs: BudgetLog[];
  lastKeepAlive: string | null;
  onResetRankProfit: () => void;
  onResetLoanProfit: () => void;
  onResetFineProfit: () => void;
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
  onSyncStats?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = React.memo(({ 
  user, 
  loans, 
  users, 
  systemBudget, 
  rankProfit, 
  loanProfit,
  fineProfit,
  monthlyStats,
  budgetLogs,
  lastKeepAlive,
  onResetRankProfit, 
  onResetLoanProfit,
  onResetFineProfit,
  onNavigateToUsers,
  onNavigateToBudget,
  onLogout,
  onDeleteLog,
  onRefresh,
  authenticatedFetch,
  settings,
  notifications,
  onMarkNotificationRead,
  onUpdateSettings,
  onSyncStats
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showLoanResetConfirm, setShowLoanResetConfirm] = useState(false);
  const [showFineResetConfirm, setShowFineResetConfirm] = useState(false);
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

  const [tempStartDate, setTempStartDate] = useState<string>(settings.SYSTEM_START_DATE || '');
  const [revenueFilter, setRevenueFilter] = useState<'all' | 'month' | 'year'>('all');

  useEffect(() => {
    if (settings.SYSTEM_START_DATE !== undefined) {
      setTempStartDate(settings.SYSTEM_START_DATE || '');
    }
  }, [settings.SYSTEM_START_DATE]);

  // Helper to parse Vietnam-style date and datetime strings to standard JS Date
  const parseDateString = (str: string | undefined | null): Date | null => {
    if (!str) return null;
    if (typeof str === 'number') return new Date(str);
    const cleaned = str.trim();
    
    // Check if it is a numeric timestamp as a string
    if (/^\d+$/.test(cleaned)) {
      return new Date(parseInt(cleaned, 10));
    }

    // Try standard ISO or browser-native parsing first
    const nativeDate = new Date(cleaned);
    if (!isNaN(nativeDate.getTime()) && cleaned.includes('-')) {
      return nativeDate;
    }

    // Custom parsing utilizing RegExp for various Vietnamese & standard formats
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

  const [chartYear, setChartYear] = useState<number>(new Date().getFullYear());

  const getItemRevenueDate = useCallback((item: any, type: 'loan' | 'user' | 'log'): Date | null => {
    if (type === 'loan') {
      const loan = item as LoanRecord;
      const loanUser = (users || []).find(u => u.id === loan.userId);
      if (loanUser?.isLocked) {
        // Tài khoản bị phong toả chỉ tính doanh thu phí dịch vụ theo ngày giải ngân (createdAt) ban đầu, 
        // không tính theo ngày gia hạn/đến hạn vốn thay đổi và dịch chuyển qua các kỳ sau này.
        if (loan.createdAt) {
          return parseDateString(loan.createdAt);
        }
      }
      if (loan.date) {
        const dueDate = parseDateString(loan.date);
        if (dueDate && !isNaN(dueDate.getTime())) {
          // Trừ đi 1 tháng vì ngày đến hạn là ngày 1 tây của tháng tiếp theo,
          // và phí của khoản vay được thu trước vào tháng trước đó.
          const revDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
          revDate.setMonth(revDate.getMonth() - 1);
          return revDate;
        }
      }
      if (loan.createdAt) {
        return parseDateString(loan.createdAt);
      }
    } else if (type === 'user') {
      const user = item as User;
      if (user.joinDate) {
        return parseDateString(user.joinDate);
      }
    } else if (type === 'log') {
      const log = item as BudgetLog;
      if (log.createdAt) {
        return parseDateString(log.createdAt);
      }
    }
    return null;
  }, [users]);

  const isItemRevenueMatched = useCallback((item: any, type: 'loan' | 'user' | 'log') => {
    if (revenueFilter === 'all') return true;
    const date = getItemRevenueDate(item, type);
    if (!date || isNaN(date.getTime())) return false;

    const now = new Date();
    const targetYear = now.getFullYear();

    if (revenueFilter === 'year') {
      return date.getFullYear() === targetYear;
    } else if (revenueFilter === 'month') {
      return date.getFullYear() === targetYear && date.getMonth() === now.getMonth();
    }
    return true;
  }, [revenueFilter, getItemRevenueDate]);

  const isAfterOrEqualMatch = (itemDateStr: string | undefined | null, boundaryDateStr: string | null) => {
    if (!boundaryDateStr) return true;
    const itemDate = parseDateString(itemDateStr);
    if (!itemDate || isNaN(itemDate.getTime())) return false;
    const boundaryDate = parseDateString(boundaryDateStr);
    if (!boundaryDate || isNaN(boundaryDate.getTime())) return true;
    
    const itemMidnight = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
    const boundaryMidnight = new Date(boundaryDate.getFullYear(), boundaryDate.getMonth(), boundaryDate.getDate());
    return itemMidnight >= boundaryMidnight;
  };

  // Filtered datasets based on selected Start Date
  const filteredLoans = useMemo(() => {
    if (!tempStartDate) return loans;
    const lockedUserIds = new Set((users || []).filter(u => u.isLocked).map(u => u.id));
    return loans.filter(l => {
      // LOẠI LOẠI TRỪ CHO KHOẢN VAY PHONG TOẢ: Luôn giữ lại để tránh bỏ sót
      if (lockedUserIds.has(l.userId)) return true;
      return isAfterOrEqualMatch(l.createdAt || l.date, tempStartDate);
    });
  }, [loans, tempStartDate, users]);

  const filteredUsers = useMemo(() => {
    if (!tempStartDate) return users;
    return users.filter(u => isAfterOrEqualMatch(u.joinDate, tempStartDate));
  }, [users, tempStartDate]);

  const availableYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    loans.forEach(l => {
      let revDate: Date | null = null;
      if (l.date) {
        const dueDate = parseDateString(l.date);
        if (dueDate && !isNaN(dueDate.getTime())) {
          revDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
          revDate.setMonth(revDate.getMonth() - 1);
        }
      }
      if (!revDate && l.createdAt) {
        revDate = parseDateString(l.createdAt);
      }
      if (revDate && !isNaN(revDate.getTime())) {
        years.add(revDate.getFullYear());
      }
    });
    users.forEach(u => {
      const d = parseDateString(u.joinDate);
      if (d && !isNaN(d.getTime())) {
        years.add(d.getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [loans, users]);

  const chartData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: `Thg ${i + 1}`,
      loanRevenue: 0,
      rankRevenue: 0,
      penaltyRevenue: 0,
      total: 0
    }));

    const activeStatuses = ['ĐANG NỢ', 'ĐÃ TẤT TOÁN', 'CHỜ TẤT TOÁN', 'ĐANG ĐỐI SOÁT', 'QUÁ HẠN', 'ĐANG GIẢI NGÂN'];
    const feePercent = Number(settings.PRE_DISBURSEMENT_FEE || 0) / 100;
    const upgradePercent = Number(settings.UPGRADE_PERCENT || 0);

    loans.forEach(loan => {
      const loanUser = users.find(u => u.id === loan.userId);
      if (!loanUser || loanUser.isAdmin || loanUser.phone === 'admin' || !loanUser.phone) return;
      if (loanUser.id === '5444' || loanUser.fullName?.toLowerCase().includes('test')) return;

      let revDate: Date | null = null;
      if (loanUser.isLocked) {
        if (loan.createdAt) {
          revDate = parseDateString(loan.createdAt);
        }
      } else {
        if (loan.date) {
          const dueDate = parseDateString(loan.date);
          if (dueDate && !isNaN(dueDate.getTime())) {
            revDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
            revDate.setMonth(revDate.getMonth() - 1);
          }
        }
        if (!revDate && loan.createdAt) {
          revDate = parseDateString(loan.createdAt);
        }
      }

      if (revDate && !isNaN(revDate.getTime()) && revDate.getFullYear() === chartYear) {
        const m = revDate.getMonth();
        if (activeStatuses.includes(loan.status)) {
          months[m].loanRevenue += (loan.amount * feePercent);
        }
        if ((loan.status === 'ĐÃ TẤT TOÁN' || loan.status === 'CHỜ TẤT TOÁN') && loan.fine) {
          months[m].penaltyRevenue += Math.round((loan.fine || 0) / 1000) * 1000;
        }
      }
    });

    const sortedRanks = settings.RANK_CONFIG ? [...settings.RANK_CONFIG].sort((a, b) => a.maxLimit - b.maxLimit) : [];
    const lowestRankId = sortedRanks.length > 0 ? sortedRanks[0].id : 'bronze';

    users.forEach(u => {
      if (u.isAdmin || u.phone === 'admin' || u.id === 'admin' || !u.phone || u.phone.length < 10) return;
      if (u.id === '5444' || u.fullName?.toLowerCase().includes('test')) return;

      const joinDate = parseDateString(u.joinDate);
      if (joinDate && !isNaN(joinDate.getTime()) && joinDate.getFullYear() === chartYear) {
        const m = joinDate.getMonth();
        if (u.rank && u.rank !== lowestRankId && !u.isFreeUpgrade && u.rankApproved !== false) {
          const rankConf = settings.RANK_CONFIG?.find(r => r.id === u.rank);
          if (rankConf) {
            months[m].rankRevenue += (rankConf.maxLimit * (upgradePercent / 100));
          }
        }
      }
    });

    months.forEach(m => {
      m.total = m.loanRevenue + m.rankRevenue + m.penaltyRevenue;
    });

    return months;
  }, [loans, users, chartYear, settings]);

  const maxTotalRevenue = useMemo(() => {
    const maxVal = Math.max(...chartData.map(d => d.total), 0);
    return maxVal === 0 ? 1000000 : maxVal;
  }, [chartData]);

  const filteredBudgetLogs = useMemo(() => {
    let result = budgetLogs;
    if (tempStartDate) {
      result = result.filter(log => isAfterOrEqualMatch(log.createdAt, tempStartDate));
    }
    if (revenueFilter !== 'all') {
      result = result.filter(log => isItemRevenueMatched(log, 'log'));
    }
    return result;
  }, [budgetLogs, tempStartDate, revenueFilter, isItemRevenueMatched]);

  // Loan Statistics
  const { settledLoans, pendingLoans, activeLoans, overdueLoans, isolatedBadDebt, isolatedBadDebtPrincipal, isolatedBadDebtFine } = useMemo(() => {
    const today = new Date();
    const lockedUserIds = new Set((users || []).filter(u => u.isLocked).map(u => u.id));

    const isolatedLoans = filteredLoans.filter(l => {
      const activeStatuses = ['ĐANG NỢ', 'QUÁ HẠN', 'CHỜ TẤT TOÁN', 'ĐANG ĐỐI SOÁT'];
      return lockedUserIds.has(l.userId) && activeStatuses.includes(l.status);
    });

    return {
      settledLoans: filteredLoans.filter(l => l.status === 'ĐÃ TẤT TOÁN' && l.settlementType !== 'PRINCIPAL' && l.settlementType !== 'PARTIAL'),
      pendingLoans: filteredLoans.filter(l => l.status === 'CHỜ DUYỆT' || l.status === 'CHỜ TẤT TOÁN'),
      activeLoans: filteredLoans.filter(l => l.status === 'ĐANG NỢ' && !lockedUserIds.has(l.userId)),
      overdueLoans: filteredLoans.filter(l => {
        if ((l.status !== 'ĐANG NỢ' && l.status !== 'CHỜ TẤT TOÁN') || !l.date || typeof l.date !== 'string') return false;
        if (lockedUserIds.has(l.userId)) return false; // Exclude locked from regular overdue
        const [d, m, y] = l.date.split('/').map(Number);
        const dueDate = new Date(y, m - 1, d);
        return dueDate < today;
      }),
      isolatedBadDebt: isolatedLoans.reduce((sum, l) => sum + (Number(l.amount) || 0) + (Number(l.fine) || 0), 0),
      isolatedBadDebtPrincipal: isolatedLoans.reduce((sum, l) => sum + (Number(l.amount) || 0), 0),
      isolatedBadDebtFine: isolatedLoans.reduce((sum, l) => sum + (Number(l.fine) || 0), 0)
    };
  }, [filteredLoans, users]);
  
  // Financial Statistics
  const { totalDisbursed, totalCollected, activeDebt, collectionRate } = useMemo(() => {
    const activeStatuses = ['ĐANG NỢ', 'QUÁ HẠN', 'CHỜ TẤT TOÁN', 'ĐANG ĐỐI SOÁT'];
    const lockedUserIds = new Set((users || []).filter(u => u.isLocked).map(u => u.id));

    // A loan is a rollover/extension if its ID contains renewal keywords or originalBaseId points to another loan ID
    const isRollover = (l: LoanRecord) => {
      const idUpper = l.id.toUpperCase();
      return (
        idUpper.includes('GH') || 
        idUpper.includes('TTMP') || 
        (l.originalBaseId && l.originalBaseId !== l.id)
      );
    };

    // Total disbursed counts ONLY the initial/original loan capital dispatched (not renewed rollovers)
    const originalLoans = filteredLoans.filter(l => 
      !isRollover(l) && 
      l.status !== 'BỊ TỪ CHỐI' && 
      l.status !== 'CHỜ DUYỆT' && 
      l.status !== 'ĐÃ CỘNG DỒN' &&
      l.status !== 'ĐÃ HUỶ' &&
      l.status !== 'ĐÃ HỦY'
    );
    const disbursed = originalLoans.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    // Current real active debt in distribution / outstanding (includes any active rollovers)
    const debt = filteredLoans
      ? filteredLoans.filter((l: any) => activeStatuses.includes(l.status) && !lockedUserIds.has(l.userId)).reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0)
      : 0;

    // True collected capital is the initial real money dispersed minus what is still active/outstanding
    const collected = Math.max(0, disbursed - debt);
    
    const rate = disbursed > 0 ? (collected / disbursed) * 100 : 0;
    
    return {
      totalDisbursed: disbursed,
      totalCollected: collected,
      activeDebt: debt,
      collectionRate: rate
    };
  }, [filteredLoans, users]);

  // Precise Dynamic Profits calculation for specified Date range filter
  const { filteredLoanProfit, filteredFineProfit, filteredRankProfit } = useMemo(() => {
    const feePercent = Number(settings.PRE_DISBURSEMENT_FEE || 0) / 100;
    const upgradePercent = Number(settings.UPGRADE_PERCENT || 0);

    let serviceProfit = 0;
    let penaltyProfit = 0;
    const activeStatuses = ['ĐANG NỢ', 'ĐÃ TẤT TOÁN', 'CHỜ TẤT TOÁN', 'ĐANG ĐỐI SOÁT', 'QUÁ HẠN', 'ĐANG GIẢI NGÂN'];
    
    // Báo cáo doanh thu mặc định hiển thị toàn bộ hệ thống, lọc chính xác theo bộ chọn Tháng/Năm
    const targetLoans = filteredLoans;

    targetLoans.forEach(loan => {
      const loanUser = users.find(u => u.id === loan.userId);
      if (!loanUser || loanUser.isAdmin || loanUser.phone === 'admin' || !loanUser.phone) return;
      if (loanUser.id === '5444' || loanUser.fullName?.toLowerCase().includes('test')) return;

      const isRevenueFilterMatched = isItemRevenueMatched(loan, 'loan');
      if (!isRevenueFilterMatched) return;

      if (tempStartDate) {
        // Chỉ giới hạn phí dịch vụ phát sinh từ ngày giải ngân (revDate) của giai đoạn hoạt động mới
        const revDate = getItemRevenueDate(loan, 'loan');
        const revDateStr = revDate ? revDate.toISOString().split('T')[0] : null;
        const isFeeInPeriod = revDateStr ? isAfterOrEqualMatch(revDateStr, tempStartDate) : false;
        
        // Chỉ giới hạn tiền phạt phát sinh từ ngày tất toán (settledAt) hoặc ngày hiện hành của giai đoạn hoạt động mới
        const settledDateStr = loan.settledAt || loan.updatedAt ? new Date(loan.settledAt || Number(loan.updatedAt || Date.now())).toISOString().split('T')[0] : null;
        const isSettledInPeriod = settledDateStr ? isAfterOrEqualMatch(settledDateStr, tempStartDate) : false;
        
        if (activeStatuses.includes(loan.status) && isFeeInPeriod) {
          serviceProfit += (loan.amount * feePercent);
        }
        if ((loan.status === 'ĐÃ TẤT TOÁN' || loan.status === 'CHỜ TẤT TOÁN') && loan.fine && isSettledInPeriod) {
          penaltyProfit += Math.round((loan.fine || 0) / 1000) * 1000;
        }
      } else {
        if (activeStatuses.includes(loan.status)) {
          serviceProfit += (loan.amount * feePercent);
        }
        if ((loan.status === 'ĐÃ TẤT TOÁN' || loan.status === 'CHỜ TẤT TOÁN') && loan.fine) {
          penaltyProfit += Math.round((loan.fine || 0) / 1000) * 1000;
        }
      }
    });

    let rProfit = 0;
    const sortedRanks = settings.RANK_CONFIG ? [...settings.RANK_CONFIG].sort((a, b) => a.maxLimit - b.maxLimit) : [];
    const lowestRankId = sortedRanks.length > 0 ? sortedRanks[0].id : 'bronze';

    const targetUsers = filteredUsers;

    targetUsers.forEach(u => {
      if (u.isAdmin || u.phone === 'admin' || u.id === 'admin' || !u.phone || u.phone.length < 10) return;
      if (u.id === '5444' || u.fullName?.toLowerCase().includes('test')) return;

      const isRevenueFilterMatched = isItemRevenueMatched(u, 'user');
      if (!isRevenueFilterMatched) return;

      if (u.rank && u.rank !== lowestRankId && !u.isFreeUpgrade && u.rankApproved !== false) {
        const rankConf = settings.RANK_CONFIG?.find(r => r.id === u.rank);
        if (rankConf) {
          rProfit += (rankConf.maxLimit * (upgradePercent / 100));
        }
      }
    });

    return {
      filteredLoanProfit: serviceProfit,
      filteredFineProfit: penaltyProfit,
      filteredRankProfit: rProfit
    };
  }, [revenueFilter, filteredLoans, filteredUsers, settings, isItemRevenueMatched, getItemRevenueDate, tempStartDate, users]);

  const isBudgetAlarm = useMemo(() => systemBudget <= Number(settings.MIN_SYSTEM_BUDGET || 2000000), [systemBudget, settings.MIN_SYSTEM_BUDGET]);
  
  // Capital Statistics - ALWAYS computed from the unfiltered list of budgetLogs 
  // to ensure that global capital indicators (Vốn đầu, Thêm vốn, Rút vốn, Vốn ròng) 
  // and system profit (currentTotalProfit) remain mathematically stable and accurate 
  // even when looking at a specific date sub-range for other details.
  const capitalStats = useMemo(() => {
    return budgetLogs.reduce((acc, log) => {
      if (log.type === 'INITIAL') {
        acc.initial += log.amount;
      } else if (log.type === 'ADD') {
        acc.added += log.amount;
      } else if (log.type === 'WITHDRAW') {
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
    
    const score = issues.length === 0 ? 100 : Math.max(0, 100 - (issues.length * 33));
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

  const handleConfirmFineReset = () => {
    onResetFineProfit();
    setShowFineResetConfirm(false);
  };


  return (
    <div className="w-full bg-[#0a0a0a] px-5 space-y-6 pt-4 pb-20 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex items-center justify-between gap-4 px-1 mb-2">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 bg-gradient-to-br from-[#ff8c00] to-[#ff5f00] rounded-xl flex items-center justify-center font-black text-black text-xs shadow-xl shadow-orange-500/20 shrink-0">
            NDV
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-white tracking-widest uppercase leading-none">TỔNG QUAN</h2>
            <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mt-1">HỆ THỐNG NDV MONEY</p>
          </div>
        </div>
        
        {/* Actions Row */}
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={() => onUpdateSettings({ MAINTENANCE_MODE: !settings.MAINTENANCE_MODE })}
            className={`w-9 h-9 border rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0 shadow-lg ${
              settings.MAINTENANCE_MODE 
                ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' 
                : 'bg-white/5 border-white/5 text-gray-500 hover:text-yellow-500 hover:bg-yellow-500/10'
            }`}
            title={settings.MAINTENANCE_MODE ? "Tắt bảo trì" : "Bật bảo trì"}
          >
            <Power size={14} />
          </button>

          <button onClick={onLogout} className="w-9 h-9 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-95 shrink-0 shadow-lg" title="Thoát">
            <LogOut size={14} />
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

      {/* Unified Stats Card */}
      <div className="bg-[#111111] border border-white/5 rounded-[2.5rem] p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 blur-3xl rounded-full -mr-16 -mt-16"></div>
        <div className="relative z-10 space-y-5">
          {/* 1. TỔNG THU */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 w-full">
              <div>
                <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">TỔNG THU</p>
                <h3 className="text-2xl font-black text-[#00ffcc] tracking-tight drop-shadow-[0_0_15px_rgba(0,255,204,0.15)] select-all">
                  {(filteredLoanProfit + filteredFineProfit + filteredRankProfit).toLocaleString()}
                  <span className="text-xs font-black text-[#00ffcc]/60 uppercase ml-1 align-middle">VND</span>
                </h3>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5 text-left">
                <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">PHÍ DỊCH VỤ</p>
                <p className="text-[10px] sm:text-xs font-black text-amber-500">{filteredLoanProfit.toLocaleString()}đ</p>
              </div>
              <div className="space-y-0.5 text-center">
                <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">TIỀN PHẠT</p>
                <p className="text-[10px] sm:text-xs font-black text-red-500">{filteredFineProfit.toLocaleString()}đ</p>
              </div>
              <div className="space-y-0.5 text-right">
                <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">NÂNG HẠNG</p>
                <p className="text-[10px] sm:text-xs font-black text-violet-400">{filteredRankProfit.toLocaleString()}đ</p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.04]"></div>

          {/* 2. VỐN LƯU & DƯ NỢ */}
          <div className="grid grid-cols-3 gap-4 items-center">
            {/* Left column: Vốn lưu */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-orange-500/10 rounded-xl flex items-center justify-center text-[#ff9f0a] border border-orange-500/20 shrink-0">
                <Wallet size={15} />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-[8px] font-black text-[#ff8c00]/80 uppercase tracking-[0.2em] mb-0.5">VỐN LƯU</p>
                  {isBudgetAlarm && <AlertCircle size={11} className="text-[#ff3b30] animate-pulse shrink-0" />}
                </div>
                <h4 className={`text-xs sm:text-sm font-black tracking-tight whitespace-nowrap ${isBudgetAlarm ? 'text-[#ff3b30]' : 'text-[#ff9f0a]'}`}>{systemBudget.toLocaleString()}đ</h4>
              </div>
            </div>
            {/* Center column: Blank placeholder (aligns under TIỀN PHẠT) */}
            <div></div>
            {/* Right column: Dư nợ */}
            <div className="text-right space-y-0.5">
              <p className="text-[8px] font-black text-emerald-500/80 uppercase tracking-[0.2em] mb-0.5">DƯ NỢ</p>
              <h4 className="text-xs sm:text-sm font-black text-emerald-400 tracking-tight whitespace-nowrap">{activeDebt.toLocaleString()}đ</h4>
            </div>
          </div>

          <div className="border-t border-white/[0.04]"></div>

          {/* 3. NỢ KHÓA */}
          <div className="grid grid-cols-3 gap-4 items-center">
            {/* Left column: Nợ khóa gốc */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-red-600/10 rounded-xl flex items-center justify-center text-red-500 border border-red-600/20 shrink-0">
                <ShieldOff size={15} />
              </div>
              <div>
                <p className="text-[8px] font-black text-red-500 uppercase tracking-[0.2em] mb-0.5">NỢ KHÓA GỐC</p>
                <h4 className="text-xs sm:text-sm font-black text-red-500 tracking-tight whitespace-nowrap">{isolatedBadDebtPrincipal.toLocaleString()}đ</h4>
              </div>
            </div>
            {/* Center column: Blank placeholder (aligns under TIỀN PHẠT) */}
            <div></div>
            {/* Right column: Phạt tích lũy */}
            <div className="text-right space-y-0.5">
              <p className="text-[8px] font-black text-amber-500 uppercase tracking-[0.2em] mb-0.5">PHẠT TÍCH LŨY</p>
              <h4 className="text-xs sm:text-sm font-black text-amber-400 tracking-tight whitespace-nowrap">{isolatedBadDebtFine.toLocaleString()}đ</h4>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BIỂU ĐỒ DOANH THU 12 THÁNG */}
      <div className="bg-[#111111] border border-white/5 rounded-[2.5rem] p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffc300]/5 blur-3xl rounded-full -mr-16 -mt-16"></div>
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#00ffcc]/10 rounded-xl flex items-center justify-center text-[#00ffcc] border border-[#00ffcc]/10">
                <BarChart3 size={18} />
              </div>
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] leading-none">BIỂU ĐỒ DOANH THU</h3>
                <p className="text-[7px] font-black text-gray-500 uppercase tracking-widest mt-1">THỐNG KÊ 12 THÁNG TRONG NĂM</p>
              </div>
            </div>

            {/* Year Selector Dropdown for Chart */}
            <div className="flex items-center gap-1.5 shrink-0 select-none">
              <select
                value={chartYear}
                onChange={(e) => {
                  setChartYear(Number(e.target.value));
                  toast.success(`Đã chọn thống kê năm ${e.target.value}`);
                }}
                className="bg-[#1c1c1e] text-[9px] font-black uppercase tracking-widest text-[#00ffcc] border border-[#00ffcc]/20 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-[#00ffcc] focus:ring-1 focus:ring-[#00ffcc]/30 transition-all cursor-pointer shadow-md [color-scheme:dark]"
              >
                {availableYears.map(yr => (
                  <option key={yr} value={yr} className="bg-[#111111] text-white">NĂM {yr}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Core Chart Grid Area */}
          <div className="mt-4 pt-6 pb-2 px-1 rounded-2xl bg-black/10 border border-white/[0.02]">
            <div className="h-44 w-full flex items-end gap-[4%] px-2">
              {chartData.map((data, index) => {
                const heightPct = maxTotalRevenue > 0 ? (data.total / maxTotalRevenue) * 100 : 0;
                // Minimum height of 3% if total > 0 so that there's always a visual indicator
                const finalHeight = data.total > 0 ? Math.max(heightPct, 3) : 0;

                return (
                  <div key={data.month} className="flex-1 flex flex-col items-center group relative h-full justify-end cursor-pointer">
                    {/* Tooltip Content on Hover */}
                    <div className="absolute bottom-full mb-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 z-50 text-left bg-[#1a1a1e] border border-white/10 p-2.5 rounded-xl shadow-xl w-36 -translate-y-1">
                      <p className="text-[8px] font-black text-white mb-1.5 uppercase border-b border-white/10 pb-1">{data.month} / {chartYear}</p>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[7px] font-black">
                          <span className="text-gray-400">PHÍ DỊCH VỤ:</span>
                          <span className="text-amber-500">{data.loanRevenue.toLocaleString()}đ</span>
                        </div>
                        <div className="flex justify-between items-center text-[7px] font-black">
                          <span className="text-gray-400">TIỀN PHẠT:</span>
                          <span className="text-red-500">{data.penaltyRevenue.toLocaleString()}đ</span>
                        </div>
                        <div className="flex justify-between items-center text-[7px] font-black">
                          <span className="text-gray-400">NÂNG HẠNG:</span>
                          <span className="text-violet-400">{data.rankRevenue.toLocaleString()}đ</span>
                        </div>
                        <div className="flex justify-between items-center text-[8px] font-black pt-1 border-t border-white/[0.05] mt-1 text-[#00ffcc]">
                          <span>TỔNG THU:</span>
                          <span>{data.total.toLocaleString()}đ</span>
                        </div>
                      </div>
                    </div>

                    {/* Revenue Text Overlay Above the Bar */}
                    {data.total > 0 && (
                      <span className="text-[6px] sm:text-[7px] font-black text-[#00ffcc] mb-1 select-none whitespace-nowrap">
                        {(data.total / 1000).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}k
                      </span>
                    )}

                    {/* Interactive Bar */}
                    <div className="w-full rounded-t-md relative overflow-hidden transition-all duration-300 group-hover:brightness-125" style={{ height: `${finalHeight}%` }}>
                      {/* Background Gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#ff8c00]/60 via-[#ff0055]/70 to-[#00ffcc] shadow-[0_0_10px_rgba(0,255,204,0.1)]"></div>
                      {/* Active Hover Glow Accent */}
                      <div className="absolute inset-x-0 top-0 h-1.5 bg-white opacity-0 group-hover:opacity-40 transition-opacity"></div>
                    </div>

                    {/* Month Label */}
                    <span className="mt-2 text-[7px] font-black text-gray-500 group-hover:text-white transition-colors uppercase tracking-wider">{data.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dynamic Highlights / Stat Banner below Chart */}
          <div className="grid grid-cols-2 gap-3 mt-1 pt-1">
            <div className="bg-black/20 border border-white/5 rounded-xl p-2.5">
              <p className="text-[7px] font-black text-gray-500 uppercase tracking-widest">TỔNG DOANH THU NĂM {chartYear}</p>
              <h4 className="text-xs font-black text-[#00ffcc] mt-0.5 select-all">
                {chartData.reduce((sum, m) => sum + m.total, 0).toLocaleString()}đ
              </h4>
            </div>
            <div className="bg-black/20 border border-white/5 rounded-xl p-2.5">
              <p className="text-[7px] font-black text-gray-500 uppercase tracking-widest">TRUNG BÌNH THÁNG</p>
              <h4 className="text-xs font-black text-amber-500 mt-0.5 select-all">
                {Math.round(chartData.reduce((sum, m) => sum + m.total, 0) / 12).toLocaleString()}đ
              </h4>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}

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
