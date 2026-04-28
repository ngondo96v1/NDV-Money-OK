
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { TrendingUp, Wallet, AlertTriangle, ChevronLeft, Save, X, Check, Plus, Minus, History, Calendar, ArrowUpRight, ArrowDownLeft, Info, ChevronRight, Trash2 } from 'lucide-react';
import { BudgetLog, AppSettings } from '../types';

interface AdminBudgetProps {
  currentBudget: number;
  logs: BudgetLog[];
  onUpdateBudget: (type: BudgetLog['type'], amount: number, note: string) => Promise<void>;
  onDeleteLog: (logId: string) => Promise<void>;
  onBack: () => void;
  settings: AppSettings;
}

const AdminBudget: React.FC<AdminBudgetProps> = ({ currentBudget, logs, onUpdateBudget, onDeleteLog, onBack, settings }) => {
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
    } else if (log.type === 'ADD' || log.type === 'ADJUSTMENT_IN') {
      acc.added += log.amount;
    } else if (log.type === 'WITHDRAW' || log.type === 'ADJUSTMENT_OUT') {
      acc.withdrawn += log.amount;
    }
    return acc;
  }, { initial: 0, added: 0, withdrawn: 0 });

  const netCapital = stats.initial + stats.added - stats.withdrawn;
  const currentProfit = currentBudget - netCapital;

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
        <h1 className="text-lg font-black text-white uppercase tracking-tighter leading-none">
          CẤU HÌNH NGÂN SÁCH
        </h1>
      </div>

      <div className="flex flex-col gap-4 overflow-hidden flex-1">
        {/* Thống kê Vốn Gốc */}
        <div className="grid grid-cols-3 gap-2 shrink-0">
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-2.5 space-y-1">
            <p className="text-[7px] font-black text-blue-500 uppercase tracking-widest">Vốn ban đầu</p>
            <p className="text-sm font-black text-white tracking-tighter">
              {stats.initial.toLocaleString()} <span className="text-[8px] text-gray-600 font-bold">đ</span>
            </p>
          </div>
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-2.5 space-y-1">
            <p className="text-[7px] font-black text-green-500 uppercase tracking-widest">Đã thêm vốn</p>
            <p className="text-sm font-black text-white tracking-tighter">
              {stats.added.toLocaleString()} <span className="text-[8px] text-gray-600 font-bold">đ</span>
            </p>
          </div>
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-2.5 space-y-1">
            <p className="text-[7px] font-black text-red-500 uppercase tracking-widest">Đã rút vốn</p>
            <p className="text-sm font-black text-white tracking-tighter">
              {stats.withdrawn.toLocaleString()} <span className="text-[8px] text-gray-600 font-bold">đ</span>
            </p>
          </div>
        </div>

        {/* Tổng quan ngân sách */}
        <div className="bg-gradient-to-br from-[#111111] to-black border border-white/5 rounded-2xl p-4 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 p-2 opacity-10">
            <Wallet size={60} className="text-[#ff8c00]" />
          </div>
          <div className="relative z-10 flex justify-between items-end">
            <div className="space-y-0.5">
              <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em]">Vốn lưu động hiện tại</p>
              <h2 className="text-2xl font-black text-[#ff8c00] tracking-tighter leading-none">
                {currentBudget.toLocaleString()} <span className="text-xs">đ</span>
              </h2>
            </div>
            <div className="text-right space-y-0.5">
              <p className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Lợi nhuận ròng</p>
              <h3 className={`text-sm font-black tracking-tighter ${currentProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {currentProfit >= 0 ? '+' : ''}{currentProfit.toLocaleString()} <span className="text-[8px]">đ</span>
              </h3>
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center relative z-10">
            <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">Tổng vốn đối ứng</p>
            <p className="text-[10px] font-black text-white tracking-tighter">{netCapital.toLocaleString()} đ</p>
          </div>
        </div>

        {/* Tabs hành động */}
        <div className="bg-[#111111] border border-white/5 rounded-2xl p-1 flex gap-1 shrink-0">
          {[
            { id: 'ADD', label: 'THÊM VỐN', icon: <Plus size={12} /> },
            { id: 'WITHDRAW', label: 'RÚT VỐN', icon: <Minus size={12} /> },
            { id: 'INITIAL', label: 'VỐN BAN ĐẦU', icon: <Wallet size={12} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-[#ff8c00] text-black shadow-lg shadow-orange-900/20' : 'text-gray-500 hover:text-white'}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form nhập liệu */}
        <div className="bg-[#111111] border border-white/5 rounded-2xl p-4 space-y-4 shrink-0">
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <p className="text-[7px] font-black text-gray-500 uppercase tracking-widest pl-1">
                {activeTab === 'ADD' ? 'Số tiền muốn thêm' : 'Số tiền muốn rút'} (VND)
              </p>
              <div className="bg-black border border-white/5 rounded-xl p-3 flex items-center">
                <input 
                  type="text" 
                  inputMode="numeric"
                  placeholder="0"
                  value={inputValue}
                  onChange={handleAmountChange}
                  className="bg-transparent text-lg font-black tracking-tighter focus:outline-none w-full text-[#ff8c00]"
                />
                <span className="text-gray-700 font-black text-[8px] tracking-widest uppercase ml-2">VND</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[7px] font-black text-gray-500 uppercase tracking-widest pl-1">Ghi chú hoạt động</p>
              <div className="bg-black border border-white/5 rounded-xl p-3">
                <input 
                  type="text" 
                  placeholder="Ví dụ: Thêm vốn từ nguồn dự phòng..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="bg-transparent text-[10px] font-bold tracking-tight focus:outline-none w-full text-white placeholder:text-gray-800"
                />
              </div>
            </div>
          </div>

          <button 
            onClick={handleAction}
            disabled={numericValue <= 0 || isProcessing}
            className={`w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${numericValue <= 0 || isProcessing ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-[#ff8c00] text-black shadow-orange-950/40'}`}
          >
            {activeTab === 'ADD' ? <Plus size={14} /> : <Minus size={14} />}
            {activeTab === 'ADD' ? 'XÁC NHẬN THÊM' : 'XÁC NHẬN RÚT'}
          </button>
        </div>

        {/* Lịch sử hoạt động */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3 px-1 shrink-0">
            <div className="flex items-center gap-2">
              <History size={14} className="text-[#ff8c00]" />
              <h3 className="text-[10px] font-black text-white uppercase tracking-widest">LỊCH SỬ THU / CHI</h3>
            </div>
            <p className="text-[7px] font-bold text-gray-500 uppercase tracking-tighter">Lưu tối đa 60 ngày</p>
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
                      <div className="space-y-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[8px] font-black uppercase tracking-widest ${getLogTypeColor(log.type)}`}>
                            {getLogTypeLabel(log.type)}
                          </span>
                          <span className="text-[7px] font-bold text-gray-600 flex items-center gap-0.5">
                            <Calendar size={7} />
                            {new Date(log.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[9px] font-bold text-white tracking-tight line-clamp-1">{formatLogNote(log.note)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right space-y-0">
                        <p className={`text-[10px] font-black tracking-tighter ${['ADD', 'LOAN_REPAY', 'INITIAL', 'ADJUSTMENT_IN'].includes(log.type) ? 'text-green-400' : 'text-red-400'}`}>
                          {['ADD', 'LOAN_REPAY', 'INITIAL', 'ADJUSTMENT_IN'].includes(log.type) ? '+' : '-'}
                          {log.amount.toLocaleString()} đ
                        </p>
                        <p className="text-[7px] font-bold text-gray-600 uppercase tracking-tighter">Dư: {log.balanceAfter.toLocaleString()} đ</p>
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

