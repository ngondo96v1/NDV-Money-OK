
import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense, lazy } from 'react';
import { AppView, User, UserRank, LoanRecord, Notification, MonthlyStat, AppSettings, Voucher, BudgetLog } from './types';
import { motion, AnimatePresence } from 'framer-motion';
import { User as UserIcon, Home, Briefcase, Medal, LayoutGrid, Users, Wallet, AlertTriangle, X, Database, Settings, RefreshCcw, Loader2 } from 'lucide-react';
import { compressImage, generateContractId, generateUserId, uploadToImgBB, getSystemFormat, getSystemContractFormat, getBusinessOp, calculateFine } from './utils';
import { io, Socket } from 'socket.io-client';
import { Toaster, toast } from 'sonner';

// Lazy load components to improve initial load speed
const Login = lazy(() => import('./components/Login'));
const Register = lazy(() => import('./components/Register'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const LoanApplication = lazy(() => import('./components/LoanApplication'));
const RankLimits = lazy(() => import('./components/RankLimits'));
const Profile = lazy(() => import('./components/Profile'));
const SecurityModal = lazy(() => import('./components/SecurityModal'));
const TermsModal = lazy(() => import('./components/TermsModal'));
const BankInfoModal = lazy(() => import('./components/BankInfoModal'));
const EditProfileModal = lazy(() => import('./components/EditProfileModal'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const AdminUserManagement = lazy(() => import('./components/AdminUserManagement'));
const AdminBudget = lazy(() => import('./components/AdminBudget'));
const AdminSystem = lazy(() => import('./components/AdminSystem'));
const NotificationModal = lazy(() => import('./components/NotificationModal'));
const SystemNotificationDrawer = lazy(() => import('./components/SystemNotificationDrawer'));
const LuckySpin = lazy(() => import('./components/LuckySpin'));
import DatabaseErrorModal from './components/DatabaseErrorModal';
import ProfileUpdateWarning from './components/ProfileUpdateWarning';

const LoadingFallback = () => (
  <div className="h-[100dvh] bg-black flex flex-col items-center justify-center p-8 text-center">
    <Loader2 size={32} className="text-[#ff8c00] animate-spin mb-4" />
    <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em]">Đang tải hệ thống...</p>
  </div>
);

const MaintenanceScreen = ({ onLogout }: { onLogout: () => void }) => (
  <div className="h-[100dvh] bg-black flex flex-col items-center justify-center p-8 text-center">
    <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mb-6">
      <AlertTriangle size={40} className="text-yellow-500" />
    </div>
    <h1 className="text-xl font-bold text-white mb-2 uppercase tracking-wider">Hệ thống bảo trì</h1>
    <p className="text-sm text-gray-400 mb-8 max-w-xs mx-auto leading-relaxed">
      Hệ thống hiện đang được bảo trì để nâng cấp dịch vụ. Vui lòng quay lại sau.
    </p>
    <button 
      onClick={onLogout}
      className="px-8 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-400 text-xs font-medium hover:bg-white/10 transition-all active:scale-95"
    >
      ĐĂNG XUẤT
    </button>
  </div>
);

interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: any): ErrorBoundaryState { 
    return { hasError: true }; 
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[100dvh] bg-black flex flex-col items-center justify-center p-8 text-center">
          <AlertTriangle size={48} className="text-[#ff8c00] mb-4" />
          <h2 className="text-xl font-black uppercase mb-2 text-white">Hệ thống đang bảo trì</h2>
          <p className="text-xs text-gray-500 mb-6 uppercase">Đã xảy ra lỗi khởi tạo. Vui lòng tải lại trang.</p>
          <button onClick={() => window.location.reload()} className="px-8 py-4 bg-[#ff8c00] text-black font-black rounded-full text-[10px] uppercase tracking-widest">Tải lại trang</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(() => {
    const savedLocal = localStorage.getItem('vnv_user');
    const savedSession = sessionStorage.getItem('vnv_user');
    const saved = savedLocal || savedSession;
    
    if (saved && saved !== 'null' && saved !== '') {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.isAdmin) return AppView.ADMIN_DASHBOARD;
        if (parsed) return AppView.DASHBOARD;
      } catch (e) {
        return AppView.LOGIN;
      }
    }
    return AppView.LOGIN;
  });
  const [settleLoanFromDash, setSettleLoanFromDash] = useState<LoanRecord | null>(null);
  const [viewLoanFromDash, setViewLoanFromDash] = useState<LoanRecord | null>(null);
  const [user, setUser] = useState<User | null>(() => {
    // Check both localStorage (Stay Logged In) and sessionStorage (Session only)
    const savedLocal = localStorage.getItem('vnv_user');
    const savedSession = sessionStorage.getItem('vnv_user');
    const saved = savedLocal || savedSession;
    
    if (saved && saved !== 'null' && saved !== '') {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // State for server-side search and counts
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [totalLoans, setTotalLoans] = useState<number>(0);
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [loanSearchTerm, setLoanSearchTerm] = useState<string>('');
  const [userRange, setUserRange] = useState({ from: 0, to: 49 }); // Default shows 50 users
  const [loanRange, setLoanRange] = useState({ from: 0, to: 49 });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('vnv_token') || sessionStorage.getItem('vnv_token');
  });

  const handlePayOSPayment = async (type: 'SETTLE' | 'UPGRADE', id: string, amount: number, targetRank?: string, settleType?: string, partialAmount?: number, voucherId?: string) => {
    if (isPayOSProcessing) return;
    setIsPayOSProcessing(true);
    setIsGlobalProcessing(true);
    
    try {
      const response = await authenticatedFetch('/api/payment/create-link', {
        method: 'POST',
        body: JSON.stringify({
          type,
          id,
          amount,
          targetRank,
          settleType,
          partialAmount,
          voucherId,
          screen: currentView
        })
      });
      
      const data = await response.json();
      if (data.success && data.checkoutUrl) {
        // Open PayOS checkout page in a new tab
        const paymentWindow = window.open(data.checkoutUrl, '_blank');
        if (!paymentWindow) {
          // If popup is blocked, fallback to current window
          window.location.href = data.checkoutUrl;
        }
      } else {
        toast.error("Không thể tạo link thanh toán. Vui lòng thử lại sau.");
      }
    } catch (e) {
      console.error("PayOS Payment Error:", e);
      toast.error("Đã xảy ra lỗi khi kết nối với cổng thanh toán.");
    } finally {
      setIsPayOSProcessing(false);
      setIsGlobalProcessing(false);
    }
  };

  // Cleanup budget logs older than 60 days
  useEffect(() => {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    setBudgetLogs(prev => {
      const filtered = prev.filter(log => new Date(log.createdAt) > sixtyDaysAgo);
      if (filtered.length !== prev.length) {
        localStorage.setItem('ndv_budget_logs', JSON.stringify(filtered));
      }
      return filtered;
    });
  }, []);

  const handleUpdateBudget = async (type: BudgetLog['type'], amount: number, note: string) => {
    let finalBudget = 0;
    let finalLog: BudgetLog | null = null;
    const nowStr = new Date().toISOString();
    const logId = `BL${Date.now()}`;

    // Update system budget first using functional update
    setSystemBudget(prevBudget => {
      let nextBudget = prevBudget;
      if (type === 'INITIAL') {
        nextBudget = amount;
      } else if (type === 'ADD') {
        nextBudget += amount;
      } else if (type === 'WITHDRAW') {
        nextBudget -= amount;
      }
      
      finalBudget = nextBudget;
      localStorage.setItem('ndv_budget', nextBudget.toString());
      
      finalLog = {
        id: logId,
        type,
        amount,
        balanceAfter: nextBudget,
        note,
        createdAt: nowStr
      };

      return nextBudget;
    });

    // Update logs after budget state update is queued
    if (finalLog) {
      const logToSave = finalLog; // Capture for closure
      setBudgetLogs(prevLogs => {
        const updatedLogs = [logToSave, ...prevLogs];
        localStorage.setItem('ndv_budget_logs', JSON.stringify(updatedLogs));
        return updatedLogs;
      });

      // Async sync to server
      try {
        await authenticatedFetch('/api/budget', {
          method: 'POST',
          body: JSON.stringify({ 
            type, 
            amount, 
            log: logToSave,
            budget: finalBudget // Fallback for backward compatibility
          })
        });
      } catch (e) {
        console.error("Lỗi cập nhật ngân sách:", e);
      }
    }
  };

  const handleLogout = (reason?: any) => {
    setUser(null);
    setToken(null);
    // Clear all possible session storages
    localStorage.removeItem('vnv_user');
    localStorage.removeItem('vnv_token');
    sessionStorage.removeItem('vnv_user');
    sessionStorage.removeItem('vnv_token');
    
    // Close modals
    setShowSecurityModal(false);
    setShowBankInfoModal(false);
    setShowEditProfileModal(false);
    
    setCurrentView(AppView.LOGIN);
    if (reason && typeof reason === 'string') {
      setLoginError(reason);
    }
  };

  // 3. Inactivity Timeout - Logout after 5 minutes of no interaction
  useEffect(() => {
    if (!user || !token) return;

    const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    let timeoutId: any;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.log("[AUTH] Logging out due to inactivity");
        handleLogout("Phiên làm việc đã hết hạn do không hoạt động trong 5 phút. Vui lòng đăng nhập lại.");
      }, INACTIVITY_TIMEOUT);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => document.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [user?.id, token]);

  const authenticatedFetch = useCallback(async (url: string, options: RequestInit = {}, retries = 2) => {
    if (!token && !url.includes('/api/login') && !url.includes('/api/register') && !url.includes('/api/api-health') && !url.includes('/api/supabase-status') && !url.includes('/api/public-settings')) {
      return new Response(JSON.stringify({ error: "Yêu cầu xác thực" }), { status: 401 });
    }

    const headers = {
      ...options.headers,
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': options.body ? 'application/json' : (options.headers as any)?.['Content-Type'] || undefined,
    };
    
    // Remove Content-Type if it's undefined
    if (!headers['Content-Type']) delete (headers as any)['Content-Type'];

    let lastError;
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(url, { ...options, headers });
        
        if (response.status === 401 || response.status === 403) {
          if (currentView !== AppView.LOGIN && !url.includes('/api/login')) {
            handleLogout();
          }
        }
        
        // Retry on 5xx server errors
        if (response.status >= 500 && i < retries) {
          console.warn(`[FETCH] Server Error ${response.status}. Retry ${i + 1}/${retries} for ${url}`);
          await new Promise(res => setTimeout(res, 1000 * (i + 1)));
          continue;
        }
        
        return response;
      } catch (e: any) {
        lastError = e;
        if (e.name === 'AbortError') throw e; // Don't retry if explicitly aborted
        if (i < retries) {
          console.warn(`[FETCH] Retry ${i + 1}/${retries} for ${url}`);
          await new Promise(res => setTimeout(res, 1000 * (i + 1))); // Exponential backoff
        }
      }
    }
    throw lastError;
  }, [token, currentView]);
  const [loans, setLoans] = useState<LoanRecord[]>(() => {
    const saved = localStorage.getItem('ndv_loans');
    return saved ? JSON.parse(saved) : [];
  });
  const [registeredUsers, setRegisteredUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('ndv_users');
    let users = saved ? JSON.parse(saved) : [];
    // Sanity check: filter out invalid/empty users from local cache
    return Array.isArray(users) ? users.filter(u => u && u.id && u.phone) : [];
  });
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem('ndv_notifications');
    return saved ? JSON.parse(saved) : [];
  });
  const [adminNotifications, setAdminNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem('ndv_admin_notifications');
    return saved ? JSON.parse(saved) : [];
  });
  const [systemBudget, setSystemBudget] = useState<number>(() => {
    const saved = localStorage.getItem('ndv_budget');
    return saved ? Number(saved) : 0;
  }); 
  const [rankProfit, setRankProfit] = useState<number>(() => {
    const saved = localStorage.getItem('ndv_rank_profit');
    return saved ? Number(saved) : 0;
  }); 
  const [loanProfit, setLoanProfit] = useState<number>(() => {
    const saved = localStorage.getItem('ndv_loan_profit');
    return saved ? Number(saved) : 0;
  }); 
  const [budgetLogs, setBudgetLogs] = useState<BudgetLog[]>(() => {
    const saved = localStorage.getItem('ndv_budget_logs');
    return saved ? JSON.parse(saved) : [];
  });
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStat[]>(() => {
    const saved = localStorage.getItem('ndv_monthly_stats');
    return saved ? JSON.parse(saved) : [];
  });
  const [lastKeepAlive, setLastKeepAlive] = useState<string | null>(() => {
    return localStorage.getItem('ndv_last_keep_alive');
  });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(() => {
    const saved = localStorage.getItem('vnv_remember');
    return saved === null ? true : saved === 'true';
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [showProfileWarning, setShowProfileWarning] = useState(false);
  const [lastSeenNotificationCount, setLastSeenNotificationCount] = useState<number>(() => {
    const saved = localStorage.getItem('ndv_last_seen_notif_count');
    return saved ? Number(saved) : 0;
  });
  const [storageFull, setStorageFull] = useState(false);
  const [storageUsage, setStorageUsage] = useState('0');
  const [isGlobalProcessing, setIsGlobalProcessing] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const isProcessingRef = useRef(false);
  const lastActionTimestamp = useRef<number>(0);
  const lastFullFetch = useRef<number>(0);
  const lastSyncTimestamp = useRef<number>(0);
  const socketRef = useRef<Socket | null>(null);
  const [isTabActive, setIsTabActive] = useState(true);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showBankInfoModal, setShowBankInfoModal] = useState(false);
  const [isPayOSProcessing, setIsPayOSProcessing] = useState(false);
  const [payOSModal, setPayOSModal] = useState<{ show: boolean; url: string; loanId: string } | null>(null);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSystemNotification, setShowSystemNotification] = useState(false);
  const [showLuckySpin, setShowLuckySpin] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    IMGBB_API_KEY: '',
    PAYMENT_ACCOUNT: { bankName: '', accountNumber: '', accountName: '' },
    PRE_DISBURSEMENT_FEE: '',
    MAX_EXTENSIONS: '',
    UPGRADE_PERCENT: '',
    FINE_RATE: '',
    MAX_FINE_PERCENT: '',
    MAX_LOAN_PER_CYCLE: '',
    MIN_SYSTEM_BUDGET: '',
    MAX_SINGLE_LOAN_AMOUNT: '',
    INITIAL_LIMIT: '',
    PAYMENT_CONTENT_FULL_SETTLEMENT: '',
    PAYMENT_CONTENT_PARTIAL_SETTLEMENT: '',
    PAYMENT_CONTENT_EXTENSION: '',
    PAYMENT_CONTENT_UPGRADE: '',
    CONTRACT_CODE_FORMAT: '',
    USER_ID_FORMAT: '',
    ZALO_GROUP_LINK: '',
    SYSTEM_NOTIFICATION: '',
    MAINTENANCE_MODE: false,
    RANK_CONFIG: [
      { id: 'standard', name: 'TIÊU CHUẨN', minLimit: 1000000, maxLimit: 2000000, color: '#6b7280', features: ['Hạn mức 1 - 2 triệu', 'Duyệt trong 24h'] },
      { id: 'bronze', name: 'ĐỒNG', minLimit: 1000000, maxLimit: 3000000, color: '#fdba74', features: ['Hạn mức 1 - 3 triệu', 'Ưu tiên duyệt lệnh'] },
      { id: 'silver', name: 'BẠC', minLimit: 1000000, maxLimit: 4000000, color: '#bfdbfe', features: ['Hạn mức 1 - 4 triệu', 'Hỗ trợ 24/7'] },
      { id: 'gold', name: 'VÀNG', minLimit: 1000000, maxLimit: 5000000, color: '#facc15', features: ['Hạn mức 1 - 5 triệu', 'Giảm 10% phí phạt'] },
      { id: 'diamond', name: 'KIM CƯƠNG', minLimit: 1000000, maxLimit: 10000000, color: '#60a5fa', features: ['Hạn mức 1 - 10 triệu', 'Duyệt lệnh tức thì'] }
    ],
    SYSTEM_CONTRACT_FORMATS_CONFIG: [],
    MASTER_CONFIGS: []
  });


  const unreadAdminNotifCount = useMemo(() => {
    return adminNotifications.filter(n => !n.read).length;
  }, [adminNotifications]);

  const calculateUserBalance = useCallback((u: User, userLoans: LoanRecord[]) => {
    // ONLY ĐÃ TẤT TOÁN, BỊ TỪ CHỐI, ĐÃ CỘNG DỒN and ĐÃ HUỶ are not current debt. everything else counts as debt.
    const activeDebt = userLoans
      .filter(l => l.status !== 'ĐÃ TẤT TOÁN' && l.status !== 'BỊ TỪ CHỐI' && l.status !== 'ĐÃ CỘNG DỒN' && l.status !== 'ĐÃ HUỶ')
      .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
    return Math.max(0, (Number(u.totalLimit) || 0) - activeDebt);
  }, []);

  useEffect(() => {
    const fetchPublicSettings = async () => {
      try {
        const response = await fetch('/api/public-settings');
        if (response.ok) {
          const data = await response.json();
          setSettings(prev => ({ ...prev, ...data }));
        }
      } catch (e) {
        console.error("Lỗi fetch public settings:", e);
      }
    };
    fetchPublicSettings();
  }, []);

  // Fetch latest user profile on mount and when tab becomes active
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!token || !user?.id) return;
      
      try {
        const response = await authenticatedFetch(`/api/data?userId=${user.id}&full=true`);
        if (response.ok) {
          const data = await response.json();
          
          if (data.users && data.users.length > 0) {
            const latestUser = data.users[0];
            // Ensure isAdmin is boolean
            latestUser.isAdmin = !!latestUser.isAdmin;
            // Preserve isAdmin flag for admins if not in DB to prevent accidental logout/redirect
            if (user.isAdmin && !latestUser.isAdmin) {
              latestUser.isAdmin = true;
            }
            setUser(latestUser);
            if (rememberMe) {
              localStorage.setItem('vnv_user', JSON.stringify(latestUser));
            } else {
              sessionStorage.setItem('vnv_user', JSON.stringify(latestUser));
            }
          }
          
          if (data.loans) {
            setLoans(data.loans);
            localStorage.setItem('ndv_loans', JSON.stringify(data.loans));
          }
          
          if (data.notifications) {
            const allNotifs = deduplicateNotifications(data.notifications);
            const userNotifs = allNotifs.filter(n => n.userId === user.id).slice(0, 10);
            const adminNotifs = allNotifs.filter(n => n.userId === 'ADMIN').slice(0, 50);
            
            setNotifications(userNotifs);
            localStorage.setItem('ndv_notifications', JSON.stringify(userNotifs));
            
            if (user.isAdmin) {
              setAdminNotifications(adminNotifs);
              localStorage.setItem('ndv_admin_notifications', JSON.stringify(adminNotifs));
            }
          }
          
          console.log("[AUTH] User profile and data synced with server");
        }
      } catch (e) {
        console.error("[AUTH] Error syncing user profile:", e);
      }
    };

    if (isInitialized && isTabActive) {
      fetchUserProfile();
    }
  }, [isInitialized, isTabActive, token, user?.id]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await authenticatedFetch('/api/settings');
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        }
      } catch (e) {
        console.error("Lỗi fetch settings:", e);
      }
    };
    if (user?.id && token) {
      fetchSettings();
    }
  }, [user?.id, token]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    // Only automatically show if conditions are met
    if (user && !user.isAdmin && settings?.SYSTEM_NOTIFICATION && settings?.SHOW_SYSTEM_NOTIFICATION) {
      const userNotifs = notifications.filter(n => n.userId === user.id);
      const unreadCount = userNotifs.filter(n => !n.read).length;
      
      // Only auto-expand if there are new unread notifications that haven't been seen in this session
      if (unreadCount > lastSeenNotificationCount) {
        setShowSystemNotification(true);
        // We don't update lastSeenNotificationCount here, only when they view it or mark as read
      }
    }
  }, [user?.id, user?.isAdmin, settings?.SYSTEM_NOTIFICATION, settings?.SHOW_SYSTEM_NOTIFICATION, notifications.length]);

  useEffect(() => {
    if (user && !user.isAdmin) {
      const needsBank = !hasBankInfo(user);
      const needsAvatar = !user.avatar;
      setShowProfileWarning(needsBank || needsAvatar);
    } else {
      setShowProfileWarning(false);
    }
  }, [user?.bankName, user?.bankAccountNumber, user?.bankAccountHolder, user?.avatar, user?.isAdmin]);

  const [drawerTab, setDrawerTab] = useState<'NOTIF' | 'SPIN'>('NOTIF');

  const handleOpenLuckySpin = () => {
    if (settings.MAINTENANCE_MODE) return;
    setDrawerTab('SPIN');
    setShowSystemNotification(true);
  };

  const handleCloseSystemNotification = () => {
    if (user) {
      const userNotifs = notifications.filter(n => n.userId === user.id);
      const unreadCount = userNotifs.filter(n => !n.read).length;
      setLastSeenNotificationCount(unreadCount);
      localStorage.setItem('ndv_last_seen_notif_count', unreadCount.toString());
    }
    setShowSystemNotification(false);
    setDrawerTab('NOTIF'); // Reset for next time
  };

  const handleSpinResult = async (prizeLabel: string, amount: number) => {
    if (!user) return;

    // 1. Update user spins count
    const newSpins = Math.max(0, (user.spins || 0) - 1);
    
    // 2. If amount > 0, create a voucher
    let newVouchers = [...(user.vouchers || [])];
    if (amount > 0) {
      const createdAt = new Date();
      const expiryDate = new Date(createdAt);
      expiryDate.setDate(expiryDate.getDate() + 30); // 30 days expiry

      const newVoucher: Voucher = {
        id: `VC${Math.floor(Math.random() * 1000000)}`,
        userId: user.id,
        amount: amount,
        code: `LUCKY${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        createdAt: createdAt.toISOString(),
        expiryDate: expiryDate.toISOString(),
        isUsed: false,
        type: 'LUCKY_SPIN'
      };
      newVouchers = [newVoucher, ...newVouchers];
    }

    // 3. Sync to server
    const updatedUser = { ...user, spins: newSpins, vouchers: newVouchers };
    setUser(updatedUser);
    
    try {
      await authenticatedFetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: [updatedUser]
        })
      });
    } catch (err) {
      console.error("Error syncing spin result:", err);
    }
  };

  const hasBankInfo = (u: User | null) => {
    if (!u || u.isAdmin) return true;
    return !!(u.bankName && u.bankAccountNumber && u.bankAccountHolder);
  };

  const deduplicateNotifications = (notifs: Notification[]) => {
    const seen = new Set();
    return notifs.filter(n => {
      if (!n.id || seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });
  };

  const addNotification = async (userId: string, title: string, message: string, type: 'LOAN' | 'RANK' | 'SYSTEM') => {
    const newNotif: Notification = {
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 10000)}-${Math.random().toString(36).substring(2, 9)}`,
      userId,
      title,
      message,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
      read: false,
      type
    };

    if (userId === 'ADMIN') {
      setAdminNotifications(prev => {
        const exists = prev.some(n => n.id === newNotif.id);
        if (exists) return prev;
        const next = [newNotif, ...prev].slice(0, 100);
        
        authenticatedFetch('/api/notifications', {
          method: 'POST',
          body: JSON.stringify(next.slice(0, 3))
        }).catch(e => console.error("Lỗi lưu thông báo admin:", e));
        
        return next;
      });
    } else {
      setNotifications(prev => {
        const exists = prev.some(n => n.id === newNotif.id);
        if (exists) return prev;
        const next = [newNotif, ...prev].slice(0, 50); 
        
        authenticatedFetch('/api/notifications', {
          method: 'POST',
          body: JSON.stringify(next.slice(0, 3))
        }).catch(e => console.error("Lỗi lưu thông báo:", e));
        
        return next;
      });
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    if (adminNotifications.some(n => n.id === id)) {
      setAdminNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } else {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }
    
    try {
      await authenticatedFetch(`/api/notifications/${id}/read`, { method: 'POST' });
    } catch (e) {
      console.error("Lỗi mark read:", e);
    }
  };

  // 1. View Enforcement - Ensure admins stay on admin views and users stay on user views
  useEffect(() => {
    if (!user || !user.isLoggedIn) return;

    const isAdminView = currentView.toString().startsWith('ADMIN_');
    const isUserOnlyView = [AppView.DASHBOARD, AppView.APPLY_LOAN, AppView.PROFILE, AppView.RANK_LIMITS].includes(currentView);

    if (user.isAdmin && isUserOnlyView) {
      console.log("[VIEW ENFORCEMENT] Admin redirected to Admin Dashboard");
      setCurrentView(AppView.ADMIN_DASHBOARD);
    } else if (!user.isAdmin && isAdminView) {
      console.log("[VIEW ENFORCEMENT] User redirected to User Dashboard");
      setCurrentView(AppView.DASHBOARD);
    }
  }, [user?.isAdmin, currentView]);

  useEffect(() => {
    if (user && currentView === AppView.LOGIN) {
      setCurrentView(!!user.isAdmin ? AppView.ADMIN_DASHBOARD : AppView.DASHBOARD);
    }
  }, [user, currentView]);

  const fetchData = useCallback(async (isInitial = false, fetchFull = false, force = false) => {
    if (isGlobalProcessing) return;
    
    // Throttle data fetching
    const now = Date.now();
    if (!isInitial && !force && now - lastActionTimestamp.current < 30000) { // 30s throttle for non-initial
      return;
    }
    if (!force) lastActionTimestamp.current = now;
    
    if (!user || !token) {
      if (isInitial) setIsInitialized(true);
      return;
    }

    setIsGlobalProcessing(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      console.warn("[FETCH] Request timed out after 60s");
      controller.abort();
    }, 60000);

    try {
      const params = new URLSearchParams();
      if (user) {
        params.append('userId', user.id);
        if (user.isAdmin) {
          params.append('isAdmin', 'true');
          // For admin, fetch more items initially
          params.append('userFrom', '0');
          params.append('userTo', '99'); // Up from 29
          params.append('loanFrom', '0');
          params.append('loanTo', '99'); // Up from 29
        }
      }
      if (user?.isAdmin) params.append('checkStorage', 'true');
      if (fetchFull || isInitial) {
        params.append('full', 'true');
        if (user?.isAdmin) {
          params.append('userTo', '99'); // Fetch 100 users
          params.append('loanTo', '99'); // Fetch 100 loans
        }
      }
      
      params.append('notifFrom', '0');
      params.append('notifTo', '9'); // Only 10 notifications
      params.append('t', Date.now().toString()); // Cache buster
      const url = `/api/data?${params.toString()}`;
      
      console.log(`[FETCH] Loading data from ${url} (full=${fetchFull})`);
      const response = await authenticatedFetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        let errorMessage = `Lỗi Server ${response.status}${response.statusText ? ': ' + response.statusText : ''}`;
      try {
        const text = await response.text();
        console.error(`[FETCH] Error response body:`, text);
        try {
          const errorData = JSON.parse(text);
          if (errorData.message) errorMessage = errorData.message;
          else if (errorData.error) errorMessage = errorData.error;
          else if (errorData.details) errorMessage = `${errorMessage} (${errorData.details})`;
        } catch (e) {
          if (text && text.length < 250 && !text.includes('<!DOCTYPE')) {
            errorMessage = text;
          }
        }
      } catch (e) {}
      
      const lowerError = errorMessage.toLowerCase();
      if (response.status === 500 || response.status === 503 || lowerError.includes('database') || lowerError.includes('supabase') || lowerError.includes('kết nối') || lowerError.includes('connection')) {
        setDbError(errorMessage);
      }
      throw new Error(errorMessage);
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error(`[FETCH] Non-JSON response:`, text.substring(0, 200));
        throw new Error(`Server không trả về JSON (Status: ${response.status})`);
      }

      const data = await response.json();
      
      console.log(`[FETCH] Data loaded successfully:`, { 
        users: data.users?.length, 
        loans: data.loans?.length 
      });
      if (data.loans) {
        setLoans(prev => {
          // Admin should also trust server for loans list during full fetch
          const isFullFetch = fetchFull || isInitial;
          if (user?.isAdmin && isFullFetch && Array.isArray(data.loans)) {
            localStorage.setItem('ndv_loans', JSON.stringify(data.loans));
            return data.loans;
          }

          const next = [...prev];
          data.loans.forEach((l: LoanRecord) => {
            const idx = next.findIndex(existing => existing.id === l.id);
            if (idx !== -1) next[idx] = { ...next[idx], ...l };
            else next.push(l);
          });
          // Keep sorted by updated at
          next.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          localStorage.setItem('ndv_loans', JSON.stringify(next));
          return next;
        });
      }
      if (data.users) {
        setRegisteredUsers(prev => {
          // If the user is an admin, we should be more authoritative and remove users not on server
          // provided we aren't doing a tiny delta update
          const isFullFetch = fetchFull || isInitial;
          
          if (user?.isAdmin && isFullFetch && Array.isArray(data.users)) {
            const serverUsers = data.users.filter((u: any) => u && u.id && u.phone && !u.isAdmin);
            localStorage.setItem('ndv_users', JSON.stringify(serverUsers));
            return serverUsers;
          }

          // Non-admin or delta fetch: merge
          const cleanPrev = prev.filter(u => u && u.id && u.phone);
          const next = [...cleanPrev];
          
          data.users.forEach((u: User) => {
            if (!u || !u.id || !u.phone) return;
            
            const idx = next.findIndex(existing => existing.id === u.id);
            if (idx !== -1) {
              // Update existing
              next[idx] = { ...next[idx], ...u };
            } else {
              // Add new
              next.push(u);
            }
          });
          
          // Cleanup
          const finalNext = next.filter(u => u && u.id && u.phone && !u.isAdmin);
          finalNext.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          localStorage.setItem('ndv_users', JSON.stringify(finalNext));
          return finalNext;
        });
      }
      if (data.notifications) {
        const deduplicated = deduplicateNotifications(data.notifications).slice(0, 10);
        setNotifications(deduplicated);
        localStorage.setItem('ndv_notifications', JSON.stringify(deduplicated));
      }
      if (data.budget !== undefined) {
        setSystemBudget(data.budget);
        localStorage.setItem('ndv_budget', data.budget.toString());
      }
      if (data.rankProfit !== undefined) {
        setRankProfit(data.rankProfit);
        localStorage.setItem('ndv_rank_profit', data.rankProfit.toString());
      }
      if (data.loanProfit !== undefined) {
        setLoanProfit(data.loanProfit);
        localStorage.setItem('ndv_loan_profit', data.loanProfit.toString());
      }
      if (data.monthlyStats !== undefined) {
        const slicedStats = data.monthlyStats.slice(0, 6);
        setMonthlyStats(slicedStats);
        localStorage.setItem('ndv_monthly_stats', JSON.stringify(slicedStats));
      }
      if (data.lastKeepAlive !== undefined) {
        setLastKeepAlive(data.lastKeepAlive);
        if (data.lastKeepAlive) localStorage.setItem('ndv_last_keep_alive', data.lastKeepAlive);
      }
      if (data.budgetLogs !== undefined && Array.isArray(data.budgetLogs)) {
        setBudgetLogs(data.budgetLogs);
        localStorage.setItem('ndv_budget_logs', JSON.stringify(data.budgetLogs));
      }
      if (data.storageFull !== undefined) setStorageFull(data.storageFull);
      if (data.storageUsage !== undefined) setStorageUsage(data.storageUsage);

      if (user && data.users) {
        const freshUser = data.users.find((u: User) => u.id === user.id);
        if (freshUser) {
          // Ensure isAdmin is boolean and protected for admins
          const updatedUser = { ...freshUser, isAdmin: !!freshUser.isAdmin };
          if (user.isAdmin && !updatedUser.isAdmin) {
            updatedUser.isAdmin = true;
          }
          setUser(updatedUser);
        }
      }
    } catch (e: any) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') {
        console.warn("[FETCH] Request was aborted (timeout or cleanup)");
      } else {
        console.error("Lỗi khi tải dữ liệu ban đầu:", e.message || e);
      }
    } finally {
      if (isInitial) setIsInitialized(true);
      setIsGlobalProcessing(false);
    }
  }, [user?.id, user?.isAdmin, token, authenticatedFetch, isGlobalProcessing]);

  // AUTO-POLLING for Admin: Fetch fresh data every 45 seconds if tab is active
  useEffect(() => {
    if (!user || !user.isAdmin || !isTabActive) return;

    const pollInterval = setInterval(() => {
      console.log("[POLL] Admin fetching fresh data...");
      fetchData(false, false, true); // Use force=true for background polling
    }, 45000); // 45 seconds

    return () => clearInterval(pollInterval);
  }, [user?.isAdmin, isTabActive, fetchData]);

  useEffect(() => {
    let isMounted = true;
    
    const initialFetch = async () => {
      if (isMounted) await fetchData(true, true);
    };

    initialFetch();

    // Socket.io initialization
    const socket = io(window.location.origin);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[REALTIME] Connected to server');
      if (user?.id) {
        socket.emit('join', { userId: user.id, isAdmin: user.isAdmin });
      }
    });

    socket.on('user_updated', (updatedUser: User) => {
      console.log('[REALTIME] User updated:', updatedUser.id, updatedUser.pendingUpgradeRank ? 'PENDING RANK' : '');
      
      setRegisteredUsers(prev => {
        const idx = prev.findIndex(u => u.id === updatedUser.id);
        let next;
        if (idx !== -1) {
          next = [...prev];
          next[idx] = { ...next[idx], ...updatedUser };
        } else {
          next = [updatedUser, ...prev];
        }
        localStorage.setItem('ndv_users', JSON.stringify(next));
        return next;
      });

      if (user && user.id === updatedUser.id) {
        // Ensure isAdmin is boolean and protected for admins
        const nextUser = { ...updatedUser, isAdmin: !!updatedUser.isAdmin };
        if (user.isAdmin && !nextUser.isAdmin) {
          nextUser.isAdmin = true;
        }
        setUser(nextUser);
        if (rememberMe) {
          localStorage.setItem('vnv_user', JSON.stringify(nextUser));
        } else {
          sessionStorage.setItem('vnv_user', JSON.stringify(nextUser));
        }
      }
    });

    socket.on('users_updated', (updatedUsers: User[]) => {
      console.log('[REALTIME] Multiple users updated:', updatedUsers.length);
      
      setRegisteredUsers(prev => {
        const newUsers = [...prev];
        updatedUsers.forEach(u => {
          const idx = newUsers.findIndex(existing => existing.id === u.id);
          if (idx !== -1) newUsers[idx] = { ...newUsers[idx], ...u };
          else newUsers.push(u);
        });
        localStorage.setItem('ndv_users', JSON.stringify(newUsers));
        return newUsers;
      });

      if (user) {
        const me = updatedUsers.find(u => u.id === user.id);
        if (me) {
          // Ensure isAdmin is boolean and protected for admins
          const nextUser = { ...me, isAdmin: !!me.isAdmin };
          if (user.isAdmin && !nextUser.isAdmin) {
            nextUser.isAdmin = true;
          }
          setUser(nextUser);
          if (rememberMe) {
            localStorage.setItem('vnv_user', JSON.stringify(nextUser));
          } else {
            sessionStorage.setItem('vnv_user', JSON.stringify(nextUser));
          }
        }
      }
    });

    socket.on('users_bulk_updated', () => {
      console.log('[REALTIME] Bulk users updated, refreshing data...');
      fetchFullData(true);
    });

    socket.on('loan_updated', (updatedLoan: LoanRecord) => {
      console.log('[REALTIME] Loan updated:', updatedLoan.id);
      setLoans(prev => {
        let next;
        const idx = prev.findIndex(l => l.id === updatedLoan.id);
        if (idx !== -1) next = prev.map(l => l.id === updatedLoan.id ? updatedLoan : l);
        else next = [updatedLoan, ...prev];
        localStorage.setItem('ndv_loans', JSON.stringify(next));
        return next;
      });
    });

    socket.on('loan_deleted', (data: { id: string }) => {
      console.log('[REALTIME] Loan deleted:', data.id);
      setLoans(prev => {
        const next = prev.filter(l => l.id !== data.id);
        localStorage.setItem('ndv_loans', JSON.stringify(next));
        return next;
      });
    });

    socket.on('loans_updated', (updatedLoans: LoanRecord[]) => {
      console.log('[REALTIME] Multiple loans updated');
      setLoans(prev => {
        const newLoans = [...prev];
        updatedLoans.forEach(l => {
          const idx = newLoans.findIndex(existing => existing.id === l.id);
          if (idx !== -1) newLoans[idx] = l;
          else newLoans.push(l);
        });
        localStorage.setItem('ndv_loans', JSON.stringify(newLoans));
        return newLoans;
      });
    });

    socket.on('notification_updated', (notif: Notification) => {
      console.log('[REALTIME] Notification received');
      setNotifications(prev => {
        if (prev.some(n => n.id === notif.id)) return prev;
        const next = [notif, ...prev].slice(0, 10);
        localStorage.setItem('ndv_notifications', JSON.stringify(next));
        return next;
      });
    });

    socket.on('config_updated', (data: any) => {
      console.log('[REALTIME] Config updated');
      
      // Handle both array of {key, value} and full settings object
      if (Array.isArray(data)) {
        data.forEach(c => {
          if (c.key === 'budget' || c.key === 'SYSTEM_BUDGET') {
            setSystemBudget(c.value);
            localStorage.setItem('ndv_budget', c.value.toString());
          }
          if (c.key === 'rankProfit' || c.key === 'TOTAL_RANK_PROFIT') {
            setRankProfit(c.value);
            localStorage.setItem('ndv_rank_profit', c.value.toString());
          }
          if (c.key === 'loanProfit' || c.key === 'TOTAL_LOAN_PROFIT') {
            setLoanProfit(c.value);
            localStorage.setItem('ndv_loan_profit', c.value.toString());
          }
          if (c.key === 'monthlyStats' || c.key === 'MONTHLY_STATS') {
            const sliced = c.value.slice(0, 6);
            setMonthlyStats(sliced);
            localStorage.setItem('ndv_monthly_stats', JSON.stringify(sliced));
          }
          if (c.key === 'lastKeepAlive') {
            setLastKeepAlive(c.value);
            if (c.value) localStorage.setItem('ndv_last_keep_alive', c.value);
          }
          
          // Handle maintenance mode and other flags in array updates
          if (c.key === 'MAINTENANCE_MODE') {
            setSettings(prev => ({ ...prev, MAINTENANCE_MODE: c.value === true || c.value === 'true' }));
          }
        });
      } else if (typeof data === 'object' && data !== null) {
        // Update full settings state
        setSettings(prev => ({ ...prev, ...data }));
        
        // Update individual stats if present
        if (data.SYSTEM_BUDGET !== undefined) setSystemBudget(data.SYSTEM_BUDGET);
        if (data.TOTAL_RANK_PROFIT !== undefined) setRankProfit(data.TOTAL_RANK_PROFIT);
        if (data.TOTAL_LOAN_PROFIT !== undefined) setLoanProfit(data.TOTAL_LOAN_PROFIT);
        if (data.MONTHLY_STATS) setMonthlyStats(data.MONTHLY_STATS.slice(0, 6));
      }
    });

    socket.on('sync_completed', (data: any) => {
      console.log('[REALTIME] Full sync completed');
      if (data.users) setRegisteredUsers(prev => {
        const next = [...prev];
        data.users.forEach((u: any) => {
          const idx = next.findIndex(e => e.id === u.id);
          if (idx !== -1) next[idx] = u; else next.push(u);
        });
        return next;
      });
      if (data.loans) setLoans(prev => {
        const next = [...prev];
        data.loans.forEach((l: any) => {
          const idx = next.findIndex(e => e.id === l.id);
          if (idx !== -1) next[idx] = l; else next.push(l);
        });
        return next;
      });
    });

    socket.on('admin_notification', (data: { type: string, message: string }) => {
      console.log('[REALTIME] Admin notification:', data);
      if (user?.isAdmin) {
        let description = 'Hoạt động hệ thống mới';
        let notifType: 'LOAN' | 'RANK' | 'SYSTEM' = 'SYSTEM';
        
        if (data.type === 'RANK_UPGRADE') {
          description = 'Yêu cầu nâng hạng thành viên';
          notifType = 'RANK';
        }
        if (data.type === 'NEW_LOAN') {
          description = 'Yêu cầu khoản vay mới';
          notifType = 'LOAN';
        }
        if (data.type === 'PAYMENT') {
          description = 'Thông báo thanh toán PayOS';
          notifType = 'LOAN';
        }
        
        toast.info(data.message, {
          description
        });

        // Add to local admin notifications state for immediate feedback
        const newNotif: Notification = {
          id: `ADMIN-SOCKET-${Date.now()}`,
          userId: 'ADMIN',
          title: description,
          message: data.message,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
          read: false,
          type: notifType
        };
        setAdminNotifications(prev => [newNotif, ...prev].slice(0, 50));
        
        // Refresh full data
        fetchData(false, false, true);
      }
    });

    socket.on('supabase_ping', (data: { timestamp: string }) => {
      console.log('[REALTIME] Supabase ping received:', data.timestamp);
      setLastKeepAlive(data.timestamp);
      localStorage.setItem('ndv_last_keep_alive', data.timestamp);
    });

    socket.on('payment_success', (data: { message: string, type?: string }) => {
      console.log('[SOCKET] Payment success:', data);
      fetchData(true);
      // Only redirect to Dashboard if NOT an admin
      if (user && !user.isAdmin) {
        setCurrentView(AppView.DASHBOARD);
      }
    });

    socket.on('rank_upgrade_success', (data: { message: string }) => {
      console.log('[SOCKET] Rank upgrade success:', data);
      fetchData(true);
      // Only redirect to Dashboard if NOT an admin
      if (user && !user.isAdmin) {
        setCurrentView(AppView.DASHBOARD);
      }
    });

    socket.on('users_bulk_updated', () => {
      console.log('[SOCKET] Users bulk updated (Rank Sync)');
      fetchData(true);
      if (user?.isAdmin) {
        fetchFullData(true);
      }
    });

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [user?.id, user?.isAdmin, token]);

  const [pendingPaymentRestore, setPendingPaymentRestore] = useState<{ type: string, id: string, screen: AppView } | null>(null);

  const processPaymentResult = useCallback((payment: string, screen: AppView | string, type: string, id: string) => {
    if (payment) {
      console.log(`[PAYOS] Processing result: payment=${payment}, type=${type}, screen=${screen}`);
      
      const isUpgrade = type?.toUpperCase() === 'UPGRADE' || screen === AppView.RANK_LIMITS;
      
      if (payment === 'success') {
        // Only redirect to Dashboard if NOT an admin
        console.log('[PAYOS] Payment success, checking redirect');
        if (user && !user.isAdmin) {
          setCurrentView(AppView.DASHBOARD);
        }
        
        // Trigger data refresh
        fetchData(true);
      } else if (payment === 'cancel') {
        console.log('[PAYOS] Payment cancelled/failed');
        // Chuyển về trang đang thao tác khi thất bại hoặc huỷ
        if (screen && Object.values(AppView).includes(screen as AppView)) {
          setCurrentView(screen as AppView);
        } else if (user && !user.isAdmin) {
          // Fallback to Dashboard if screen is invalid and NOT an admin
          setCurrentView(AppView.DASHBOARD);
        }
        
        if (isUpgrade && token) {
          fetch('/api/payment/cancel-upgrade', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
          .then(() => {
            fetchData(true);
          })
          .catch(err => console.error('Error canceling upgrade:', err));
        }
      }
      
      if (type && id) {
        setPendingPaymentRestore({ type, id, screen: (screen as AppView) || AppView.DASHBOARD });
      }
    }
  }, [token, fetchData]);

  // Handle PayOS return/cancel parameters from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const screen = params.get('screen') as AppView;
    const type = params.get('type');
    const id = params.get('id');
    
    if (payment) {
      // Clean up 'undefined' strings from URL parameters
      const cleanType = type === 'undefined' ? '' : type;
      const cleanId = id === 'undefined' ? '' : id;
      const cleanScreen = (screen as string) === 'undefined' ? '' : screen;
      
      processPaymentResult(payment, cleanScreen || '', cleanType || '', cleanId || '');
      
      // Clean up URL parameters without refreshing
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [processPaymentResult]);

  // Handle PayOS return/cancel from postMessage (new tab)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PAYOS_PAYMENT_RESULT') {
        const { payment, paymentType, id, screen } = event.data;
        console.log('[PAYOS] Received payment result from tab:', event.data);
        processPaymentResult(payment, screen as AppView, paymentType, id);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [processPaymentResult]);

  // Restore sub-state when data is loaded
  useEffect(() => {
    if (pendingPaymentRestore && loans.length > 0) {
      const { type, id, screen } = pendingPaymentRestore;
      if (type === 'SETTLE' && screen === AppView.APPLY_LOAN) {
        const loan = loans.find(l => l.id === id);
        if (loan) {
          setSettleLoanFromDash(loan);
        }
      }
      setPendingPaymentRestore(null);
    }
  }, [pendingPaymentRestore, loans]);

  // Re-join room when user changes
  useEffect(() => {
    if (socketRef.current && socketRef.current.connected && user) {
      socketRef.current.emit('join', { userId: user.id, isAdmin: user.isAdmin });
    }
  }, [user]);

  useEffect(() => {
    if (!isInitialized || isGlobalProcessing || !isTabActive) return;

    // Throttle sync to once every 10 minutes (was 30) for better state consistency while preserving bandwidth
    const nowTime = Date.now();
    if (nowTime - lastSyncTimestamp.current < 600000) return;
    lastSyncTimestamp.current = nowTime;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let usersUpdated = false;
    let loansUpdated = false;

    const newUsers = [...registeredUsers];
    
    // 1. Calculate fines and cleanup old bill images
    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
    const cleanupThreshold = nowTime - threeDaysInMs;

    const newLoans = loans.map(loan => {
      let updated = false;
      let currentLoan = { ...loan };

      // Fine calculation
      if ((loan.status === 'ĐANG NỢ' || loan.status === 'CHỜ TẤT TOÁN' || loan.status === 'ĐANG GIẢI NGÂN') && loan.date && typeof loan.date === 'string') {
        const fineRate = Number(settings.FINE_RATE || 0.1) / 100;
        const maxFinePercent = Number(settings.MAX_FINE_PERCENT || 30);
        const newFine = calculateFine(loan.amount, loan.date, fineRate, maxFinePercent);

        if (loan.fine !== newFine) {
          currentLoan.fine = newFine;
          updated = true;
        }
      }

      // Bill image cleanup (after 3 days of settlement)
      if (loan.status === 'ĐÃ TẤT TOÁN' && loan.billImage && (loan.updatedAt || 0) < cleanupThreshold) {
        currentLoan.billImage = null;
        updated = true;
      }

      if (updated) {
        loansUpdated = true;
        currentLoan.updatedAt = nowTime;
        return currentLoan;
      }
      return loan;
    });

    // 2. Handle rank consistency & demotion for users
    newUsers.forEach((targetUser, userIdx) => {
      if (targetUser.isAdmin) return;
      let updated = false;

      // A. Rank Consistency: Preserve Admin custom limit by ONLY auto-setting if explicitly requested (false)
      // Since hasCustomLimit column is missing in DB, we rely on intentionality.
      // We only auto-fix if hasCustomLimit is explicitly false.
      // NOTE: !targetUser.hasCustomLimit is true for undefined, which causes unwanted resets on reload.
      if (settings.RANK_CONFIG && settings.RANK_CONFIG.length > 0 && targetUser.hasCustomLimit === false) {
        const currentRankDef = settings.RANK_CONFIG.find(r => r.id === targetUser.rank);
        if (currentRankDef && targetUser.totalLimit !== currentRankDef.maxLimit) {
          const oldLimit = targetUser.totalLimit;
          const newLimit = currentRankDef.maxLimit;
          const limitDiff = newLimit - oldLimit;
          
          targetUser = {
            ...targetUser,
            totalLimit: newLimit,
            balance: Math.max(0, (targetUser.balance || 0) + limitDiff),
            updatedAt: nowTime
          };
          newUsers[userIdx] = targetUser;
          updated = true;
          usersUpdated = true;
        }
      }
      // If limit is 0, always set default rank limit
      else if (settings.RANK_CONFIG && settings.RANK_CONFIG.length > 0 && (targetUser.totalLimit === 0 || targetUser.totalLimit === undefined || targetUser.totalLimit === null)) {
        const currentRankDef = settings.RANK_CONFIG.find(r => r.id === targetUser.rank) || settings.RANK_CONFIG[0];
        if (currentRankDef) {
          targetUser = {
            ...targetUser,
            totalLimit: currentRankDef.maxLimit,
            balance: (targetUser.balance || 0) + currentRankDef.maxLimit,
            updatedAt: nowTime
          };
          newUsers[userIdx] = targetUser;
          updated = true;
          usersUpdated = true;
        }
      }

      // B. Rank Demotion: Handle overdue penalties
      const userLoans = newLoans.filter(l => 
        l.userId === targetUser.id && 
        (l.status === 'ĐANG NỢ' || l.status === 'CHỜ TẤT TOÁN' || l.status === 'ĐANG GIẢI NGÂN')
      );

      let maxDiffDays = 0;
      userLoans.forEach(loan => {
        if (loan.date && typeof loan.date === 'string') {
          const [d, m, y] = loan.date.split('/').map(Number);
          const dueDate = new Date(y, m - 1, d);
          dueDate.setHours(0, 0, 0, 0);
          if (today > dueDate) {
            const diffTime = today.getTime() - dueDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays > maxDiffDays) maxDiffDays = diffDays;
          }
        }
      });

      if (maxDiffDays > 0) {
        const rankOrder: UserRank[] = ['standard', 'bronze', 'silver', 'gold', 'diamond'];
        let currentRank = targetUser.rank;
        let currentProgress = targetUser.rankProgress;
        let remainingDays = maxDiffDays;

        if (currentRank === 'diamond') {
          currentRank = 'gold';
          currentProgress = 10;
          remainingDays -= 1;
        }

        while (remainingDays > 0 && currentRank !== 'standard') {
          if (currentProgress >= remainingDays) {
            currentProgress -= remainingDays;
            remainingDays = 0;
          } else {
            remainingDays -= (currentProgress + 1);
            const rankIdx = rankOrder.indexOf(currentRank);
            if (rankIdx > 0) {
              currentRank = rankOrder[rankIdx - 1];
              currentProgress = 10;
            } else {
              remainingDays = 0;
            }
          }
        }

        if (currentRank === 'standard' && remainingDays > 0) {
          currentProgress = Math.max(0, currentProgress - remainingDays);
          remainingDays = 0;
        }

        if (currentRank !== targetUser.rank || currentProgress !== targetUser.rankProgress) {
          let newLimit = targetUser.totalLimit;
          // Only reset limit if it's NOT a custom limit (unless it's a critical error)
          if (targetUser.hasCustomLimit !== true) {
            const rankConf = settings.RANK_CONFIG?.find(r => r.id === currentRank);
            if (rankConf) {
              newLimit = rankConf.maxLimit;
            }
          }

          newUsers[userIdx] = {
            ...targetUser,
            rank: currentRank,
            rankProgress: currentProgress,
            totalLimit: newLimit,
            balance: Math.min(newLimit, targetUser.balance),
            updatedAt: nowTime
          };
          usersUpdated = true;
        }
      }
    });

    // Consolidate updates and persist to server
    if (loansUpdated || usersUpdated) {
      const updatedLoans = loansUpdated ? newLoans.filter((l, i) => l !== loans[i]) : [];
      const updatedUsers = usersUpdated ? newUsers.filter((u, i) => u !== registeredUsers[i]) : [];

      if (loansUpdated) setLoans(newLoans);
      if (usersUpdated) {
        setRegisteredUsers(newUsers);
        if (user && !user.isAdmin) {
          const updatedMe = newUsers.find(u => u.id === user.id);
          if (updatedMe) setUser(updatedMe);
        }
      }

      // Persist ONLY updated items to server to save egress
      if (updatedLoans.length > 0 || updatedUsers.length > 0) {
        authenticatedFetch('/api/sync', {
          method: 'POST',
          body: JSON.stringify({
            loans: updatedLoans.length > 0 ? updatedLoans : undefined,
            users: updatedUsers.length > 0 ? updatedUsers : undefined
          })
        }).catch(e => console.error("Lỗi đồng bộ phạt/hạ hạng:", e));
      }
    }
  }, [isInitialized, loans, registeredUsers, isGlobalProcessing]);

  // Only persist current user session to localStorage if rememberMe is true
  useEffect(() => {
    localStorage.setItem('vnv_remember', rememberMe.toString());
    
    if (!isInitialized) return; // Don't touch storage during initial load

    if (user && token) {
      if (rememberMe) {
        // Persist to localStorage (Stay Logged In)
        localStorage.setItem('vnv_user', JSON.stringify(user));
        localStorage.setItem('vnv_token', token);
        // Clear sessionStorage to avoid duplicates
        sessionStorage.removeItem('vnv_user');
        sessionStorage.removeItem('vnv_token');
      } else {
        // Persist to sessionStorage (Session Only)
        sessionStorage.setItem('vnv_user', JSON.stringify(user));
        sessionStorage.setItem('vnv_token', token);
        // Clear localStorage to ensure it doesn't persist across restarts
        localStorage.removeItem('vnv_user');
        localStorage.removeItem('vnv_token');
      }
    } else if (!user) {
      // Only remove if user is explicitly null (logged out)
      localStorage.removeItem('vnv_user');
      localStorage.removeItem('vnv_token');
      sessionStorage.removeItem('vnv_user');
      sessionStorage.removeItem('vnv_token');
    }
  }, [user, token, rememberMe, isInitialized]);

  const handleLogin = async (phone: string, password?: string) => {
    setLoginError(null);
    setIsGlobalProcessing(true);
    
    // Add a timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for login

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ phone, password }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        let data;
        try {
          data = await response.json();
        } catch (jsonErr) {
          throw new Error("Phản hồi từ server không hợp lệ. Vui lòng thử lại.");
        }

        if (data.success) {
          const loggedInUser = { ...data.user, isLoggedIn: true };
          console.log("[LOGIN] Success:", loggedInUser);
          setUser(loggedInUser);
          setToken(data.token);
          
          // Determine storage based on rememberMe
          const storage = rememberMe ? localStorage : sessionStorage;
          storage.setItem('vnv_user', JSON.stringify(loggedInUser));
          storage.setItem('vnv_token', data.token);
          
          // Clear the other storage to prevent conflicts
          const otherStorage = rememberMe ? sessionStorage : localStorage;
          otherStorage.removeItem('vnv_user');
          otherStorage.removeItem('vnv_token');

          setCurrentView(loggedInUser.isAdmin ? AppView.ADMIN_DASHBOARD : AppView.DASHBOARD);
        } else {
          setLoginError(data.error || "Số điện thoại hoặc mật khẩu không chính xác.");
        }
      } else {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          // Non-JSON error response (e.g., 502, 504 from proxy)
          if (response.status === 404) throw new Error("Không tìm thấy dịch vụ đăng nhập. Vui lòng thử lại sau.");
          if (response.status >= 500) throw new Error("Máy chủ đang gặp sự cố. Vui lòng thử lại sau.");
          throw new Error("Lỗi kết nối server (" + response.status + ").");
        }
        
        const displayError = errorData.message || errorData.error || "Số điện thoại hoặc mật khẩu không chính xác.";
        setLoginError(displayError);
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      console.error("Lỗi đăng nhập:", e);
      
      let message = e.message || "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.";
      
      // Handle specific browser error messages
      if (e.name === 'AbortError') {
        message = "Yêu cầu đăng nhập quá hạn. Vui lòng kiểm tra kết nối mạng.";
      } else if (message.toLowerCase().includes('load failed') || message.toLowerCase().includes('failed to fetch')) {
        message = "Không thể kết nối với máy chủ. Vui lòng kiểm tra kết nối Internet.";
      } else if (message.toLowerCase().includes('expected pattern')) {
        message = "Dữ liệu đăng nhập không hợp lệ. Vui lòng tải lại trang hoặc liên hệ Admin.";
      }
      
      setLoginError(message);
    } finally {
      setIsGlobalProcessing(false);
    }
  };

  const handleRegister = async (userData: Partial<User>) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsGlobalProcessing(true);
    try {
      setRegisterError(null);
      
      // Removed local registeredUsers check to avoid stale data issues after reset.
      // The server (/api/register) already performs this check against the source of truth.

      const format = getSystemFormat(settings, 'user', '{RANDOM 4 SỐ}');
      const newUserId = generateUserId(format, settings);
      
      // Tải ảnh lên ImgBB để tiết kiệm dung lượng Supabase (Egress Quota)
      let idFrontUrl = userData.idFront;
      let idBackUrl = userData.idBack;

      if (userData.idFront && userData.idFront.startsWith('data:image')) {
        const compressed = await compressImage(userData.idFront, 1000, 1000);
        idFrontUrl = await uploadToImgBB(compressed, `MT_${newUserId}_${Date.now()}`, settings.IMGBB_API_KEY);
      }
      if (userData.idBack && userData.idBack.startsWith('data:image')) {
        const compressed = await compressImage(userData.idBack, 1000, 1000);
        idBackUrl = await uploadToImgBB(compressed, `MS_${newUserId}_${Date.now()}`, settings.IMGBB_API_KEY);
      }

      // Determine default rank based on logic: Rank with lowest maxLimit
      const sortedRanks = settings.RANK_CONFIG ? [...settings.RANK_CONFIG].sort((a, b) => a.maxLimit - b.maxLimit) : [];
      const defaultRank = sortedRanks.length > 0 ? sortedRanks[0] : null;
      
      const initialLimit = defaultRank ? defaultRank.maxLimit : Number(settings.INITIAL_LIMIT || 2000000);
      const initialRank = defaultRank ? defaultRank.id : 'standard';

      const newUser: User = {
        id: newUserId, 
        phone: userData.phone || '', fullName: userData.fullName || '',
        idNumber: userData.idNumber || '', address: userData.address || '',
        password: userData.password || '', // This will be hashed on the server
        balance: initialLimit, 
        totalLimit: initialLimit, 
        rank: initialRank, 
        rankProgress: 0, 
        fullSettlementCount: 0,
        isLoggedIn: true, 
        isAdmin: false,
        joinDate: new Date().toLocaleTimeString('vi-VN') + ' ' + new Date().toLocaleDateString('vi-VN'),
        idFront: idFrontUrl, idBack: idBackUrl, refZalo: userData.refZalo, relationship: userData.relationship,
        lastLoanSeq: 0,
        updatedAt: Date.now()
      };
      
      const newUsers = [...registeredUsers, newUser];
      
      // Background Sync - Only send the NEW user, not the whole array
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      
      console.log(`[Registration] Response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[Registration] Response data:`, data);
        if (data.success) {
          setToken(data.token);
          
          // Determine storage based on rememberMe
          const storage = rememberMe ? localStorage : sessionStorage;
          storage.setItem('vnv_token', data.token);
          
          // Clear the other storage to prevent conflicts
          const otherStorage = rememberMe ? sessionStorage : localStorage;
          otherStorage.removeItem('vnv_token');
          
          // Update local state ONLY after successful server registration
          setRegisteredUsers(newUsers);
          const { password: _, ...userForState } = newUser;
          const loggedInUser = { ...userForState, isLoggedIn: true } as User;
          setUser(loggedInUser);
          
          // Also save user to storage
          storage.setItem('vnv_user', JSON.stringify(loggedInUser));
          otherStorage.removeItem('vnv_user');

          // Add welcome notification
          addNotification(newUser.id, 'Chào mừng thành viên mới', `Chúc mừng ${newUser.fullName} đã gia nhập NDV Money! Tài khoản của bạn đã được khởi tạo thành công với hạn mức ban đầu là ${initialLimit.toLocaleString()} đ. Bạn có thể bắt đầu đăng ký các khoản vay phù hợp với nhu cầu ngay bây giờ.`, 'SYSTEM');

          setCurrentView(AppView.DASHBOARD);
        }
      } else {
        const errorData = await response.json();
        setRegisterError(errorData.error || "Đăng ký không thành công trên hệ thống.");
        // Stay on REGISTER view, don't clear user state if we want them to edit, 
        // but since Register.tsx has its own state, we just need to stay on the view.
        setCurrentView(AppView.REGISTER);
      }
      
      isProcessingRef.current = false;
      setIsGlobalProcessing(false);
    } catch (e) {
      console.error("Lỗi lưu đăng ký:", e);
      setRegisterError("Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.");
      isProcessingRef.current = false;
      setIsGlobalProcessing(false);
    }
  };

  const [lastSyncTime, setLastSyncTime] = useState<number>(() => {
    const saved = localStorage.getItem('ndv_last_sync_time');
    return saved ? parseInt(saved) : 0;
  });

  const fetchFullData = async (force = false) => {
    if (!user || !token || isGlobalProcessing || !isTabActive) return;
    
    // Cache logic: Only fetch if forced or if last fetch was more than 60 seconds ago
    const now = Date.now();
    if (!force && now - lastFullFetch.current < 60000) {
      console.log("[CACHE] Using cached full data (last fetch was < 60s ago)");
      return;
    }

    setIsGlobalProcessing(true);
    lastFullFetch.current = now;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      console.warn("[FETCH FULL] Request timed out after 45s");
      controller.abort();
    }, 45000);

    try {
      const params = new URLSearchParams();
      params.append('userId', user.id);
      if (user.isAdmin) {
        params.append('isAdmin', 'true');
        
        // Use ranges from state
        params.append('userFrom', userRange.from.toString());
        params.append('userTo', userRange.to.toString());
        params.append('loanFrom', loanRange.from.toString());
        params.append('loanTo', loanRange.to.toString());
        
        if (userSearchTerm) params.append('userSearch', userSearchTerm);
        if (loanSearchTerm) params.append('loanSearch', loanSearchTerm);
      }
      
      // Delta update logic
      if (!force && lastSyncTime > 0) {
        params.append('since', lastSyncTime.toString());
      } else {
        params.append('full', 'true');
      }
      
      params.append('t', now.toString());
      
      const response = await authenticatedFetch(`/api/data?${params.toString()}`, { signal: controller.signal });
      clearTimeout(timeout);

      const contentType = response.headers.get("content-type");
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[FETCH] HTTP Error ${response.status}:`, errorText);
        throw new Error(`HTTP Error ${response.status}`);
      }

      let data;
      const responseText = await response.text();
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("[FETCH] JSON Parse Error. Raw response:", responseText.substring(0, 500));
        throw parseError;
      }

      if (data) {
        lastFullFetch.current = Date.now();
        setLastSyncTime(Date.now());
        localStorage.setItem('ndv_last_sync_time', Date.now().toString());

        if (data.totalUsers !== undefined) setTotalUsers(data.totalUsers);
        if (data.totalLoans !== undefined) setTotalLoans(data.totalLoans);

        if (data.loans) setLoans(prev => {
          const next = [...prev];
          data.loans.forEach((l: any) => {
            const idx = next.findIndex(e => e.id === l.id);
            if (idx !== -1) next[idx] = l; else next.push(l);
          });
          localStorage.setItem('ndv_loans', JSON.stringify(next));
          return next;
        });
        if (data.users) setRegisteredUsers(prev => {
          const nextStage = [...prev];
          data.users.forEach((u: any) => {
            const idx = nextStage.findIndex(e => e.id === u.id);
            if (idx !== -1) nextStage[idx] = u; else nextStage.push(u);
          });
          
          localStorage.setItem('ndv_users', JSON.stringify(nextStage));
          return nextStage;
        });
        
        if (data.budget !== undefined) {
          setSystemBudget(data.budget);
          localStorage.setItem('ndv_budget', data.budget.toString());
        }
        if (data.rankProfit !== undefined) {
          setRankProfit(data.rankProfit);
          localStorage.setItem('ndv_rank_profit', data.rankProfit.toString());
        }
        if (data.loanProfit !== undefined) {
          setLoanProfit(data.loanProfit);
          localStorage.setItem('ndv_loan_profit', data.loanProfit.toString());
        }
        if (data.monthlyStats) {
          const sliced = data.monthlyStats.slice(0, 6);
          setMonthlyStats(sliced);
          localStorage.setItem('ndv_monthly_stats', JSON.stringify(sliced));
        }
        if (data.lastKeepAlive !== undefined) {
          setLastKeepAlive(data.lastKeepAlive);
          if (data.lastKeepAlive) localStorage.setItem('ndv_last_keep_alive', data.lastKeepAlive);
        }

        if (data.notifications) {
          const allNotifs = deduplicateNotifications(data.notifications);
          const userNotifs = allNotifs.filter(n => n.userId === user?.id).slice(0, 50);
          setNotifications(userNotifs);
          localStorage.setItem('ndv_notifications', JSON.stringify(userNotifs));

          if (user?.isAdmin) {
            const adminNotifs = allNotifs.filter(n => n.userId === 'ADMIN').slice(0, 100);
            setAdminNotifications(adminNotifs);
            localStorage.setItem('ndv_admin_notifications', JSON.stringify(adminNotifs));
          }
        }

        if (user && data.users) {
          const meRaw = data.users.find((u: any) => u.id === user.id);
          if (meRaw) {
            // Ensure isAdmin is boolean and protected for admins
            const nextUser = { ...meRaw, isAdmin: !!meRaw.isAdmin };
            if (user.isAdmin && !nextUser.isAdmin) {
              nextUser.isAdmin = true;
            }
            setUser(nextUser);
          }
        }
      }
    } catch (e) {
      console.error("Lỗi khi tải dữ liệu đầy đủ:", e);
    } finally {
      setIsGlobalProcessing(false);
    }
  };

  // Auto-refetch when search or range changes (Admin only)
  useEffect(() => {
    if (user?.isAdmin && (userSearchTerm || loanSearchTerm || userRange.from > 0 || loanRange.from > 0)) {
       const timer = setTimeout(() => {
         fetchFullData();
       }, 500); // 500ms debounce
       return () => clearTimeout(timer);
    }
  }, [userSearchTerm, loanSearchTerm, userRange, loanRange]);

  const handleFetchUserDetail = async (userId: string) => {
    try {
      const response = await authenticatedFetch(`/api/users/${userId}`);
      if (response.ok) {
        const fullUser = await response.json();
        setRegisteredUsers(prev => prev.map(u => u.id === userId ? { ...u, ...fullUser } : u));
      }
    } catch (e) {
      console.error("Lỗi khi tải chi tiết người dùng:", e);
    }
  };

  const handleApplyLoan = async (amount: number, signature?: string, loanPurpose?: string) => {
    if (!user || isProcessingRef.current) return;

    // Chặn spam và nợ quá hạn
    const userLoans = loans.filter(l => l.userId === user.id);
    const hasPending = userLoans.some(l => ['CHỜ DUYỆT', 'ĐÃ DUYỆT', 'ĐANG GIẢI NGÂN', 'CHỜ TẤT TOÁN'].includes(l.status));
    
    // Kiểm tra nợ quá hạn (Trạng thái QUÁ HẠN hoặc ĐANG NỢ nhưng đã quá ngày)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const hasOverdue = userLoans.some(l => {
      if (l.status === 'QUÁ HẠN' || l.status === 'OVERDUE') return true;
      if (['ĐANG NỢ', 'CHỜ TẤT TOÁN'].includes(l.status) && l.date) {
        const [d, m, y] = l.date.split('/').map(Number);
        const dueDate = new Date(y, m - 1, d);
        return dueDate < today;
      }
      return false;
    });
    
    if (hasOverdue) {
      toast.error("Bạn đang có khoản vay quá hạn. Vui lòng tất toán khoản vay cũ trước khi đăng ký khoản mới.");
      return;
    }

    if (hasPending) {
      toast.warning("Bạn đang có một khoản vay đang được xử lý. Vui lòng đợi cho đến khi khoản vay hiện tại hoàn tất trước khi đăng ký khoản mới.");
      return;
    }

    // Kiểm tra ngân sách hệ thống trước khi nộp đơn
    const minBudget = Number(settings.MIN_SYSTEM_BUDGET || 1000000);
    if (systemBudget < minBudget) {
      toast.error("Hệ thống đang bảo trì nguồn vốn. Vui lòng quay lại sau.");
      return;
    }

    isProcessingRef.current = true;
    lastActionTimestamp.current = Date.now();
    // No global processing for 0ms feel
    try {
      // Tải chữ ký lên ImgBB
      let signatureUrl = signature;
      if (signature && signature.startsWith('data:image')) {
        const compressed = await compressImage(signature, 800, 800);
        signatureUrl = await uploadToImgBB(compressed, `CK_${user.id}_${Date.now()}`, settings.IMGBB_API_KEY);
      }

      const now = new Date();
      
      // Logic tính ngày đến hạn: Ngày 1 của tháng kế tiếp
      // Nếu còn dưới 10 ngày thì chuyển sang tháng sau nữa
      const nextMonth1st = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const diffTime = nextMonth1st.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let finalDate;
      if (diffDays < 10) {
        finalDate = new Date(now.getFullYear(), now.getMonth() + 2, 1);
      } else {
        finalDate = nextMonth1st;
      }
      
      const dayStr = finalDate.getDate().toString().padStart(2, '0');
      const monthStr = (finalDate.getMonth() + 1).toString().padStart(2, '0');
      const dueDate = `${dayStr}/${monthStr}/${finalDate.getFullYear()}`;
      
      // Logic tạo Mã hợp đồng: Sử dụng hàm sinh mã duy nhất
      const nextSeq = (user.lastLoanSeq || 0) + 1;
      const format = getSystemFormat(settings, 'contract', 'HD-{MHD}');
      const contractId = generateContractId(user.id, format, settings, undefined, nextSeq);

      const newLoan: LoanRecord = {
        id: contractId,
        originalBaseId: contractId,
        userId: user.id, 
        userName: user.fullName, 
        amount: amount,
        loanPurpose: loanPurpose,
        date: dueDate, 
        createdAt: now.toLocaleTimeString('vi-VN') + ' ' + now.toLocaleDateString('vi-VN'), 
        status: 'CHỜ DUYỆT', 
        signature: signatureUrl,
        fine: 0,
        principalPaymentCount: 0,
        extensionCount: 0,
        updatedAt: Date.now()
      };
      
      const nextLoans = [...loans, newLoan];
      const updatedUser: User = { 
        ...user, 
        balance: calculateUserBalance(user, nextLoans),
        lastLoanSeq: nextSeq,
        hasJoinedZalo: user.hasJoinedZalo || nextSeq === 1,
        updatedAt: Date.now()
      };

      const newLoans = [newLoan, ...loans];
      const newRegisteredUsers = registeredUsers.some(u => u.id === user.id)
        ? registeredUsers.map(u => u.id === user.id ? updatedUser : u)
        : [...registeredUsers, updatedUser];

      // Optimistic UI Update - 0ms response
      setLoans(newLoans);
      setUser(updatedUser);
      setRegisteredUsers(newRegisteredUsers);

      // Add detailed notification for the user
      addNotification(user.id, 'Đăng ký vay thành công', `Yêu cầu vay mã số ${contractId} với số tiền ${amount.toLocaleString()} đ đã được gửi lên hệ thống. Đội ngũ thẩm định sẽ kiểm tra hồ sơ và phản hồi cho bạn trong thời gian sớm nhất. Vui lòng theo dõi trạng thái tại mục Khoản vay.`, 'LOAN');

      // Background Sync - Targeted (only send changed records)
      Promise.all([
        authenticatedFetch('/api/loans', {
          method: 'POST',
          body: JSON.stringify([newLoan]) // Only 1 loan
        }),
        authenticatedFetch('/api/users', {
          method: 'POST',
          body: JSON.stringify([updatedUser]) // Only 1 user
        })
      ])
      .then(async responses => {
        for (const res of responses) {
          if (!res.ok) {
            const errorData = await res.json();
            console.error("Sync error (apply):", errorData);
            toast.error(`Lỗi đồng bộ: ${errorData.message || 'Không thể lưu dữ liệu khoản vay'}. Vui lòng thử lại.`);
          }
        }
      })
      .catch(err => {
        console.error("Background sync error (loans):", err);
        toast.error("Lỗi kết nối mạng. Vui lòng kiểm tra lại kết nối và thử lại.");
      });

      // Chuyển sang Zalo nếu là khoản vay đầu tiên và chưa từng chuyển
      const hasAnyPriorLoans = loans.some(l => l.userId === user.id);
      if (nextSeq === 1 && !user.hasJoinedZalo && !hasAnyPriorLoans) {
        setTimeout(() => {
          window.location.assign('https://zalo.me/g/escncv086');
        }, 800);
      }
      
      // Clear processing state early for better responsiveness
      isProcessingRef.current = false;
      lastActionTimestamp.current = Date.now();
      setIsGlobalProcessing(false);
    } catch (e) {
      console.error("Lỗi lưu khoản vay:", e);
      isProcessingRef.current = false;
      lastActionTimestamp.current = Date.now();
      setIsGlobalProcessing(false);
    }
  };

  const handleUpgradeRank = async (targetRank: UserRank, bill: string) => {
    if (!user || isProcessingRef.current) return;
    isProcessingRef.current = true;
    lastActionTimestamp.current = Date.now();
    // No global processing for 0ms feel
    try {
      // Tải hóa đơn lên ImgBB
      let billUrl = bill;
      if (bill && bill.startsWith('data:image')) {
        const compressed = await compressImage(bill, 1000, 1000);
        billUrl = await uploadToImgBB(compressed, `HANG_${user.id}_${Date.now()}`, settings.IMGBB_API_KEY);
      }

      const updatedUser = { ...user, pendingUpgradeRank: targetRank, rankUpgradeBill: billUrl, updatedAt: Date.now() };
      const newRegisteredUsers = registeredUsers.some(u => u.id === user.id)
        ? registeredUsers.map(u => u.id === user.id ? updatedUser : u)
        : [...registeredUsers, updatedUser];
      
      // Optimistic UI Update - 0ms response
      setUser(updatedUser);
      setRegisteredUsers(newRegisteredUsers);
      addNotification(user.id, 'Yêu cầu nâng hạng', 'Yêu cầu nâng hạng thành viên của bạn đã được gửi thành công. Hệ thống đang tiến hành rà soát lịch sử giao dịch và điểm tín dụng của bạn. Kết quả sẽ được thông báo sau khi quá trình phê duyệt hoàn tất.', 'RANK');

      // Background Sync - Targeted (only send changed records)
      authenticatedFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify([updatedUser])
      }).catch(err => console.error("Background sync error (upgrade):", err));
      
      isProcessingRef.current = false;
      lastActionTimestamp.current = Date.now();
      setIsGlobalProcessing(false);
    } catch (e) {
      console.error("Lỗi nâng hạng:", e);
      isProcessingRef.current = false;
      lastActionTimestamp.current = Date.now();
      setIsGlobalProcessing(false);
    }
  };

  const handleSettleLoan = async (loanId: string, bill: string, settlementType: 'ALL' | 'PRINCIPAL' | 'PARTIAL', bankTransactionId?: string, partialAmount?: number, voucherId?: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    lastActionTimestamp.current = Date.now();
    // No global processing for 0ms feel
    try {
      // Tải biên lai tất toán/gia hạn lên ImgBB
      let billUrl = bill;
      if (bill && bill.startsWith('data:image')) {
        const compressed = await compressImage(bill, 1000, 1000);
        const prefix = settlementType === 'PRINCIPAL' ? 'GH' : (settlementType === 'PARTIAL' ? 'TTMP' : 'TT');
        billUrl = await uploadToImgBB(compressed, `${prefix}_${loanId}_${Date.now()}`, settings.IMGBB_API_KEY);
      }

      let updatedLoan: LoanRecord | null = null;
      const newLoans = loans.map(loan => {
        if (loan.id === loanId) {
          updatedLoan = { 
            ...loan, 
            status: 'CHỜ TẤT TOÁN', 
            billImage: billUrl, 
            bankTransactionId,
            settlementType,
            partialAmount,
            voucherId,
            rejectionReason: null, // Clear old rejection reason on re-submission
            updatedAt: Date.now() 
          };
          return updatedLoan;
        }
        return loan;
      });

      // Optimistic UI
      setLoans(newLoans);

      // Background Sync - Only send the UPDATED loan
      if (updatedLoan) {
        authenticatedFetch('/api/loans', {
          method: 'POST',
          body: JSON.stringify([updatedLoan])
        })
        .then(async res => {
          if (!res.ok) {
            const errorData = await res.json();
            console.error("Sync error (settle):", errorData);
            toast.error(`Lỗi đồng bộ: ${errorData.message || 'Không thể lưu dữ liệu tất toán'}. Vui lòng thử lại.`);
          }
        })
        .catch(err => {
          console.error("Background sync error (settle):", err);
          toast.error("Lỗi kết nối mạng. Vui lòng kiểm tra lại kết nối và thử lại.");
        });
      }
      
    } catch (e) {
      console.error("Lỗi tất toán:", e);
    } finally {
      isProcessingRef.current = false;
      lastActionTimestamp.current = Date.now();
      setIsGlobalProcessing(false);
    }
  };

  const handleAdminLoanAction = async (loanId: string, action: 'APPROVE' | 'DISBURSE' | 'SETTLE' | 'REJECT', reason?: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    lastActionTimestamp.current = Date.now();
    setIsGlobalProcessing(true); // Admin actions show loading for 100% certainty
    try {
      let newLoans = [...loans];
      let newRegisteredUsers = [...registeredUsers];
      let usersUpdated = false;
      let budgetDelta = 0;

      const loanIdx = newLoans.findIndex(l => l.id === loanId);
      if (loanIdx === -1) {
        isProcessingRef.current = false;
        setIsGlobalProcessing(false);
        return;
      }

      const loan = newLoans[loanIdx];

      // Ngăn chặn xử lý lặp lại hoặc trạng thái không hợp lệ
      if (action === 'APPROVE' && loan.status !== 'CHỜ DUYỆT') {
        isProcessingRef.current = false;
        setIsGlobalProcessing(false);
        return;
      }
      if (action === 'DISBURSE' && loan.status !== 'ĐÃ DUYỆT') {
        isProcessingRef.current = false;
        setIsGlobalProcessing(false);
        return;
      }
      if (action === 'SETTLE' && loan.status !== 'CHỜ TẤT TOÁN') {
        isProcessingRef.current = false;
        setIsGlobalProcessing(false);
        return;
      }
      if (action === 'REJECT' && loan.status !== 'CHỜ DUYỆT' && loan.status !== 'CHỜ TẤT TOÁN') {
        isProcessingRef.current = false;
        setIsGlobalProcessing(false);
        return;
      }

      let newStatus = loan.status;
      let rejectionReason = action === 'REJECT' ? (reason || loan.rejectionReason) : null;

      if (action === 'DISBURSE') budgetDelta = -(loan.amount * (1 - Number(settings.PRE_DISBURSEMENT_FEE || 0) / 100)); // Only deduct disbursed amount (fee kept in budget)
      else if (action === 'SETTLE') {
        // Recalculate fine for 100% accuracy at settlement time to ensure budget matches exact rounded amount
        const fRate = Number(settings.FINE_RATE || 0.1) / 100;
        const mPercent = Number(settings.MAX_FINE_PERCENT || 30);
        const actualFine = calculateFine(loan.amount, loan.date || '', fRate, mPercent);
        loan.fine = actualFine; 

        const userIdx = newRegisteredUsers.findIndex(u => u.id === loan.userId);
        const targetUser = userIdx !== -1 ? newRegisteredUsers[userIdx] : null;
        
        // Handle voucher usage
        let voucherDiscount = 0;
        if (loan.voucherId && targetUser && targetUser.vouchers) {
          const vIdx = targetUser.vouchers.findIndex(v => v.id === loan.voucherId);
          if (vIdx !== -1 && !targetUser.vouchers[vIdx].isUsed) {
            voucherDiscount = targetUser.vouchers[vIdx].amount;
            targetUser.vouchers[vIdx].isUsed = true;
            targetUser.vouchers[vIdx].usedAt = new Date().toISOString();
            usersUpdated = true;
          }
        }

        if (loan.settlementType === 'PRINCIPAL') {
          // Vay Gốc: Pay fee + fines
          budgetDelta = ((loan.amount * (Number(settings.PRE_DISBURSEMENT_FEE || 0) / 100)) + (loan.fine || 0));
        } else if (loan.settlementType === 'PARTIAL') {
          // Tất toán 1 phần: Pay partial principal + fee on remaining principal + fines
          const pAmount = loan.partialAmount || 0;
          const remainingPrincipal = loan.amount - pAmount;
          budgetDelta = (pAmount + (remainingPrincipal * (Number(settings.PRE_DISBURSEMENT_FEE || 0) / 100)) + (loan.fine || 0));
        } else {
          // Tất Cả: Pay principal + fines - voucherDiscount
          budgetDelta = Math.max(0, (loan.amount + (loan.fine || 0)) - voucherDiscount);
        }
      }

      if (action === 'REJECT') {
        if (loan.status === 'CHỜ TẤT TOÁN') {
          newStatus = 'ĐANG NỢ';
        } else {
          newStatus = 'BỊ TỪ CHỐI';
        }
      } else {
        switch(action) {
          case 'APPROVE': newStatus = 'ĐÃ DUYỆT'; break;
          case 'DISBURSE': newStatus = 'ĐANG NỢ'; break;
          case 'SETTLE': newStatus = 'ĐÃ TẤT TOÁN'; break;
        }
      }

      // Optimistic Consolidation for Disbursement
      let primaryLoanInSync: LoanRecord | null = null;
      if (action === 'DISBURSE') {
        const existingActiveLoan = newLoans.find(l => 
          l.id !== loan.id && 
          l.userId === loan.userId && 
          (l.status === 'ĐANG NỢ' || l.status === 'QUÁ HẠN')
        );
        if (existingActiveLoan) {
          // Merge this loan into the existing one
          existingActiveLoan.amount += loan.amount;
          existingActiveLoan.updatedAt = Date.now();
          primaryLoanInSync = existingActiveLoan;
          
          // Mark current loan as consolidated
          newStatus = 'ĐÃ CỘNG DỒN';
          (loan as any).consolidatedInto = existingActiveLoan.id;
        }
      }

      // Logic tính chu kỳ tiếp theo cho Vay Gốc & TTMP: Cộng thêm 1 tháng (đến ngày 1 tháng sau)
      let newDueDate = loan.date;
      if (action === 'SETTLE' && (loan.settlementType === 'PRINCIPAL' || loan.settlementType === 'PARTIAL') && loan.date && typeof loan.date === 'string') {
        const [d, m, y] = loan.date.split('/').map(Number);
        const currentDueDate = new Date(y, m - 1, d);
        // Cộng thêm 1 tháng và đặt về ngày 1 của tháng tiếp theo
        const nextCycleDate = new Date(currentDueDate.getFullYear(), currentDueDate.getMonth() + 1, 1);
        const dayStr = nextCycleDate.getDate().toString().padStart(2, '0');
        const monthStr = (nextCycleDate.getMonth() + 1).toString().padStart(2, '0');
        newDueDate = `${dayStr}/${monthStr}/${nextCycleDate.getFullYear()}`;
      }

      let updatedLoan: LoanRecord;
      let nextLoan: LoanRecord | null = null;

      if (action === 'SETTLE' && (loan.settlementType === 'PRINCIPAL' || loan.settlementType === 'PARTIAL')) {
        // 1. Mark current loan as settled
        updatedLoan = { 
          ...loan, 
          status: 'ĐÃ TẤT TOÁN', 
          updatedAt: Date.now() 
        };

        // 2. Create new loan for the next cycle with suffixed ID
        const nextCount = (loan.principalPaymentCount || 0) + 1;
        const nextExtensionCount = loan.settlementType === 'PRINCIPAL' ? (loan.extensionCount || 0) + 1 : (loan.extensionCount || 0);
        const nextPartialCount = loan.settlementType === 'PARTIAL' ? (loan.partialPaymentCount || 0) + 1 : (loan.partialPaymentCount || 0);
        
        // Use originalBaseId if available, otherwise strip prefixes from current ID
        let cleanBaseId = loan.originalBaseId || loan.id;
        if (!loan.originalBaseId) {
          // Fallback stripping logic for legacy records
          const masterConfigs = Array.isArray(settings?.MASTER_CONFIGS) ? settings.MASTER_CONFIGS : [];
          const allAbbrs = masterConfigs
            .filter((c: any) => c.category === 'ABBREVIATION' || c.category === 'TRANSFER_CONTENT' || c.category === 'CONTRACT_NEW')
            .map((c: any) => c.abbreviation)
            .filter(Boolean);
          const systemAbbrs = ['TTMP', 'GH', 'GN', 'NH', 'TT', 'TATTOAN', 'GIAHAN', 'GIAINGAN'];
          const combinedAbbrs = [...new Set([...allAbbrs, ...systemAbbrs])];
          const stripRegex = new RegExp(`^(${combinedAbbrs.join('|')})`, 'i');
          
          const oldId = cleanBaseId;
          cleanBaseId = cleanBaseId.replace(stripRegex, '').trim();
          // Only strip trailing digits and connectors if we actually removed a system prefix (indicating it's already an extension/partial)
          if (oldId !== cleanBaseId) {
            // Remove common connectors like LAN, LẦN, L, # followed by digits, or just digits
            cleanBaseId = cleanBaseId.replace(/(LAN|LẦN|L|#)\s*\d+$/i, '').replace(/\d+$/, '').trim();
          }
        }
        
        let newId = '';
        if (loan.settlementType === 'PRINCIPAL') {
          const format = getSystemContractFormat(settings, 'EXTENSION', '{ID}GH{N}');
          newId = generateContractId(loan.userId, format, settings, cleanBaseId, nextExtensionCount, undefined, nextExtensionCount, nextPartialCount);
        } else if (loan.settlementType === 'PARTIAL') {
          const format = getSystemContractFormat(settings, 'PARTIAL_SETTLEMENT', '{ID}TTMP{N}');
          newId = generateContractId(loan.userId, format, settings, cleanBaseId, nextPartialCount, undefined, nextExtensionCount, nextPartialCount);
        }

        nextLoan = {
          ...loan,
          id: newId,
          originalBaseId: cleanBaseId,
          status: 'ĐANG NỢ',
          date: newDueDate,
          amount: loan.settlementType === 'PARTIAL' ? (loan.amount - (loan.partialAmount || 0)) : loan.amount,
          principalPaymentCount: nextCount,
          extensionCount: nextExtensionCount,
          partialPaymentCount: nextPartialCount,
          billImage: null,
          settlementType: null,
          partialAmount: null,
          fine: 0,
          payosOrderCode: null,
          payosCheckoutUrl: null,
          payosAmount: null,
          payosExpireAt: null,
          updatedAt: Date.now()
        };

        newLoans[loanIdx] = updatedLoan;
        newLoans.push(nextLoan);
      } else {
        updatedLoan = { 
          ...loan, 
          status: (newStatus as any), 
          rejectionReason, 
          updatedAt: Date.now() 
        };
        newLoans[loanIdx] = updatedLoan;
      }

      // RECALCULATE USER BALANCE after status changed
      const loanUser = newRegisteredUsers.find(u => u.id === loan.userId);
      if (loanUser) {
        const nextUserLoans = newLoans.filter(l => l.userId === loan.userId);
        const newBalance = calculateUserBalance(loanUser, nextUserLoans);
        
        let updatedUser: User = { ...loanUser, balance: newBalance, updatedAt: Date.now() };

        if (action === 'SETTLE') {
          const maxOnTimePayments = Number(settings.MAX_ON_TIME_PAYMENTS_FOR_UPGRADE || 10);
          const dueDateParts = (loan.date || "").split('/');
          let isOnTime = false;
          
          if (dueDateParts.length === 3) {
            const dueDate = new Date(parseInt(dueDateParts[2]), parseInt(dueDateParts[1]) - 1, parseInt(dueDateParts[0]));
            dueDate.setHours(23, 59, 59, 999);
            if (new Date() <= dueDate) {
              isOnTime = true;
            }
          }

          let nextRankProgress = loanUser.rankProgress;
          let nextRank = loanUser.rank;
          let nextLimit = loanUser.totalLimit;
          let rankChanged = false;

          // Only gain progress if settled on time
          if (isOnTime) {
            nextRankProgress = Math.min(maxOnTimePayments, loanUser.rankProgress + 1);
            
            // Check for automatic promotion
            if (nextRankProgress >= maxOnTimePayments) {
              const rankConfig = settings.RANK_CONFIG || [];
              const currentIdx = rankConfig.findIndex((r: any) => r.id === loanUser.rank);
              if (currentIdx !== -1 && currentIdx < rankConfig.length - 1) {
                const nextRankConf = rankConfig[currentIdx + 1];
                nextRank = nextRankConf.id;
                nextRankProgress = 0;
                nextLimit = nextRankConf.maxLimit;
                rankChanged = true;
                addNotification(loanUser.id, 'Tự động nâng hạng', `Chúc mừng bạn đã thăng hạng! Do có lịch sử tất toán đúng hạn liên tục, bạn đã được hệ thống tự động nâng lên hạng ${nextRankConf.name}. Hạn mức vay tối đa của bạn hiện tại là ${nextLimit.toLocaleString()} đ. Hãy tiếp tục duy trì uy tín để nhận thêm nhiều ưu đãi.`, 'RANK');
              }
            }
          }

          if (loan.settlementType === 'ALL') {
             let newSpins = loanUser.spins || 0;
             const newFullSettlementCount = (loanUser.fullSettlementCount || 0) + 1;
             
             if (isOnTime) {
               const requiredPayments = Number(settings.LUCKY_SPIN_PAYMENTS_REQUIRED || 1);
               if (newFullSettlementCount % requiredPayments === 0) {
                 newSpins += 1;
               }
             }
             
             updatedUser = {
               ...updatedUser,
               rank: nextRank,
               rankProgress: nextRankProgress,
               totalLimit: nextLimit,
               balance: rankChanged ? (nextLimit - (loanUser.totalLimit - loanUser.balance)) : updatedUser.balance,
               isFreeUpgrade: rankChanged ? true : updatedUser.isFreeUpgrade,
               hasCustomLimit: rankChanged ? false : updatedUser.hasCustomLimit,
               fullSettlementCount: newFullSettlementCount,
               spins: newSpins
             };
          } else {
            updatedUser = {
              ...updatedUser,
              rank: nextRank,
              rankProgress: nextRankProgress,
              totalLimit: nextLimit,
              balance: rankChanged ? (nextLimit - (loanUser.totalLimit - loanUser.balance)) : updatedUser.balance,
              isFreeUpgrade: rankChanged ? true : updatedUser.isFreeUpgrade,
              hasCustomLimit: rankChanged ? false : updatedUser.hasCustomLimit
            };
          }
        }

        if (updatedUser.balance !== loanUser.balance || action === 'SETTLE' || (action === 'REJECT' && loan.status !== 'CHỜ TẤT TOÁN')) {
          newRegisteredUsers = newRegisteredUsers.map(u => u.id === loan.userId ? updatedUser : u);
          usersUpdated = true;
        }
      }

      // Calculate new stats for sync
      let loanProfitToSync = loanProfit;
      let monthlyStatsToSync = [...monthlyStats];

      if (action === 'DISBURSE') {
        const amount = loan.amount * (Number(settings.PRE_DISBURSEMENT_FEE || 0) / 100);
        loanProfitToSync += amount;
        const now = new Date();
        const monthKey = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
        const existingIdx = monthlyStatsToSync.findIndex(s => s.month === monthKey);
        if (existingIdx !== -1) {
          const stat = { ...monthlyStatsToSync[existingIdx] };
          stat.loanProfit += amount;
          stat.totalProfit = stat.rankProfit + stat.loanProfit;
          monthlyStatsToSync[existingIdx] = stat;
        } else {
          monthlyStatsToSync = [{ month: monthKey, rankProfit: 0, loanProfit: amount, totalProfit: amount }, ...monthlyStatsToSync].slice(0, 6);
        }
      } else if (action === 'SETTLE') {
        // Re-calculate voucherDiscount for profit calculation
        let voucherDiscount = 0;
        const userIdx = newRegisteredUsers.findIndex(u => u.id === loan.userId);
        const targetUser = userIdx !== -1 ? newRegisteredUsers[userIdx] : null;
        if (loan.voucherId && targetUser && targetUser.vouchers) {
          const vIdx = targetUser.vouchers.findIndex(v => v.id === loan.voucherId);
          if (vIdx !== -1) {
            voucherDiscount = targetUser.vouchers[vIdx].amount;
          }
        }

        let profitAmount = 0;
        const feePercent = Number(settings.PRE_DISBURSEMENT_FEE || 0) / 100;
        if (loan.settlementType === 'PRINCIPAL') {
          profitAmount = (loan.amount * feePercent) + (loan.fine || 0);
        } else if (loan.settlementType === 'PARTIAL') {
          const pAmount = loan.partialAmount || 0;
          const remainingPrincipal = loan.amount - pAmount;
          profitAmount = (remainingPrincipal * feePercent) + (loan.fine || 0);
        } else {
          profitAmount = (loan.fine || 0) - voucherDiscount;
        }

        loanProfitToSync += profitAmount;
        const now = new Date();
        const monthKey = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
        const existingIdx = monthlyStatsToSync.findIndex(s => s.month === monthKey);
        if (existingIdx !== -1) {
          const stat = { ...monthlyStatsToSync[existingIdx] };
          stat.loanProfit += profitAmount;
          stat.totalProfit = stat.rankProfit + stat.loanProfit;
          monthlyStatsToSync[existingIdx] = stat;
        } else {
          monthlyStatsToSync = [{ month: monthKey, rankProfit: 0, loanProfit: profitAmount, totalProfit: profitAmount }, ...monthlyStatsToSync].slice(0, 6);
        }
      }

      // Persist to server using sync endpoint - Targeted sync for bandwidth
      const syncLoans = [updatedLoan];
      if (nextLoan) syncLoans.push(nextLoan);
      if (primaryLoanInSync) syncLoans.push(primaryLoanInSync);
      
      // Calculate final budget safely using functional update pattern
      const calculatedBudget = systemBudget + budgetDelta;
      
      setSystemBudget(prev => {
        const next = prev + budgetDelta;
        localStorage.setItem('ndv_budget', next.toString());
        return next;
      });

      // Record budget log for disburse/settle
      let newBudgetLog: BudgetLog | undefined = undefined;
      
      if (action === 'DISBURSE') {
        const disburseAmount = (loan.amount * (1 - Number(settings.PRE_DISBURSEMENT_FEE || 0) / 100));
        newBudgetLog = {
          id: `BL${Date.now()}`,
          type: 'LOAN_DISBURSE',
          amount: disburseAmount,
          balanceAfter: calculatedBudget,
          note: `Giải ngân khoản vay ${loan.id} cho ${loan.userName}`,
          createdAt: new Date().toISOString()
        };
        setBudgetLogs(prev => {
          const next = [newBudgetLog!, ...prev];
          localStorage.setItem('ndv_budget_logs', JSON.stringify(next));
          return next;
        });
      } else if (action === 'SETTLE') {
        newBudgetLog = {
          id: `BL${Date.now()}`,
          type: 'LOAN_REPAY',
          amount: budgetDelta,
          balanceAfter: calculatedBudget,
          note: `Thu hồi khoản vay ${loan.id} từ ${loan.userName} (${loan.settlementType === 'PRINCIPAL' ? 'Gia hạn' : loan.settlementType === 'PARTIAL' ? 'TTMP' : 'Tất toán'})`,
          createdAt: new Date().toISOString()
        };
        setBudgetLogs(prev => {
          const next = [newBudgetLog!, ...prev];
          localStorage.setItem('ndv_budget_logs', JSON.stringify(next));
          return next;
        });
      }

      const syncData = {
        loans: syncLoans, // Only the changed loans
        budgetDelta: (action === 'SETTLE' || action === 'DISBURSE') ? budgetDelta : undefined,
        budgetLog: newBudgetLog,
        users: usersUpdated ? [newRegisteredUsers.find(u => u.id === loan.userId)] : undefined,
        loanProfit: (action === 'SETTLE' || action === 'DISBURSE') ? loanProfitToSync : undefined,
        monthlyStats: (action === 'SETTLE' || action === 'DISBURSE') ? monthlyStatsToSync : undefined
      };

      const response = await authenticatedFetch('/api/sync', {
        method: 'POST',
        body: JSON.stringify(syncData)
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      // Update local state ONLY after successful sync for Admin
      setLoans(newLoans);
      setLoanProfit(loanProfitToSync);
      setMonthlyStats(monthlyStatsToSync);
      
      if (usersUpdated) {
        setRegisteredUsers(newRegisteredUsers);
        if (user && !user.isAdmin) {
          const updatedMe = newRegisteredUsers.find(u => u.id === user.id);
          if (updatedMe) setUser(updatedMe);
        }
      }

      // Notifications
      if (action === 'APPROVE') {
        addNotification(loan.userId, 'Hồ sơ đã được phê duyệt', `Thông báo: Hồ sơ vay mã số ${loan.id} của bạn đã được Admin phê duyệt thành công. Vui lòng kiểm tra ví và thực hiện các bước xác nhận cuối cùng (nếu có) để nhận tiền về tài khoản ngân hàng.`, 'LOAN');
      } else if (action === 'DISBURSE') {
        addNotification(loan.userId, 'Giải ngân thành công', `Chúc mừng! Hệ thống đã thực hiện giải ngân thành công số tiền vay mã số ${loan.id} vào tài khoản ngân hàng của bạn. Vui lòng kiểm tra số dư và sử dụng nguồn vốn một cách hiệu quả.`, 'LOAN');
      } else if (action === 'SETTLE') {
        const totalPaid = (loan.settlementType === 'PRINCIPAL' ? ((loan.amount * (Number(settings.PRE_DISBURSEMENT_FEE || 0) / 100)) + (loan.fine || 0)) : (loan.settlementType === 'PARTIAL' ? ((loan.partialAmount || 0) + ((loan.amount - (loan.partialAmount || 0)) * (Number(settings.PRE_DISBURSEMENT_FEE || 0) / 100)) + (loan.fine || 0)) : Math.max(0, (loan.amount + (loan.fine || 0)))));
        const fineText = loan.fine && loan.fine > 0 ? ` (bao gồm phí phạt ${(loan.fine || 0).toLocaleString()} đ)` : "";
        
        if (loan.settlementType === 'PRINCIPAL') {
          addNotification(loan.userId, 'Gia hạn thành công', `Khoản vay mã số ${loan.id} đã được gia hạn thời gian thanh toán thành công. Tổng số tiền đã thanh toán đợt này là ${totalPaid.toLocaleString()} đ${fineText}. Ngày tới hạn thanh toán mới của bạn là ${newDueDate}.`, 'LOAN');
        } else if (loan.settlementType === 'PARTIAL') {
          addNotification(loan.userId, 'Tất toán một phần thành công', `Hệ thống ghi nhận bạn đã tất toán một phần gốc cho khoản vay mã số ${loan.id} với số tiền ${(loan.partialAmount || 0).toLocaleString()} đ. Tổng số tiền thanh toán thực tế là ${totalPaid.toLocaleString()} đ${fineText}. Dư nợ còn lại đã được cập nhật chính xác.`, 'LOAN');
        } else {
          addNotification(loan.userId, 'Tất toán thành công', `Chúc mừng bạn đã hoàn thành nghĩa vụ thanh toán! Khoản vay mã số ${loan.id} đã được tất toán toàn bộ. Tổng số tiền thanh toán cuối cùng là ${totalPaid.toLocaleString()} đ${fineText}. Cảm ơn bạn đã luôn giữ uy tín với NDV Money.`, 'LOAN');
        }
      } else if (action === 'REJECT') {
        const isSettlementReject = loan.status === 'CHỜ TẤT TOÁN';
        let title = 'Yêu cầu bị từ chối';
        let typeStr = '';
        
        if (isSettlementReject) {
          if (loan.settlementType === 'PRINCIPAL') {
            title = 'Từ chối gia hạn';
            typeStr = 'gia hạn cho ';
          } else if (loan.settlementType === 'PARTIAL') {
            title = 'Từ chối tất toán 1 phần';
            typeStr = 'tất toán 1 phần cho ';
          } else {
            title = 'Từ chối tất toán';
            typeStr = 'tất toán toàn bộ cho ';
          }
        }
        
        addNotification(loan.userId, title, `Rất tiếc, yêu cầu ${typeStr}cho khoản vay mã số ${loan.id} đã bị từ chối phê duyệt. Lý do: ${rejectionReason || 'Hồ sơ không đạt điều kiện yêu cầu'}. Vui lòng kiểm tra lại thông tin hoặc liên hệ CSKH để được hướng dẫn thêm.`, 'LOAN');
      }
    } catch (e: any) {
      console.error("Lỗi lưu thay đổi khoản vay Admin:", e.message || e);
    } finally {
      isProcessingRef.current = false;
      lastActionTimestamp.current = Date.now();
      setIsGlobalProcessing(false);
    }
  };

  const handleCancelUpgrade = async () => {
    if (!token || !user) return;
    try {
      await fetch('/api/payment/cancel-upgrade', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      // Update local state
      setUser({ ...user, pendingUpgradeRank: null });
    } catch (err) {
      console.error('Error canceling upgrade:', err);
    }
  };

  const handleAdminUserAction = async (userId: string, action: 'APPROVE_RANK' | 'REJECT_RANK') => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    lastActionTimestamp.current = Date.now();
    setIsGlobalProcessing(true); // Admin actions show loading
    try {
      let newUsers = [...registeredUsers];
      let updatedUser: User | null = null;

      const targetUser = newUsers.find(u => u.id === userId);
      if (!targetUser) {
        isProcessingRef.current = false;
        setIsGlobalProcessing(false);
        return;
      }

      if (action === 'APPROVE_RANK') {
        if (targetUser.pendingUpgradeRank) {
          const newRank = targetUser.pendingUpgradeRank;
          let newLimit = targetUser.totalLimit;
          
          const rankConf = settings.RANK_CONFIG?.find(r => r.id === newRank);
          if (rankConf) {
            newLimit = rankConf.maxLimit;
          }
          
          updatedUser = { 
            ...targetUser, 
            rank: newRank, 
            totalLimit: newLimit, 
            balance: newLimit - (targetUser.totalLimit - targetUser.balance), 
            pendingUpgradeRank: null, 
            rankUpgradeBill: undefined,
            isFreeUpgrade: false,
            hasCustomLimit: false,
            updatedAt: Date.now()
          };
          
          newUsers = newUsers.map(u => u.id === userId ? updatedUser! : u);
          
          const rankNames: Record<string, string> = {};
          settings.RANK_CONFIG?.forEach(r => {
            rankNames[r.id] = r.name;
          });
          addNotification(userId, 'Nâng hạng thành công', `Chúc mừng! Hệ thống đã phê duyệt nâng cấp hạng thành viên của bạn lên mức ${rankNames[newRank] || newRank}. Các đặc quyền về hạn mức vay và tốc độ xét duyệt đã được kích hoạt tương ứng.`, 'RANK');
        }
      } else if (action === 'REJECT_RANK') {
        updatedUser = { ...targetUser, pendingUpgradeRank: null, rankUpgradeBill: undefined, updatedAt: Date.now() };
        newUsers = newUsers.map(u => u.id === userId ? updatedUser! : u);
        addNotification(userId, 'Từ chối nâng hạng', `Thông báo: Yêu cầu nâng cấp hạng thành viên của bạn đã bị từ chối. Lý do chính thường là lịch sử giao dịch chưa đạt yêu cầu hoặc hồ sơ chưa hoàn thiện. Vui lòng tiếp tục giao dịch đúng hạn để tăng khả năng nâng cấp sau này.`, 'RANK');
      }

      if (updatedUser) {
        const upgradeFeeSize = action === 'APPROVE_RANK' ? (updatedUser.totalLimit * (Number(settings.UPGRADE_PERCENT || 0) / 100)) : 0;
        const calculatedBudget = systemBudget + upgradeFeeSize;
        
        if (upgradeFeeSize > 0) {
          setSystemBudget(prev => {
            const next = prev + upgradeFeeSize;
            localStorage.setItem('ndv_budget', next.toString());
            return next;
          });
        }
        
        let newRankProfit = rankProfit;
        let newMonthlyStats = [...monthlyStats];

        if (upgradeFeeSize > 0) {
          newRankProfit += upgradeFeeSize;
          const now = new Date();
          const monthKey = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
          const existingIdx = newMonthlyStats.findIndex(s => s.month === monthKey);
          if (existingIdx !== -1) {
            const stat = { ...newMonthlyStats[existingIdx] };
            stat.rankProfit += upgradeFeeSize;
            stat.totalProfit = stat.rankProfit + stat.loanProfit;
            newMonthlyStats[existingIdx] = stat;
          } else {
            newMonthlyStats = [{ month: monthKey, rankProfit: upgradeFeeSize, loanProfit: 0, totalProfit: upgradeFeeSize }, ...newMonthlyStats].slice(0, 6);
          }
        }

        // Persist to server using sync endpoint - Targeted sync
        let newBudgetLog: BudgetLog | undefined = undefined;
        if (upgradeFeeSize > 0) {
          const rankNames: Record<string, string> = {};
          settings.RANK_CONFIG?.forEach(r => {
            rankNames[r.id] = r.name;
          });
          const rankId = targetUser.pendingUpgradeRank || '';
          const rankName = rankNames[rankId] || rankId;

          newBudgetLog = {
            id: `BL${Date.now()}`,
            type: 'ADD',
            amount: upgradeFeeSize,
            balanceAfter: calculatedBudget,
            note: `Phí nâng hạng từ ${targetUser.fullName} (${rankName})`,
            createdAt: new Date().toISOString()
          };
          setBudgetLogs(prev => {
            const next = [newBudgetLog!, ...prev];
            localStorage.setItem('ndv_budget_logs', JSON.stringify(next));
            return next;
          });
        }

        const syncData = {
          users: [updatedUser], // Only the changed user
          budgetDelta: upgradeFeeSize > 0 ? upgradeFeeSize : undefined,
          budgetLog: newBudgetLog,
          rankProfit: upgradeFeeSize > 0 ? newRankProfit : undefined,
          monthlyStats: upgradeFeeSize > 0 ? newMonthlyStats : undefined
        };

        const response = await authenticatedFetch('/api/sync', {
          method: 'POST',
          body: JSON.stringify(syncData)
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }

        // Update local state ONLY after successful sync for Admin
        setRegisteredUsers(newUsers);
        if (user?.id === userId) {
          // If admin happens to be the one edited (shared session or dev test), preserve admin status
          setUser({ ...updatedUser, isAdmin: user.isAdmin });
        }
        if (upgradeFeeSize > 0) {
          setRankProfit(newRankProfit);
          setMonthlyStats(newMonthlyStats);
        }
      }
    } catch (e: any) {
      console.error("Lỗi xử lý nâng hạng Admin:", e.message || e);
    } finally {
      isProcessingRef.current = false;
      lastActionTimestamp.current = Date.now();
      setIsGlobalProcessing(false);
    }
  };

  const handleAdminEditUser = async (userId: string, updatedData: Partial<User>) => {
    if (isGlobalProcessing) return;
    setIsGlobalProcessing(true);
    try {
      const targetUser = registeredUsers.find(u => u.id === userId);
      if (!targetUser) throw new Error("Không tìm thấy người dùng");

      // Merge data and recalculate balance robustly
      const userLoans = loans.filter(l => l.userId === userId);
      const intermediateUser = { ...targetUser, ...updatedData };
      const newBalance = calculateUserBalance(intermediateUser as User, userLoans);

      const updatedUser = { 
        ...intermediateUser, 
        balance: newBalance,
        isFreeUpgrade: updatedData.rank !== undefined && updatedData.rank !== targetUser.rank ? true : intermediateUser.isFreeUpgrade,
        hasCustomLimit: updatedData.totalLimit !== undefined ? true : intermediateUser.hasCustomLimit,
        updatedAt: Date.now() 
      };

      // Targeted sync
      const response = await authenticatedFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify([updatedUser])
      });

      if (!response.ok) throw new Error("Sync failed");

      setRegisteredUsers(prev => {
        const next = prev.map(u => u.id === userId ? updatedUser : u);
        localStorage.setItem('ndv_users', JSON.stringify(next));
        return next;
      });

      if (user?.id === userId) {
        // Safe update: preserve admin status
        const sessionUpdate = { ...updatedUser, isAdmin: user.isAdmin };
        setUser(sessionUpdate);
        if (rememberMe) {
          localStorage.setItem('vnv_user', JSON.stringify(sessionUpdate));
        } else {
          sessionStorage.setItem('vnv_user', JSON.stringify(sessionUpdate));
        }
      }
      
      const rankNames: Record<string, string> = {};
      if (Array.isArray(settings.RANK_CONFIG)) {
        settings.RANK_CONFIG.forEach((r: any) => { rankNames[r.id] = r.name; });
      }

      // Determine what was updated for a more detailed notification
      let detail = 'Hồ sơ của bạn đã được quản trị viên điều chỉnh.';
      if (updatedData.totalLimit !== undefined && updatedData.rank !== undefined) {
        detail = `Hồ sơ của bạn đã được cập nhật: Hạng ${rankNames[updatedData.rank] || updatedData.rank}, Hạn mức ${updatedData.totalLimit.toLocaleString()} đ.`;
      } else if (updatedData.totalLimit !== undefined) {
        detail = `Hạn mức tài khoản của bạn đã được quản trị viên điều chỉnh thành ${updatedData.totalLimit.toLocaleString()} đ.`;
      } else if (updatedData.rank !== undefined) {
        detail = `Hạng thành viên của bạn đã được cập nhật thành ${rankNames[updatedData.rank] || updatedData.rank}.`;
      }
      
      addNotification(userId, 'Cập nhật hệ thống', `Hệ thống đã cập nhật thông tin tài khoản của bạn. Chi tiết: ${detail}. Vui lòng đăng nhập lại nếu cần để thông tin được đồng bộ chính xác.`, 'SYSTEM');
    } catch (e: any) {
      console.error("Lỗi sửa user Admin:", e);
    } finally {
      setIsGlobalProcessing(false);
    }
  };

  const handleAdminResetPassword = async (userId: string) => {
    if (isGlobalProcessing) return;
    
    setIsGlobalProcessing(true);
    try {
      const response = await authenticatedFetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        toast.success("Mật khẩu đã được reset về 111111");
        addNotification(userId, 'Bảo mật tài khoản', 'Mật khẩu của bạn đã được quản trị viên đặt lại về mặc định (111111). Vui lòng đăng nhập và đổi mật khẩu mới để bảo mật tài khoản.', 'SYSTEM');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Không thể reset mật khẩu");
      }
    } catch (e) {
      console.error("Lỗi reset mật khẩu:", e);
      toast.error("Đã xảy ra lỗi khi kết nối máy chủ");
    } finally {
      setIsGlobalProcessing(false);
    }
  };

  const handleAdminEditLoan = async (loanId: string, updatedData: Partial<LoanRecord>) => {
    if (isGlobalProcessing) return;
    setIsGlobalProcessing(true);
    try {
      const targetLoan = loans.find(l => l.id === loanId);
      if (!targetLoan) throw new Error("Không tìm thấy khoản vay");

      const finalLoan = { 
        ...targetLoan, 
        ...updatedData, 
        updatedAt: Date.now() 
      };

      // Recalculate User Balance if status or amount changed
      let finalUser: User | null = null;
      if (updatedData.status !== undefined || updatedData.amount !== undefined) {
        const targetUser = registeredUsers.find(u => u.id === targetLoan.userId);
        if (targetUser) {
          const userLoansPrior = loans.filter(l => l.userId === targetLoan.userId);
          const nextUserLoans = userLoansPrior.map(l => l.id === loanId ? finalLoan : l);
          const newBalance = calculateUserBalance(targetUser, nextUserLoans);
          if (newBalance !== targetUser.balance) {
            finalUser = { ...targetUser, balance: newBalance, updatedAt: Date.now() };
          }
        }
      }

      // We will sync everything in one call to /api/sync below
      setRegisteredUsers(prev => finalUser ? prev.map(u => u.id === finalUser!.id ? finalUser! : u) : prev);
      if (finalUser && user?.id === finalUser.id) {
        setUser({ ...finalUser, isAdmin: user.isAdmin });
      }

      setLoans(prev => prev.map(l => l.id === loanId ? finalLoan : l));
      
      // 1. Budget & Profit Sync for Manual Edits
      let newBudget = systemBudget;
      let newBudgetLog: BudgetLog | undefined = undefined;
      let nextLoanProfit = loanProfit;
      let nextMonthlyStats = [...monthlyStats];
      let financialUpdated = false;

      const feePercent = Number(settings.PRE_DISBURSEMENT_FEE || 0) / 100;
      const oldStatus = targetLoan.status;
      const newStatus = updatedData.status || oldStatus;
      const oldAmount = targetLoan.amount;
      const newAmount = updatedData.amount !== undefined ? updatedData.amount : oldAmount;
      const oldFine = targetLoan.fine || 0;
      const newFine = updatedData.fine !== undefined ? updatedData.fine : oldFine;

      const disbursedStats = ['ĐANG NỢ', 'CHỜ TẤT TOÁN', 'ĐANG GIẢI NGÂN', 'ĐANG ĐỐI SOÁT', 'ĐÃ TẤT TOÁN'];
      const settledStats = ['ĐÃ TẤT TOÁN'];

      const wasDisbursed = disbursedStats.includes(oldStatus);
      const isNowDisbursed = disbursedStats.includes(newStatus);
      const wasSettled = settledStats.includes(oldStatus);
      const isNowSettled = settledStats.includes(newStatus);

      let budgetDiff = 0;
      let profitDiff = 0;
      
      // 1. Disbursement Effect (Money leaves/enters based on initial payout)
      if (!wasDisbursed && isNowDisbursed) {
        budgetDiff -= newAmount * (1 - feePercent);
        profitDiff += newAmount * feePercent;
      } else if (wasDisbursed && !isNowDisbursed) {
        budgetDiff += oldAmount * (1 - feePercent);
        profitDiff -= oldAmount * feePercent;
      } else if (wasDisbursed && isNowDisbursed && oldAmount !== newAmount) {
        budgetDiff -= (newAmount - oldAmount) * (1 - feePercent);
        profitDiff += (newAmount - oldAmount) * feePercent;
      }

      // 2. Settlement Effect (Principal + Fines return to system)
      if (!wasSettled && isNowSettled) {
        budgetDiff += (newAmount + newFine);
        profitDiff += newFine;
      } else if (wasSettled && !isNowSettled) {
        budgetDiff -= (oldAmount + oldFine);
        profitDiff -= oldFine;
      } else if (wasSettled && isNowSettled && (oldAmount !== newAmount || oldFine !== newFine)) {
        budgetDiff += (newAmount - oldAmount) + (newFine - oldFine);
        profitDiff += (newFine - oldFine);
      }

      if (Math.abs(budgetDiff) > 0 || Math.abs(profitDiff) > 0) {
        financialUpdated = true;
        if (Math.abs(budgetDiff) > 0) {
          newBudget += budgetDiff;
          newBudgetLog = {
            id: `BL${Date.now()}`,
            type: budgetDiff > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
            amount: Math.abs(budgetDiff),
            balanceAfter: newBudget,
            note: `Điều chỉnh thủ công khoản vay ${loanId} (${oldStatus} -> ${newStatus})`,
            createdAt: new Date().toISOString()
          };
        }
        
        if (Math.abs(profitDiff) > 0) {
          nextLoanProfit += profitDiff;
          const now = new Date();
          const monthKey = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
          const existingIdx = nextMonthlyStats.findIndex(s => s.month === monthKey);
          if (existingIdx !== -1) {
            nextMonthlyStats[existingIdx] = {
              ...nextMonthlyStats[existingIdx],
              loanProfit: nextMonthlyStats[existingIdx].loanProfit + profitDiff,
              totalProfit: nextMonthlyStats[existingIdx].totalProfit + profitDiff
            };
          } else {
            nextMonthlyStats = [{ month: monthKey, rankProfit: 0, loanProfit: profitDiff, totalProfit: profitDiff }, ...nextMonthlyStats].slice(0, 6);
          }
        }
      }

      // Sync everything
      const syncData = {
        loans: [finalLoan],
        budgetDelta: financialUpdated ? budgetDiff : undefined,
        budgetLog: newBudgetLog,
        users: finalUser ? [finalUser] : undefined,
        loanProfit: financialUpdated ? nextLoanProfit : undefined,
        monthlyStats: financialUpdated ? nextMonthlyStats : undefined
      };

      const syncResponse = await authenticatedFetch('/api/sync', {
        method: 'POST',
        body: JSON.stringify(syncData)
      });
      
      if (!syncResponse.ok) throw new Error("Loan/Financial Sync failed");

      // Update local states if sync was successful
      if (financialUpdated) {
        setSystemBudget(prev => {
          const next = prev + budgetDiff;
          localStorage.setItem('ndv_budget', next.toString());
          return next;
        });
        setLoanProfit(nextLoanProfit);
        setMonthlyStats(nextMonthlyStats);
        if (newBudgetLog) {
          const logItem = newBudgetLog;
          setBudgetLogs(prev => {
            const next = [logItem, ...prev];
            localStorage.setItem('ndv_budget_logs', JSON.stringify(next));
            return next;
          });
        }
      }
      
      // 2. Notification for user
      let details: string[] = [];
      if (updatedData.status) details.push(`Trạng thái: ${updatedData.status}`);
      if (updatedData.amount) details.push(`Số tiền: ${updatedData.amount.toLocaleString()} đ`);
      if (updatedData.fine !== undefined) details.push(`Phí phạt: ${updatedData.fine.toLocaleString()} đ`);
      if (updatedData.date) details.push(`Ngày thanh toán: ${updatedData.date}`);
      
      let detail = `Khoản vay mã số ${loanId} đã được quản trị viên điều chỉnh thông tin.`;
      if (details.length > 0) {
        detail = `Khoản vay mã số ${loanId} đã được cập nhật: ${details.join(', ')}.`;
      }
      
      addNotification(targetLoan.userId, 'Cập nhật khoản vay', `Admin đã thực hiện cập nhật thông tin cho khoản vay mã số ${targetLoan.id}. Nội dung: ${detail}. Vui lòng kiểm tra lại tình trạng khoản vay của mình.`, 'LOAN');
    } catch (e: any) {
      console.error("Lỗi sửa khoản vay Admin:", e);
    } finally {
      setIsGlobalProcessing(false);
    }
  };

  const handleDeleteLoan = async (loanId: string) => {
    if (isGlobalProcessing) return;
    setIsGlobalProcessing(true);
    try {
      const resp = await authenticatedFetch('/api/loan/delete', {
        method: 'POST',
        body: JSON.stringify({ loanId })
      });
      if (resp.ok) {
        setLoans(prev => prev.filter(l => l.id !== loanId));
        toast.success("Đã xóa khoản vay");
      } else {
        const err = await resp.json();
        toast.error(err.error || "Không thể xóa khoản vay");
      }
    } catch (e) {
      console.error("Error deleting loan:", e);
      toast.error("Lỗi hệ thống khi xóa");
    } finally {
      setIsGlobalProcessing(false);
    }
  };

  const handleDeleteBudgetLog = async (logId: string) => {
    if (isGlobalProcessing) return;
    setIsGlobalProcessing(true);
    try {
      const resp = await authenticatedFetch('/api/budget-log/delete', {
        method: 'POST',
        body: JSON.stringify({ logId })
      });
      if (resp.ok) {
        const result = await resp.json();
        setBudgetLogs(prev => prev.filter(l => l.id !== logId));
        if (result.newBudget !== undefined) {
          setSystemBudget(result.newBudget);
        }
        if (result.newLoanProfit !== undefined) {
          setLoanProfit(result.newLoanProfit);
          localStorage.setItem('ndv_loan_profit', result.newLoanProfit.toString());
        }
        if (result.newRankProfit !== undefined) {
          setRankProfit(result.newRankProfit);
          localStorage.setItem('ndv_rank_profit', result.newRankProfit.toString());
        }
        toast.success("Đã xóa log thu chi thành công. Dữ liệu hệ thống đã được hoàn lại.");
      } else {
        const err = await resp.json();
        toast.error(err.error || "Không thể xóa log");
      }
    } catch (e) {
      console.error("Error deleting budget log:", e);
      toast.error("Lỗi hệ thống khi xóa");
    } finally {
      setIsGlobalProcessing(false);
    }
  };

  // Automatic Financial Statistics Calculation
  useEffect(() => {
    if (!registeredUsers.length || !settings.RANK_CONFIG) return;

    const calculateStats = () => {
      // 1. Calculate Rank Profit
      // Profit is only earned when a user is ABOVE the lowest possible rank in the system
      let derivedRankProfit = 0;
      const upgradePercent = Number(settings.UPGRADE_PERCENT || 0);
      
      const sortedRanks = settings.RANK_CONFIG ? [...settings.RANK_CONFIG].sort((a, b) => a.maxLimit - b.maxLimit) : [];
      const lowestRankId = sortedRanks.length > 0 ? sortedRanks[0].id : 'standard';

      registeredUsers.forEach(u => {
        // ID 5444 is an exception: manually upgraded by Admin without fee
        if (u.rank && u.rank !== lowestRankId && !u.isFreeUpgrade && u.id !== '5444') {
          const rankConf = settings.RANK_CONFIG?.find(r => r.id === u.rank);
          if (rankConf) {
            derivedRankProfit += (rankConf.maxLimit * (upgradePercent / 100));
          }
        }
      });

      // 2. Calculate Loan Profit (Fees & Fines)
      let derivedLoanProfit = 0;
      const feePercent = Number(settings.PRE_DISBURSEMENT_FEE || 0) / 100;
      
      loans.forEach(loan => {
        // Fee is earned when loan is disbursed (status is active or settled)
        if (['ĐANG NỢ', 'ĐÃ TẤT TOÁN', 'CHỜ TẤT TOÁN', 'ĐANG ĐỐI SOÁT'].includes(loan.status)) {
          derivedLoanProfit += (loan.amount * feePercent);
        }
        
        // Fines are earned when loan is settled
        if (loan.status === 'ĐÃ TẤT TOÁN' && loan.fine) {
          derivedLoanProfit += loan.fine;
        }
        
        // Note: Voucher discounts are harder to track automatically without a dedicated field in LoanRecord
        // but for now we prioritize the main fee/fine calculation which covers the user's discrepancy.
      });

      // Update local state if different (to avoid infinite loops, we check if the change is significant)
      if (Math.abs(derivedRankProfit - rankProfit) > 1) {
        setRankProfit(derivedRankProfit);
      }
      if (Math.abs(derivedLoanProfit - loanProfit) > 1) {
        setLoanProfit(derivedLoanProfit);
      }

      // 3. Update Monthly Stats for current month
      const now = new Date();
      const monthKey = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
      const totalProfit = derivedRankProfit + derivedLoanProfit;
      
      setMonthlyStats(prev => {
        const next = [...prev];
        const existingIdx = next.findIndex(s => s.month === monthKey);
        
        // We only update the current month's total. 
        // Note: This is an approximation since monthlyStats usually tracks 
        // profit *earned in that month*, while derivedRankProfit is *total*.
        // But for a single-user app, this keeps the chart in sync.
        if (existingIdx !== -1) {
          if (Math.abs(next[existingIdx].totalProfit - totalProfit) > 1) {
            next[existingIdx] = { 
              ...next[existingIdx], 
              rankProfit: derivedRankProfit, 
              loanProfit: derivedLoanProfit, 
              totalProfit: totalProfit 
            };
            return next;
          }
        } else {
          // Add new month if not exists
          return [{ month: monthKey, rankProfit: derivedRankProfit, loanProfit: derivedLoanProfit, totalProfit: totalProfit }, ...prev].slice(0, 6);
        }
        return prev;
      });
    };

    calculateStats();
  }, [registeredUsers, loans, settings.UPGRADE_PERCENT, settings.PRE_DISBURSEMENT_FEE, settings.RANK_CONFIG]);

  const handleResetRankProfit = async () => {
    setRankProfit(0);
    try {
      await authenticatedFetch('/api/rankProfit', {
        method: 'POST',
        body: JSON.stringify({ rankProfit: 0 })
      });
    } catch (e) {
      console.error("Lỗi khi reset phí nâng hạng:", e);
    }
  };

  const handleResetLoanProfit = async () => {
    setLoanProfit(0);
    try {
      await authenticatedFetch('/api/loanProfit', {
        method: 'POST',
        body: JSON.stringify({ loanProfit: 0 })
      });
    } catch (e) {
      console.error("Lỗi khi reset lợi nhuận phí và phạt:", e);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await authenticatedFetch(`/api/users/${userId}`, { method: 'DELETE' });
      setRegisteredUsers(prev => prev.filter(u => u.id !== userId));
      setLoans(prev => prev.filter(l => l.userId !== userId));
    } catch (e) {
      console.error("Lỗi khi xóa user:", e);
    }
  };

  const handleAutoCleanupUsers = async () => {
    const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const usersToDelete = registeredUsers.filter(u => {
      if (u.isAdmin) return false;
      
      const userLoans = loans.filter(l => l.userId === u.id);
      
      // Check if user has any active/pending loans
      const hasActiveLoans = userLoans.some(l => 
        !['ĐÃ TẤT TOÁN', 'BỊ TỪ CHỐI'].includes(l.status)
      );
      
      if (hasActiveLoans) return false;

      // Find the latest activity timestamp for this user
      let lastActivity = u.updatedAt || 0;
      userLoans.forEach(l => {
        if (l.updatedAt && l.updatedAt > lastActivity) {
          lastActivity = l.updatedAt;
        }
      });

      // If no activity recorded at all (shouldn't happen with updatedAt), use joinDate as fallback
      if (lastActivity === 0 && u.joinDate) {
        try {
          // joinDate format: "HH:mm:ss DD/MM/YYYY"
          const parts = u.joinDate.split(' ');
          if (parts.length === 2) {
            const [d, m, y] = parts[1].split('/').map(Number);
            const [h, min, s] = parts[0].split(':').map(Number);
            lastActivity = new Date(y, m - 1, d, h, min, s).getTime();
          }
        } catch (e) {
          lastActivity = 0;
        }
      }

      // Only delete if inactive for more than 60 days
      return (now - lastActivity) > SIXTY_DAYS_MS;
    });
    
    for (const u of usersToDelete) {
      try {
        await authenticatedFetch(`/api/users/${u.id}`, { method: 'DELETE' });
      } catch (e) {
        console.error("Lỗi khi dọn dẹp user:", u.id, e);
      }
    }
    
    setRegisteredUsers(prev => prev.filter(u => !usersToDelete.some(td => td.id === u.id)));
    setLoans(prev => prev.filter(l => !usersToDelete.some(td => td.id === l.userId)));
    return usersToDelete.length;
  };

  const adminNotificationCount = useMemo(() => 
    loans.filter(l => l.status === 'CHỜ DUYỆT' || l.status === 'CHỜ TẤT TOÁN').length +
    registeredUsers.filter(u => u.pendingUpgradeRank).length +
    adminNotifications.filter(n => !n.read).length
  , [loans, registeredUsers, adminNotifications]);

  const handleUpdateProfile = async (userData: Partial<User>) => {
    if (user) {
      setIsGlobalProcessing(true);
      try {
        // Tải ảnh lên ImgBB nếu có thay đổi
        let idFrontUrl = userData.idFront;
        let idBackUrl = userData.idBack;

        if (userData.idFront && userData.idFront.startsWith('data:image')) {
          const compressed = await compressImage(userData.idFront, 1000, 1000);
          idFrontUrl = await uploadToImgBB(compressed, `MT_${user.id}_${Date.now()}`, settings.IMGBB_API_KEY);
        }
        if (userData.idBack && userData.idBack.startsWith('data:image')) {
          const compressed = await compressImage(userData.idBack, 1000, 1000);
          idBackUrl = await uploadToImgBB(compressed, `MS_${user.id}_${Date.now()}`, settings.IMGBB_API_KEY);
        }

        const updatedUser = { 
          ...user, 
          ...userData, 
          idFront: idFrontUrl || user.idFront,
          idBack: idBackUrl || user.idBack,
          updatedAt: Date.now() 
        };
        const newUsers = registeredUsers.map(u => u.id === user.id ? updatedUser : u);
        // Optimistic UI Update - 0ms response
        setUser(updatedUser);
        setRegisteredUsers(newUsers);
        
        // If password was updated, add a specific notification
        if (userData.password) {
          addNotification(user.id, 'Bảo mật tài khoản', 'Mật khẩu đăng nhập của bạn đã được thay đổi thành công. Hệ thống yêu cầu quý khách sử dụng mật khẩu mới cho các lần đăng nhập tiếp theo để đảm bảo an toàn.', 'SYSTEM');
        } else {
          addNotification(user.id, 'Cập nhật thông tin', 'Thông tin cá nhân (Họ tên, CCCD, Ảnh chân dung) của bạn đã được cập nhật thành công và lưu trữ an toàn trên hệ thống.', 'SYSTEM');
        }

        // Persist to server - Targeted sync
        authenticatedFetch('/api/users', {
          method: 'POST',
          body: JSON.stringify([updatedUser])
        }).catch(e => console.error("Lỗi lưu hồ sơ:", e));
      } catch (e) {
        console.error("Lỗi cập nhật hồ sơ:", e);
      } finally {
        setIsGlobalProcessing(false);
      }
    }
  };

  const handleUpdatePassword = async (oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "Bạn chưa đăng nhập" };
    
    setIsGlobalProcessing(true);
    try {
      const response = await authenticatedFetch('/api/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword })
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        addNotification(user.id, 'Bảo mật tài khoản', 'Mật khẩu đăng nhập của bạn đã được thay đổi thành công.', 'SYSTEM');
        return { success: true };
      } else {
        return { success: false, error: data.error || "Không thể đổi mật khẩu" };
      }
    } catch (e: any) {
      console.error("Lỗi đổi mật khẩu:", e);
      return { success: false, error: "Lỗi kết nối máy chủ" };
    } finally {
      setIsGlobalProcessing(false);
    }
  };

  const handleUpdateBank = (bankData: { bankName: string; bankAccountNumber: string; bankAccountHolder: string }) => {
    if (user) {
      const updatedUser = { ...user, ...bankData, updatedAt: Date.now() };
      const newUsers = registeredUsers.map(u => u.id === user.id ? updatedUser : u);
      // Optimistic UI Update - 0ms response
      setUser(updatedUser);
      setRegisteredUsers(newUsers);
      addNotification(user.id, 'Cập nhật tài khoản', 'Thông tin tài khoản ngân hàng nhận tiền của bạn đã được cập nhật thành công. Các yêu cầu giao dịch trong tương lai sẽ được thực hiện qua tài khoản mới này.', 'SYSTEM');
      setShowProfileWarning(false);
      
      // Persist to server - Targeted sync
      authenticatedFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify([updatedUser])
      }).catch(e => console.error("Lỗi lưu tài khoản ngân hàng:", e));
    }
  };

  const handleSaveSettings = async (newSettings: Partial<AppSettings>) => {
    // Optimistic update
    setSettings(prev => ({ ...prev, ...newSettings }));
    
    try {
      const response = await authenticatedFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update settings');
      }
      
      const data = await response.json();
      if (data.settings) {
        setSettings(data.settings);
      }
      toast.success('Đã cập nhật cài đặt hệ thống thành công');
    } catch (e) {
      console.error("Lỗi cập nhật cài đặt:", e);
      toast.error('Lỗi khi lưu cài đặt vào máy chủ');
    }
  };

  const handleSystemRefresh = async (targetView?: AppView) => {
    setIsGlobalProcessing(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    try {
      // ONLY clear storage if EXPLICITLY requested
      if (targetView === AppView.LOGIN) {
        localStorage.removeItem('ndv_user_id');
        setUser(null);
        setRegisteredUsers([]); 
      }
      
      const realTarget = targetView || currentView;
      const params = new URLSearchParams();
      params.append('checkStorage', 'true');
      params.append('t', Date.now().toString());
      
      const response = await authenticatedFetch(`/api/data?${params.toString()}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new Error('Failed to fetch data');
      
      const data = await response.json();
      
      if (data.users) {
        const cleanUsers = Array.isArray(data.users) 
          ? data.users.filter((u: any) => u && u.id && u.phone && !u.isAdmin)
          : [];
        setRegisteredUsers(cleanUsers);
        localStorage.setItem('ndv_users', JSON.stringify(cleanUsers));
      }
      if (data.loans) setLoans(data.loans);
      if (data.notifications) setNotifications(deduplicateNotifications(data.notifications));
      if (data.budget !== undefined) setSystemBudget(data.budget);
      if (data.rankProfit !== undefined) setRankProfit(data.rankProfit);
      if (data.loanProfit !== undefined) setLoanProfit(data.loanProfit);
      if (data.monthlyStats) setMonthlyStats(data.monthlyStats);
      
      setStorageFull(data.storageFull);
      setStorageUsage(data.storageUsage);
      
      setCurrentView(realTarget);
    } catch (e) {
      console.error("Lỗi làm mới hệ thống:", e);
      // Fallback to reload if everything fails
      window.location.href = window.location.origin;
    } finally {
      setIsGlobalProcessing(false);
    }
  };

  const renderView = () => {
    // Maintenance Mode Enforcement: Allow admins, but block normal users
    if (settings.MAINTENANCE_MODE && (!user || !user.isAdmin)) {
      // Allow LOGIN and REGISTER views so non-admins can reach login to check status
      // or admins can login
      if (currentView !== AppView.LOGIN && currentView !== AppView.REGISTER) {
        return <MaintenanceScreen onLogout={handleLogout} />;
      }
    }

    switch (currentView) {
      case AppView.LOGIN: return (
        <Login 
          onLogin={handleLogin} 
          onNavigateRegister={() => { setRegisterError(null); setCurrentView(AppView.REGISTER); }} 
          error={loginError}
          rememberMe={rememberMe}
          onToggleRememberMe={setRememberMe}
        />
      );
      case AppView.REGISTER: return <Register onBack={() => setCurrentView(AppView.LOGIN)} onRegister={handleRegister} onClearError={() => setRegisterError(null)} error={registerError} settings={settings} />;
      case AppView.DASHBOARD: 
        return (
          <Dashboard 
            user={user} 
            loans={loans.filter(l => l.userId === user?.id)} 
            notifications={notifications}
            systemBudget={systemBudget} 
            onApply={() => {
              if (!hasBankInfo(user)) {
                setShowProfileWarning(true);
                return;
              }
              setCurrentView(AppView.APPLY_LOAN);
            }} 
            onLogout={handleLogout} 
            onViewAllLoans={() => {
              if (!hasBankInfo(user)) {
                setShowProfileWarning(true);
                return;
              }
              setCurrentView(AppView.APPLY_LOAN);
            }}
            onSettleLoan={(loan) => {
              setSettleLoanFromDash(loan);
              setCurrentView(AppView.APPLY_LOAN);
            }}
            onPayOSSettle={(loan) => handlePayOSPayment('SETTLE', loan.id, loan.amount + (loan.fine || 0))}
            onViewContract={(loan) => {
              setViewLoanFromDash(loan);
              setCurrentView(AppView.APPLY_LOAN);
            }}
            onMarkNotificationRead={(id) => handleMarkNotificationRead(id)}
            onMarkAllNotificationsRead={() => {
              if (user) {
                const userNotifs = notifications.map(n => ({ ...n, read: true }));
                setNotifications(userNotifs);
                setLastSeenNotificationCount(0);
                localStorage.setItem('ndv_last_seen_notif_count', '0');
                authenticatedFetch('/api/notifications', {
                  method: 'POST',
                  body: JSON.stringify(userNotifs)
                });
              }
            }}
            onRefresh={() => fetchFullData(true)}
            onOpenLuckySpin={handleOpenLuckySpin}
            settings={settings}
          />
        );
      case AppView.APPLY_LOAN: 
        return (
          <LoanApplication 
            user={user} 
            loans={loans.filter(l => l.userId === user?.id)} 
            systemBudget={systemBudget} 
            isGlobalProcessing={isGlobalProcessing}
            onApplyLoan={handleApplyLoan} 
            onSettleLoan={handleSettleLoan}
            onPayOSPayment={handlePayOSPayment}
            onBack={() => {
              setSettleLoanFromDash(null);
              setViewLoanFromDash(null);
              setCurrentView(user?.isAdmin ? AppView.ADMIN_DASHBOARD : AppView.DASHBOARD);
            }}
            token={token}
            initialLoanToSettle={settleLoanFromDash}
            initialLoanToView={viewLoanFromDash}
            settings={settings}
          />
        );
      case AppView.RANK_LIMITS: return <RankLimits user={user} isGlobalProcessing={isGlobalProcessing} onBack={() => setCurrentView(user?.isAdmin ? AppView.ADMIN_DASHBOARD : AppView.DASHBOARD)} onUpgrade={handleUpgradeRank} onPayOSUpgrade={(rank, amount) => handlePayOSPayment('UPGRADE', user?.id || '', amount, rank)} onCancelUpgrade={handleCancelUpgrade} settings={settings} />;
      case AppView.PROFILE: 
        return (
          <Profile 
            user={user} 
            onBack={() => setCurrentView(user?.isAdmin ? AppView.ADMIN_DASHBOARD : AppView.DASHBOARD)} 
            onLogout={handleLogout} 
            onUpdateBank={handleUpdateBank}
            onUpdateProfile={handleUpdateProfile}
            onRefresh={() => fetchFullData(true)}
            onShowSecurity={() => setShowSecurityModal(true)}
            onShowTerms={() => setShowTermsModal(true)}
            onShowBankInfo={() => setShowBankInfoModal(true)}
            onShowEditProfile={() => setShowEditProfileModal(true)}
            settings={settings}
          />
        );
      case AppView.ADMIN_DASHBOARD: return (
        <AdminDashboard 
          user={user} 
          loans={loans} 
          registeredUsersCount={registeredUsers.length} 
          systemBudget={systemBudget} 
          rankProfit={rankProfit} 
          loanProfit={loanProfit} 
          monthlyStats={monthlyStats} 
          budgetLogs={budgetLogs} 
          lastKeepAlive={lastKeepAlive} 
          onResetRankProfit={handleResetRankProfit} 
          onResetLoanProfit={handleResetLoanProfit} 
          onNavigateToUsers={() => setCurrentView(AppView.ADMIN_USERS)} 
          onNavigateToBudget={() => setCurrentView(AppView.ADMIN_BUDGET)} 
          onLogout={handleLogout} 
          onDeleteLog={handleDeleteBudgetLog}
          onRefresh={() => fetchFullData(true)} 
          authenticatedFetch={authenticatedFetch} 
          settings={settings}
          notifications={adminNotifications}
          onMarkNotificationRead={(id) => handleMarkNotificationRead(id)}
          onUpdateSettings={handleSaveSettings}
        />
      );
      case AppView.ADMIN_USERS: return <AdminUserManagement users={registeredUsers} loans={loans} isGlobalProcessing={isGlobalProcessing} onAction={handleAdminUserAction} onLoanAction={handleAdminLoanAction} onEditUser={handleAdminEditUser} onResetPassword={handleAdminResetPassword} onEditLoan={handleAdminEditLoan} onDeleteUser={handleDeleteUser} onDeleteLoan={handleDeleteLoan} onAutoCleanup={handleAutoCleanupUsers} onFetchFullData={fetchFullData} onFetchUserDetail={handleFetchUserDetail} onRefresh={() => fetchFullData(true)} onBack={() => setCurrentView(AppView.ADMIN_DASHBOARD)} totalUsers={totalUsers} totalLoans={totalLoans} onSearchUsers={(term: string) => setUserSearchTerm(term)} onSearchLoans={(term: string) => setLoanSearchTerm(term)} userRange={userRange} loanRange={loanRange} onSetUserRange={setUserRange} onSetLoanRange={setLoanRange} settings={settings} />;
      case AppView.ADMIN_BUDGET: 
        return (
          <AdminBudget 
            currentBudget={systemBudget} 
            logs={budgetLogs}
            onUpdateBudget={handleUpdateBudget}
            onDeleteLog={handleDeleteBudgetLog}
            onBack={() => setCurrentView(AppView.ADMIN_DASHBOARD)} 
            settings={settings}
          />
        );
      case AppView.ADMIN_SYSTEM:
        return (
          <AdminSystem 
            onReset={async () => {
              try {
                await authenticatedFetch('/api/reset', { method: 'POST' });
                handleSystemRefresh(AppView.LOGIN);
              } catch (e) {
                console.error("Lỗi reset hệ thống:", e);
              }
            }}
            onImportSuccess={() => handleSystemRefresh(AppView.LOGIN)}
            onBack={() => setCurrentView(AppView.ADMIN_DASHBOARD)} 
            authenticatedFetch={authenticatedFetch}
            settings={settings}
            onSettingsUpdate={(newSettings: any) => setSettings(prev => ({ ...prev, ...newSettings }))}
          />
        );
      default: 
        return (
          <Dashboard 
            user={user} 
            loans={loans.filter(l => l.userId === user?.id)} 
            notifications={notifications.filter(n => n.userId === user?.id)}
            systemBudget={systemBudget} 
            onApply={() => {
              if (!hasBankInfo(user)) {
                setShowProfileWarning(true);
                return;
              }
              setCurrentView(AppView.APPLY_LOAN);
            }} 
            onLogout={handleLogout} 
            onViewAllLoans={() => {
              if (!hasBankInfo(user)) {
                setShowProfileWarning(true);
                return;
              }
              setCurrentView(AppView.APPLY_LOAN);
            }}
            onSettleLoan={(loan) => {
              setSettleLoanFromDash(loan);
              setCurrentView(AppView.APPLY_LOAN);
            }}
            onPayOSSettle={(loan) => handlePayOSPayment('SETTLE', loan.id, loan.amount + (loan.fine || 0))}
            onViewContract={(loan) => {
              setViewLoanFromDash(loan);
              setCurrentView(AppView.APPLY_LOAN);
            }}
            onMarkNotificationRead={(id) => {
              const updatedNotif = notifications.find(n => n.id === id);
              if (updatedNotif) {
                const newNotif = { ...updatedNotif, read: true };
                setNotifications(prev => {
                  const updated = prev.map(n => n.id === id ? newNotif : n);
                  if (user) {
                    const userNotifs = updated.filter(un => un.userId === user.id);
                    const unreadCount = userNotifs.filter(un => !un.isRead).length;
                    setLastSeenNotificationCount(unreadCount);
                    localStorage.setItem('ndv_last_seen_notif_count', unreadCount.toString());
                  }
                  return updated;
                });
                // Targeted Sync - Only send the changed notification
                authenticatedFetch('/api/notifications', {
                  method: 'POST',
                  body: JSON.stringify([newNotif])
                }).catch(e => console.error("Lỗi lưu trạng thái thông báo:", e));
              }
            }}
            onMarkAllNotificationsRead={() => {
              if (user) {
                const userNotifs = notifications.filter(n => n.userId === user.id);
                const updatedNotifs = userNotifs.map(n => ({ ...n, read: true }));
                setNotifications(prev => prev.map(n => n.userId === user.id ? { ...n, read: true } : n));
                
                // Reset count since all are read
                setLastSeenNotificationCount(0);
                localStorage.setItem('ndv_last_seen_notif_count', '0');

                // Targeted Sync - Only send notifications for this user
                authenticatedFetch('/api/notifications', {
                  method: 'POST',
                  body: JSON.stringify(updatedNotifs)
                });
              }
            }}
            onRefresh={() => fetchFullData(true)}
            onOpenLuckySpin={handleOpenLuckySpin}
            settings={settings}
          />
        );
    }
  };

  const showNavbar = user && currentView !== AppView.LOGIN && currentView !== AppView.REGISTER && (user.isAdmin || !settings.MAINTENANCE_MODE);

  if (!isInitialized) {
    return (
      <div className="h-[100dvh] bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#ff8c00] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <Toaster position="top-center" richColors />
        <div className="h-[100dvh] bg-black text-white flex flex-col max-w-md mx-auto relative overflow-hidden">
        {storageFull && !user?.isAdmin && (
          <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center text-[#ff8c00] animate-pulse">
              <AlertTriangle size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black uppercase tracking-tighter">Hệ thống bảo trì</h2>
              <p className="text-sm font-bold text-gray-500 leading-relaxed">
                Hệ thống đang quá tải dung lượng lưu trữ và cần bảo trì định kỳ. Vui lòng quay lại sau ít phút.
              </p>
            </div>
            <div className="w-12 h-1 bg-orange-500/20 rounded-full"></div>
          </div>
        )}

        {storageFull && user?.isAdmin && (
          <div className="fixed top-0 left-0 right-0 z-[1000] bg-red-600 text-white px-4 py-2 flex items-center justify-between shadow-lg max-w-md mx-auto">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="animate-bounce" />
              <span className="text-[10px] font-black uppercase tracking-widest">CẢNH BÁO: DUNG LƯỢNG SẮP HẾT ({storageUsage}MB/45MB)</span>
            </div>
            <button onClick={() => setStorageFull(false)} className="text-white/50 hover:text-white"><X size={14} /></button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scroll-smooth relative">
          {renderView()}
          
          {/* Floating Zalo Button */}
          {user && !user.isAdmin && settings.ZALO_GROUP_LINK && !settings.MAINTENANCE_MODE && (
            <a 
              href={settings.ZALO_GROUP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="fixed bottom-24 right-4 z-[100] w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20 active:scale-90 transition-all animate-bounce"
            >
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Icon_of_Zalo.svg/1200px-Icon_of_Zalo.svg.png" 
                alt="Zalo" 
                className="w-8 h-8 object-contain"
                referrerPolicy="no-referrer"
              />
            </a>
          )}
        </div>

        {dbError && (
          <DatabaseErrorModal 
            error={dbError} 
            onRetry={() => {
              setDbError(null);
              window.location.reload();
            }} 
            onClose={() => setDbError(null)} 
          />
        )}
        {showProfileWarning && user && currentView !== AppView.PROFILE && (
          <ProfileUpdateWarning 
            missingBank={!hasBankInfo(user)}
            missingAvatar={!user.avatar}
            onUpdateBank={() => {
              setShowProfileWarning(false);
              setCurrentView(AppView.PROFILE);
              // Optionally open the bank modal directly if Profile view supports it
              // But standard flow seems to be just going to Profile
            }}
            onUpdateAvatar={() => {
              setShowProfileWarning(false);
              setCurrentView(AppView.PROFILE);
            }}
          />
        )}
        {showNavbar && (
          <div className="bg-[#111111]/95 backdrop-blur-xl border-t border-white/10 px-4 py-4 flex justify-between items-center z-[50] safe-area-bottom flex-none">
            {user?.isAdmin ? (
              <>
                <button onClick={() => setCurrentView(AppView.ADMIN_DASHBOARD)} className={`flex flex-col items-center gap-1 flex-1 ${currentView === AppView.ADMIN_DASHBOARD ? 'text-[#ff8c00]' : 'text-gray-500'}`}><LayoutGrid size={22} /><span className="text-[7px] font-black uppercase tracking-widest">Tổng quan</span></button>
                <button 
                  onClick={() => {
                    fetchFullData();
                    setCurrentView(AppView.ADMIN_USERS);
                  }} 
                  className={`flex flex-col items-center gap-1 flex-1 relative ${currentView === AppView.ADMIN_USERS ? 'text-[#ff8c00]' : 'text-gray-500'}`}
                >
                  <div className="relative"><Users size={22} />{adminNotificationCount > 0 && <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center border-2 border-[#111111] animate-bounce"><span className="text-[7px] font-black text-white">{adminNotificationCount}</span></div>}</div>
                  <span className="text-[7px] font-black uppercase tracking-widest">Người dùng</span>
                </button>
                <button onClick={() => setCurrentView(AppView.ADMIN_BUDGET)} className={`flex flex-col items-center gap-1 flex-1 ${currentView === AppView.ADMIN_BUDGET ? 'text-[#ff8c00]' : 'text-gray-500'}`}><Wallet size={22} /><span className="text-[7px] font-black uppercase tracking-widest">Ngân sách</span></button>
                <button onClick={() => setCurrentView(AppView.ADMIN_SYSTEM)} className={`flex flex-col items-center gap-1 flex-1 ${currentView === AppView.ADMIN_SYSTEM ? 'text-[#ff8c00]' : 'text-gray-500'}`}><Settings size={22} /><span className="text-[7px] font-black uppercase tracking-widest">Hệ thống</span></button>
                <button 
                  onClick={() => fetchFullData(true)} 
                  disabled={isGlobalProcessing}
                  className="flex flex-col items-center gap-1 flex-1 text-gray-500 hover:text-white transition-all"
                >
                  <RefreshCcw size={22} className={isGlobalProcessing ? 'animate-spin' : ''} />
                  <span className="text-[7px] font-black uppercase tracking-widest">Cập nhật</span>
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => {
                    setSettleLoanFromDash(null);
                    setViewLoanFromDash(null);
                    setCurrentView(AppView.DASHBOARD);
                  }} 
                  className={`flex flex-col items-center gap-1 flex-1 ${currentView === AppView.DASHBOARD ? 'text-[#ff8c00]' : 'text-gray-500'}`}
                >
                  <Home size={22} />
                  <span className="text-[7px] font-black uppercase tracking-widest">Trang chủ</span>
                </button>
                <button 
                  onClick={() => {
                    if (!hasBankInfo(user)) {
                      setShowProfileWarning(true);
                      return;
                    }
                    setSettleLoanFromDash(null);
                    setViewLoanFromDash(null);
                    setCurrentView(AppView.APPLY_LOAN);
                  }} 
                  className={`flex flex-col items-center gap-1 flex-1 ${currentView === AppView.APPLY_LOAN ? 'text-[#ff8c00]' : 'text-gray-500'}`}
                >
                  <Briefcase size={22} />
                  <span className="text-[7px] font-black uppercase tracking-widest">Vay</span>
                </button>
                <button 
                  onClick={() => {
                    if (!hasBankInfo(user)) {
                      setShowProfileWarning(true);
                      return;
                    }
                    setSettleLoanFromDash(null);
                    setViewLoanFromDash(null);
                    setCurrentView(AppView.RANK_LIMITS);
                  }} 
                  className={`flex flex-col items-center gap-1 flex-1 ${currentView === AppView.RANK_LIMITS ? 'text-[#ff8c00]' : 'text-gray-500'}`}
                >
                  <Medal size={22} />
                  <span className="text-[7px] font-black uppercase tracking-widest">Hạn mức</span>
                </button>
                <button 
                  onClick={() => {
                    setSettleLoanFromDash(null);
                    setViewLoanFromDash(null);
                    fetchFullData();
                    setCurrentView(AppView.PROFILE);
                  }} 
                  className={`flex flex-col items-center gap-1 flex-1 ${currentView === AppView.PROFILE ? 'text-[#ff8c00]' : 'text-gray-500'}`}
                >
                  <UserIcon size={22} />
                  <span className="text-[7px] font-black uppercase tracking-widest">Cá nhân</span>
                </button>
                <button 
                  onClick={() => fetchFullData(true)} 
                  disabled={isGlobalProcessing}
                  className="flex flex-col items-center gap-1 flex-1 text-gray-500 hover:text-white transition-all"
                >
                  <RefreshCcw size={22} className={isGlobalProcessing ? 'animate-spin' : ''} />
                  <span className="text-[7px] font-black uppercase tracking-widest">Cập nhật</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Global Modals */}
        {showSecurityModal && (
          <SecurityModal 
            user={user}
            onClose={() => setShowSecurityModal(false)} 
            onLogout={handleLogout} 
            onUpdatePassword={handleUpdatePassword}
          />
        )}
        {showTermsModal && <TermsModal onClose={() => setShowTermsModal(false)} />}
        {showBankInfoModal && (
          <BankInfoModal 
            user={user} 
            onClose={() => setShowBankInfoModal(false)} 
            onUpdate={handleUpdateBank} 
          />
        )}
        {showEditProfileModal && (
          <EditProfileModal 
            user={user} 
            onClose={() => setShowEditProfileModal(false)} 
            onUpdate={handleUpdateProfile} 
            settings={settings}
          />
        )}
        <AnimatePresence>
          {user && !user.isAdmin && !settings.MAINTENANCE_MODE && (
            <SystemNotificationDrawer 
              message={settings?.SYSTEM_NOTIFICATION || ""}
              user={user}
              settings={settings}
              initialTab={drawerTab}
              forceExpand={showSystemNotification}
              isDashboard={currentView === AppView.DASHBOARD}
              onSpinResult={handleSpinResult}
              onClose={handleCloseSystemNotification}
            />
          )}
        </AnimatePresence>
      </div>
    </Suspense>
  </ErrorBoundary>
);
};

export default App;
