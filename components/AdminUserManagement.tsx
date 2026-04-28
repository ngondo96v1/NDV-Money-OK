// Admin management component for users and loans
import React, { useState, useMemo, useCallback } from 'react';
import { User as UserType, LoanRecord, AppSettings } from '../types';
import { 
  Search, 
  User, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  TrendingUp, 
  Hash, 
  Phone, 
  ImageIcon,
  Users,
  MapPin,
  Calendar,
  ChevronLeft,
  FileText,
  CheckCircle2,
  Briefcase,
  Clock,
  Eye,
  Coins,
  ArrowDownToLine,
  AlertTriangle,
  ChevronRight,
  History,
  Camera,
  Trash2,
  X,
  AlertCircle,
  RefreshCcw,
  CheckCircle,
  XCircle,
  Landmark,
  Copy,
  Check,
  Maximize2,
  Download,
  MessageSquare,
  ExternalLink,
  Award,
  Pencil
} from 'lucide-react';
import ContractModal from './ContractModal';
import { BANK_BINS } from '../constants';
import { generatePaymentContent, calculateFine } from '../utils';

interface AdminUserManagementProps {
  users: UserType[];
  loans: LoanRecord[];
  isGlobalProcessing: boolean;
  onAction: (userId: string, action: 'APPROVE_RANK' | 'REJECT_RANK') => Promise<void> | void;
  onLoanAction: (loanId: string, action: 'APPROVE' | 'DISBURSE' | 'SETTLE' | 'REJECT', reason?: string) => Promise<void> | void;
  onEditUser: (userId: string, updatedData: Partial<UserType>) => Promise<void>;
  onResetPassword: (userId: string) => Promise<void>;
  onEditLoan: (loanId: string, updatedData: Partial<LoanRecord>) => Promise<void>;
  onDeleteUser: (userId: string) => void;
  onDeleteLoan: (loanId: string) => void;
  onAutoCleanup: () => Promise<number>;
  onFetchFullData?: () => Promise<void>;
  onRefresh?: () => void;
  onBack: () => void;
  settings: AppSettings;
  
  // Server-side props
  totalUsers?: number;
  totalLoans?: number;
  onSearchUsers?: (term: string) => void;
  onSearchLoans?: (term: string) => void;
  onFetchUserDetail?: (userId: string) => void;
  userRange?: { from: number, to: number };
  loanRange?: { from: number, to: number };
  onSetUserRange?: (range: { from: number, to: number }) => void;
  onSetLoanRange?: (range: { from: number, to: number }) => void;
}

const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ 
  users, loans, isGlobalProcessing, onAction, onLoanAction, onEditUser, onResetPassword, onEditLoan, 
  onDeleteUser, onDeleteLoan, onAutoCleanup, onFetchFullData, onRefresh, onBack, settings,
  totalUsers = 0, totalLoans = 0, onSearchUsers, onSearchLoans, onFetchUserDetail, userRange, onSetUserRange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const [filterPendingOnly, setFilterPendingOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<'NONE' | 'LOAN_ASC' | 'LOAN_DESC'>('NONE');
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // Reset to page 1 when searching or changing filters
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterPendingOnly, sortOrder]);

  const [showAllLoansAdmin, setShowAllLoansAdmin] = useState<Record<string, boolean>>({});
  const [selectedContract, setSelectedContract] = useState<{ loan: LoanRecord, owner: UserType } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteLoanId, setConfirmDeleteLoanId] = useState<string | null>(null);
  const [confirmResetPasswordId, setConfirmResetPasswordId] = useState<string | null>(null);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [cleanupResultCount, setCleanupResultCount] = useState<number | null>(null);
  const [rejectingLoanId, setRejectingLoanId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSubSections, setExpandedSubSections] = useState<Record<string, Record<string, boolean>>>({});

  // Manual Edit States
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [editingLoan, setEditingLoan] = useState<LoanRecord | null>(null);
  const [editUserForm, setEditUserForm] = useState({ rank: '', totalLimit: 0, hasCustomLimit: false });
  const [editLoanForm, setEditLoanForm] = useState({ status: '', amount: 0, date: '', fine: 0 });

  // Manual Edit Helpers
  const formatNumberWithDots = (val: number | string) => {
    if (val === undefined || val === null || val === '') return '';
    const str = typeof val === 'string' ? val.replace(/\D/g, '') : val.toString();
    const num = parseInt(str);
    return isNaN(num) ? '' : num.toLocaleString('vi-VN');
  };

  const parseNumberFromDots = (val: string) => {
    return parseInt(val.replace(/\./g, '')) || 0;
  };

  const toHtmlDate = (dateStr: string) => {
    if (!dateStr || !dateStr.includes('/')) return '';
    const parts = dateStr.split('/');
    if (parts.length !== 3) return '';
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  };

  const fromHtmlDate = (dateStr: string) => {
    if (!dateStr || !dateStr.includes('-')) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getUserNotificationCount = useCallback((userId: string) => {
    const user = users.find(u => u.id === userId);
    const userLoans = loans.filter(l => l.userId === userId);
    
    let count = 0;
    // Include 'ĐÃ DUYỆT' because it needs 'DISBURSE' (Giải ngân)
    // Include 'CHỜ TẤT TOÁN' because it needs 'SETTLE' (Xác nhận tất toán)
    // Include 'CHỜ DUYỆT' because it needs 'APPROVE' (Duyệt vay)
    count += userLoans.filter(l => 
      l.status === 'CHỜ DUYỆT' || 
      l.status === 'ĐÃ DUYỆT' || 
      l.status === 'CHỜ TẤT TOÁN'
    ).length;
    
    if (user?.pendingUpgradeRank && user?.rankUpgradeBill) count += 1;
    
    return count;
  }, [users, loans]);

  const getLatestActivity = useCallback((userId: string) => {
    const user = users.find(u => u.id === userId);
    const userLoans = loans.filter(l => l.userId === userId);
    const loanUpdates = userLoans.map(l => l.updatedAt || 0);
    return Math.max(user?.updatedAt || 0, ...loanUpdates, 0);
  }, [users, loans]);

  const getUserLoanValue = useCallback((userId: string) => {
    const userLoans = loans.filter(l => 
      l.userId === userId && 
      ['ĐANG NỢ', 'CHỜ DUYỆT', 'ĐÃ DUYỆT', 'ĐANG GIẢI NGÂN', 'CHỜ TẤT TOÁN', 'ĐANG ĐỐI SOÁT'].includes(l.status)
    );
    return userLoans.reduce((sum, l) => sum + l.amount, 0);
  }, [loans]);

  // Handle Search with debounce or immediate trigger
  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    if (onSearchUsers) {
      onSearchUsers(val);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.phone.includes(searchTerm) ||
        u.id.includes(searchTerm);
      
      if (!matchesSearch) return false;
      if (filterPendingOnly) return getUserNotificationCount(u.id) > 0;
      return true;
    }).sort((a, b) => {
      // 1. If sorting by loan value explicitly
      if (sortOrder === 'LOAN_ASC') {
        const valA = getUserLoanValue(a.id);
        const valB = getUserLoanValue(b.id);
        if (valA !== valB) return valA - valB;
      } else if (sortOrder === 'LOAN_DESC') {
        const valA = getUserLoanValue(a.id);
        const valB = getUserLoanValue(b.id);
        if (valA !== valB) return valB - valA;
      }

      // 2. Priority by notification count (including loans needing action)
      const countA = getUserNotificationCount(a.id);
      const countB = getUserNotificationCount(b.id);
      if (countA !== countB) return countB - countA;

      // 3. Priority by latest activity (newest first)
      const activityA = getLatestActivity(a.id);
      const activityB = getLatestActivity(b.id);
      if (activityA !== activityB) return activityB - activityA;

      // 4. Fallback to name
      return a.fullName.localeCompare(b.fullName);
    });
  }, [users, searchTerm, filterPendingOnly, sortOrder, getUserNotificationCount, getLatestActivity, getUserLoanValue]);

  const itemsPerPage = 5;
  const totalPages = useMemo(() => Math.ceil(filteredUsers.length / itemsPerPage), [filteredUsers.length, itemsPerPage]);
  const displayedUsers = useMemo(() => filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [filteredUsers, currentPage, itemsPerPage]);

  const isUserBadDebt = (userId: string) => {
    const userLoans = loans.filter(l => l.userId === userId && (l.status === 'ĐANG NỢ' || l.status === 'CHỜ TẤT TOÁN'));
    const today = new Date();
    return userLoans.some(l => {
      if (!l.date || typeof l.date !== 'string') return false;
      const [d, m, y] = l.date.split('/').map(Number);
      const dueDate = new Date(y, m - 1, d);
      return dueDate < today;
    });
  };

  const getRankName = (rankId: string) => {
    const rankConf = settings.RANK_CONFIG?.find(r => r.id === rankId);
    if (rankConf) return rankConf.name.toUpperCase();
    
    switch(rankId) {
      case 'standard': return 'TIÊU CHUẨN';
      case 'bronze': return 'HẠNG ĐỒNG';
      case 'silver': return 'HẠNG BẠC';
      case 'gold': return 'HẠNG VÀNG';
      case 'diamond': return 'KIM CƯƠNG';
      default: return rankId.toUpperCase();
    }
  };

  const getStatusStyles = (status: string, isOverdue: boolean) => {
    if (isOverdue) return 'bg-red-500/20 text-red-500';
    switch (status) {
      case 'CHỜ DUYỆT': return 'bg-amber-400/10 text-amber-400';
      case 'ĐÃ DUYỆT': return 'bg-indigo-400/10 text-indigo-400';
      case 'ĐANG GIẢI NGÂN': return 'bg-sky-400/10 text-sky-400';
      case 'ĐANG NỢ': return 'bg-orange-500/10 text-orange-500';
      case 'CHỜ TẤT TOÁN': return 'bg-purple-400/10 text-purple-400';
      case 'ĐÃ TẤT TOÁN': return 'bg-emerald-500/10 text-emerald-500';
      case 'BỊ TỪ CHỐI': return 'bg-rose-500/10 text-rose-500';
      case 'ĐANG ĐỐI SOÁT': return 'bg-fuchsia-400/10 text-fuchsia-400';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const [loanCurrentPage, setLoanCurrentPage] = useState<{[key: string]: number}>({});
  const loanItemsPerPage = 5;

  const handleToggleUser = (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
    } else {
      setExpandedUserId(userId);
      // Fetch full details if not already present (e.g. missing idFront)
      const u = users.find(user => user.id === userId);
      if (onFetchUserDetail && u && !u.idFront) {
        onFetchUserDetail(userId);
      }
    }
  };

  const toggleShowAllLoans = (userId: string) => {
    setShowAllLoansAdmin(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleDeleteConfirm = () => {
    if (confirmDeleteId) {
      onDeleteUser(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  };

  const handleDeleteLoanConfirm = () => {
    if (confirmDeleteLoanId) {
      onDeleteLoan(confirmDeleteLoanId);
      setConfirmDeleteLoanId(null);
    }
  };

  const handleCleanupConfirm = async () => {
    const count = await onAutoCleanup();
    setCleanupResultCount(count);
    setShowCleanupConfirm(false);
  };

  const toggleSubSection = (userId: string, section: string) => {
    setExpandedSubSections(prev => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {}),
        [section]: !(prev[userId]?.[section])
      }
    }));
  };

  const isSubSectionExpanded = (userId: string, section: string) => {
    return !!(expandedSubSections[userId]?.[section]);
  };

  return (
    <div className="w-full bg-[#0a0a0a] px-5 pb-10 animate-in fade-in duration-500 flex flex-col h-screen overflow-hidden">
      <div className="flex items-center justify-between pt-6 mb-5 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 bg-[#16161a] border border-white/5 rounded-full flex items-center justify-center text-white active:scale-90">
            <ChevronLeft size={18} />
          </button>
          <h1 className="text-xl font-black text-white uppercase tracking-tighter">QUẢN LÝ KHÁCH HÀNG</h1>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowCleanupConfirm(true)}
            className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-1.5 hover:bg-white/10 transition-colors active:scale-95"
            title="Dọn dẹp tự động (60 ngày)"
          >
             <RefreshCcw size={12} className="text-[#ff8c00]" />
             <span className="text-[8px] font-black text-white uppercase tracking-widest">Dọn dẹp</span>
          </button>
        </div>
      </div>

      <div className="relative mb-6 shrink-0">
        <div className="relative flex items-center bg-[#111111] border border-white/5 rounded-2xl focus-within:border-white/20 transition-all p-1">
          <div className="absolute left-4 text-gray-600 pointer-events-none">
            <Search size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Tìm Tên, Số Zalo hoặc ID..." 
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1 bg-transparent py-4 pl-12 pr-4 text-xs font-bold text-white placeholder-gray-600 focus:outline-none"
          />
          
          <div className="flex items-center gap-1.5 pr-1">
            <div className="flex bg-black/40 rounded-xl overflow-hidden p-0.5 border border-white/5">
              <button 
                onClick={() => setSortOrder(sortOrder === 'LOAN_DESC' ? 'NONE' : 'LOAN_DESC')}
                title="Giá trị cao nhất"
                className={`w-10 h-10 flex items-center justify-center transition-all rounded-lg ${sortOrder === 'LOAN_DESC' ? 'bg-[#ff8c00] text-black shadow-[0_0_15px_rgba(255,140,0,0.3)]' : 'text-gray-500 hover:text-white font-medium'}`}
              >
                <div className="flex flex-col items-center">
                  <ChevronDown size={18} />
                  <span className="text-[6px] font-black uppercase tracking-tighter mt-[-4px]">MAX</span>
                </div>
              </button>
              <button 
                onClick={() => setSortOrder(sortOrder === 'LOAN_ASC' ? 'NONE' : 'LOAN_ASC')}
                title="Giá trị thấp nhất"
                className={`w-10 h-10 flex items-center justify-center transition-all rounded-lg ${sortOrder === 'LOAN_ASC' ? 'bg-[#ff8c00] text-black shadow-[0_0_15px_rgba(255,140,0,0.3)]' : 'text-gray-500 hover:text-white font-medium'}`}
              >
                <div className="flex flex-col items-center">
                  <ChevronUp size={18} />
                  <span className="text-[6px] font-black uppercase tracking-tighter mt-[-4px]">MIN</span>
                </div>
              </button>
            </div>

            <button 
              onClick={() => setFilterPendingOnly(!filterPendingOnly)}
              title="Chờ duyệt"
              className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center relative border ${filterPendingOnly ? 'bg-[#ff8c00] border-[#ff8c00] text-black shadow-[0_0_15px_rgba(255,140,0,0.3)]' : 'bg-black/40 border-white/5 text-gray-500'}`}
            >
              <Clock size={18} />
              {users.filter(u => getUserNotificationCount(u.id) > 0).length > 0 && !filterPendingOnly && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#111111] animate-pulse"></div>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-2 mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <Users size={12} className="text-gray-600" />
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
            ĐANG HIỂN THỊ {users.length} / {totalUsers} KHÁCH HÀNG
          </span>
        </div>
        {users.length < totalUsers && (
          <button 
            onClick={() => {
              if (onSetUserRange && userRange) {
                onSetUserRange({ ...userRange, to: userRange.to + 50 });
              }
            }}
            className="text-[9px] font-black text-[#ff8c00] uppercase tracking-widest flex items-center gap-1 hover:underline underline-offset-4"
          >
            TẢI THÊM <ArrowDownToLine size={10} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3">
        {displayedUsers.map((u) => {
          const notificationCount = getUserNotificationCount(u.id);
          const isExpanded = expandedUserId === u.id;
          const userLoans = [...loans]
            .filter(l => l.userId === u.id && l.status !== 'ĐÃ CỘNG DỒN')
            .sort((a, b) => {
              // Status priority mapping (lower number = higher priority)
              const getPriority = (status: string) => {
                switch (status) {
                  case 'CHỜ DUYỆT': return 1;
                  case 'CHỜ TẤT TOÁN': return 2;
                  case 'ĐÃ DUYỆT': return 3;
                  case 'ĐANG GIẢI NGÂN': return 4;
                  case 'ĐANG NỢ': return 5;
                  case 'ĐANG ĐỐI SOÁT': return 6;
                  case 'ĐÃ TẤT TOÁN': return 10;
                  case 'BỊ TỪ CHỐI': return 11;
                  default: return 7;
                }
              };

              const priorityA = getPriority(a.status);
              const priorityB = getPriority(b.status);

              if (priorityA !== priorityB) {
                return priorityA - priorityB;
              }
              
              // If same priority, sort by updatedAt descending
              if (a.updatedAt !== b.updatedAt) {
                return (b.updatedAt || 0) - (a.updatedAt || 0);
              }

              // Fallback to parsing createdAt
              const parseCreatedAt = (str: string) => {
                try {
                  const [time, date] = str.split(' ');
                  const [h, m, s] = time.split(':').map(Number);
                  const [d, mo, y] = date.split('/').map(Number);
                  return new Date(y, mo - 1, d, h, m, s).getTime();
                } catch (e) {
                  return 0;
                }
              };
              return parseCreatedAt(b.createdAt) - parseCreatedAt(a.createdAt);
            });
          const badDebt = isUserBadDebt(u.id);
          const userLoanPage = loanCurrentPage[u.id] || 1;
          const totalLoanPages = Math.ceil(userLoans.length / loanItemsPerPage);
          const displayedUserLoans = userLoans.slice((userLoanPage - 1) * loanItemsPerPage, userLoanPage * loanItemsPerPage);

          const disbursedLoans = userLoans.filter(l => 
            ['ĐANG NỢ', 'CHỜ TẤT TOÁN', 'ĐANG GIẢI NGÂN', 'ĐANG ĐỐI SOÁT'].includes(l.status)
          );
          const tongThucThu = disbursedLoans.reduce((sum, l) => sum + l.amount + (l.fine || 0), 0);
          
          const pendingRank = settings.RANK_CONFIG?.find(r => r.id === u.pendingUpgradeRank);
          const upgradePercent = Number(settings.UPGRADE_PERCENT) || 10;
          const upgradeAmount = pendingRank ? Math.round(pendingRank.maxLimit * (upgradePercent / 100)) : 0;

          return (
            <div key={u.id} className={`bg-[#111111] border rounded-3xl overflow-hidden relative shadow-lg transition-all ${badDebt ? 'border-red-600/50 ring-1 ring-red-600/20' : 'border-white/5'}`}>
              <div 
                onClick={() => handleToggleUser(u.id)}
                className="cursor-pointer active:bg-white/[0.01] transition-all"
              >
                <div className="p-4 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      onClick={(e) => {
                        if (u.avatar) {
                          e.stopPropagation();
                          setZoomImage(u.avatar);
                        }
                      }}
                      className={`w-11 h-11 bg-[#1a1a1e] rounded-xl flex items-center justify-center text-gray-500 border border-white/5 relative overflow-hidden ${u.avatar ? 'cursor-zoom-in' : ''}`}
                    >
                      {u.avatar ? (
                        <img src={u.avatar} className="w-full h-full object-cover" alt="Avatar" referrerPolicy="no-referrer" />
                      ) : (
                        <User size={20} className={isExpanded ? 'text-[#ff8c00]' : ''} />
                      )}
                      {notificationCount > 0 && (
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center border-2 border-[#111111] shadow-lg">
                          <span className="text-[9px] font-black text-white">{notificationCount}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <h3 className="text-sm font-black text-white tracking-tight uppercase leading-none">{u.fullName}</h3>
                        {badDebt && (
                          <div className="flex items-center gap-1 bg-red-600 px-1.5 py-0.5 rounded-md animate-pulse">
                            <AlertTriangle size={8} className="text-white" />
                            <span className="text-[7px] font-black text-white uppercase tracking-tighter">NỢ XẤU</span>
                          </div>
                        )}
                      </div>
                      <p className="text-[8px] font-bold text-gray-600 tracking-widest uppercase">MÃ KHÁCH: {u.id}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-gray-500">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                <div className="mx-3 mb-3 bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between shadow-inner">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center text-gray-600">
                      <Coins size={18} />
                    </div>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">TỔNG THỰC THU:</span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-white tracking-tight leading-none mb-1">{tongThucThu.toLocaleString()} đ</p>
                    <p className="text-[6px] font-black text-gray-600 uppercase tracking-tighter">
                      (GỐC + PHẠT TRÊN DƯ NỢ)
                    </p>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-8 space-y-8 animate-in slide-in-from-top-2 duration-300">
                  {/* 1. Quick Actions & Important Alerts */}
                  {(u.pendingUpgradeRank && u.rankUpgradeBill) && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 px-1">
                        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
                        <h4 className="text-[9px] font-black text-orange-500 uppercase tracking-[0.2em]">YÊU CẦU NÂNG HẠNG</h4>
                      </div>
                      <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-4 space-y-4">
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                               <ShieldCheck size={18} className="text-[#ff8c00]" />
                               <div>
                                  <h4 className="text-[9px] font-black text-[#ff8c00] uppercase tracking-widest">Nâng hạng</h4>
                                  <p className="text-xs font-black text-white uppercase">{getRankName(u.pendingUpgradeRank!)}</p>
                               </div>
                            </div>
                            <div className="text-right">
                               <h4 className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-none">Số tiền nâng hạng</h4>
                               <p className="text-xs font-black text-white mt-1">{upgradeAmount.toLocaleString()} đ</p>
                            </div>
                         </div>
                         <div className="aspect-video w-full bg-black rounded-xl border border-white/5 overflow-hidden group/img relative cursor-zoom-in" onClick={() => u.rankUpgradeBill && setZoomImage(u.rankUpgradeBill)}>
                            <img src={u.rankUpgradeBill!} className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" alt="Upgrade bill" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                                <Maximize2 size={20} />
                              </div>
                            </div>
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (isGlobalProcessing) return;
                                await onAction(u.id, 'APPROVE_RANK');
                              }} 
                              disabled={isGlobalProcessing}
                              className={`py-3.5 bg-[#ff8c00] text-black font-black text-[9px] uppercase rounded-lg flex items-center justify-center gap-1.5 ${isGlobalProcessing ? 'opacity-50' : ''}`}
                            >
                              {isGlobalProcessing ? 'Đang xử lý...' : 'Duyệt hạng'}
                            </button>
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (isGlobalProcessing) return;
                                await onAction(u.id, 'REJECT_RANK');
                              }} 
                              disabled={isGlobalProcessing}
                              className={`py-3.5 bg-white/5 border border-white/10 text-gray-500 font-black text-[9px] uppercase rounded-lg ${isGlobalProcessing ? 'opacity-50' : ''}`}
                            >
                              {isGlobalProcessing ? '...' : 'Từ chối'}
                            </button>
                         </div>
                      </div>
                    </div>
                  )}

                  {/* 2. Unified Information Dashboard (Bento Style) */}
                  <div className="space-y-4">
                    <button 
                      onClick={() => toggleSubSection(u.id, 'PROFILE')}
                      className="w-full flex items-center justify-between px-1 hover:bg-white/5 py-2 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-gray-500 group-hover:text-[#ff8c00] transition-colors" />
                        <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] group-hover:text-white transition-colors">HỒ SƠ KHÁCH HÀNG</h4>
                      </div>
                      <div className={`transition-transform duration-300 ${isSubSectionExpanded(u.id, 'PROFILE') ? 'rotate-180' : ''}`}>
                        <ChevronDown size={14} className="text-gray-600" />
                      </div>
                    </button>

                    {isSubSectionExpanded(u.id, 'PROFILE') && (
                      <div className="bg-black/30 border border-white/5 rounded-2xl p-5 space-y-6 shadow-inner animate-in slide-in-from-top-2 duration-300">
                        {/* Header actions for profile */}
                        <div className="flex justify-end gap-2 mb-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingUser(u);
                              setEditUserForm({ rank: u.rank, totalLimit: u.totalLimit, hasCustomLimit: u.hasCustomLimit || false });
                            }}
                            className="w-8 h-8 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center text-blue-500 hover:bg-blue-500/20 transition-all"
                            title="Sửa thông tin"
                          >
                            <Pencil size={12} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmResetPasswordId(u.id);
                            }}
                            className="w-8 h-8 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-500/20 transition-all"
                            title="Reset mật khẩu về 111111"
                          >
                            <RefreshCcw size={12} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(u.id);
                            }}
                            className="w-8 h-8 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500/20 transition-all"
                            title="Xóa khách hàng"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        {/* Personal Info Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-6 gap-x-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5"><ShieldCheck size={11} className="text-[#ff8c00]/60" /><p className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Hạng</p></div>
                            <p className="text-[11px] font-black text-[#ff8c00] uppercase pt-0.5">{getRankName(u.rank)}</p>
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5"><TrendingUp size={11} className="text-[#ff8c00]/60" /><p className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Hạn mức</p></div>
                            <p className="text-[11px] font-black text-white pt-0.5">{(u.totalLimit || 0).toLocaleString()} đ</p>
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5"><Hash size={11} className="text-[#ff8c00]/60" /><p className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Số CCCD</p></div>
                            <p className="text-[11px] font-black text-white pt-0.5">{u.idNumber}</p>
                          </div>
                          <div className="space-y-0.5 col-span-1">
                            <div className="flex items-center gap-1.5"><Phone size={11} className="text-[#ff8c00]/60" /><p className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Zalo / SĐT</p></div>
                            <div className="flex items-center gap-2 pt-0.5">
                              <p className="text-[11px] font-black text-white">{u.phone}</p>
                              <a href={`https://zalo.me/${u.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400"><ExternalLink size={10} /></a>
                            </div>
                          </div>
                          <div className="space-y-0.5 col-span-1">
                            <div className="flex items-center gap-1.5"><Users size={11} className="text-[#ff8c00]/60" /><p className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Người tham chiếu</p></div>
                            <div className="flex items-center gap-2 pt-0.5 overflow-hidden">
                              <p className="text-[11px] font-black text-white truncate">{u.refZalo || 'CHƯA CÓ'}</p>
                              {u.refZalo && <a href={`https://zalo.me/${u.refZalo.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-400"><ExternalLink size={10} /></a>}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5"><RefreshCcw size={11} className="text-[#ff8c00]/60" /><p className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Gia nhập</p></div>
                            <p className="text-[10px] font-black text-gray-400 pt-0.5">{u.joinDate || '--'}</p>
                          </div>
                          <div className="space-y-0.5 col-span-2">
                            <div className="flex items-center gap-1.5"><MapPin size={11} className="text-[#ff8c00]/60" /><p className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Địa chỉ thường trú</p></div>
                            <p className="text-[11px] font-black text-white pt-1 leading-tight line-clamp-1">{u.address || 'CHƯA CẬP NHẬT'}</p>
                          </div>
                        </div>

                        {/* CCCD Documents */}
                        <div className="grid grid-cols-2 gap-3 pt-6 border-t border-white/5">
                          <div className="space-y-2">
                            <p className="text-[7px] font-black text-gray-600 uppercase tracking-widest mb-1.5 px-0.5">Mặt trước CCCD</p>
                            <div className="aspect-[16/10] w-full bg-black rounded-xl border border-white/5 overflow-hidden group/img relative cursor-zoom-in" onClick={() => u.idFront && setZoomImage(u.idFront)}>
                              {u.idFront ? (
                                <>
                                  <img src={u.idFront} className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" alt="Front" referrerPolicy="no-referrer" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                    <Maximize2 size={16} className="text-white" />
                                  </div>
                                </>
                              ) : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={16} className="text-gray-800" /></div>}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[7px] font-black text-gray-600 uppercase tracking-widest mb-1.5 px-0.5">Mặt sau CCCD</p>
                            <div className="aspect-[16/10] w-full bg-black rounded-xl border border-white/5 overflow-hidden group/img relative cursor-zoom-in" onClick={() => u.idBack && setZoomImage(u.idBack)}>
                              {u.idBack ? (
                                <>
                                  <img src={u.idBack} className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" alt="Back" referrerPolicy="no-referrer" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                    <Maximize2 size={16} className="text-white" />
                                  </div>
                                </>
                              ) : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={16} className="text-gray-800" /></div>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Unified Loan Management Section */}
                  <div className="space-y-4">
                    <button 
                      onClick={() => toggleSubSection(u.id, 'LOANS')}
                      className="w-full flex items-center justify-between px-1 hover:bg-white/5 py-2 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <Briefcase size={14} className="text-gray-500 group-hover:text-[#ff8c00] transition-colors" />
                        <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] group-hover:text-white transition-colors">CÁC KHOẢN VAY ({userLoans.length})</h4>
                      </div>
                      <div className={`transition-transform duration-300 ${isSubSectionExpanded(u.id, 'LOANS') ? 'rotate-180' : ''}`}>
                        <ChevronDown size={14} className="text-gray-600" />
                      </div>
                    </button>

                    {isSubSectionExpanded(u.id, 'LOANS') && (
                      <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                        {userLoans.length > loanItemsPerPage && (
                          <div className="flex justify-end gap-2 mb-2 pr-1">
                            <button 
                              disabled={userLoanPage <= 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                setLoanCurrentPage(prev => ({...prev, [u.id]: userLoanPage - 1}));
                              }}
                              className="w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center disabled:opacity-20 hover:text-[#ff8c00] transition-colors border border-white/5"
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <div className="flex items-center px-3 bg-white/5 rounded-lg border border-white/5">
                              <span className="text-[8px] font-black text-white">{userLoanPage} / {totalLoanPages}</span>
                            </div>
                            <button 
                              disabled={userLoanPage >= totalLoanPages}
                              onClick={(e) => {
                                e.stopPropagation();
                                setLoanCurrentPage(prev => ({...prev, [u.id]: userLoanPage + 1}));
                              }}
                              className="w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center disabled:opacity-20 hover:text-[#ff8c00] transition-colors border border-white/5"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        )}

                        <div className="space-y-4">
                          {userLoans.length === 0 ? (
                            <div className="bg-black/20 border border-dashed border-white/10 rounded-2xl py-12 text-center">
                              <History size={24} className="mx-auto text-gray-800 mb-3" />
                              <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Chưa có lịch sử giao dịch</p>
                            </div>
                          ) : (
                            displayedUserLoans.map(loan => {
                           const [d, m, y] = (loan.date && typeof loan.date === 'string') ? loan.date.split('/').map(Number) : [0, 0, 0];
                           const todayNow = new Date();
                           todayNow.setHours(0, 0, 0, 0);
                           const isOverdue = (loan.status === 'ĐANG NỢ' || loan.status === 'CHỜ TẤT TOÁN') && d !== 0 && new Date(y, m - 1, d) < todayNow;
                           const statusStyles = getStatusStyles(loan.status, isOverdue);

                           return (
                             <div key={loan.id} className={`bg-black/40 border rounded-2xl p-4 space-y-4 shadow-inner ${isOverdue ? 'border-red-600/30 ring-1 ring-red-600/10' : 'border-white/5'}`}>
                                <div className="flex justify-between items-start">
                                   <div className="flex-1">
                                      <div className="flex items-center gap-1.5 mb-0.5">
                                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{loan.id}</p>
                                        <button onClick={() => setSelectedContract({ loan, owner: u })} className="w-5 h-5 bg-white/5 rounded-md flex items-center justify-center text-gray-500 hover:text-[#ff8c00]"><Eye size={12} /></button>
                                      </div>
                                       <h4 className="text-base font-black text-white leading-none">{loan.amount.toLocaleString()} đ</h4>
                                       {loan.loanPurpose && (
                                         <div className="mt-1 flex items-center gap-1">
                                           <span className="text-[7px] font-black text-gray-600 uppercase">Mục đích:</span>
                                           <span className="text-[8px] font-black text-gray-400 uppercase">{loan.loanPurpose}</span>
                                         </div>
                                       )}
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                      <div className="flex items-center gap-2">
                                        <div className={`px-2.5 py-1 rounded-lg text-[7px] font-black uppercase flex items-center gap-1 ${statusStyles}`}>
                                          {isOverdue ? 'QUÁ HẠN' : loan.status}
                                          {loan.status === 'CHỜ TẤT TOÁN' && (
                                            <span className={`px-1 rounded text-[6px] ml-1 ${
                                              loan.settlementType === 'ALL' ? 'bg-green-500 text-white' : 
                                              (loan.settlementType === 'PARTIAL' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white')
                                            }`}>
                                              {loan.settlementType === 'PRINCIPAL' ? 'GH' : (loan.settlementType === 'PARTIAL' ? 'TTMP' : 'TT')}
                                            </span>
                                          )}
                                        </div>
                                        <button 
                                          onClick={() => {
                                            setEditingLoan(loan);
                                            setEditLoanForm({ status: loan.status, amount: loan.amount, date: loan.date || '', fine: loan.fine || 0 });
                                          }}
                                          className="w-6 h-6 bg-white/5 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-500 border border-white/5 transition-colors"
                                          title="Sửa khoản vay"
                                        >
                                          <Pencil size={12} />
                                        </button>
                                        <button 
                                          onClick={() => setConfirmDeleteLoanId(loan.id)}
                                          className="w-6 h-6 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500/20 transition-all"
                                          title="Xóa khoản vay"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                      {/* Accurate dynamic fine calculation for Admin visibility */}
                                      {(() => {
                                        const fineRateVal = Number(settings.FINE_RATE || 0.1) / 100;
                                        const maxPercentVal = Number(settings.MAX_FINE_PERCENT || 30);
                                        const calculatedFineVal = (loan.status === 'ĐANG NỢ' || loan.status === 'CHỜ TẤT TOÁN' || loan.status === 'ĐANG GIẢI NGÂN') 
                                          ? calculateFine(loan.amount, loan.date || '', fineRateVal, maxPercentVal)
                                          : 0;
                                        const currentFineVal = Math.max(calculatedFineVal, loan.fine || 0);
                                        
                                        return (currentFineVal > 0 || isOverdue) && (
                                          <div className="flex flex-col items-end">
                                            <p className="text-[6px] font-black text-red-500/60 uppercase tracking-widest leading-none mb-1">Phí + Phạt quá hạn</p>
                                            <div className="bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                                              <p className="text-[10px] font-black text-red-500 tracking-tighter">{currentFineVal.toLocaleString()} đ</p>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                </div>

                                {loan.status === 'CHỜ TẤT TOÁN' && (
                                  <div className={`space-y-2.5 border rounded-xl p-3 ${
                                    loan.settlementType === 'ALL' ? 'bg-green-500/5 border-green-500/20' : 
                                    (loan.settlementType === 'PARTIAL' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-blue-500/5 border-blue-500/20')
                                  }`}>
                                     <div className="flex items-center justify-between">
                                       <div className={`flex items-center gap-1.5 ${
                                         loan.settlementType === 'ALL' ? 'text-green-500' : 
                                         (loan.settlementType === 'PARTIAL' ? 'text-amber-500' : 'text-blue-500')
                                       }`}><ImageIcon size={12} /><span className="text-[8px] font-black uppercase tracking-widest">Bill {loan.settlementType === 'PRINCIPAL' ? 'Gia hạn' : (loan.settlementType === 'PARTIAL' ? 'Tất toán 1 phần' : 'Tất toán')}</span></div>
                                       {loan.bankTransactionId && (
                                         <div className="flex items-center gap-1.5 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                                           <span className="text-[7px] font-black text-blue-400 uppercase tracking-tighter">Mã GD: {loan.bankTransactionId}</span>
                                           <button 
                                             onClick={() => handleCopy(loan.bankTransactionId || '', 'tx' + loan.id)}
                                             className="text-blue-400 hover:text-white"
                                           >
                                             <Copy size={8} />
                                           </button>
                                         </div>
                                       )}
                                     </div>

                                     {/* Expected Amount Display */}
                                     <div className="flex items-center justify-between px-1 py-1 border-b border-blue-500/10">
                                       <span className="text-[8px] font-black text-gray-500 uppercase">Số tiền thực trả:</span>
                                       <span className="text-xs font-black text-blue-400">
                                         {(() => {
                                           let amount = 0;
                                           if (loan.settlementType === 'PRINCIPAL') {
                                             amount = Math.round((loan.amount * (Number(settings.PRE_DISBURSEMENT_FEE) / 100)) + (loan.fine || 0));
                                           } else if (loan.settlementType === 'PARTIAL') {
                                             const pAmt = loan.partialAmount || 0;
                                             amount = Math.round(pAmt + ((loan.amount - pAmt) * (Number(settings.PRE_DISBURSEMENT_FEE) / 100)) + (loan.fine || 0));
                                           } else {
                                             amount = Math.round(loan.amount + (loan.fine || 0));
                                           }
                                           
                                           // Subtract voucher if any
                                           if (loan.voucherId && u.vouchers) {
                                             const v = u.vouchers.find(v => v.id === loan.voucherId);
                                             if (v) amount = Math.max(0, amount - v.amount);
                                           }
                                           
                                           return amount.toLocaleString();
                                         })()} đ
                                       </span>
                                     </div>

                                     {loan.voucherId && (
                                       <div className="flex items-center justify-between px-1 py-1 border-b border-blue-500/10">
                                         <span className="text-[8px] font-black text-amber-500 uppercase">Voucher đã dùng:</span>
                                         <span className="text-[10px] font-black text-amber-500">
                                           {(() => {
                                             const v = u.vouchers?.find(v => v.id === loan.voucherId);
                                             return v ? `-${v.amount.toLocaleString()} đ` : 'N/A';
                                           })()}
                                         </span>
                                       </div>
                                     )}

                                     <div className="aspect-video w-full bg-black rounded-lg overflow-hidden border border-white/5 group/img relative cursor-zoom-in" onClick={() => loan.billImage && setZoomImage(loan.billImage)}>
                                        {loan.billImage ? (
                                          <>
                                            <img src={loan.billImage} className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" alt="Bill payment" referrerPolicy="no-referrer" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                              <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                                                <Maximize2 size={20} />
                                              </div>
                                            </div>
                                          </>
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center"><Clock size={14} className="text-gray-800" /></div>
                                        )}
                                     </div>
                                  </div>
                                )}

                                {['CHỜ DUYỆT', 'ĐÃ DUYỆT'].includes(loan.status) && (
                                  <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 space-y-2.5">
                                    <div className="flex items-center gap-1.5 text-blue-500">
                                      <Landmark size={12} />
                                      <h4 className="text-[8px] font-black uppercase tracking-widest">Tài khoản nhận tiền</h4>
                                    </div>
                                    {u.bankName ? (
                                      <div className="space-y-1.5">
                                        <div className="flex justify-between items-center">
                                          <span className="text-[6px] font-black text-gray-600 uppercase">Ngân hàng:</span>
                                          <span className="text-[8px] font-black text-white uppercase">{u.bankName}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-[6px] font-black text-gray-600 uppercase">Số tài khoản:</span>
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-black text-blue-400 tracking-widest">{u.bankAccountNumber}</span>
                                            <div className="flex gap-1">
                                              <button 
                                                onClick={() => handleCopy(u.bankAccountNumber || '', u.id + loan.id)}
                                                className={`p-1 rounded-md transition-all ${copiedId === u.id + loan.id ? 'bg-green-500/20 text-green-500' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                                                title="Sao chép số tài khoản"
                                              >
                                                {copiedId === u.id + loan.id ? <Check size={9} /> : <Copy size={9} />}
                                              </button>

                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-[6px] font-black text-gray-600 uppercase">Chủ tài khoản:</span>
                                          <span className="text-[8px] font-black text-white uppercase">{u.bankAccountHolder}</span>
                                        </div>

                                        {/* VietQR for Disbursement */}
                                        <div className="pt-3 flex flex-col items-center gap-2 border-t border-white/5 mt-2">
                                          <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 bg-[#ff8c00] rounded-full animate-pulse"></div>
                                            <p className="text-[7px] font-black text-[#ff8c00] uppercase tracking-widest">Quét mã giải ngân nhanh</p>
                                          </div>
                                          <div className="bg-white p-2 rounded-xl shadow-lg group/qr relative">
                                            {(() => {
                                              const disburseContent = generatePaymentContent('DISBURSE', { id: loan.id, userId: u.id, userPhone: u.phone }, settings);
                                              const qrUrl = `https://img.vietqr.io/image/${u.bankBin || BANK_BINS[u.bankName?.toUpperCase() || ""] || "970436"}-${u.bankAccountNumber}-compact2.png?amount=${Math.round(loan.amount * (1 - settings.PRE_DISBURSEMENT_FEE / 100))}&addInfo=${encodeURIComponent(disburseContent)}&accountName=${encodeURIComponent(u.bankAccountHolder || "")}`;
                                              
                                              return (
                                                <>
                                                  <img 
                                                    src={qrUrl} 
                                                    alt="VietQR Disbursement" 
                                                    className="w-32 h-32 object-contain"
                                                    referrerPolicy="no-referrer"
                                                  />
                                                  <button 
                                                    onClick={() => window.open(qrUrl, '_blank')}
                                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover/qr:opacity-100 transition-opacity flex items-center justify-center rounded-xl"
                                                  >
                                                    <Maximize2 size={20} className="text-white" />
                                                  </button>
                                                </>
                                              );
                                            })()}
                                          </div>
                                          <div className="flex flex-col items-center">
                                            <p className="text-[6px] font-bold text-gray-500 uppercase">Số tiền giải ngân: {Math.round(loan.amount * (1 - settings.PRE_DISBURSEMENT_FEE / 100)).toLocaleString()} đ</p>
                                            <p className="text-[5px] font-black text-blue-400 uppercase tracking-tighter mt-0.5">
                                              Nội dung: {generatePaymentContent('DISBURSE', { id: loan.id, userId: u.id, userPhone: u.phone }, settings)}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-[7px] font-black text-red-500 uppercase text-center">Khách chưa cập nhật tài khoản</p>
                                    )}
                                  </div>
                                )}

                                <div className="space-y-4 pt-1">
                                  <div className="flex gap-1.5">
                                    {loan.status === 'CHỜ DUYỆT' && (
                                      <div className="flex flex-col gap-1.5 w-full">
                                        <div className="flex gap-1.5">
                                          <button 
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              if (isGlobalProcessing) return;
                                              await onLoanAction(loan.id, 'APPROVE');
                                            }} 
                                            disabled={isGlobalProcessing}
                                            className={`flex-1 bg-[#ff8c00] text-black py-3 rounded-lg font-black text-[9px] uppercase active:scale-95 transition-all ${isGlobalProcessing ? 'opacity-50' : ''}`}
                                          >
                                            {isGlobalProcessing ? 'Đang xử lý...' : 'Duyệt vay'}
                                          </button>
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setRejectingLoanId(rejectingLoanId === loan.id ? null : loan.id);
                                            }} 
                                            disabled={isGlobalProcessing}
                                            className={`flex-1 py-3 rounded-lg font-black text-[9px] uppercase active:scale-95 transition-all flex items-center justify-center gap-1.5 ${rejectingLoanId === loan.id ? 'bg-red-600 text-white' : 'bg-white/5 border border-white/10 text-red-500'} ${isGlobalProcessing ? 'opacity-50' : ''}`}
                                          >
                                            <XCircle size={12} /> {rejectingLoanId === loan.id ? 'Hủy' : 'Từ chối'}
                                          </button>
                                        </div>
                                        {rejectingLoanId === loan.id && (
                                          <div className="grid grid-cols-2 gap-1.5 animate-in slide-in-from-top-2 duration-200">
                                            {["Hồ sơ không đạt", "Thông tin sai lệch", "Nợ xấu hệ thống", "Vượt quá hạn mức"].map((reason) => (
                                              <button 
                                                key={reason}
                                                onClick={async (e) => { 
                                                  e.stopPropagation();
                                                  if (isGlobalProcessing) return;
                                                  await onLoanAction(loan.id, 'REJECT', reason); 
                                                  setRejectingLoanId(null); 
                                                }}
                                                disabled={isGlobalProcessing}
                                                className={`bg-red-500/10 text-red-500/70 py-1.5 rounded-md font-bold text-[7px] uppercase border border-red-500/10 hover:bg-red-500/20 transition-all ${isGlobalProcessing ? 'opacity-50' : ''}`}
                                              >
                                                {reason}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {loan.status === 'ĐÃ DUYỆT' && (
                                      <button 
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (isGlobalProcessing) return;
                                          await onLoanAction(loan.id, 'DISBURSE');
                                        }} 
                                        disabled={isGlobalProcessing}
                                        className={`w-full bg-green-600 text-white py-3 rounded-lg font-black text-[9px] uppercase active:scale-95 transition-all ${isGlobalProcessing ? 'opacity-50' : ''}`}
                                      >
                                        {isGlobalProcessing ? 'Đang xử lý...' : 'Giải ngân tiền'}
                                      </button>
                                    )}
                                    {loan.status === 'CHỜ TẤT TOÁN' && (
                                      <div className="flex flex-col gap-1.5 w-full">
                                        <div className="flex gap-1.5">
                                          <button 
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              if (isGlobalProcessing) return;
                                              await onLoanAction(loan.id, 'SETTLE');
                                            }} 
                                            disabled={isGlobalProcessing}
                                            className={`flex-1 text-white py-3 rounded-lg font-black text-[9px] uppercase flex items-center justify-center gap-1.5 active:scale-95 transition-all ${
                                              isGlobalProcessing ? 'opacity-50' : ''
                                            } ${
                                              loan.settlementType === 'ALL' ? 'bg-green-600' : 
                                              (loan.settlementType === 'PARTIAL' ? 'bg-amber-500' : 'bg-blue-600')
                                            }`}
                                          >
                                            <CheckCircle2 size={12} /> {isGlobalProcessing ? 'Đang xử lý...' : (loan.settlementType === 'ALL' ? 'Xác nhận Tất toán' : (loan.settlementType === 'PARTIAL' ? 'Xác nhận TTMP' : 'Xác nhận Gia hạn'))}
                                          </button>
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setRejectingLoanId(rejectingLoanId === loan.id ? null : loan.id);
                                            }} 
                                            disabled={isGlobalProcessing}
                                            className={`flex-1 py-3 rounded-lg font-black text-[9px] uppercase active:scale-95 transition-all flex items-center justify-center gap-1.5 ${rejectingLoanId === loan.id ? 'bg-red-600 text-white' : 'bg-white/5 border border-white/10 text-red-500'} ${isGlobalProcessing ? 'opacity-50' : ''}`}
                                          >
                                            <XCircle size={12} /> {rejectingLoanId === loan.id ? 'Hủy' : 'Từ chối'}
                                          </button>
                                        </div>
                                        {rejectingLoanId === loan.id && (
                                          <div className="grid grid-cols-2 gap-1.5 animate-in slide-in-from-top-2 duration-200">
                                            {["Bill không hợp lệ", "Sai nội dung", "Sai số tiền", "Ảnh mờ/Lỗi"].map((reason) => (
                                              <button 
                                                key={reason}
                                                onClick={async (e) => { 
                                                  e.stopPropagation();
                                                  if (isGlobalProcessing) return;
                                                  await onLoanAction(loan.id, 'REJECT', reason); 
                                                  setRejectingLoanId(null); 
                                                }}
                                                disabled={isGlobalProcessing}
                                                className={`bg-red-500/10 text-red-500/70 py-1.5 rounded-md font-bold text-[7px] uppercase border border-red-500/10 hover:bg-red-500/20 transition-all ${isGlobalProcessing ? 'opacity-50' : ''}`}
                                              >
                                                {reason}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {['CHỜ DUYỆT', 'ĐÃ DUYỆT'].includes(loan.status) && (
                                    <div className="flex flex-col items-center justify-center gap-1 py-2.5 bg-white/[0.03] border border-white/5 rounded-xl">
                                      <div className="flex items-center gap-1.5">
                                        <ArrowDownToLine size={10} className="text-[#ff8c00]" />
                                        <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Số tiền Giải ngân:</span>
                                      </div>
                                      <p className="text-xs font-black text-white tracking-tight">
                                        {(loan.amount * (1 - settings.PRE_DISBURSEMENT_FEE / 100)).toLocaleString()} VNĐ
                                      </p>
                                    </div>
                                  )}
                                </div>
                             </div>
                           );
                         })
                       )}

                       {/* Loan Pagination Controls */}
                       {totalLoanPages > 1 && (
                         <div className="flex items-center justify-between mt-4 px-1 pt-2 border-t border-white/5">
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               setLoanCurrentPage(prev => ({ ...prev, [u.id]: Math.max(1, (prev[u.id] || 1) - 1) }));
                             }}
                             disabled={userLoanPage === 1}
                             className={`flex items-center gap-1 text-[8px] font-black uppercase tracking-widest transition-all ${userLoanPage === 1 ? 'text-gray-700' : 'text-[#ff8c00] hover:text-white'}`}
                           >
                             <ChevronLeft size={12} /> TRƯỚC
                           </button>
                           <div className="flex items-center gap-2">
                             <span className="text-[8px] font-black text-white">{userLoanPage}</span>
                             <span className="text-[8px] font-bold text-gray-600">/</span>
                             <span className="text-[8px] font-bold text-gray-600">{totalLoanPages}</span>
                           </div>
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               setLoanCurrentPage(prev => ({ ...prev, [u.id]: Math.min(totalLoanPages, (prev[u.id] || 1) + 1) }));
                             }}
                             disabled={userLoanPage === totalLoanPages}
                             className={`flex items-center gap-1 text-[8px] font-black uppercase tracking-widest transition-all ${userLoanPage === totalLoanPages ? 'text-gray-700' : 'text-[#ff8c00] hover:text-white'}`}
                           >
                             TIẾP <ChevronRight size={12} />
                           </button>
                         </div>
                       )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 px-1 pt-4 border-t border-white/5 shrink-0">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className={`flex items-center gap-1 text-[8px] font-black uppercase tracking-widest transition-all ${currentPage === 1 ? 'text-gray-700' : 'text-[#ff8c00] hover:text-white'}`}
          >
            <ChevronLeft size={12} /> TRƯỚC
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-black text-white">{currentPage}</span>
            <span className="text-[8px] font-bold text-gray-600">/</span>
            <span className="text-[8px] font-bold text-gray-600">{totalPages}</span>
          </div>
          <button 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className={`flex items-center gap-1 text-[8px] font-black uppercase tracking-widest transition-all ${currentPage === totalPages ? 'text-gray-700' : 'text-[#ff8c00] hover:text-white'}`}
          >
            TIẾP <ChevronRight size={12} />
          </button>
        </div>
      )}

      {filteredUsers.length === 0 && (
        <div className="py-20 text-center space-y-4 opacity-30">
           <AlertTriangle size={32} className="mx-auto" />
           <p className="text-[10px] font-black uppercase tracking-widest">Không tìm thấy khách hàng</p>
        </div>
      )}

      {/* Confirmation Modal for Password Reset */}
      {confirmResetPasswordId && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#111111] border border-amber-600/20 w-full max-w-sm rounded-[2.5rem] p-8 space-y-8 relative shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-600"></div>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-amber-600/10 rounded-full flex items-center justify-center text-amber-600">
                 <RefreshCcw size={32} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">RESET MẬT KHẨU?</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase leading-relaxed px-4">
                  Bạn có chắc chắn muốn đặt lại mật khẩu của người dùng này về mặc định <span className="text-amber-500 font-black">111111</span>?
                </p>
              </div>
            </div>

            <div className="flex gap-3">
               <button 
                 onClick={() => setConfirmResetPasswordId(null)}
                 className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-gray-500 uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                 <X size={14} /> HỦY BỎ
               </button>
               <button 
                 onClick={async () => {
                   const id = confirmResetPasswordId;
                   setConfirmResetPasswordId(null);
                   await onResetPassword(id);
                 }}
                 className="flex-1 py-4 bg-amber-600 rounded-2xl text-[10px] font-black text-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-900/40"
               >
                 <CheckCircle size={14} /> XÁC NHẬN
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Manual Delete */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#111111] border border-red-600/20 w-full max-w-sm rounded-[2.5rem] p-8 space-y-8 relative shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-red-600"></div>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center text-red-600">
                 <AlertCircle size={32} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">XÓA NGƯỜI DÙNG?</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase leading-relaxed px-4">
                  Bạn có chắc chắn muốn xóa vĩnh viễn khách hàng này cùng toàn bộ lịch sử vay? Thao tác này <span className="text-red-500 font-black">KHÔNG THỂ HOÀN TÁC</span>.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
               <button 
                 onClick={() => setConfirmDeleteId(null)}
                 className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-gray-500 uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                 <X size={14} /> HỦY BỎ
               </button>
               <button 
                 onClick={handleDeleteConfirm}
                 className="flex-1 py-4 bg-red-600 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/40"
               >
                 <Trash2 size={14} /> ĐỒNG Ý XÓA
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Loan Delete */}
      {confirmDeleteLoanId && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#111111] border border-red-600/20 w-full max-w-sm rounded-[2.5rem] p-8 space-y-8 relative shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-red-600"></div>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center text-red-600">
                 <AlertCircle size={32} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">XÓA KHOẢN VAY?</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase leading-relaxed px-4">
                  Bạn có chắc chắn muốn xóa vĩnh viễn hồ sơ vay <span className="text-white font-black">{confirmDeleteLoanId}</span>? Thao tác này <span className="text-red-500 font-black">KHÔNG THỂ HOÀN TÁC</span>.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
               <button 
                 onClick={() => setConfirmDeleteLoanId(null)}
                 className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-gray-500 uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                 <X size={14} /> HỦY BỎ
               </button>
               <button 
                 onClick={handleDeleteLoanConfirm}
                 className="flex-1 py-4 bg-red-600 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/40"
               >
                 <Trash2 size={14} /> ĐỒNG Ý XÓA
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Auto Cleanup */}
      {showCleanupConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#111111] border border-orange-600/20 w-full max-w-sm rounded-[2.5rem] p-8 space-y-8 relative shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-orange-600"></div>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-orange-600/10 rounded-full flex items-center justify-center text-orange-600">
                 <RefreshCcw size={32} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">XÁC NHẬN DỌN DẸP?</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase leading-relaxed px-4">
                  Hệ thống sẽ tự động xóa tất cả người dùng <span className="text-orange-500">không hoạt động trên 60 ngày</span> kể từ lần tất toán cuối. Bạn có chắc chắn?
                </p>
              </div>
            </div>

            <div className="flex gap-3">
               <button 
                 onClick={() => setShowCleanupConfirm(false)}
                 className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-gray-500 uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                 <X size={14} /> HỦY BỎ
               </button>
               <button 
                 onClick={handleCleanupConfirm}
                 className="flex-1 py-4 bg-orange-600 rounded-2xl text-[10px] font-black text-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/40"
               >
                 <CheckCircle size={14} /> BẮT ĐẦU
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Cleanup Result Summary Modal */}
      {cleanupResultCount !== null && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in zoom-in duration-300">
          <div className="bg-[#111111] border border-green-600/20 w-full max-w-sm rounded-[2.5rem] p-8 space-y-8 relative shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-green-600"></div>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 bg-green-600/10 rounded-full flex items-center justify-center text-green-600">
                 <CheckCircle2 size={48} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">BÁO CÁO DỌN DẸP</h3>
                <div className="bg-black/40 rounded-2xl p-6 border border-white/5 shadow-inner">
                   <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Kết quả thực thi</p>
                   <p className="text-3xl font-black text-green-500">{cleanupResultCount} <span className="text-sm">User</span></p>
                   <p className="text-[9px] font-bold text-gray-600 uppercase mt-2 leading-tight">Đã được dọn dẹp vĩnh viễn khỏi hệ thống (Dữ liệu {'>'} 60 ngày).</p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setCleanupResultCount(null)}
              className="w-full py-4 bg-green-600 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-green-900/40"
            >
              ĐÃ HIỂU & ĐÓNG
            </button>
          </div>
        </div>
      )}

      {selectedContract && (
        <ContractModal 
          contract={selectedContract.loan} 
          user={selectedContract.owner} 
          onClose={() => setSelectedContract(null)} 
          settings={settings}
        />
      )}

      {/* Manual User Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#111111] border border-blue-600/20 w-full max-w-sm rounded-[2.5rem] p-8 space-y-8 relative shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-600">
                   <ShieldCheck size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">SỦA HỒ SƠ KHÁCH</h3>
                  <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">{editingUser.fullName} • {editingUser.id}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Hạng thành viên</label>
                  <select 
                    value={editUserForm.rank}
                    onChange={(e) => {
                      const newRank = e.target.value;
                      const rankConf = settings.RANK_CONFIG?.find(r => r.id === newRank);
                      const updates: any = { rank: newRank };
                      if (rankConf) {
                        updates.totalLimit = rankConf.maxLimit;
                        updates.hasCustomLimit = false; // Reset to rank default
                      }
                      setEditUserForm({ ...editUserForm, ...updates });
                    }}
                    className="w-full bg-black border border-white/5 rounded-xl py-3 px-4 text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-all"
                  >
                    {settings.RANK_CONFIG?.map((rc) => (
                      <option key={rc.id} value={rc.id}>{rc.name.toUpperCase()}</option>
                    ))}
                    {!settings.RANK_CONFIG?.some(rc => rc.id === 'standard') && <option value="standard">TIÊU CHUẨN</option>}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Tổng hạn mức (đ)</label>
                  <input 
                    type="text"
                    inputMode="numeric"
                    value={formatNumberWithDots(editUserForm.totalLimit)}
                    onChange={(e) => setEditUserForm({ ...editUserForm, totalLimit: parseNumberFromDots(e.target.value), hasCustomLimit: true })}
                    className="w-full bg-black border border-white/5 rounded-xl py-3 px-4 text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                 <button 
                   onClick={() => setEditingUser(null)}
                   className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-gray-500 uppercase tracking-widest active:scale-95 transition-all shadow-xl"
                 >
                   HỦY
                 </button>
                 <button 
                   onClick={async () => {
                     await onEditUser(editingUser.id, editUserForm);
                     setEditingUser(null);
                   }}
                   className="flex-1 py-4 bg-blue-600 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-blue-900/40"
                 >
                   XÁC NHẬN
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Loan Edit Modal */}
      {editingLoan && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#111111] border border-orange-600/20 w-full max-w-sm rounded-[2.5rem] p-8 space-y-8 relative shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-orange-600"></div>
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-600/10 rounded-2xl flex items-center justify-center text-orange-600">
                   <RefreshCcw size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">SỬA VÁ KHOẢN VAY</h3>
                  <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">MÃ HĐ: {editingLoan.id}</p>
                </div>
              </div>

              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Trạng thái</label>
                  <select 
                    value={editLoanForm.status}
                    onChange={(e) => {
                      const newStatus = e.target.value as LoanRecord['status'];
                      const fRate = Number(settings.FINE_RATE || 0.1) / 100;
                      const mPercent = Number(settings.MAX_FINE_PERCENT || 30);
                      const newFine = (newStatus === 'ĐANG NỢ' || newStatus === 'CHỜ TẤT TOÁN' || newStatus === 'ĐANG GIẢI NGÂN' || newStatus === 'ĐANG ĐỐI SOÁT')
                        ? calculateFine(editLoanForm.amount, editLoanForm.date, fRate, mPercent)
                        : editLoanForm.fine;
                      setEditLoanForm({ ...editLoanForm, status: newStatus, fine: newFine });
                    }}
                    className="w-full bg-black border border-white/5 rounded-xl py-3 px-4 text-xs font-bold text-white focus:outline-none focus:border-orange-500 transition-all"
                  >
                    <option value="ĐANG NỢ">ĐANG NỢ (Đang vay)</option>
                    <option value="ĐÃ TẤT TOÁN">ĐÃ TẤT TOÁN (Đã trả)</option>
                    <option value="BỊ TỪ CHỐI">BỊ TỪ CHỐI (Hủy bỏ)</option>
                    {/* Các trạng thái khác vẫn được giữ lại nếu bản ghi hiện tại đang ở trạng thái đó, tránh lỗi UI */}
                    {!['ĐANG NỢ', 'ĐÃ TẤT TOÁN', 'BỊ TỪ CHỐI'].includes(editingLoan.status) && (
                      <option value={editingLoan.status}>{editingLoan.status}</option>
                    )}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Số tiền vay (đ)</label>
                  <input 
                    type="text"
                    inputMode="numeric"
                    value={formatNumberWithDots(editLoanForm.amount)}
                    onChange={(e) => {
                      const newAmount = parseNumberFromDots(e.target.value);
                      const fRate = Number(settings.FINE_RATE || 0.1) / 100;
                      const mPercent = Number(settings.MAX_FINE_PERCENT || 30);
                      const newFine = (editLoanForm.status === 'ĐANG NỢ' || editLoanForm.status === 'CHỜ TẤT TOÁN' || editLoanForm.status === 'ĐANG GIẢI NGÂN')
                        ? calculateFine(newAmount, editLoanForm.date, fRate, mPercent)
                        : editLoanForm.fine;
                      setEditLoanForm({ ...editLoanForm, amount: newAmount, fine: newFine });
                    }}
                    className="w-full bg-black border border-white/5 rounded-xl py-3 px-4 text-xs font-bold text-white focus:outline-none focus:border-orange-500 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Phí phạt (đ)</label>
                  <input 
                    type="text"
                    inputMode="numeric"
                    value={formatNumberWithDots(editLoanForm.fine)}
                    onChange={(e) => setEditLoanForm({ ...editLoanForm, fine: parseNumberFromDots(e.target.value) })}
                    className="w-full bg-black border border-white/5 rounded-xl py-3 px-4 text-xs font-bold text-white focus:outline-none focus:border-orange-500 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Ngày đến hạn</label>
                  <input 
                    type="date"
                    value={toHtmlDate(editLoanForm.date)}
                    onChange={(e) => {
                      const newDate = fromHtmlDate(e.target.value);
                      const fRate = Number(settings.FINE_RATE || 0.1) / 100;
                      const mPercent = Number(settings.MAX_FINE_PERCENT || 30);
                      const newFine = (editLoanForm.status === 'ĐANG NỢ' || editLoanForm.status === 'CHỜ TẤT TOÁN' || editLoanForm.status === 'ĐANG GIẢI NGÂN')
                        ? calculateFine(editLoanForm.amount, newDate, fRate, mPercent)
                        : editLoanForm.fine;
                      setEditLoanForm({ ...editLoanForm, date: newDate, fine: newFine });
                    }}
                    className="w-full bg-black border border-white/5 rounded-xl py-3 px-4 text-xs font-bold text-white focus:outline-none focus:border-orange-500 transition-all [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                 <button 
                   onClick={() => setEditingLoan(null)}
                   className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-gray-500 uppercase tracking-widest active:scale-95 transition-all shadow-xl"
                 >
                   HỦY
                 </button>
                 <button 
                   onClick={async () => {
                     await onEditLoan(editingLoan.id, editLoanForm);
                     setEditingLoan(null);
                   }}
                   className="flex-1 py-4 bg-orange-600 rounded-2xl text-[10px] font-black text-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-orange-900/40"
                 >
                   CẬP NHẬT
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div 
          className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300 cursor-zoom-out"
          onClick={() => setZoomImage(null)}
        >
          <div className="absolute top-6 right-6 flex gap-4">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                const link = document.createElement('a');
                link.href = zoomImage;
                link.download = 'bill-payment.png';
                link.click();
              }}
              className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all"
            >
              <Download size={24} />
            </button>
            <button 
              onClick={() => setZoomImage(null)}
              className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all"
            >
              <X size={24} />
            </button>
          </div>
          <img 
            src={zoomImage} 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in duration-500" 
            alt="Zoomed bill" 
            onClick={(e) => e.stopPropagation()}
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
  );
};

export default AdminUserManagement;