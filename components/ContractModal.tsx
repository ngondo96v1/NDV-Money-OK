
import React from 'react';
import { User, LoanRecord, AppSettings } from '../types';
import { X, ShieldCheck, Download, Calendar, Award, Scale, AlertCircle, ShieldAlert, FileCheck, Landmark, ArrowDownToLine, Lock } from 'lucide-react';
import { replaceContractPlaceholders } from '../utils';

interface ContractModalProps {
  contract: LoanRecord;
  user: User | null;
  onClose: () => void;
  settings: AppSettings;
}

const ContractModal: React.FC<ContractModalProps> = ({ contract, user, onClose, settings }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-500 overflow-hidden">
      <div className="w-full p-3 flex items-center justify-between bg-black text-white border-b border-white/5 flex-none">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-orange-500/10 rounded-lg flex items-center justify-center text-[#ff8c00]">
            <Award size={16} />
          </div>
          <div>
            <h3 className="text-[9px] font-black uppercase tracking-widest leading-none">Hợp đồng gốc kỹ thuật số</h3>
            <p className="text-[6px] font-bold text-gray-500 uppercase mt-0.5 tracking-tighter">
              {settings.CONTRACT_CLAUSES?.subtitle || 'XÁC THỰC ĐIỆN TỬ NDV-SAFE'}
            </p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="w-7 h-7 bg-white/5 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-all active:scale-90"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 bg-black px-2 pt-1 pb-2 overflow-hidden flex flex-col">
        <div className="bg-white w-full rounded-2xl p-2.5 relative overflow-hidden shadow-2xl border border-gray-100 flex-1 flex flex-col">
          
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center opacity-[0.01] rotate-[-35deg] select-none space-y-8">
            <span className="text-3xl font-black whitespace-nowrap">NDV ORIGINAL DOCUMENT</span>
            <span className="text-3xl font-black whitespace-nowrap">AUTHENTIC SIGNING</span>
          </div>

          <div className="flex flex-col items-center space-y-1 relative z-10 flex-none">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-[#ff8c00] font-black text-xs shadow-lg border border-orange-500/20">
                NDV
               </div>
               <div className="h-4 w-px bg-gray-200"></div>
               <Landmark size={16} className="text-gray-300" />
            </div>
            <div className="text-center">
              <h2 className="text-sm font-black text-black tracking-tighter uppercase leading-tight">
                {settings.CONTRACT_CLAUSES?.title || 'Hợp đồng vay tiêu dùng'}
              </h2>
              <p className="text-[6px] font-bold text-gray-400 uppercase tracking-widest">Mã số: {contract.id}</p>
            </div>
          </div>

          <div className="w-full h-px bg-gray-100 my-2 relative z-10 flex-none"></div>

          <div className="flex-1 min-h-0 relative z-10 overflow-y-auto pr-1 custom-scrollbar py-2 space-y-4">
            
            {/* Nội dung các điều khoản động */}
            {(settings.CONTRACT_CLAUSES?.clauses || [
              { title: 'Các bên giao kết', content: 'Bên A (Bên cho vay): HỆ THỐNG TÀI CHÍNH NDV FINANCIAL\nBên B (Bên vay): CÁ NHÂN ĐỊNH DANH' },
              { title: 'Nội dung thỏa thuận vay', content: 'Bên A đồng ý cho Bên B vay số tiền gốc theo yêu cầu đã được phê duyệt trên hệ thống. Lãi suất vay là 0% (Ưu đãi).' },
              { title: 'Giải ngân và Thanh toán', content: '3.1. Bên A thực hiện giải ngân trực tiếp vào tài khoản ngân hàng đã được Bên B cung cấp.\n3.2. Bên B có trách nhiệm hoàn trả toàn bộ số tiền gốc vào ngày đến hạn.\n3.3. Mọi giao dịch thanh toán phải được thực hiện đúng theo nội dung chuyển khoản được hệ thống chỉ định.' },
              { title: 'Phí dịch vụ và Phí phạt', content: 'Phí phạt quá hạn được tính dựa trên số dư nợ gốc thực tế và bắt đầu áp dụng từ 00:01 ngày kế tiếp sau ngày đến hạn.' },
              { title: 'Quyền và Nghĩa vụ của Bên B', content: '5.1. Được nhận tiền giải ngân đúng số lượng.\n5.2. Có nghĩa vụ tự theo dõi thời hạn vay và chủ động thực hiện thanh toán đúng hạn.\n5.3. Cam kết sử dụng vốn vay vào mục đích hợp pháp.' },
              { title: 'Xử lý vi phạm và Thu hồi nợ', content: '6.1. Trường hợp Bên B cố tình vi phạm nghĩa vụ thanh toán, Bên A có quyền áp dụng các biện pháp thu hồi nợ hợp pháp.\n6.2. Bên A được quyền cung cấp thông tin vi phạm của Bên B cho các đơn vị xếp hạng tín dụng.' },
              { title: 'Giải quyết tranh chấp', content: '7.1. Mọi tranh chấp phát sinh sẽ được giải quyết thông qua thương lượng, hòa giải.\n7.2. Trường hợp không đạt được thỏa thuận, tranh chấp sẽ được đưa ra giải quyết tại Tòa án có thẩm quyền.' },
              { title: 'Điều khoản chung', content: '8.1. Hợp đồng này được lập dưới dạng dữ liệu điện tử, có giá trị pháp lý tương đương văn bản giấy.\n8.2. Bên B xác nhận đã đọc, hiểu rõ và đồng ý toàn bộ các điều khoản.' }
            ]).map((clause: any, index: number) => (
              <section key={index} className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <div className={`w-4 h-4 rounded flex items-center justify-center text-white font-black text-[7px] ${clause.title.toLowerCase().includes('phí phạt') ? 'bg-red-600' : 'bg-black'}`}>
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <h4 className={`text-[10px] font-black uppercase tracking-widest ${clause.title.toLowerCase().includes('phí phạt') ? 'text-red-600' : 'text-black'}`}>
                    {clause.title}
                  </h4>
                </div>
                <div className={`${clause.title.toLowerCase().includes('phí phạt') ? 'bg-red-50/50 border border-red-100' : 'bg-gray-50 border border-gray-100'} rounded-xl p-3 shadow-sm`}>
                  {(() => {
                    const content = replaceContractPlaceholders(clause.content, user, contract);
                    const isParties = clause.title.toLowerCase().includes('bên giao kết');
                    const isFine = clause.title.toLowerCase().includes('phí phạt');

                    const highlightPlaceholders = (text: string) => {
                      if (!user) return text;
                      const placeholders = [
                        contract.amount ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(contract.amount) : null,
                        contract.date,
                        user.fullName,
                        user.idNumber,
                        contract.loanPurpose,
                        user.bankName,
                        user.bankAccountNumber,
                        user.phone,
                        user.address,
                        contract.id,
                        new Date().toLocaleDateString('vi-VN'),
                        '................'
                      ].filter(Boolean);

                      let parts: any[] = [text];
                      
                      placeholders.forEach(p => {
                        const newParts: any[] = [];
                        parts.forEach(part => {
                          if (typeof part === 'string') {
                            const segments = part.split(String(p));
                            segments.forEach((seg, i) => {
                              newParts.push(seg);
                              if (i < segments.length - 1) {
                                const isBankAccount = String(p) === user.bankAccountNumber || (String(p) === '................' && text.toLowerCase().includes('tài khoản'));
                                newParts.push(
                                  <span 
                                    key={`${p}-${i}`} 
                                    className={`font-black px-1 rounded-sm ${
                                      isBankAccount 
                                        ? "text-blue-600 bg-blue-50 border border-blue-100" 
                                        : "text-[#ff8c00] bg-[#ff8c00]/10 border border-[#ff8c00]/10"
                                    }`}
                                  >
                                    {String(p)}
                                  </span>
                                );
                              }
                            });
                          } else {
                            newParts.push(part);
                          }
                        });
                        parts = newParts;
                      });
                      return parts;
                    };

                    if (isParties || content.includes('[COLUMN_SPLIT]')) {
                      let sideA = "";
                      let sideB = "";
                      
                      if (content.includes('[COLUMN_SPLIT]')) {
                        const parts = content.split('[COLUMN_SPLIT]');
                        sideA = parts[0] || "";
                        sideB = parts[1] || "";
                      } else {
                        const parts = content.split(/(?=Bên B|Bên vay)/i);
                        sideA = parts[0] || "";
                        sideB = parts.slice(1).join("") || "";
                      }
                      
                      const linesA = sideA.split('\n').map(l => l.trim()).filter(Boolean);
                      const linesB = sideB.split('\n').map(l => l.trim()).filter(Boolean);
                      const maxLines = Math.max(linesA.length, linesB.length);
                      
                      return (
                        <div className="space-y-1">
                          {Array.from({ length: maxLines }).map((_, i) => (
                            <div key={i} className="grid grid-cols-2 gap-4 items-start">
                              <div className="text-[7px] font-bold text-gray-700 leading-tight border-r border-gray-100 pr-2 min-h-[1.2em]">
                                {highlightPlaceholders(linesA[i] || '')}
                              </div>
                              <div className="text-[7px] font-bold text-gray-700 leading-tight min-h-[1.2em]">
                                {highlightPlaceholders(linesB[i] || '')}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    }

                    return (
                      <>
                        {isFine && (
                          <div className="grid grid-cols-1 gap-4 mb-2">
                            <div className="space-y-1">
                              <p className="text-[6px] font-black text-gray-400 uppercase">Phí phạt quá hạn</p>
                              <p className="text-[9px] font-black text-red-600">{settings.FINE_RATE}% / Ngày chậm trả</p>
                            </div>
                          </div>
                        )}
                        <div className={`text-[7px] font-bold leading-relaxed whitespace-pre-line ${isFine ? 'text-gray-600 border-t border-red-100 pt-2' : 'text-gray-700'}`}>
                          {highlightPlaceholders(content)}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </section>
            ))}

            {/* Chữ ký */}
            <section className="pt-2 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center justify-center space-y-1">
                  <p className="text-[6px] font-black text-gray-400 uppercase tracking-widest">Đại diện Bên A</p>
                  <div className="w-full aspect-[16/9] bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center overflow-hidden relative">
                    <div className="absolute inset-0 flex items-center justify-center opacity-80 scale-150 -rotate-12">
                      <div className="w-14 h-14 rounded-full border-2 border-red-600 border-dashed flex flex-col items-center justify-center text-red-600">
                        <span className="text-[4px] font-black uppercase leading-none">NDV GROUP</span>
                        <ShieldCheck size={12} className="my-0.5" />
                        <span className="text-[3px] font-black uppercase leading-none">VERIFIED</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[7px] font-black text-red-600 uppercase tracking-tighter">ĐÃ KÝ SỐ HỆ THỐNG</p>
                </div>

                <div className="flex flex-col items-center justify-center space-y-1">
                  <p className="text-[6px] font-black text-gray-400 uppercase tracking-widest">Người vay (Bên B)</p>
                  <div className="w-full aspect-[16/9] bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center overflow-hidden relative">
                    {contract.signature ? (
                      <img 
                        src={contract.signature} 
                        alt="Signature" 
                        className="w-full h-full object-contain mix-blend-multiply"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center opacity-20">
                        <Lock size={12} className="text-gray-400 mb-1" />
                        <span className="text-[5px] font-black text-gray-400 uppercase">CHƯA KÝ</span>
                      </div>
                    )}
                    <div className="absolute top-1 right-1">
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 rounded-full border border-blue-500/20">
                        <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"></div>
                        <span className="text-[4px] text-blue-500 font-black uppercase tracking-widest">Verified</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[7px] font-black text-blue-600 uppercase tracking-tighter truncate w-full text-center">{user?.fullName}</p>
                </div>
              </div>
            </section>
          </div>

          <div className="flex justify-center pt-2 mt-1 border-t border-gray-50 flex-none">
             <p className="text-[5px] font-bold text-gray-300 uppercase tracking-[0.2em]">Hợp đồng số hóa NDV Financial System v1.26</p>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 left-0 right-0 p-3 bg-black flex gap-2 z-[110] border-t border-white/5 mt-auto">
        <button className="flex-1 py-3.5 rounded-xl border border-white/10 text-white font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all bg-white/5">
          <Download size={14} />
          Bản gốc
        </button>
        <button 
          onClick={onClose}
          className="flex-[1.5] py-3.5 rounded-xl bg-[#ff8c00] text-black font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-orange-950/20"
        >
          Xác nhận đóng
        </button>
      </div>
    </div>
  );
};

export default ContractModal;
