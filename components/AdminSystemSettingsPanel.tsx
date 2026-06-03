import React, { useState } from 'react';
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
  MessageCircle, 
  Eye, 
  EyeOff, 
  Zap, 
  Sparkles, 
  Plus, 
  Trash2, 
  FileText, 
  Wallet, 
  Trophy, 
  GripVertical, 
  ChevronRight, 
  Power
} from 'lucide-react';
import BankSearchableSelect from './BankSearchableSelect';

interface AdminSystemSettingsPanelProps {
  localSettings: any;
  setLocalSettings: React.Dispatch<React.SetStateAction<any>>;
  defaultSettings: any;
  isSavingSettings: boolean;
  hasChanges: boolean;
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
  showAdminPassword: any;
  setShowAdminPassword: React.Dispatch<React.SetStateAction<any>>;
  isCheckingBank: boolean;
  setIsCheckingBank: React.Dispatch<React.SetStateAction<boolean>>;
  copiedField: string | null;
  setCopiedField: React.Dispatch<React.SetStateAction<string | null>>;
  copyToClipboard: (text: string, fieldId: string) => void;
  pushForm: any;
  setPushForm: React.Dispatch<React.SetStateAction<any>>;
  isSendingPush: boolean;
  handleSendPush: () => Promise<void>;
  expandedConfigs: Record<string, boolean>;
  toggleConfigExpansion: (key: string) => void;
  handleAddRank: () => void;
  handleRemoveRank: (index: number) => void;
  handleRankUpdate: (index: number, field: string, val: any) => void;
  handleRegenerateRankFeatures: (index: number) => void;
  handleAddVoucherMilestone: () => void;
  handleRemoveVoucherMilestone: (index: number) => void;
  handleVoucherMilestoneUpdate: (index: number, field: string, val: any) => void;
  handleAddMasterConfig: (category: string) => void;
  handleRemoveMasterConfig: (index: number) => void;
  handleMasterConfigUpdate: (index: number, field: string, val: any) => void;
  handleMigrateUnified: () => void;
  handleOneClickSetup: () => void;
  isMigratingUnified: boolean;
  isScanning: boolean;
  handleCheckBankAccount: () => Promise<void>;
  setConfirmDialog: React.Dispatch<React.SetStateAction<any>>;
  formatNumberWithDots: (val: any) => string;
  parseNumberFromDots: (val: string) => number;
  handleSaveSettings: (filterKeys?: string[]) => Promise<void>;
  sqlSchema: string;
}

const ICON_COLORS = [
  { name: 'Xám', color: '#6b7280' },
  { name: 'Đồng', color: '#fdba74' },
  { name: 'Bạc', color: '#bfdbfe' },
  { name: 'Vàng', color: '#facc15' },
  { name: 'Bạch Kim', color: '#38bdf8' },
  { name: 'Kim Cương', color: '#60a5fa' },
  { name: 'Rubi', color: '#f87171' },
  { name: 'Lục Bảo', color: '#4ade80' },
  { name: 'Tím', color: '#a855f7' },
  { name: 'Hồng', color: '#ec4899' },
  { name: 'Cam', color: '#f97316' },
];

const AdminSystemSettingsPanel: React.FC<AdminSystemSettingsPanelProps> = ({
  localSettings,
  setLocalSettings,
  defaultSettings,
  isSavingSettings,
  hasChanges,
  setHasChanges,
  showAdminPassword,
  setShowAdminPassword,
  isCheckingBank,
  setIsCheckingBank,
  copiedField,
  setCopiedField,
  copyToClipboard,
  pushForm,
  setPushForm,
  isSendingPush,
  handleSendPush,
  expandedConfigs,
  toggleConfigExpansion,
  handleAddRank,
  handleRemoveRank,
  handleRankUpdate,
  handleRegenerateRankFeatures,
  handleAddVoucherMilestone,
  handleRemoveVoucherMilestone,
  handleVoucherMilestoneUpdate,
  handleAddMasterConfig,
  handleRemoveMasterConfig,
  handleMasterConfigUpdate,
  handleMigrateUnified,
  handleOneClickSetup,
  isMigratingUnified,
  isScanning,
  handleCheckBankAccount,
  setConfirmDialog,
  formatNumberWithDots,
  parseNumberFromDots,
  handleSaveSettings,
  sqlSchema
}) => {
  const [settingsTab, setSettingsTab] = useState<'security_tech' | 'payment_gate' | 'finance_ranks' | 'contracts_formats' | 'gift_rewards' | 'system_utils'>('security_tech');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (sectionKey: string) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const menuItems = [
    { id: 'security_tech', label: '🛡️ BẢO MẬT & KỸ THUẬT', desc: 'CSDL, API, Admin và Bảo trì' },
    { id: 'payment_gate', label: '💳 TÀI KHOẢN NHẬN TIỀN', desc: 'PayOS & Bank thụ nhận VietQR' },
    { id: 'finance_ranks', label: '💵 HẠN MỨC & TÀI CHÍNH', desc: 'Hạn mức vay, Phí dịch vụ, Hạng VIP' },
    { id: 'contracts_formats', label: '📄 ĐỊNH DẠNG & HỢP ĐỒNG', desc: 'Sửa điều khoản và thiết lập mã ID' },
    { id: 'gift_rewards', label: '🎁 SỰ KIỆN & QUÀ TẶNG', desc: 'Vòng quay và danh sách Vouchers' },
    { id: 'system_utils', label: '⚙️ TIỆN ÍCH HỆ THỐNG', desc: 'Link Zalo, Chữ chạy, Giả lập Robot' }
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Sidebar Navigation */}
      <div className="w-full lg:w-64 flex-none flex flex-col gap-2 self-start bg-black/40 p-2.5 rounded-2xl border border-white/5 shadow-inner">
        <div className="px-3 py-2 border-b border-white/5 mb-1.5">
          <span className="text-[8px] font-black tracking-widest text-[#ff8c00] uppercase">MỤC CẤU HÌNH</span>
        </div>
        {menuItems.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSettingsTab(tab.id as any)}
            className={`w-full text-left p-3.5 rounded-xl border transition-all duration-300 relative overflow-hidden group flex flex-col gap-1 ${
              settingsTab === tab.id
                ? 'bg-[#ff8c00]/15 border-[#ff8c00]/35 text-white shadow-lg shadow-orange-950/20'
                : 'bg-white/0 border-transparent text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            {settingsTab === tab.id && (
              <div className="absolute top-0 left-0 w-1 h-full bg-[#ff8c00]"></div>
            )}
            <div className="flex items-center justify-between">
              <span className={`text-[9px] font-black tracking-wide uppercase ${settingsTab === tab.id ? 'text-[#ff8c00]' : 'text-gray-300 group-hover:text-white'}`}>
                {tab.label}
              </span>
              <ChevronRight size={12} className={`transition-transform duration-300 ${settingsTab === tab.id ? 'translate-x-1 text-[#ff8c00]' : 'text-gray-600 group-hover:text-gray-400'}`} />
            </div>
            <span className="text-[7.5px] font-bold text-gray-500 uppercase leading-relaxed group-hover:text-gray-400">
              {tab.desc}
            </span>
          </button>
        ))}
      </div>

      {/* Main Settings Panel */}
      <div className="flex-1 min-w-0 bg-[#111111] border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        
        {/* TAB 1: BẢO MẬT & KỸ THUẬT */}
        {settingsTab === 'security_tech' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-300">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-400/10 flex items-center justify-center text-red-400">
                  <Shield size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">CHỈ SỐ AN NINH & KỸ THUẬT</h4>
                  <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Quản trị bảo mật, API, credentials và bảo trì hệ thống</p>
                </div>
              </div>
            </div>

            {/* Security Indicator Widgets & Maintenance Block */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
              <div 
                onClick={() => toggleSection('sec_indicators')}
                className="flex items-center justify-between cursor-pointer select-none group/hd"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3 bg-red-400 rounded-full"></div>
                  <h6 className="text-[9px] font-black text-white uppercase tracking-widest group-hover/hd:text-red-400 transition-colors">CHỈ SỐ AN NINH & BẢO TRÌ</h6>
                </div>
                <div className="text-gray-500 group-hover/hd:text-white transition-colors">
                  {openSections['sec_indicators'] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>
              {openSections['sec_indicators'] && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className={`p-4 rounded-xl border ${localSettings.JWT_SECRET === 'your-secret-key' ? 'bg-red-500/5 border-red-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
                                    <div className="flex items-start gap-3">
                                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${localSettings.JWT_SECRET === 'your-secret-key' ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                                        {localSettings.JWT_SECRET === 'your-secret-key' ? <AlertCircle size={15} /> : <Check size={15} />}
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-[9px] font-black text-white uppercase tracking-tight">JWT Secret Key</p>
                                        <p className="text-[8px] font-bold text-gray-500 leading-relaxed uppercase">
                                          {localSettings.JWT_SECRET === 'your-secret-key' 
                                            ? 'CẢNH BÁO: Bạn đang sử dụng Key mặc định. Vui lòng đổi ngay để tránh bị hack tài khoản.' 
                                            : 'An toàn: Bạn đã thay đổi Key bảo mật.'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                    
                                  <div className={`p-4 rounded-xl border ${localSettings.ADMIN_PASSWORD === 'admin123' ? 'bg-red-500/5 border-red-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
                                    <div className="flex items-start gap-3">
                                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${localSettings.ADMIN_PASSWORD === 'admin123' ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                                        {localSettings.ADMIN_PASSWORD === 'admin123' ? <AlertCircle size={15} /> : <Check size={15} />}
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-[9px] font-black text-white uppercase tracking-tight">Mật khẩu Admin</p>
                                        <p className="text-[8px] font-bold text-gray-500 leading-relaxed uppercase">
                                          {localSettings.ADMIN_PASSWORD === 'admin123' 
                                            ? 'CẢNH BÁO: Mật khẩu admin quá yếu hoặc đang để mặc định (admin123).' 
                                            : 'An toàn: Mật khẩu admin đã được thay đổi.'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                    
                                  <div className={`p-4 rounded-xl border ${!localSettings.IMGBB_API_KEY || localSettings.IMGBB_API_KEY.includes('your-imgbb') ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
                                    <div className="flex items-start gap-3">
                                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${!localSettings.IMGBB_API_KEY || localSettings.IMGBB_API_KEY.includes('your-imgbb') ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'}`}>
                                        {!localSettings.IMGBB_API_KEY || localSettings.IMGBB_API_KEY.includes('your-imgbb') ? <Info size={15} /> : <Check size={15} />}
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-[9px] font-black text-white uppercase tracking-tight">ImgBB API Key</p>
                                        <p className="text-[8px] font-bold text-gray-500 leading-relaxed uppercase">
                                          {!localSettings.IMGBB_API_KEY || localSettings.IMGBB_API_KEY.includes('your-imgbb') 
                                            ? 'Lưu ý: Chưa cấu hình ImgBB. Ảnh sẽ được lưu dưới dạng Base64 (nặng database).' 
                                            : 'Đã cấu hình: Ảnh sẽ được tải lên Cloud.'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                    
                                  <div className={`p-4 rounded-xl border ${!localSettings.PAYOS_API_KEY ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
                                    <div className="flex items-start gap-3">
                                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${!localSettings.PAYOS_API_KEY ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'}`}>
                                        {!localSettings.PAYOS_API_KEY ? <Info size={15} /> : <Check size={15} />}
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-[9px] font-black text-white uppercase tracking-tight">Thanh toán PayOS</p>
                                        <p className="text-[8px] font-bold text-gray-500 leading-relaxed uppercase">
                                          {!localSettings.PAYOS_API_KEY 
                                            ? 'Lưu ý: Chưa cấu hình PayOS. Các tính năng thanh toán tự động không thể chạy.' 
                                            : 'Đã cấu hình: Hệ thống thanh toán tự động sẵn sàng.'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                  </div>
                  
                  <div className="p-4 bg-yellow-500/5 border border-yellow-500/15 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${localSettings.MAINTENANCE_MODE ? 'bg-yellow-500 text-black' : 'bg-white/5 text-gray-400'}`}>
                                    <Power size={16} />
                                  </div>
                                  <div>
                                    <h6 className="text-[10px] font-black text-white uppercase">Chế độ bảo trì hệ thống</h6>
                                    <p className="text-[8px] font-semibold text-gray-500 uppercase mt-0.5">Vô hiệu hóa toàn bộ quyền truy cập của người dùng ngoại trừ Admin</p>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => {
                                    setLocalSettings({...localSettings, MAINTENANCE_MODE: !localSettings.MAINTENANCE_MODE});
                                    setHasChanges(true);
                                  }}
                                  className={`w-10 h-5 rounded-full relative transition-all ${localSettings.MAINTENANCE_MODE ? 'bg-yellow-500 animate-pulse' : 'bg-white/10'}`}
                                >
                                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${localSettings.MAINTENANCE_MODE ? 'left-5.5' : 'left-0.5'}`}></div>
                                </button>
                              </div>
                </div>
              )}
            </div>

            {/* Technical Parameters Input Fields */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
              <div 
                onClick={() => toggleSection('sec_params')}
                className="flex items-center justify-between cursor-pointer select-none group/hd"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3 bg-red-500 rounded-full"></div>
                  <h6 className="text-[9px] font-black text-white uppercase tracking-widest group-hover/hd:text-red-500 transition-colors">THIẾT LẬP THAM SỐ KỸ THUẬT</h6>
                </div>
                <div className="text-gray-500 group-hover/hd:text-white transition-colors">
                  {openSections['sec_params'] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>
              {openSections['sec_params'] && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200 mt-2">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest px-1">Supabase URL</label>
                  <input 
                    type="text" 
                    value={localSettings.SUPABASE_URL || ''}
                    placeholder={defaultSettings.SUPABASE_URL}
                    onChange={(e) => {
                      setLocalSettings({...localSettings, SUPABASE_URL: e.target.value});
                      setHasChanges(true);
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-3 text-[10px] font-bold text-white focus:border-[#ff8c00] outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest px-1">Service Key</label>
                  <input 
                    type="password" 
                    value={localSettings.SUPABASE_SERVICE_ROLE_KEY || ''}
                    placeholder={defaultSettings.SUPABASE_SERVICE_ROLE_KEY}
                    onChange={(e) => {
                      setLocalSettings({...localSettings, SUPABASE_SERVICE_ROLE_KEY: e.target.value});
                      setHasChanges(true);
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-3 text-[10px] font-bold text-white focus:border-[#ff8c00] outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest px-1">ImgBB API Key</label>
                  <input 
                    type="text" 
                    value={localSettings.IMGBB_API_KEY || ''}
                    placeholder={defaultSettings.IMGBB_API_KEY}
                    onChange={(e) => {
                      setLocalSettings({...localSettings, IMGBB_API_KEY: e.target.value});
                      setHasChanges(true);
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-3 text-[10px] font-bold text-white focus:border-[#ff8c00] outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest px-1">JWT Secret Key</label>
                  <input 
                    type="text" 
                    value={localSettings.JWT_SECRET || ''}
                    placeholder={defaultSettings.JWT_SECRET}
                    onChange={(e) => {
                      setLocalSettings({...localSettings, JWT_SECRET: e.target.value});
                      setHasChanges(true);
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-3 text-[10px] font-bold text-white focus:border-[#ff8c00] outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest px-1">SĐT Hotline hệ thống</label>
                  <input 
                    type="text" 
                    value={localSettings.ADMIN_PHONE || ''}
                    placeholder={defaultSettings.ADMIN_PHONE}
                    onChange={(e) => {
                      setLocalSettings({...localSettings, ADMIN_PHONE: e.target.value});
                      setHasChanges(true);
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-3 text-[10px] font-bold text-white focus:border-[#ff8c00] outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest px-1">MẬT KHẨU TRUY CẬP ADMIN</label>
                  <div className="relative">
                    <input 
                      type={showAdminPassword ? "text" : "password"}
                      value={localSettings.ADMIN_PASSWORD || ''}
                      placeholder={defaultSettings.ADMIN_PASSWORD}
                      onChange={(e) => {
                        setLocalSettings({...localSettings, ADMIN_PASSWORD: e.target.value});
                        setHasChanges(true);
                      }}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-3 text-[10px] font-bold text-white focus:border-[#ff8c00] outline-none transition-all pr-10"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                    >
                      {showAdminPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
              )}
            </div>

            <button 
              onClick={() => handleSaveSettings(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'IMGBB_API_KEY', 'JWT_SECRET', 'ADMIN_PHONE', 'ADMIN_PASSWORD', 'MAINTENANCE_MODE'])}
              disabled={isSavingSettings}
              className="w-full bg-red-600/10 border border-red-500/25 hover:bg-red-500/20 text-red-400 font-black py-4 rounded-xl text-[9px] uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSavingSettings ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
              LƯU CẤU HÌNH BẢO MẬT & KỸ THUẬT
            </button>
          </div>
        )}

        {/* TAB 2: TÀI KHOẢN NHẬN TIỀN */}
        {settingsTab === 'payment_gate' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-300">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-400/10 flex items-center justify-center text-orange-400">
                  <CreditCard size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">CẤU HÌNH NHẬN THANH TOÁN</h4>
                  <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Cấu hình cổng PayOS tự động hoặc tài khoản ngân hàng thụ hưởng qua VietQR</p>
                </div>
              </div>
            </div>

            {/* Toggle Gateway Systems */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
              <div 
                onClick={() => toggleSection('pay_gates')}
                className="flex items-center justify-between cursor-pointer select-none group/hd"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3 bg-orange-400 rounded-full"></div>
                  <h6 className="text-[9px] font-black text-white uppercase tracking-widest group-hover/hd:text-orange-400 transition-colors">CẤU HÌNH PHƯƠNG THỨC NHẬN TIỀN</h6>
                </div>
                <div className="text-gray-500 group-hover/hd:text-white transition-colors">
                  {openSections['pay_gates'] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>
              {openSections['pay_gates'] && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in duration-200">
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${localSettings.ENABLE_PAYOS ? 'bg-[#ff8c00]/25 text-[#ff8c00]' : 'bg-white/5 text-gray-500'}`}>
                    <Zap size={14} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-white uppercase block">Thanh toán Tự động PayOS</span>
                    <span className="text-[7.5px] font-semibold text-gray-500 uppercase mt-0.5">Xử lý tự động hóa hóa đơn</span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setLocalSettings({...localSettings, ENABLE_PAYOS: !localSettings.ENABLE_PAYOS});
                    setHasChanges(true);
                  }}
                  className={`w-9 h-5 rounded-full relative transition-all ${localSettings.ENABLE_PAYOS ? 'bg-[#ff8c00]' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${localSettings.ENABLE_PAYOS ? 'left-4.5' : 'left-0.5'}`}></div>
                </button>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${localSettings.ENABLE_VIETQR ? 'bg-[#ff8c00]/25 text-[#ff8c00]' : 'bg-white/5 text-gray-500'}`}>
                    <CreditCard size={14} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-white uppercase block">Chuyển khoản thủ công VietQR</span>
                    <span className="text-[7.5px] font-semibold text-gray-500 uppercase mt-0.5">Dựa trên mã QR ngân hàng đại lý</span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setLocalSettings({...localSettings, ENABLE_VIETQR: !localSettings.ENABLE_VIETQR});
                    setHasChanges(true);
                  }}
                  className={`w-9 h-5 rounded-full relative transition-all ${localSettings.ENABLE_VIETQR ? 'bg-[#ff8c00]' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${localSettings.ENABLE_VIETQR ? 'left-4.5' : 'left-0.5'}`}></div>
                </button>
              </div>
              </div>
              )}
            </div>

            {/* PayOS Credentials Form */}
            {localSettings.ENABLE_PAYOS && (
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
                <div 
                  onClick={() => toggleSection('pay_payos')}
                  className="flex items-center justify-between cursor-pointer select-none group/hd border-b border-white/5 pb-2"
                >
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-[#ff8c00]" />
                    <h6 className="text-[9px] font-black text-white uppercase tracking-widest group-hover/hd:text-[#ff8c00] transition-colors">KHOÁ KẾT NỐI PAYOS</h6>
                  </div>
                  <div className="text-gray-500 group-hover/hd:text-white transition-colors">
                    {openSections['pay_payos'] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </div>
                {openSections['pay_payos'] && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-in fade-in duration-200 mt-2">
                  <div className="space-y-1">
                    <label className="text-[7.5px] font-bold text-gray-500 uppercase px-1">PayOS Client ID</label>
                    <input 
                      type="text" 
                      value={localSettings.PAYOS_CLIENT_ID || ''}
                      placeholder={defaultSettings.PAYOS_CLIENT_ID}
                      onChange={(e) => {
                        setLocalSettings({...localSettings, PAYOS_CLIENT_ID: e.target.value});
                        setHasChanges(true);
                      }}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-[9px] font-bold text-white outline-none focus:border-[#ff8c00]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[7.5px] font-bold text-gray-500 uppercase px-1">PayOS API Key</label>
                    <input 
                      type="text" 
                      value={localSettings.PAYOS_API_KEY || ''}
                      placeholder={defaultSettings.PAYOS_API_KEY}
                      onChange={(e) => {
                        setLocalSettings({...localSettings, PAYOS_API_KEY: e.target.value});
                        setHasChanges(true);
                      }}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-[9px] font-bold text-white outline-none focus:border-[#ff8c00]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[7.5px] font-bold text-gray-500 uppercase px-1">PayOS Checksum Key</label>
                    <input 
                      type="text" 
                      value={localSettings.PAYOS_CHECKSUM_KEY || ''}
                      placeholder={defaultSettings.PAYOS_CHECKSUM_KEY}
                      onChange={(e) => {
                        setLocalSettings({...localSettings, PAYOS_CHECKSUM_KEY: e.target.value});
                        setHasChanges(true);
                      }}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-[9px] font-bold text-white outline-none focus:border-[#ff8c00]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
            {localSettings.ENABLE_VIETQR && (
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
                <div 
                  onClick={() => toggleSection('pay_vietqr')}
                  className="flex items-center justify-between cursor-pointer select-none group/hd border-b border-white/5 pb-2"
                >
                  <div className="flex items-center gap-2">
                    <CreditCard size={14} className="text-[#ff8c00]" />
                    <h6 className="text-[9px] font-black text-white uppercase tracking-widest group-hover/hd:text-[#ff8c00] transition-colors">TÀI KHOẢN NGÂN HÀNG THỤ HƯỞNG (VIETQR)</h6>
                  </div>
                  <div className="text-gray-500 group-hover/hd:text-white transition-colors">
                    {openSections['pay_vietqr'] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </div>
                {openSections['pay_vietqr'] && (
                  <div className="space-y-3 animate-in fade-in duration-200 mt-2">
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[8px] font-black text-gray-500 uppercase px-1">Tên ngân hàng đại lý</label>
                    <BankSearchableSelect 
                      value={localSettings.PAYMENT_ACCOUNT?.bankName || ''}
                      onChange={(name, bin) => {
                        setLocalSettings({
                          ...localSettings, 
                          PAYMENT_ACCOUNT: { ...(localSettings.PAYMENT_ACCOUNT || {}), bankName: name, bankBin: bin }
                        });
                        setHasChanges(true);
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 flex flex-col">
                      <label className="text-[8px] font-black text-gray-500 uppercase px-1">Số tài khoản thụ hưởng</label>
                      <div className="relative">
                        <input 
                          type="text"
                          value={localSettings.PAYMENT_ACCOUNT?.accountNumber || ''}
                          onChange={(e) => {
                            setLocalSettings({
                              ...localSettings, 
                              PAYMENT_ACCOUNT: { ...(localSettings.PAYMENT_ACCOUNT || {}), accountNumber: e.target.value }
                            });
                            setHasChanges(true);
                          }}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                          placeholder="Số tài khoản nhận tiền"
                        />
                        <button 
                          type="button"
                          onClick={handleCheckBankAccount}
                          disabled={isCheckingBank}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#ff8c00] hover:text-orange-300 disabled:opacity-40 transition-colors"
                          title="Xác thực tên tài khoản"
                        >
                          {isCheckingBank ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5 flex flex-col">
                      <label className="text-[8px] font-black text-gray-500 uppercase px-1">Tên chủ tài khoản ngân hàng</label>
                      <input 
                        type="text"
                        value={localSettings.PAYMENT_ACCOUNT?.accountName || ''}
                        onChange={(e) => {
                          setLocalSettings({
                            ...localSettings, 
                            PAYMENT_ACCOUNT: { ...(localSettings.PAYMENT_ACCOUNT || {}), accountName: e.target.value.toUpperCase() }
                          });
                          setHasChanges(true);
                        }}
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] font-extrabold text-[#ff8c00] outline-none focus:border-[#ff8c00] placeholder:text-gray-800"
                        placeholder="NỘI DUNG TÊN CHỦ SỞ HỮU"
                      />
                    </div>
                  </div>
                </div>
                )}
              </div>
            )}            <button 
              onClick={() => handleSaveSettings(['ENABLE_PAYOS', 'ENABLE_VIETQR', 'PAYMENT_ACCOUNT', 'PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'])}
              disabled={isSavingSettings}
              className="w-full bg-[#ff8c00]/10 border border-[#ff8c00]/25 hover:bg-[#ff8c00]/20 text-[#ff8c00] font-black py-4 rounded-xl text-[9px] uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSavingSettings ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
              LƯU THIẾT LẬP THANH TOÁN
            </button>
          </div>
        )}

        {/* TAB 3: HẠN MỨC & TÀI CHÍNH */}
        {settingsTab === 'finance_ranks' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-300">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-green-400/10 flex items-center justify-center text-green-400">
                  <Wallet size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">HẠN MỨC & CHÍNH SÁCH TÀI CHÍNH</h4>
                  <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Hạn mức giải ngân, biểu phí dịch vụ, phí phạt và các cấp bậc thành viên vip</p>
                </div>
              </div>
            </div>

            {/* Fees and Limits inputs Grid */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
              <div 
                onClick={() => toggleSection('fin_params')}
                className="flex items-center justify-between cursor-pointer select-none group/hd"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3 bg-green-500 rounded-full"></div>
                  <h6 className="text-[9px] font-black text-white uppercase tracking-widest group-hover/hd:text-green-500 transition-colors">THAM SỐ TÀI CHÍNH CỐ ĐỊNH</h6>
                </div>
                <div className="text-gray-500 group-hover/hd:text-white transition-colors">
                  {openSections['fin_params'] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>
              {openSections['fin_params'] && (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-200 mt-2">
                <div className="space-y-1">
                  <label className="text-[7.5px] font-black text-gray-500 uppercase px-1">PHÍ DỊCH VỤ (%)</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={formatNumberWithDots(localSettings.PRE_DISBURSEMENT_FEE)}
                    placeholder={formatNumberWithDots(defaultSettings.PRE_DISBURSEMENT_FEE)}
                    onChange={(e) => {
                      setLocalSettings({...localSettings, PRE_DISBURSEMENT_FEE: parseNumberFromDots(e.target.value)});
                      setHasChanges(true);
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[7.5px] font-black text-gray-500 uppercase px-1">PHÍ NÂNG HẠNG (%)</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={formatNumberWithDots(localSettings.UPGRADE_PERCENT)}
                    placeholder={formatNumberWithDots(defaultSettings.UPGRADE_PERCENT)}
                    onChange={(e) => {
                      setLocalSettings({...localSettings, UPGRADE_PERCENT: parseNumberFromDots(e.target.value)});
                      setHasChanges(true);
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[7.5px] font-black text-gray-500 uppercase px-1">TỈ LỆ PHÍ PHẠT (%/Ngày)</label>
                  <input 
                    type="text" 
                    value={localSettings.FINE_RATE || ''}
                    placeholder={defaultSettings.FINE_RATE}
                    onChange={(e) => {
                      setLocalSettings({...localSettings, FINE_RATE: e.target.value});
                      setHasChanges(true);
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[7.5px] font-black text-gray-500 uppercase px-1">HẠN MỨC VAY TỐI ĐA</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={formatNumberWithDots(localSettings.MAX_SINGLE_LOAN_AMOUNT)}
                    placeholder={formatNumberWithDots(defaultSettings.MAX_SINGLE_LOAN_AMOUNT)}
                    onChange={(e) => {
                      setLocalSettings({...localSettings, MAX_SINGLE_LOAN_AMOUNT: parseNumberFromDots(e.target.value)});
                      setHasChanges(true);
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[7.5px] font-black text-gray-500 uppercase px-1">KHOẢN VAY TỐI THIỂU</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={formatNumberWithDots(localSettings.MIN_LOAN_AMOUNT)}
                    placeholder={formatNumberWithDots(defaultSettings.MIN_LOAN_AMOUNT)}
                    onChange={(e) => {
                      setLocalSettings({...localSettings, MIN_LOAN_AMOUNT: parseNumberFromDots(e.target.value)});
                      setHasChanges(true);
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[7.5px] font-black text-gray-500 uppercase px-1">SỐ LẦN GIA HẠN TỐI ĐA</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={formatNumberWithDots(localSettings.MAX_EXTENSIONS)}
                    placeholder={formatNumberWithDots(defaultSettings.MAX_EXTENSIONS)}
                    onChange={(e) => {
                      setLocalSettings({...localSettings, MAX_EXTENSIONS: parseNumberFromDots(e.target.value)});
                      setHasChanges(true);
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[7.5px] font-black text-gray-500 uppercase px-1">PHÍ PHẠT TỐI ĐA (%)</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={formatNumberWithDots(localSettings.MAX_FINE_PERCENT)}
                    placeholder={formatNumberWithDots(defaultSettings.MAX_FINE_PERCENT)}
                    onChange={(e) => {
                      setLocalSettings({...localSettings, MAX_FINE_PERCENT: parseNumberFromDots(e.target.value)});
                      setHasChanges(true);
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[7.5px] font-black text-gray-500 uppercase px-1">VỐN TỔNG TỐI THIỂU</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={formatNumberWithDots(localSettings.MIN_SYSTEM_BUDGET)}
                    placeholder={formatNumberWithDots(defaultSettings.MIN_SYSTEM_BUDGET)}
                    onChange={(e) => {
                      setLocalSettings({...localSettings, MIN_SYSTEM_BUDGET: parseNumberFromDots(e.target.value)});
                      setHasChanges(true);
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[7.5px] font-black text-gray-500 uppercase px-1">TỔNG VAY TRONG CHU KỲ</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={formatNumberWithDots(localSettings.MAX_LOAN_PER_CYCLE)}
                    placeholder={formatNumberWithDots(defaultSettings.MAX_LOAN_PER_CYCLE)}
                    onChange={(e) => {
                      setLocalSettings({...localSettings, MAX_LOAN_PER_CYCLE: parseNumberFromDots(e.target.value)});
                      setHasChanges(true);
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                  />
                </div>

                <div className="space-y-1 col-span-2 lg:col-span-1">
                  <label className="text-[7.5px] font-black text-[#ff8c00] uppercase px-1">LƯỢT TẤT TOÁN ĐỂ LÊN HẠNG</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={formatNumberWithDots(localSettings.MAX_ON_TIME_PAYMENTS_FOR_UPGRADE)}
                    placeholder={formatNumberWithDots(defaultSettings.MAX_ON_TIME_PAYMENTS_FOR_UPGRADE)}
                    onChange={(e) => {
                      setLocalSettings({...localSettings, MAX_ON_TIME_PAYMENTS_FOR_UPGRADE: parseNumberFromDots(e.target.value)});
                      setHasChanges(true);
                    }}
                    className="w-full bg-black/60 border border-orange-500/20 rounded-xl px-3 py-2.5 text-[10px] font-bold text-[#ff8c00] outline-none focus:border-[#ff8c00]"
                  />
                </div>
              </div>
              )}
            </div>

            {/* User Ranks Configuration */}
            <div className="bg-white/[0.02]/50 border border-white/5 rounded-2xl p-5 space-y-4">
              <div 
                onClick={() => toggleSection('fin_ranks')}
                className="flex items-center justify-between border-b border-white/5 pb-2 cursor-pointer select-none group/hd"
              >
                <div className="flex items-center gap-2">
                  <Trophy size={14} className="text-[#ff8c00]" />
                  <h6 className="text-[9px] font-black text-white uppercase tracking-widest group-hover/hd:text-orange-400 transition-colors font-sans">CẤU HÌNH HẠNG VIP KHÁCH HÀNG</h6>
                </div>
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleAddRank(); }}
                    className="w-7 h-7 rounded-lg bg-[#ff8c00]/10 flex items-center justify-center text-[#ff8c00] hover:bg-[#ff8c00]/20 border border-[#ff8c00]/20 transition-all active:scale-95"
                    title="Thêm thứ hạng mới"
                  >
                    <Plus size={14} />
                  </button>
                  <div className="text-gray-500 group-hover/hd:text-white transition-colors pl-1">
                    {openSections['fin_ranks'] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </div>
              </div>
              {openSections['fin_ranks'] && (
                <div className="animate-in fade-in duration-200 mt-2">

              <Reorder.Group 
                axis="y" 
                values={localSettings.RANK_CONFIG || []} 
                onReorder={(newOrder) => {
                  setLocalSettings({...localSettings, RANK_CONFIG: newOrder});
                  setHasChanges(true);
                }}
                className="space-y-3 max-h-[360px] overflow-y-auto pr-1 select-none custom-scrollbar"
              >
                {(localSettings.RANK_CONFIG || []).map((rank: any, idx: number) => {
                  const isExpanded = expandedConfigs[`rank_${idx}`];
                  return (
                    <Reorder.Item 
                      key={rank.id || `rank_${idx}`} 
                      value={rank}
                      className="bg-black/45 border border-white/10 rounded-xl overflow-hidden transition-all duration-300 hover:border-white/20"
                    >
                      <div 
                        className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-white/5 transition-colors"
                        onClick={() => toggleConfigExpansion(`rank_${idx}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-1 cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300">
                            <GripVertical size={14} />
                          </div>
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: rank.color }}></div>
                          <h6 className="text-[10px] font-extrabold text-white uppercase">{rank.name || 'HẠNG MỚI'}</h6>
                          {rank.maxLimit > 0 && (
                            <span className="text-[7px] font-black text-gray-400 bg-white/5 px-2 py-0.5 rounded uppercase border border-white/5">
                              HẠN MỨC: {formatNumberWithDots(rank.maxLimit)} ₫
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRemoveRank(idx); setHasChanges(true); }} 
                            className="text-red-500/50 hover:text-red-400 transition-all p-1.5 hover:bg-red-500/5 rounded-lg"
                            title="Xoá Rank"
                          >
                            <Trash2 size={13} />
                          </button>
                          {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-4 pt-0 space-y-4 border-t border-white/5 bg-black/60 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div className="space-y-1">
                              <label className="text-[7px] font-black text-gray-500 uppercase px-1">Tên hạng</label>
                              <input 
                                type="text"
                                value={rank.name || ''}
                                onChange={(e) => {
                                  handleRankUpdate(idx, 'name', e.target.value);
                                  setHasChanges(true);
                                }}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[9px] font-bold text-white outline-none focus:border-[#ff8c00]"
                                placeholder="Ví dụ: Rank Đồng"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[7px] font-black text-gray-500 uppercase px-1">Hạn mức giới hạn (Max LIMIT)</label>
                              <input 
                                type="text"
                                inputMode="numeric"
                                value={rank.maxLimit ? formatNumberWithDots(rank.maxLimit) : ''}
                                onChange={(e) => {
                                  handleRankUpdate(idx, 'maxLimit', parseNumberFromDots(e.target.value));
                                  setHasChanges(true);
                                }}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[9px] font-bold text-white outline-none focus:border-[#ff8c00]"
                                placeholder="10.000.000"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[7px] font-black text-gray-500 uppercase px-1">Chọn màu sắc chủ đạo hạng</label>
                            <div className="flex flex-wrap gap-2 p-2.5 bg-black/30 rounded-xl border border-white/5">
                              {ICON_COLORS.map((ic) => (
                                <button
                                  key={ic.color}
                                  type="button"
                                  onClick={() => {
                                    handleRankUpdate(idx, 'color', ic.color);
                                    setHasChanges(true);
                                  }}
                                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all relative ${rank.color === ic.color ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-black scale-105' : 'opacity-65 hover:opacity-100'}`}
                                  style={{ backgroundColor: ic.color }}
                                  title={ic.name}
                                >
                                  <Trophy size={11} className="text-white" />
                                  {rank.color === ic.color && (
                                    <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#ff8c00] rounded-full flex items-center justify-center border border-black">
                                      <Check size={6} className="text-black font-black" />
                                    </div>
                                  )}
                                </button>
                              ))}
                              <div className="w-full mt-2 flex items-center gap-2 border-t border-white/5 pt-2">
                                <input 
                                  type="color"
                                  value={rank.color}
                                  onChange={(e) => {
                                    handleRankUpdate(idx, 'color', e.target.value);
                                    setHasChanges(true);
                                  }}
                                  className="w-6 h-6 bg-transparent border-none outline-none cursor-pointer"
                                />
                                <span className="text-[7.5px] font-black text-gray-500 uppercase tracking-widest leading-none">Màu sắc Custom: {rank.color}</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between px-1">
                              <label className="text-[7px] font-black text-gray-500 uppercase">Quyền hạn / Chú thích (phân cách bởi dấu phẩy ,)</label>
                              <button 
                                type="button"
                                onClick={() => {
                                  handleRegenerateRankFeatures(idx);
                                  setHasChanges(true);
                                }}
                                className="text-[#ff8c00] hover:rotate-180 transition-all duration-500 p-1 bg-[#ff8c00]/5 hover:bg-[#ff8c00]/10 rounded border border-[#ff8c00]/10"
                                title="Làm mới đặc quyền ngẫu nhiên"
                              >
                                <RefreshCw size={10} />
                              </button>
                            </div>
                            <textarea 
                              value={rank.features?.join(', ') || ''}
                              onChange={(e) => {
                                handleRankUpdate(idx, 'features', e.target.value);
                                setHasChanges(true);
                              }}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[9px] font-bold text-white outline-none min-h-[50px] resize-none focus:border-[#ff8c00]"
                              placeholder="Hạn mức cao nhất, Kiểm duyệt thông tin tự động, Đọc vị dòng tiền..."
                            />
                          </div>
                        </div>
                      )}
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>
                </div>
              )}
            </div>

            <button 
              onClick={() => handleSaveSettings(['PRE_DISBURSEMENT_FEE', 'UPGRADE_PERCENT', 'FINE_RATE', 'MAX_SINGLE_LOAN_AMOUNT', 'MIN_LOAN_AMOUNT', 'RANK_CONFIG', 'MAX_EXTENSIONS', 'MAX_FINE_PERCENT', 'MAX_LOAN_PER_CYCLE', 'MIN_SYSTEM_BUDGET', 'MAX_ON_TIME_PAYMENTS_FOR_UPGRADE'])}
              disabled={isSavingSettings}
              className="w-full bg-[#ff8c00]/10 border border-[#ff8c00]/25 hover:bg-[#ff8c00]/20 text-[#ff8c00] font-black py-4 rounded-xl text-[9px] uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSavingSettings ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
              LƯU CHÍNH SÁCH TÀI CHÍNH & VIP TUỲ CHỈNH
            </button>
          </div>
        )}

        {/* TAB 4: ĐỊNH DẠNG & HỢP ĐỒNG */}
        {settingsTab === 'contracts_formats' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-300">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-400/10 flex items-center justify-center text-blue-400">
                  <FileText size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider font-sans">ĐIỀU KHOẢN HỢP ĐỒNG & ĐỊNH DẠNG</h4>
                  <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Mẫu điều khoản ký số điện tử của khách hàng kết hợp cấu hình format ID của hệ thống</p>
                </div>
              </div>
            </div>

            {/* Sub-block A: Clauses edit block */}
            <div className="bg-white/[0.02]/50 border border-white/5 rounded-2xl p-5 space-y-4">
              <div 
                onClick={() => toggleSection('con_clauses')}
                className="flex items-center justify-between border-b border-white/5 pb-2 cursor-pointer select-none group/hd"
              >
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-blue-500" />
                  <h6 className="text-[9px] font-black text-white uppercase tracking-widest group-hover/hd:text-blue-500 transition-colors">NỘI DUNG MẪU HỢP ĐỒNG VÀ PHÁP LÝ</h6>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button 
                    type="button"
                    onClick={() => {
                      setConfirmDialog({
                        title: "KHÔI PHỤC ĐIỀU KHOẢN MẶC ĐỊNH?",
                        message: "Bạn có chắc chắn muốn khôi phục hoàn toàn điều khoản từ phác thảo của hệ thống? Toàn bộ văn bản hiện tại của bạn sẽ bị ghi đè.",
                        onConfirm: () => {
                          setLocalSettings({
                            ...localSettings,
                            CONTRACT_CLAUSES: defaultSettings.CONTRACT_CLAUSES
                          });
                          setHasChanges(true);
                          toast.success("Đã đồng bộ nội dung chuyên nghiệp!");
                        }
                      });
                    }}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 text-[6.5px] font-black uppercase hover:bg-orange-500/20 border border-orange-500/20 transition-all"
                  >
                    <RefreshCw size={10} /> ĐỒNG BỘ PHÁC THẢO
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const newClauses = [...(localSettings.CONTRACT_CLAUSES?.clauses || [])];
                      newClauses.push({ title: `Điều ${newClauses.length + 1}`, content: '' });
                      setLocalSettings({
                        ...localSettings,
                        CONTRACT_CLAUSES: { ...localSettings.CONTRACT_CLAUSES, clauses: newClauses }
                      });
                      setHasChanges(true);
                    }}
                    className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 hover:bg-blue-500/20 border border-blue-500/20 transition-all"
                    title="Thêm điều khoản mới"
                  >
                    <Plus size={14} />
                  </button>
                  <div className="text-gray-500 group-hover/hd:text-white transition-colors pl-1">
                    {openSections['con_clauses'] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </div>
              </div>
              {openSections['con_clauses'] && (
                <div className="space-y-4 animate-in fade-in duration-200">

              {/* Title & Subtitle */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[7.5px] font-black text-gray-500 uppercase px-1">Tiêu đề lớn hợp đồng</label>
                  <input 
                    type="text"
                    value={localSettings.CONTRACT_CLAUSES?.title || ''}
                    onChange={(e) => {
                      setLocalSettings({
                        ...localSettings, 
                        CONTRACT_CLAUSES: { ...localSettings.CONTRACT_CLAUSES, title: e.target.value }
                      });
                      setHasChanges(true);
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-[9px] font-bold text-white outline-none focus:border-[#ff8c00]"
                    placeholder="Ví dụ: Hợp đồng vay ngang hàng"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[7.5px] font-black text-gray-500 uppercase px-1">Nhãn chữ chìm xác thực (Subtitle)</label>
                  <input 
                    type="text"
                    value={localSettings.CONTRACT_CLAUSES?.subtitle || ''}
                    onChange={(e) => {
                      setLocalSettings({
                        ...localSettings, 
                        CONTRACT_CLAUSES: { ...localSettings.CONTRACT_CLAUSES, subtitle: e.target.value }
                      });
                      setHasChanges(true);
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-[9px] font-bold text-white outline-none focus:border-[#ff8c00]"
                    placeholder="Ví dụ: CHỨNG THỰC CHỮ KÝ ĐIỆN TỬ"
                  />
                </div>
              </div>

              {/* Clipboard Helpers */}
              <div className="bg-black/50 border border-white/5 rounded-xl p-3 space-y-2">
                <div className="px-1">
                  <span className="text-[7.5px] font-black text-gray-500 uppercase tracking-widest block">Từ khoá lắp ráp (Click để copy nhanh)</span>
                </div>
                <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {[
                    { tag: '{FULL_NAME}', label: 'Họ & Tên' },
                    { tag: '{ID_NUMBER}', label: 'Số CCCD' },
                    { tag: '{AMOUNT}', label: 'Tiền vay', important: true },
                    { tag: '{DATE}', label: 'Kì hạn', important: true },
                    { tag: '{LOAN_PURPOSE}', label: 'Mục đích vay' },
                    { tag: '{BANK_NAME}', label: 'Ngân hàng' },
                    { tag: '{BANK_ACCOUNT}', label: 'Số thẻ/STK' },
                    { tag: '{PHONE}', label: 'SĐT khách' },
                    { tag: '{ADDRESS}', label: 'Địa chỉ' },
                    { tag: '{RANK}', label: 'VIP Rank' },
                    { tag: '{DATE_NOW}', label: 'Ngày hôm nay' }
                  ].map((v, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => copyToClipboard(v.tag, `v-${i}`)}
                      className={`flex-none px-2 py-1.5 rounded-lg text-[7px] font-black uppercase transition-all flex items-center gap-1 border ${
                        v.important 
                          ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' 
                          : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {v.tag}
                      {copiedField === `v-${i}` && <Check size={8} className="text-green-500" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clauses Scroll Area */}
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 select-none custom-scrollbar">
                {(localSettings.CONTRACT_CLAUSES?.clauses || []).map((clause: any, index: number) => (
                  <div key={index} className="bg-black/40 border border-white/10 rounded-xl p-3.5 space-y-2 relative group">
                    <button 
                      type="button"
                      onClick={() => {
                        const newClauses = localSettings.CONTRACT_CLAUSES.clauses.filter((_: any, i: number) => i !== index);
                        setLocalSettings({
                          ...localSettings,
                          CONTRACT_CLAUSES: { ...localSettings.CONTRACT_CLAUSES, clauses: newClauses }
                        });
                        setHasChanges(true);
                      }}
                      className="absolute top-2.5 right-2.5 w-6 h-6 rounded-md bg-red-500/10 flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 transition-all border border-red-500/10"
                      title="Xoá Điều này"
                    >
                      <Trash2 size={11} />
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
                        setHasChanges(true);
                      }}
                      className="w-full bg-transparent border-b border-white/10 pb-1.5 text-[9px] font-black text-[#ff8c00] uppercase outline-none focus:border-orange-500/50"
                      placeholder="Tên chương / Tên Điều khoản"
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
                          setHasChanges(true);
                        }}
                        className="w-full bg-black/60 border border-white/5 rounded-xl px-3.5 py-3 text-[9px] font-bold text-gray-400 outline-none focus:border-orange-500/40 transition-all min-h-[90px] resize-none leading-relaxed"
                        placeholder="Nội dung điều luật (Sử dụng các biến {tag} để đút giá trị động)..."
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          const newClauses = [...localSettings.CONTRACT_CLAUSES.clauses];
                          const cur = newClauses[index].content || '';
                          newClauses[index].content = cur + "\n\n[COLUMN_SPLIT]\n\n";
                          setLocalSettings({
                            ...localSettings,
                            CONTRACT_CLAUSES: { ...localSettings.CONTRACT_CLAUSES, clauses: newClauses }
                          });
                          setHasChanges(true);
                          toast.info("Đã chèn ngắt trang đôi");
                        }}
                        className="absolute bottom-2.5 right-2.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[6.5px] font-black text-gray-500 uppercase border border-white/10 transition-all"
                      >
                        Chia trang đôi (Cột)
                      </button>
                    </div>

                    {/* Preview Demo print section */}
                    <div className="p-3 bg-black/75 rounded-xl border border-white/5">
                      <p className="text-[6.5px] font-black text-blue-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <Eye size={10} />
                        Bản in Demo (mô phỏng người thật ký ):
                      </p>
                      <div className="text-[7.5px] text-gray-400 font-bold leading-normal whitespace-pre-line leading-relaxed">
                        {(() => {
                          let content = clause.content || "";
                          const demoVal: any = {
                            '{FULL_NAME}': 'TRẦN ANH MINH',
                            '{ID_NUMBER}': '036207801243',
                            '{PHONE}': '0969555222',
                            '{ADDRESS}': '81 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội',
                            '{LOAN_PURPOSE}': 'Sắm sửa trang thiết bị nhà đình',
                            '{AMOUNT}': '25.000.000 ₫',
                            '{DATE}': '14/08/2026',
                            '{BANK_NAME}': 'VIETCOMBANK',
                            '{BANK_ACCOUNT}': '0071001222333',
                            '{CONTRACT_ID}': 'HD-888999',
                            '{RANK}': 'SILVER',
                            '{DATE_NOW}': new Date().toLocaleDateString('vi-VN')
                          };

                          if (content.includes('[COLUMN_SPLIT]')) {
                            const parts = content.split('[COLUMN_SPLIT]');
                            const lhs = parts[0] || "";
                            const rhs = parts[1] || "";
                            const linesL = lhs.split('\n').map(l => l.trim()).filter(Boolean);
                            const linesR = rhs.split('\n').map(l => l.trim()).filter(Boolean);
                            const maxL = Math.max(linesL.length, linesR.length);

                            const renderLineTxt = (line: string) => {
                              let elements: any[] = [line];
                              Object.entries(demoVal).forEach(([k, v]) => {
                                const list: any[] = [];
                                elements.forEach(item => {
                                  if (typeof item === 'string') {
                                    const chunks = item.split(k);
                                    chunks.forEach((seg, index) => {
                                      list.push(seg);
                                      if (index < chunks.length - 1) {
                                        list.push(
                                          <span key={`${k}-${index}`} className="font-extrabold text-[#ff8c00] bg-orange-500/5 px-1 border border-orange-500/10 rounded-sm">
                                            {v as string}
                                          </span>
                                        );
                                      }
                                    });
                                  } else {
                                    list.push(item);
                                  }
                                });
                                elements = list;
                              });
                              return elements;
                            };

                            return (
                              <div className="border-t border-b border-white/5 py-1.5 my-1 space-y-1">
                                {Array.from({ length: maxL }).map((_, i) => (
                                  <div key={i} className="grid grid-cols-2 gap-4 items-start">
                                    <div className="text-[7px] text-gray-500 pr-2 border-r border-white/5 min-h-[1.5em] leading-normal">
                                      {renderLineTxt(linesL[i] || '')}
                                    </div>
                                    <div className="text-[7px] text-gray-500 min-h-[1.5em] leading-normal">
                                      {renderLineTxt(linesR[i] || '')}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          }

                          return content.split('\n').map((line, lIdx) => {
                            let elements: any[] = [line];
                            Object.entries(demoVal).forEach(([k, v]) => {
                              const list: any[] = [];
                              elements.forEach(item => {
                                if (typeof item === 'string') {
                                  const chunks = item.split(k);
                                  chunks.forEach((seg, index) => {
                                    list.push(seg);
                                    if (index < chunks.length - 1) {
                                      list.push(
                                        <span key={`${k}-${index}`} className="font-extrabold text-[#ff8c00] bg-orange-500/5 px-1 border border-orange-500/10 rounded-sm">
                                          {v as string}
                                        </span>
                                      );
                                    }
                                  });
                                } else {
                                  list.push(item);
                                }
                              });
                              elements = list;
                            });
                            return <div key={lIdx} className="leading-relaxed">{elements}</div>;
                          });
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
                </div>
              )}
            </div>

            {/* Sub-block B: Master configs ID structure table */}
            <div className="bg-white/[0.02]/50 border border-white/5 rounded-2xl p-5 space-y-4">
              <div 
                onClick={() => toggleSection('con_master')}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-2 cursor-pointer select-none group/hd"
              >
                <div className="flex items-center gap-2">
                  <Database size={14} className="text-[#ff8c00]" />
                  <h6 className="text-[9px] font-black text-white uppercase tracking-widest group-hover/hd:text-[#ff8c00] transition-colors">ĐỊNH DẠNG MÃ SỐ & NỘI DUNG CHUYỂN KHOẢN (MASTER CODES)</h6>
                </div>
                
                <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-white/10 self-end" onClick={(e) => e.stopPropagation()}>
                  {(!localSettings.MASTER_CONFIGS || localSettings.MASTER_CONFIGS.length === 0) && (
                    <button 
                      onClick={handleMigrateUnified}
                      disabled={isMigratingUnified}
                      className="text-orange-500 text-[6.5px] font-black px-2.5 py-1.5 rounded-lg hover:bg-orange-500/10 transition-all flex items-center gap-1 border border-orange-500/15"
                      title="Chuyển đổi dữ liệu cũ sang hệ thống mới"
                    >
                      {isMigratingUnified ? <Loader2 size={10} className="animate-spin" /> : <Database size={10} />}
                      MIGRATE DATA
                    </button>
                  )}
                  <button 
                    onClick={handleOneClickSetup}
                    disabled={isScanning}
                    className="text-blue-500 text-[6.5px] font-black px-2.5 py-1.5 rounded-lg hover:bg-blue-500/10 transition-all flex items-center gap-1 border border-blue-500/15 disabled:opacity-50"
                    title="Tự động khôi phục cấu hình mã chuẩn"
                  >
                    {isScanning ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                    ONE-CLICK SETUP
                  </button>
                  <div className="text-gray-500 group-hover/hd:text-white transition-colors pl-2 pr-1">
                    {openSections['con_master'] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </div>
              </div>
              {openSections['con_master'] && (
                <div className="space-y-4 animate-in fade-in duration-200">

              {(() => {
                const categoryInfo: Record<string, { label: string, color: string, desc: string, icon: any }> = {
                  'ABBREVIATION': { 
                    label: 'BIẾN LẮP SẴN', 
                    color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
                    desc: 'Define system meaning parameters',
                    icon: <Hash size={11} />
                  },
                  'ID_FORMAT': { 
                    label: 'MÃ ID GỐC', 
                    color: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
                    desc: 'Base User/Contract structural patterns',
                    icon: <User size={11} />
                  },
                  'CONTRACT_NEW': { 
                    label: 'MÃ KHI BIẾN ĐỘNG', 
                    color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
                    desc: 'Contract renewal flow patterns',
                    icon: <FileText size={11} />
                  },
                  'TRANSFER_CONTENT': { 
                    label: 'NỘI DUNG SẮN CK', 
                    color: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
                    desc: 'Instant QR transfer comments text',
                    icon: <MessageCircle size={11} />
                  }
                };

                const allConfigs = localSettings.MASTER_CONFIGS || [];

                return (
                  <div className="space-y-4">
                    {/* Toolbar menu: Quick creations */}
                    <div className="flex items-center gap-2 p-1.5 bg-black/40 rounded-xl border border-white/5 overflow-x-auto no-scrollbar">
                      <div className="flex items-center gap-1 px-2 border-r border-white/10 mr-1.5 flex-none">
                        <Plus size={11} className="text-gray-500" />
                        <span className="text-[7px] font-black text-gray-500 uppercase select-none long">Thêm mẫu:</span>
                      </div>
                      {Object.entries(categoryInfo).map(([catKey, info]) => (
                        <button 
                          key={catKey}
                          type="button"
                          onClick={() => {
                            handleAddMasterConfig(catKey);
                            setHasChanges(true);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border transition-all active:scale-[0.97] text-[7px] font-black uppercase ${info.color}`}
                        >
                          {info.icon}
                          {info.label}
                        </button>
                      ))}
                    </div>

                    {/* Array mapping list configs */}
                    <div className="space-y-3.5">
                      {allConfigs.length === 0 ? (
                        <div className="py-12 bg-white/[0.01]/40 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2.5 text-center">
                          <Settings size={28} className="text-gray-600 animate-spin" />
                          <p className="text-[9px] font-black text-white uppercase tracking-wider">Hệ thống ID Master đang rỗng</p>
                          <p className="text-[7px] text-gray-500 font-bold uppercase">Ủy quyền sử dụng nút ONE-CLICK SETUP phía trên để nạp nhanh</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {allConfigs.map((config: any, idx: number) => {
                            const isExpanded = expandedConfigs[`master_${idx}`];
                            const info = categoryInfo[config.category] || categoryInfo['ABBREVIATION'];
                            
                            return (
                              <div 
                                key={config.id || `master_${idx}`} 
                                className={`bg-black/40 border rounded-xl overflow-hidden transition-all duration-300 ${isExpanded ? 'border-[#ff8c00]/40 ring-1 ring-[#ff8c00]/15 bg-white/[0.02]' : 'border-white/10 hover:border-white/15'}`}
                              >
                                <div 
                                  className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-white/5"
                                  onClick={() => toggleConfigExpansion(`master_${idx}`)}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400">
                                      {info.icon}
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                      <div className="flex items-center gap-2">
                                        <h6 className="text-[9.5px] font-extrabold text-white uppercase">{config.originalName || 'CẤU HÌNH MỚI'}</h6>
                                        <span className={`text-[5.5px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter ${info.color.split(' ')[0]} ${info.color.split(' ')[1]}`}>{info.label.split(' ')[0]}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[6.5px] font-bold text-gray-500 uppercase tracking-widest leading-none">{config.systemMeaning || 'Chờ gán mục tiêu'}</span>
                                        {config.abbreviation && (
                                          <span className="text-[7.5px] font-black text-[#00ffcc] leading-none">
                                            {'{'}{config.abbreviation}{'}'}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleRemoveMasterConfig(idx); setHasChanges(true); }} 
                                      className="text-red-500/40 hover:text-red-400 transition-all p-1.5 hover:bg-red-500/10 rounded-lg"
                                      title="Xóa biến số này"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                    <div className={`p-1 text-gray-500 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-orange-400' : ''}`}>
                                      <ChevronDown size={14} />
                                    </div>
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div className="p-4 pt-0 space-y-4 border-t border-white/5 bg-black/60 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="grid grid-cols-2 gap-3.5 mt-3">
                                      <div className="space-y-1">
                                        <label className="text-[7px] font-black text-gray-500 uppercase px-1">1. Phân loại cấu hình</label>
                                        <select 
                                          value={config.category}
                                          onChange={(e) => {
                                            handleMasterConfigUpdate(idx, 'category', e.target.value);
                                            setHasChanges(true);
                                          }}
                                          className="w-full bg-black/80 border border-white/10 rounded-xl px-3 py-2 text-[9px] font-bold text-white outline-none"
                                        >
                                          {Object.entries(categoryInfo).map(([key, info]) => (
                                            <option key={key} value={key} className="bg-[#111] text-white">{info.label}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[7px] font-black text-gray-500 uppercase px-1">2. Tên nhãn gợi nhớ</label>
                                        <input 
                                          type="text"
                                          value={config.originalName || ''}
                                          onChange={(e) => {
                                            handleMasterConfigUpdate(idx, 'originalName', e.target.value);
                                            setHasChanges(true);
                                          }}
                                          className="w-full bg-black/80 border border-white/10 rounded-xl px-3 py-2 text-[9px] font-bold text-white outline-none focus:border-[#ff8c00]"
                                          placeholder="Tên nhãn cứu cánh..."
                                        />
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3.5">
                                      <div className="space-y-1">
                                        <label className="text-[7px] font-black text-gray-500 uppercase px-1">3. Biến lắp ghép đại diện</label>
                                        <div className="relative">
                                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 font-extrabold text-[10px]">{'{'}</span>
                                          <input 
                                            type="text"
                                            value={config.abbreviation || ''}
                                            onChange={(e) => {
                                              handleMasterConfigUpdate(idx, 'abbreviation', e.target.value.toUpperCase());
                                              setHasChanges(true);
                                            }}
                                            className="w-full bg-black/80 border border-white/10 rounded-xl pl-6 pr-6 py-2 text-[10px] font-extrabold text-[#00ffcc] outline-none focus:border-[#ff8c00]"
                                            placeholder="RD, EX, MD..."
                                          />
                                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 font-extrabold text-[10px]">{'}'}</span>
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[7px] font-black text-gray-500 uppercase px-1">4. Chức năng hệ thống ban hành</label>
                                        <select 
                                          value={config.systemMeaning || ''}
                                          onChange={(e) => {
                                            handleMasterConfigUpdate(idx, 'systemMeaning', e.target.value);
                                            setHasChanges(true);
                                          }}
                                          className="w-full bg-black/80 border border-white/10 rounded-xl px-3 py-2 text-[9px] font-bold text-[#ff8c00] outline-none"
                                        >
                                          <option value="" className="bg-[#111] text-gray-500">Chưa thiết lập...</option>
                                          <optgroup label="Cơ bản & Toán học" className="bg-[#111] text-white">
                                            <option value="random">Số ngẫu nhiên</option>
                                            <option value="sequence">Số đếm tự tăng (001)</option>
                                            <option value="prefix">Chữ cố định đính kèm</option>
                                            <option value="date_now">Ngày hiện tại (DDMMYY)</option>
                                          </optgroup>
                                          <optgroup label="Dữ liệu Khách hàng" className="bg-[#111] text-white">
                                            <option value="user_id">Mã UserID của khách</option>
                                            <option value="phone">SĐT Khách hàng</option>
                                            <option value="rank">Tên hạng (VIP/Gold..)</option>
                                          </optgroup>
                                          <optgroup label="Cấu trúc Độc quyền" className="bg-[#111] text-white">
                                            <option value="user_format">Định dạng UserID mẫu</option>
                                            <option value="contract_original_format">Định dạng HĐ Gốc mẫu</option>
                                            <option value="contract_partial_format">Biến động: Chuyển khoản Tất toán một phần</option>
                                            <option value="contract_extension_format">Biến động: Chuyển khoản Gia hạn Hợp đồng</option>
                                          </optgroup>
                                        </select>
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-[7px] font-black text-gray-500 uppercase px-1">5. Công thức định luật (Format Pattern)</label>
                                      <input 
                                        type="text"
                                        value={config.format || ''}
                                        onChange={(e) => {
                                          handleMasterConfigUpdate(idx, 'format', e.target.value);
                                          setHasChanges(true);
                                        }}
                                        className="w-full bg-black/85 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] font-black text-white outline-none focus:border-[#ff8c00]"
                                        placeholder="Ví dụ: KHACH-{USER_ID}-{DATE_NOW}"
                                      />
                                    </div>

                                    {/* Simulated preview live block code */}
                                    <div className="p-3.5 bg-black/90 rounded-xl border border-white/5 flex items-center justify-between">
                                      <div className="flex items-center gap-1.5">
                                        <Sparkles size={11} className="text-orange-500 animate-pulse" />
                                        <span className="text-[6.5px] font-black text-gray-500 uppercase select-none">Mẫu thử đầu ra:</span>
                                      </div>
                                      <code className="text-[10px] font-mono text-[#00ffcc] font-extrabold break-all selection:bg-teal-500/10 select-all">
                                        {(() => {
                                          const getBaseVal = (cfg: any) => {
                                            const m = cfg.systemMeaning;
                                            if (m === 'random') return '789123';
                                            if (m === 'sequence') return '77';
                                            if (m === 'prefix') return cfg.format || 'NDV';
                                            if (m === 'user_id') return 'U9901';
                                            if (m === 'date_now') return new Date().toLocaleDateString('vi-VN').replace(/\//g, '');
                                            if (m === 'phone') return '0398888999';
                                            if (m === 'rank') return 'DIAMOND';
                                            return '';
                                          };

                                          const resMock = (cfg: any, limit = 0): string => {
                                            if (limit > 5) return '...';
                                            let pattern = cfg.format || getBaseVal(cfg) || '---';

                                            allConfigs.forEach((c: any) => {
                                              if (c.abbreviation) {
                                                const r = new RegExp(`\\{${c.abbreviation}\\}`, 'gi');
                                                if (r.test(pattern)) {
                                                  const val = (c === cfg) ? getBaseVal(c) : resMock(c, limit + 1);
                                                  pattern = pattern.replace(r, val);
                                                }
                                              }
                                            });

                                            pattern = pattern.replace(/\{RD\}|\{RANDOM\}/gi, '333444')
                                                             .replace(/\{N\}|\{SEQUENCE\}/gi, '1');

                                            if (pattern.includes('{ID}')) {
                                              pattern = pattern.replace(/\{ID\}/gi, 'U9901');
                                            }
                                            if (pattern.includes('{MHD}')) {
                                              pattern = pattern.replace(/\{MHD\}/gi, 'HD0095');
                                            }

                                            return pattern.replace(/\{DATE\}/gi, '150426').replace(/\{RANK\}/gi, 'PLATINUM');
                                          };

                                          return resMock(config);
                                        })()}
                                      </code>
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
            </div>            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
              <button 
                onClick={() => handleSaveSettings(['CONTRACT_CLAUSES'])}
                disabled={isSavingSettings}
                className="py-4 bg-blue-600/10 border border-blue-500/25 hover:bg-blue-500/20 text-blue-400 font-black rounded-xl text-[9px] uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 "
              >
                {isSavingSettings ? <Loader2 className="animate-spin" size={13} /> : <Check size={13} />}
                LƯU MẪU ĐIỀU KHOẢN HỢP ĐỒNG
              </button>
              <button 
                onClick={() => handleSaveSettings(['MASTER_CONFIGS'])}
                disabled={isSavingSettings}
                className="py-4 bg-[#ff8c00]/10 border border-[#ff8c00]/25 hover:bg-[#ff8c00]/20 text-[#ff8c00] font-black rounded-xl text-[9px] uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {isSavingSettings ? <Loader2 className="animate-spin" size={13} /> : <Check size={13} />}
                LƯU THIẾT LẬP MÃ SỐ ID CAO CẤP
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: SỰ KIỆN & QUÀ TẶNG */}
        {settingsTab === 'gift_rewards' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-300">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-yellow-400/10 flex items-center justify-center text-yellow-400">
                  <Trophy size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">CHƯƠNG TRÌNH QUÀ TẶNG & SỰ KIỆN</h4>
                  <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Biểu số vòng quay may mắn, rải dải trúng thưởng tỉ lệ vàng, điều kiện lấy coupon rải dải</p>
                </div>
              </div>
            </div>

            {/* Lucky spin conditions cards */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
              <div 
                onClick={() => toggleSection('gift_spin')}
                className="flex items-center justify-between cursor-pointer select-none group/hd"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3 bg-yellow-500 rounded-full"></div>
                  <h6 className="text-[9px] font-black text-white uppercase tracking-widest group-hover/hd:text-yellow-500 transition-colors">ĐIỀU KIỆN SỰ KIỆN VÒNG QUAY MAY MẮN (LUCKY SPIN)</h6>
                </div>
                <div className="text-gray-500 group-hover/hd:text-white transition-colors">
                  {openSections['gift_spin'] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>
              {openSections['gift_spin'] && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200 mt-2">
                <div className="bg-black/45 border border-white/10 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest px-0.5">Tỉ lệ xoay trúng Voucher (%)</label>
                    <span className="text-xs font-mono font-black text-[#ff8c00]">{localSettings.LUCKY_SPIN_WIN_RATE || '30'}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0"
                    max="100"
                    value={localSettings.LUCKY_SPIN_WIN_RATE || '30'}
                    onChange={(e) => {
                      setLocalSettings({...localSettings, LUCKY_SPIN_WIN_RATE: e.target.value});
                      setHasChanges(true);
                    }}
                    className="w-full accent-[#ff8c00] cursor-pointer bg-white/10 h-1 rounded-sm appearance-none"
                  />
                  <span className="text-[7px] font-bold text-gray-600 uppercase tracking-tight block">Tỉ lệ người dùng bình chọn trúng giải tại vòng quay bánh xe bánh chè</span>
                </div>

                <div className="bg-black/45 border border-white/10 p-4 rounded-xl flex flex-col justify-between">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest px-0.5 block">Lượt tất toán tối thiểu để được spin</label>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      value={formatNumberWithDots(localSettings.LUCKY_SPIN_PAYMENTS_REQUIRED)}
                      placeholder={formatNumberWithDots(defaultSettings.LUCKY_SPIN_PAYMENTS_REQUIRED)}
                      onChange={(e) => {
                        setLocalSettings({...localSettings, LUCKY_SPIN_PAYMENTS_REQUIRED: parseNumberFromDots(e.target.value)});
                        setHasChanges(true);
                      }}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-black text-white outline-none focus:border-[#ff8c00]"
                    />
                  </div>
                  <span className="text-[7px] font-bold text-gray-600 uppercase mt-2 select-none tracking-tight block">Mỗi khi hoàn thành số lượt này sẽ cộng 1 lượt spin</span>
                </div>
              </div>
              )}
            </div>

            {/* Milestone Vouchers items lists */}
            <div className="bg-[#111111] border border-white/5 rounded-2xl p-5 space-y-4">
              <div 
                onClick={() => toggleSection('gift_vouchers')}
                className="flex items-center justify-between border-b border-white/15 pb-2 cursor-pointer select-none group/hd"
              >
                <div className="flex items-center gap-2">
                  <Trophy size={14} className="text-[#ff8c00]" />
                  <h6 className="text-[9px] font-black text-white uppercase tracking-widest group-hover/hd:text-orange-400 transition-colors">DANH SÁCH CẤP VOUCHERS LUCKY SPIN</h6>
                </div>
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddVoucherMilestone();
                      setHasChanges(true);
                    }}
                    className="w-7 h-7 rounded-lg bg-[#ff8c00]/10 flex items-center justify-center text-[#ff8c00] border border-[#ff8c00]/20 hover:bg-[#ff8c00]/20 transition-all"
                    title="Thêm mốc voucher mới"
                  >
                    <Plus size={14} />
                  </button>
                  <div className="text-gray-500 group-hover/hd:text-white transition-colors pl-1">
                    {openSections['gift_vouchers'] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </div>
              </div>
              {openSections['gift_vouchers'] && (
                <div className="space-y-4 animate-in fade-in duration-200">

              <Reorder.Group 
                axis="y" 
                values={localSettings.LUCKY_SPIN_VOUCHERS || []} 
                onReorder={(newOrder) => {
                  setLocalSettings({...localSettings, LUCKY_SPIN_VOUCHERS: newOrder});
                  setHasChanges(true);
                }}
                className="space-y-3 max-h-[300px] overflow-y-auto pr-1 select-none custom-scrollbar"
              >
                {(localSettings.LUCKY_SPIN_VOUCHERS || []).map((v: any, idx: number) => {
                  const isExpanded = expandedConfigs[`voucher_${idx}`];
                  return (
                    <Reorder.Item 
                      key={v.id || `voucher_${idx}`} 
                      value={v}
                      className="bg-black/45 border border-white/10 rounded-xl overflow-hidden transition-all duration-300 hover:border-white/15"
                    >
                      <div 
                        className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-white/5"
                        onClick={() => toggleConfigExpansion(`voucher_${idx}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-1 cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300">
                            <GripVertical size={14} />
                          </div>
                          <div className="w-1.5 h-1.5 rounded-full bg-[#ff8c00]"></div>
                          <h6 className="text-[9.5px] font-black text-gray-300 uppercase tracking-wider">MỐC VOUCHER {idx + 1}</h6>
                          {v.voucherValue > 0 && (
                            <span className="text-[7.5px] font-black text-[#ff8c00] bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/10">
                              MỨC QUÀ {formatNumberWithDots(v.voucherValue)} đ
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRemoveVoucherMilestone(idx); setHasChanges(true); }} 
                            className="text-red-500/50 hover:text-red-400 transition-all p-1.5 hover:bg-red-500/5 rounded-lg"
                            title="Xoá mốc này"
                          >
                            <Trash2 size={13} />
                          </button>
                          {isExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-4 pt-0 space-y-4 border-t border-white/5 bg-black/60 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="grid grid-cols-2 gap-3.5 mt-3.5">
                            <div className="space-y-1">
                              <label className="text-[7px] font-black text-gray-500 uppercase px-1">Lợi nhuận tích luỹ tối thiểu</label>
                              <input 
                                type="text"
                                inputMode="numeric"
                                value={v.minProfit ? formatNumberWithDots(v.minProfit) : ''}
                                onChange={(e) => {
                                  handleVoucherMilestoneUpdate(idx, 'minProfit', parseNumberFromDots(e.target.value));
                                  setHasChanges(true);
                                }}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[9px] font-bold text-white outline-none focus:border-[#ff8c00]"
                                placeholder="1.000.000"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[7px] font-black text-gray-500 uppercase px-1">Mức quà trị giá Voucher</label>
                              <input 
                                type="text"
                                inputMode="numeric"
                                value={v.voucherValue ? formatNumberWithDots(v.voucherValue) : ''}
                                onChange={(e) => {
                                  handleVoucherMilestoneUpdate(idx, 'voucherValue', parseNumberFromDots(e.target.value));
                                  setHasChanges(true);
                                }}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[9px] font-bold text-[#ff8c00] outline-none focus:border-[#ff8c00]"
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
              )}
            </div>

            <button 
              onClick={() => handleSaveSettings(['LUCKY_SPIN_VOUCHERS', 'LUCKY_SPIN_WIN_RATE', 'LUCKY_SPIN_PAYMENTS_REQUIRED'])}
              disabled={isSavingSettings}
              className="w-full bg-[#ff8c00]/10 border border-[#ff8c00]/25 hover:bg-[#ff8c00]/20 text-[#ff8c00] font-black py-4 rounded-xl text-[9px] uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSavingSettings ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
              LƯU CẤU HÌNH COUPONS PHẦN THƯỞNG
            </button>
          </div>
        )}

        {/* TAB 6: TIỆN ÍCH HỆ THỐNG */}
        {settingsTab === 'system_utils' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-300">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-400/10 flex items-center justify-center text-orange-400">
                  <Wrench size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">CẤU HÌNH TIỆN ÍCH & TRỰC QUAN</h4>
                  <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Liên kết Zalo, Bảng mã bảng màu, bảng điều khiển FCM Push notifications lùi đẩy tự động</p>
                </div>
              </div>
            </div>

            {/* SQL and Webhook Quick Copy widgets */}
            <div className="bg-white/[0.02]/50 border border-white/5 rounded-2xl p-5 space-y-3.5">
              <div 
                onClick={() => toggleSection('util_paths')}
                className="flex items-center justify-between cursor-pointer select-none group/hd"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
                  <h6 className="text-[9px] font-black text-white uppercase tracking-widest group-hover/hd:text-blue-500 transition-colors font-sans">ĐƯỜNG DẪN HOẠT ĐỘNG & CODES</h6>
                </div>
                <div className="text-gray-500 group-hover/hd:text-white transition-colors">
                  {openSections['util_paths'] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>
              {openSections['util_paths'] && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in duration-200 pt-1">
                <button
                  type="button"
                  onClick={() => copyToClipboard(sqlSchema, 'sc')}
                  className="flex items-center justify-between px-3.5 py-3 bg-black/60 border border-white/10 rounded-xl hover:bg-white/5 transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <Database size={13} className="text-blue-400" />
                    <span className="text-[8.5px] font-black text-gray-300 uppercase tracking-widest">Sao chép SQL Schema</span>
                  </div>
                  {copiedField === 'sc' ? <Check size={14} className="text-green-500" /> : <Copy size={13} className="text-gray-500 group-hover:text-gray-300" />}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(`${window.location.origin}/api/payment/webhook`, 'wh')}
                  className="flex items-center justify-between px-3.5 py-3 bg-black/60 border border-white/10 rounded-xl hover:bg-white/5 transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <Globe size={13} className="text-blue-400" />
                    <span className="text-[8.5px] font-black text-gray-300 uppercase tracking-widest">Sao chép WEBHOOK URL</span>
                  </div>
                  {copiedField === 'wh' ? <Check size={14} className="text-green-500" /> : <Copy size={13} className="text-gray-500 group-hover:text-gray-300" />}
                </button>
              </div>
              )}
            </div>

            {/* Zalo Link support Group links */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
              <div 
                onClick={() => toggleSection('util_channels')}
                className="flex items-center justify-between cursor-pointer select-none group/hd"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3 bg-cyan-500 rounded-full"></div>
                  <h6 className="text-[9px] font-black text-white uppercase tracking-widest group-hover/hd:text-cyan-500 transition-colors">ĐƯỜNG DẪN KÊNH CHĂM SÓC KHÁCH HÀNG</h6>
                </div>
                <div className="text-gray-500 group-hover/hd:text-white transition-colors">
                  {openSections['util_channels'] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>
              {openSections['util_channels'] && (
                <div className="space-y-1 flex flex-col animate-in fade-in duration-200 mt-2">
                <label className="text-[7.5px] font-black text-gray-500 uppercase tracking-widest px-1">Link Địa chỉ Nhóm Zalo Hỗ trợ ngoài trang chủ</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={localSettings.ZALO_GROUP_LINK || ''}
                    placeholder={defaultSettings.ZALO_GROUP_LINK}
                    onChange={(e) => {
                      setLocalSettings({...localSettings, ZALO_GROUP_LINK: e.target.value});
                      setHasChanges(true);
                    }}
                    className="w-full bg-black/60 border border-white/10 rounded-xl pl-3.5 pr-10 py-3 text-[10px] font-bold text-white outline-none focus:border-[#ff8c00]"
                  />
                  <Globe size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                </div>
              </div>
              )}
            </div>

            {/* Custom moving notice system text marquee */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
              <div 
                onClick={() => toggleSection('util_marquee')}
                className="flex items-center justify-between border-b border-white/5 pb-1 cursor-pointer select-none group/hd"
              >
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-orange-400" />
                  <h6 className="text-[9px] font-black text-white uppercase tracking-widest group-hover/hd:text-orange-400 transition-colors">Chữ chạy thông báo khẩn ở Trang chủ (Banner Marquee)</h6>
                </div>
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button 
                    type="button"
                    onClick={() => {
                      setLocalSettings({...localSettings, SHOW_SYSTEM_NOTIFICATION: !localSettings.SHOW_SYSTEM_NOTIFICATION});
                      setHasChanges(true);
                    }}
                    className={`w-9 h-5 rounded-full relative transition-all ${localSettings.SHOW_SYSTEM_NOTIFICATION ? 'bg-[#ff8c00]' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${localSettings.SHOW_SYSTEM_NOTIFICATION ? 'left-4.5' : 'left-0.5'}`}></div>
                  </button>
                  <div className="text-gray-500 group-hover/hd:text-white transition-colors pl-1">
                    {openSections['util_marquee'] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </div>
              </div>
              {openSections['util_marquee'] && (
                <textarea 
                  value={localSettings.SYSTEM_NOTIFICATION || ''}
                  placeholder={defaultSettings.SYSTEM_NOTIFICATION}
                  onChange={(e) => {
                    setLocalSettings({...localSettings, SYSTEM_NOTIFICATION: e.target.value});
                    setHasChanges(true);
                  }}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-3 text-[9.5px] font-bold text-white outline-none min-h-[65px] resize-none focus:border-[#ff8c00] animate-in fade-in duration-200"
                />
              )}
            </div>

            {/* Core FCM notifications send board */}
            <div className="bg-orange-500/5 border border-orange-500/10 rounded-2xl p-5 space-y-4">
              <div 
                onClick={() => toggleSection('util_push')}
                className="flex items-center justify-between cursor-pointer select-none group/hd"
              >
                <div className="flex items-center gap-2.5">
                  <Zap size={15} className="text-[#ff8c00]" />
                  <h6 className="text-[9px] font-black text-[#ff8c00] uppercase tracking-[0.2em] leading-none group-hover/hd:text-orange-400 transition-colors">BẢNG PHÁT THÔNG BÁO PUSH NỔI (FCM PUSH NOTIFICATIONS)</h6>
                </div>
                <div className="text-gray-500 group-hover/hd:text-white transition-colors">
                  {openSections['util_push'] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>
              
              {openSections['util_push'] && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="space-y-2.5">
                 <input 
                   type="text"
                   value={pushForm.title}
                   onChange={(e) => setPushForm({...pushForm, title: e.target.value})}
                   placeholder="Nhập tiêu đề tin nhắn nổi..."
                   className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-[9.5px] font-bold text-white outline-none focus:border-[#ff8c00]"
                 />
                 <textarea 
                   value={pushForm.body}
                   onChange={(e) => setPushForm({...pushForm, body: e.target.value})}
                   placeholder="Nhập nội dung thông điệp nổi..."
                   className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-[9.5px] font-bold text-white outline-none min-h-[60px] resize-none focus:border-[#ff8c00]"
                 />
              </div>

              <button 
                onClick={handleSendPush}
                disabled={isSendingPush}
                className="w-full bg-[#ff8c00] hover:bg-[#ff8c00]/90 text-black font-black py-4 rounded-xl text-[9px] uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-orange-950/20"
              >
                {isSendingPush ? <Loader2 className="animate-spin" size={13} /> : <Zap size={13} />}
                PHÁT LỆNH THÔNG BÁO CHO TOÀN BỘ MOBILE APK USER
              </button>
              <p className="text-[6.5px] font-extrabold text-gray-500 uppercase tracking-widest text-center px-4 leading-normal">
                * Thao tác này sẽ truyền tín hiệu FCM tức thì đến các máy Android/iOS cài đặt ứng dụng APK đã mở thông báo.
              </p>
                </div>
              )}
            </div>

            {/* Smart simulation stealth robot toggler block */}
            <div className="bg-green-500/5 border border-green-500/10 rounded-2xl p-5 space-y-4">
              <div 
                onClick={() => toggleSection('util_simulation')}
                className="flex items-center justify-between border-b border-green-500/10 pb-1.5 cursor-pointer select-none group/hd"
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles size={15} className="text-green-400" />
                  <h6 className="text-[9px] font-black text-white uppercase tracking-widest leading-none group-hover/hd:text-green-400 transition-colors">Vận hành Robot Giao dịch ảo (Simulation Stealth)</h6>
                </div>
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => {
                      setLocalSettings({...localSettings, ENABLE_SIMULATION: !localSettings.ENABLE_SIMULATION});
                      setHasChanges(true);
                    }}
                    className={`w-9 h-5 rounded-full relative transition-all ${localSettings.ENABLE_SIMULATION ? 'bg-green-500' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${localSettings.ENABLE_SIMULATION ? 'left-4.5' : 'left-0.5'}`}></div>
                  </button>
                  <div className="text-gray-500 group-hover/hd:text-white transition-colors pl-1">
                    {openSections['util_simulation'] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </div>
              </div>
              
              {openSections['util_simulation'] && (
                <div className="space-y-3.5 animate-in fade-in duration-200 pt-2">
                  <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5 mb-3">
                    <span className="text-[7.5px] font-black text-gray-500 uppercase tracking-widest block mb-2">Trạng thái mô phỏng</span>
                    <button 
                      onClick={() => {
                        setLocalSettings({...localSettings, ENABLE_SIMULATION: !localSettings.ENABLE_SIMULATION});
                        setHasChanges(true);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase flex items-center gap-1.5 border ${localSettings.ENABLE_SIMULATION ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${localSettings.ENABLE_SIMULATION ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                      {localSettings.ENABLE_SIMULATION ? 'ĐANG KÍCH HOẠT ROBOT' : 'ROBOT ĐANG TẮT'}
                    </button>
                  </div>
                  {localSettings.ENABLE_SIMULATION && (
                    <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[7.5px] font-black text-gray-500 uppercase tracking-widest px-0.5">Khoảng tần suất xuất hiện thông báo ảo (Giây)</label>
                    <span className="text-xs font-mono font-black text-[#ff8c00]">{localSettings.SIMULATION_INTERVAL || 15}s</span>
                  </div>
                  <input 
                    type="range"
                    min="3"
                    max="120"
                    step="1"
                    value={Number(localSettings.SIMULATION_INTERVAL || 15)}
                    onChange={(e) => {
                      setLocalSettings({...localSettings, SIMULATION_INTERVAL: parseInt(e.target.value)});
                      setHasChanges(true);
                    }}
                    className="w-full h-1 accent-[#ff8c00] bg-white/10 rounded-sm appearance-none cursor-pointer"
                  />
                  <p className="text-[7px] font-bold text-gray-500 uppercase leading-normal tracking-wide">
                    * Robot sẽ tự động dựng lên những dòng tin popup giả (ví dụ: Trần Văn C vừa giải ngân 10.000.000đ, Phạm B vừa gia hạn hợp đồng thành công) nhằm tăng uy tín lòng tin cho khách hàng khi online.
                  </p>
                </div>
              )}
                </div>
              )}
            </div>

            <button 
              onClick={() => handleSaveSettings(['ZALO_GROUP_LINK', 'SYSTEM_NOTIFICATION', 'SHOW_SYSTEM_NOTIFICATION', 'ENABLE_SIMULATION', 'SIMULATION_INTERVAL'])}
              disabled={isSavingSettings}
              className="w-full bg-[#ff8c00]/10 border border-[#ff8c00]/25 hover:bg-[#ff8c00]/20 text-[#ff8c00] font-black py-4 rounded-xl text-[9px] uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSavingSettings ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
              LƯU CẤU HÌNH TIỆN ÍCH & TRỰC QUAN
            </button>
          </div>
        )}

      </div>

    </div>
  );
};

export default AdminSystemSettingsPanel;
