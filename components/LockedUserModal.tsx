import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, LogOut, MessageCircle, CreditCard, ExternalLink, AlertTriangle } from 'lucide-react';

interface LockedUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  loans: any[];
  onSettle: () => void;
  zaloLink: string;
}

const LockedUserModal: React.FC<LockedUserModalProps> = ({ 
  isOpen, 
  onClose, 
  user, 
  loans,
  onSettle,
  zaloLink 
}) => {
  if (!isOpen) return null;

  const activeLoans = (loans || []).filter(l => 
    ['ĐANG NỢ', 'QUÁ HẠN', 'CHỜ TẤT TOÁN', 'ĐANG ĐỐI SOÁT'].includes(l.status)
  );
  
  const totalDebt = activeLoans.reduce((sum, l) => sum + (Number(l.amount) || 0) + (Number(l.fine) || 0), 0);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/95 backdrop-blur-xl"
        />
        
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-md bg-[#0a0a0a] border border-[#ff8c00]/20 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
        >
          {/* Animated Background Element */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#ff8c00]/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#ff8c00]/5 rounded-full blur-3xl animate-pulse" />

          <div className="relative flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-[#ff8c00]/10 rounded-3xl flex items-center justify-center text-[#ff8c00] mb-6 border border-[#ff8c00]/20 shadow-[0_0_20px_rgba(255,140,0,0.1)]">
              <ShieldAlert size={40} strokeWidth={1.5} />
            </div>

            <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">
              Tài khoản tạm khóa
            </h2>
            
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed mb-6 px-4">
              {user?.lockedReason || "Tài khoản bị giới hạn truy cập do có khoản nợ quá hạn hoặc vi phạm quy định hệ thống."}
            </p>

            <div className="w-full bg-black/60 border border-white/5 rounded-3xl p-6 mb-8 shadow-inner">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
                <div className="flex items-center gap-2 text-gray-500">
                  <AlertTriangle size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Nghĩa vụ hiện tại</span>
                </div>
                <div className="px-2 py-0.5 bg-[#ff8c00]/10 rounded-md">
                  <span className="text-[8px] font-black text-[#ff8c00] uppercase">CẦN TẤT TOÁN</span>
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">Tổng dư nợ cần thanh toán</p>
                <p className="text-4xl font-black text-[#ff8c00] tracking-tighter drop-shadow-[0_0_10px_rgba(255,140,0,0.2)]">
                  {totalDebt.toLocaleString()} <span className="text-sm opacity-40 uppercase">đ</span>
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={onSettle}
                className="group relative w-full bg-[#ff8c00] text-black font-black text-xs uppercase tracking-[0.2em] py-5 rounded-2xl flex items-center justify-center gap-3 transition-all hover:bg-[#ffa533] hover:shadow-[0_0_30px_rgba(255,140,0,0.3)] transform active:scale-95"
              >
                <CreditCard size={18} />
                Tất toán toàn bộ nợ
                <ExternalLink size={12} className="opacity-40" />
              </button>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <a
                  href={zaloLink}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-white/5 text-gray-400 font-black text-[9px] uppercase tracking-widest py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                >
                  <MessageCircle size={14} />
                  Hỗ trợ Zalo
                </a>

                <button
                  onClick={onClose}
                  className="bg-white/5 text-gray-400 font-black text-[9px] uppercase tracking-widest py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all text-rose-500/60"
                >
                  <LogOut size={14} />
                  Thoát
                </button>
              </div>
            </div>

            <p className="mt-8 text-[8px] font-bold text-gray-700 uppercase tracking-[0.3em]">
              Thanh toán ngay để khôi phục tài khoản
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default LockedUserModal;
