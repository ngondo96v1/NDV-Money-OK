
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { TrendingUp, Wallet, AlertTriangle, ChevronLeft, Save, X, Check, Plus, Minus, History, Calendar, ArrowUpRight, ArrowDownLeft, Info, ChevronRight, Trash2, RefreshCcw } from 'lucide-react';
import { BudgetLog, AppSettings, LoanRecord, User } from '../types';

interface AdminBudgetProps {
  currentBudget: number;
  logs: BudgetLog[];
  onUpdateBudget: (type: BudgetLog['type'], amount: number, note: string) => Promise<void>;
  onDeleteLog: (logId: string) => Promise<void>;
  onSyncStats?: () => Promise<void>;
  onBack: () => void;
  settings: AppSettings;
  loans: LoanRecord[];
  users: User[];
}

const AdminBudget: React.FC<AdminBudgetProps> = ({ currentBudget, logs, onUpdateBudget, onDeleteLog, onSyncStats, onBack, settings, loans, users }) => {
  const [activeTab, setActiveTab] = useState<'ADD' | 'WITHDRAW' | 'INITIAL'>('ADD');
  const [inputValue, setInputValue] = useState('');
  const [numericValue, setNumericValue] = useState(0);
  const [note, setNote] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [logToDelete, setLogToDelete] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Calculate Capital Statistics
  const stats = logs.reduce((acc, log) => {
    if (log.type === 'INITIAL') {
      acc.initial += log.amount;
    } else if (log.type === 'ADD') {
      acc.added += log.amount;
    } else if (log.type === 'WITHDRAW') {
      acc.withdrawn += log.amount;
    }
    return acc;
  }, { initial: 0, added: 0, withdrawn: 0 });

  const netCapital = stats.initial + stats.added - stats.withdrawn;
  const currentProfit = currentBudget - netCapital;

  // Calculate Nợ Phong Toả
  const lockedUserIds = new Set((users || []).filter(u => u.isLocked).map(u => u.id));
  const activeStatuses = ['ĐANG NỢ', 'QUÁ HẠN', 'CHỜ TẤT TOÁN', 'ĐANG ĐỐI SOÁT'];
  const lockedLoans = (loans || []).filter(l => lockedUserIds.has(l.userId) && activeStatuses.includes(l.status));
  const isolatedBadDebtPrincipal = lockedLoans.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

  const totalPages = Math.ceil(logs.length / itemsPerPage);
  const displayedLogs = logs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    const num = Number(rawVal);
    setNumericValue(num);
    const formatted = new Intl.NumberFormat('vi-VN').format(num);
    setInputValue(rawVal ? formatted : '');
  };

  const handleAction = () => {
    if (numericValue <= 0) {
      toast.error("Vui lòng nhập số tiền hợp lệ");
      return;
    }
    if (activeTab === 'WITHDRAW' && numericValue > currentBudget) {
      toast.error("Số tiền rút vượt quá ngân sách hiện có");
      return;
    }
    setShowConfirm(true);
  };

  const confirmAction = async () => {
    setIsProcessing(true);
    try {
      const actionLabels: Record<string, string> = {
        'ADD': 'Thêm vốn',
        'WITHDRAW': 'Rút vốn',
        'INITIAL': 'Vốn ban đầu'
      };
      const actionNote = note || actionLabels[activeTab];
      await onUpdateBudget(activeTab, numericValue, actionNote);
      toast.success("Cập nhật ngân sách thành công");
      setInputValue('');
      setNumericValue(0);
      setNote('');
      setShowConfirm(false);
    } catch (e) {
      toast.error("Đã xảy ra lỗi khi cập nhật");
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmDeleteLog = async () => {
    if (!logToDelete) return;
    setIsProcessing(true);
    try {
      await onDeleteLog(logToDelete);
      setLogToDelete(null);
    } catch (e) {
      toast.error("Không thể xóa log này");
    } finally {
      setIsProcessing(false);
    }
  };

  const getLogTypeLabel = (type: BudgetLog['type']) => {
    switch (type) {
      case 'INITIAL': return 'Ban đầu';
      case 'ADD': return 'Thêm vào';
      case 'WITHDRAW': return 'Rút ra';
      case 'LOAN_DISBURSE': return 'Giải ngân';
      case 'LOAN_REPAY': return 'Thu hồi';
      case 'ADJUSTMENT_IN': return 'Điều chỉnh (+)';
      case 'ADJUSTMENT_OUT': return 'Điều chỉnh (-)';
      default: return type;
    }
  };

  const getLogTypeColor = (type: BudgetLog['type']) => {
    switch (type) {
      case 'INITIAL': return 'text-blue-400';
      case 'ADD': return 'text-green-400';
      case 'WITHDRAW': return 'text-red-400';
      case 'LOAN_DISBURSE': return 'text-orange-400';
      case 'LOAN_REPAY': return 'text-emerald-400';
      case 'ADJUSTMENT_IN': return 'text-cyan-400';
      case 'ADJUSTMENT_OUT': return 'text-fuchsia-400';
      default: return 'text-gray-400';
    }
  };

  const getLogIcon = (type: BudgetLog['type']) => {
    switch (type) {
      case 'INITIAL': return <Wallet size={14} />;
      case 'ADD': return <Plus size={14} />;
      case 'WITHDRAW': return <Minus size={14} />;
      case 'LOAN_DISBURSE': return <ArrowUpRight size={14} />;
      case 'LOAN_REPAY': return <ArrowDownLeft size={14} />;
      default: return <Info size={14} />;
    }
  };

  return (
    <div className="w-full bg-black px-4 pb-4 animate-in fade-in duration-500 relative flex flex-col h-screen overflow-hidden">
      <div className="flex items-center gap-3 pt-6 mb-4">
        <button 
          onClick={onBack}
          className="w-7 h-7 bg-[#111111] border border-white/5 rounded-full flex items-center justify-center text-white active:scale-90 transition-all"
        >
          <ChevronLeft size={16} />
        </button>
        <h1 className="text-sm font-black text-white uppercase tracking-widest leading-none">
          NGÂN SÁCH
        </h1>
        <div className="flex-1"></div>
      </div>

      <div className="flex flex-col gap-4 overflow-hidden flex-1">
        {/* Unified Budget Overview Card */}
        <div className="bg-[#111111] border border-white/5 rounded-xl p-3.5 relative overflow-hidden shadow-2xl shrink-0">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 blur-2xl rounded-full -mr-12 -mt-12"></div>
          
          <div className="relative z-10">
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-0.5 min-w-0">
                <p className="text-[7px] font-black text-gray-500 uppercase tracking-widest leading-none truncate">THÊM VỐN</p>
                <p className="text-[10px] font-black text-emerald-400 truncate">
                  {stats.added.toLocaleString()}đ
                </p>
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className="text-[7px] font-black text-gray-500 uppercase tracking-widest leading-none truncate">RÚT VỐN</p>
                <p className="text-[10px] font-black text-rose-500 truncate">
                  {stats.withdrawn.toLocaleString()}đ
                </p>
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className="text-[7px] font-black text-gray-500 uppercase tracking-widest leading-none truncate">NỢ PHONG TOẢ</p>
                <p className="text-[10px] font-black text-amber-500 truncate">
                  {isolatedBadDebtPrincipal.toLocaleString()}đ
                </p>
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className="text-[7px] font-black text-gray-500 uppercase tracking-widest leading-none truncate">VỐN BAN ĐẦU</p>
                <p className="text-[10px] font-black text-white truncate">
                  {stats.initial.toLocaleString()}đ
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Tabs */}
        <div className="bg-[#111111] border border-white/5 rounded-xl p-0.5 flex gap-0.5 shrink-0">
          {[
            { id: 'ADD', label: 'THÊM VỐN', icon: <Plus size={9} /> },
            { id: 'WITHDRAW', label: 'RÚT VỐN', icon: <Minus size={9} /> },
            { id: 'INITIAL', label: 'THIẾT LẬP', icon: <Wallet size={9} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[7px] font-black uppercase tracking-wider transition-all ${
                activeTab === tab.id 
                  ? 'bg-orange-500/10 text-[#ff8c00] border border-orange-500/20 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-300 border border-transparent'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <div className="bg-[#111111] border border-white/5 rounded-xl p-2.5 space-y-2 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <p className="text-[7px] font-black text-gray-500 uppercase tracking-widest pl-1">
                {activeTab === 'ADD' ? 'SỐ TIỀN THÊM' : activeTab === 'WITHDRAW' ? 'SỐ TIỀN RÚT' : 'SỐ VỐN BAN ĐẦU'}
              </p>
              <div className="bg-black border border-white/5 rounded-lg px-2 py-1.5 flex items-center h-8">
                <input 
                  type="text" 
                  inputMode="numeric"
                  placeholder="0"
                  value={inputValue}
                  onChange={handleAmountChange}
                  className="bg-transparent text-xs font-black tracking-tighter focus:outline-none w-full text-[#ff8c00]"
                />
                <span className="text-gray-700 font-black text-[6px] tracking-widest uppercase ml-1 shrink-0">VND</span>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[7px] font-black text-gray-500 uppercase tracking-widest pl-1">GHI CHÚ GIAO DỊCH</p>
              <div className="bg-black border border-white/5 rounded-lg px-2 py-1.5 flex items-center h-8">
                <input 
                  type="text" 
                  placeholder={activeTab === 'ADD' ? "Nguồn bổ sung..." : activeTab === 'WITHDRAW' ? "Rút về..." : "Thiết lập..."}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="bg-transparent text-[9px] font-bold tracking-tight focus:outline-none w-full text-white placeholder:text-gray-800"
                />
              </div>
            </div>
          </div>

          <button 
            onClick={handleAction}
            disabled={numericValue <= 0 || isProcessing}
            className={`w-full py-2 rounded-lg text-[8px] font-black uppercase tracking-[0.15em] shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 ${
              numericValue <= 0 || isProcessing 
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed' 
                : 'bg-[#ff8c00] text-black hover:bg-orange-500'
            }`}
          >
            {activeTab === 'ADD' ? <Plus size={11} /> : activeTab === 'WITHDRAW' ? <Minus size={11} /> : <Wallet size={11} />}
            {activeTab === 'ADD' ? 'XÁC NHẬN THÊM VỐN' : activeTab === 'WITHDRAW' ? 'XÁC NHẬN RÚT VỐN' : 'CẬP NHẬT VỐN BAN ĐẦU'}
          </button>
        </div>

        {/* Transaction Logs History */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3 px-1 shrink-0">
            <div className="flex items-center gap-2">
              <History size={13} className="text-[#ff8c00]" />
              <h3 className="text-[10px] font-black text-white uppercase tracking-widest">LỊCH SỬ HOẠT ĐỘNG</h3>
            </div>
            <p className="text-[7px] font-bold text-gray-600 uppercase tracking-widest">60 ngày</p>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
            {logs.length === 0 ? (
              <div className="bg-[#111111] border border-dashed border-white/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-gray-700">
                  <History size={20} />
                </div>
                <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">Chưa có dữ liệu</p>
              </div>
            ) : (
              <>
                {displayedLogs.map((log) => (
                  <div key={log.id} className="bg-[#111111] border border-white/5 rounded-xl p-3 flex items-center justify-between group hover:border-[#ff8c00]/20 transition-all">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-black border border-white/5 ${getLogTypeColor(log.type)}`}>
                        {getLogIcon(log.type)}
                      </div>
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className={`text-[8px] font-black uppercase tracking-widest shrink-0 ${getLogTypeColor(log.type)}`}>
                            {getLogTypeLabel(log.type)}
                          </span>
                          <span className="text-[7px] font-bold text-gray-600 flex items-center gap-0.5 whitespace-nowrap">
                            <Calendar size={7} />
                            {new Date(log.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[9px] font-bold text-white tracking-tight leading-relaxed break-words">{formatLogNote(log.note)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right space-y-0">
                        <p className={`text-[10px] font-black tracking-tighter ${['ADD', 'LOAN_REPAY', 'INITIAL', 'ADJUSTMENT_IN'].includes(log.type) ? 'text-emerald-400' : 'text-red-500'}`}>
                          {['ADD', 'LOAN_REPAY', 'INITIAL', 'ADJUSTMENT_IN'].includes(log.type) ? '+' : '-'}
                          {log.amount.toLocaleString()}đ
                        </p>
                        <p className="text-[7px] font-bold text-gray-600 uppercase tracking-tighter">Dư: {log.balanceAfter.toLocaleString()}đ</p>
                      </div>
                      <button 
                        onClick={() => setLogToDelete(log.id)}
                        className="w-7 h-7 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/20"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 px-1 pt-2 border-t border-white/5 shrink-0">
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
        </div>
      </div>

      {/* Popup xác nhận */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-5 animate-in fade-in duration-300">
          <div className="bg-[#111111] border border-white/10 w-full max-w-sm rounded-3xl p-6 space-y-6 relative shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#ff8c00]"></div>
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 bg-[#ff8c00]/10 rounded-full flex items-center justify-center text-[#ff8c00]">
                 <AlertTriangle size={28} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-white uppercase tracking-tighter">XÁC NHẬN GIAO DỊCH</h3>
                <p className="text-[9px] font-bold text-gray-400 uppercase leading-relaxed px-3">
                  {activeTab === 'INITIAL' 
                    ? `Bạn có muốn thiết lập lại TỔNG VỐN ban đầu là ${numericValue.toLocaleString()} đ? (Hệ thống sẽ tự động trừ đi các khoản đang cho vay để tính vốn lưu động)`
                    : `Bạn có chắc chắn muốn ${activeTab === 'ADD' ? 'thêm' : 'rút'} ${numericValue.toLocaleString()} đ ${activeTab === 'ADD' ? 'vào ngân sách' : 'khỏi ngân sách'}?`
                  }
                </p>
              </div>
            </div>

            <div className="flex gap-2.5">
               <button 
                 onClick={() => setShowConfirm(false)}
                 disabled={isProcessing}
                 className="flex-1 py-3.5 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-gray-500 uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                 <X size={12} /> HỦY BỎ
               </button>
               <button 
                 onClick={confirmAction}
                 disabled={isProcessing}
                 className="flex-1 py-3.5 bg-[#ff8c00] rounded-xl text-[9px] font-black text-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/20"
               >
                 {isProcessing ? <History className="animate-spin" size={12} /> : <Check size={12} />} XÁC NHẬN
               </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal xác nhận xóa log */}
      {logToDelete && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#111111] border border-red-600/20 w-full max-w-sm rounded-[2.5rem] p-8 space-y-8 relative shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-red-600"></div>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center text-red-600 shadow-[0_0_20px_rgba(220,38,38,0.2)]">
                 <AlertTriangle size={32} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">XÓA LOG THU/CHI?</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase leading-relaxed px-4">
                  Bạn có chắc chắn muốn xóa vĩnh viễn bản ghi thu chi này? Thao tác này <span className="text-red-500 font-black">KHÔNG THỂ HOÀN TÁC</span>.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
               <button 
                 onClick={() => setLogToDelete(null)}
                 disabled={isProcessing}
                 className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-gray-500 uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                 <X size={14} /> HỦY BỎ
               </button>
               <button 
                 onClick={confirmDeleteLog}
                 disabled={isProcessing}
                 className="flex-1 py-4 bg-red-600 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/40"
               >
                 {isProcessing ? <History size={14} className="animate-spin" /> : <Check size={14} />} ĐỒNG Ý XÓA
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBudget;

