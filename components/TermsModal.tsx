
import React from 'react';
import { X, ShieldCheck, FileText, AlertCircle, Lock } from 'lucide-react';

interface TermsModalProps {
  onClose: () => void;
}

const TermsModal: React.FC<TermsModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-[#111111] w-full max-w-md rounded-[2.5rem] flex flex-col max-h-[90dvh] overflow-hidden border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#ff8c00]/10 rounded-xl flex items-center justify-center text-[#ff8c00]">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-tighter">Điều khoản sử dụng</h3>
              <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Cập nhật: 16/03/2026</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 bg-white/5 rounded-full flex items-center justify-center text-gray-500 hover:text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-[#ff8c00]">
              <ShieldCheck size={14} />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#ff8c00]">1. KỶ LUẬT VAY VÀ THỐNG NHẤT</h4>
            </div>
            <p className="text-[11px] text-gray-300 leading-relaxed font-bold">
              Mọi giao dịch vay tại NDV Money đều dựa trên tính minh bạch và KỶ LUẬT THÉP. Biên vay thừa nhận đã đọc và sẵn sàng chấp nhận các hình thức xử lý nghiêm khắc nhất nếu vi phạm điều khoản. Không có ngoại lệ, không có sự nương tay đối với các hành vi gian dối hoặc trễ hạn.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-[#ff8c00]">
              <FileText size={14} />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#ff8c00]">2. QUY TẮC NÂNG - HẠ HẠNG</h4>
            </div>
            <ul className="space-y-2.5">
              <li className="flex gap-2.5">
                <div className="w-1.5 h-1.5 bg-[#ff8c00] rounded-full mt-1.5 shrink-0"></div>
                <p className="text-[11px] text-gray-400 leading-relaxed font-medium"><span className="text-white font-bold">Nâng hạng:</span> Chỉ dành cho những cá nhân có lịch sử thanh toán sòng phẳng, chính xác đến từng phút. Nâng hạng giúp tăng hạn mức tối đa một cách xứng đáng.</p>
              </li>
              <li className="flex gap-2.5">
                <div className="w-1.5 h-1.5 bg-red-600 rounded-full mt-1.5 shrink-0"></div>
                <p className="text-[11px] text-gray-400 leading-relaxed font-medium"><span className="text-red-500 font-bold">Hạ hạng:</span> Tự động kích hoạt ngay khi quá hạn 01 ngày. Hệ thống sẽ tước bỏ đặc quyền và đưa bạn trở về hạng thấp nhất để thử thách lại lòng tin.</p>
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-[#ff8c00]">
              <AlertCircle size={14} />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#ff8c00]">3. PHÍ PHẠT VÀ TẤT TOÁN</h4>
            </div>
            <ul className="space-y-2.5">
              <li className="flex gap-2.5">
                <div className="w-1.5 h-1.5 bg-red-600 rounded-full mt-1.5 shrink-0"></div>
                <p className="text-[11px] text-gray-400 leading-relaxed font-medium"><span className="text-red-500 font-bold">Phí quá hạn:</span> Áp dụng lũy tiến mỗi ngày. Sự chậm trễ của bạn là tổn thất của hệ thống, và bạn phải bồi thường thích đáng.</p>
              </li>
              <li className="flex gap-2.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 shrink-0"></div>
                <p className="text-[11px] text-gray-400 leading-relaxed font-medium"><span className="text-green-500 font-bold">Tất toán:</span> Khuyến khích tất toán trước hạn để khẳng định uy tín tuyệt đối và nhận ưu đãi cho các lần vay kế tiếp.</p>
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-[#ff8c00]">
              <AlertCircle size={14} />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#ff8c00]">4. VÒNG QUAY MAY MẮN</h4>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed font-medium">
              Vòng quay may mắn là phần thưởng danh dự cho sự trung thành và kỷ luật. Chỉ những thành viên có lịch sử thanh toán SẠCH và đúng hạn mới được quyền tham gia để nhận các đặc quyền tài chính.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle size={14} />
              <h4 className="text-[10px] font-black uppercase tracking-widest">5. BIỆN PHÁP CHẾ TÀI</h4>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed font-bold">
              Trong trường hợp cố tình không thanh toán hoặc ngắt kết nối liên lạc: Hệ thống sẽ phong tỏa vĩnh viễn ID và chuyển hồ sơ nợ sang đơn vị thu hồi chuyên nghiệp. Không có chỗ cho sự thỏa hiệp với những hành vi vô kỷ luật.
            </p>
          </section>

          <div className="bg-[#ff8c00]/5 border border-[#ff8c00]/10 rounded-2xl p-4">
            <p className="text-[9px] font-black text-[#ff8c00] text-center uppercase tracking-widest">
              "NDV MONEY - KỶ LUẬT TẠO NÊN SỨC MẠNH"
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/5 shrink-0 bg-[#111111]">
          <button 
            onClick={onClose}
            className="w-full py-4 bg-[#ff8c00] text-black font-black text-[10px] uppercase tracking-widest rounded-2xl active:scale-95 transition-all shadow-xl shadow-orange-950/20"
          >
            Tôi đã hiểu và đồng ý
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsModal;
