import React, { useState } from 'react';
import { 
  BookOpen, 
  User, 
  Wallet, 
  HelpCircle, 
  CheckCircle2,
  Award,
  Info,
  X
} from 'lucide-react';

interface ManualSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: {
    subtitle: string;
    items: string[];
  }[];
}

interface SystemManualProps {
  onBack: () => void;
}

const SystemManual: React.FC<SystemManualProps> = ({ onBack }) => {
  const [activeSection, setActiveSection] = useState<string>('USER_GUIDE');

  const manualData: ManualSection[] = [
    {
      id: 'USER_GUIDE',
      title: 'ĐĂNG KÝ',
      icon: <User size={18} />,
      content: [
        {
          subtitle: 'Quy trình tài khoản',
          items: [
            'Dùng số điện thoại chính chủ để đăng ký và nhận OTP.',
            'Cung cấp CCCD/CMND chính xác để được hệ thống xác thực.',
            'Cập nhật tài khoản ngân hàng để nhận giải ngân tự động.',
            'Mật khẩu phải bao gồm ký tự chữ và số để tăng bảo mật.'
          ]
        }
      ]
    },
    {
      id: 'LOAN_GUIDE',
      title: 'VAY VỐN',
      icon: <BookOpen size={18} />,
      content: [
        {
          subtitle: 'Quy trình vay',
          items: [
            'Chọn số tiền trong hạn mức cho phép của Hạng thành viên.',
            'Xác nhận hợp đồng điện tử sau khi kiểm tra thông tin.',
            'Chờ Admin duyệt hồ sơ và thực hiện chuyển tiền (5-10 phút).',
            'Trạng thái vay được cập nhật liên tục tại mục Hợp đồng.'
          ]
        }
      ]
    },
    {
      id: 'PAYMENT_GUIDE',
      title: 'THANH TOÁN',
      icon: <Wallet size={18} />,
      content: [
        {
          subtitle: '1. QR PayOS (Tự động 24/7)',
          items: [
            'Quét mã QR để PayOS tự động gạch nợ sau 30 giây.',
            'Đảm bảo chuyển đúng số tiền và nội dung đã có sẵn trong mã.',
            'Không cần gửi biên lai, hệ thống tự động xử lý.'
          ]
        },
        {
          subtitle: '2. Chuyển khoản (Thủ công)',
          items: [
            'Chuyển về số tài khoản Admin hiển thị trong app.',
            'Nội dung bắt buộc: US-[Mã hợp đồng] (Ví dụ: US-1234).',
            'Gửi ảnh biên lai cho CSKH Zalo để được duyệt thủ công.'
          ]
        }
      ]
    },
    {
      id: 'RANK_GUIDE',
      title: 'NÂNG HẠNG',
      icon: <Award size={18} />,
      content: [
        {
          subtitle: 'Quyền lợi nâng hạng',
          items: [
            'Tăng hạn mức giải ngân tối đa cho lần vay tiếp theo.',
            'Giảm phí dịch vụ và lãi suất cho các kỳ thanh toán.',
            'Được hỗ trợ nhanh nhất từ đội ngũ ưu tiên.'
          ]
        }
      ]
    }
  ];

  const currentSection = manualData.find(s => s.id === activeSection) || manualData[0];

  return (
    <div className="w-full bg-[#050505] min-h-screen text-white pt-6 pb-20 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-2xl flex items-center justify-center text-black">
            <BookOpen size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tighter uppercase italic">
              CENTRAL <span className="text-orange-500">GUIDE</span>
            </h2>
            <p className="text-[7px] text-gray-500 font-bold uppercase tracking-widest leading-none">Cẩm nang người dùng</p>
          </div>
        </div>
        <button 
          onClick={onBack}
          className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
        >
          <X size={20} className="text-gray-400" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-6 scrollbar-none">
        {manualData.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`flex-shrink-0 px-4 py-3 rounded-2xl flex items-center gap-2 transition-all border ${
              activeSection === section.id
                ? 'bg-orange-500 border-orange-600 text-black shadow-lg shadow-orange-500/20'
                : 'bg-[#111111] border-white/5 text-gray-500'
            }`}
          >
            {section.icon}
            <span className="text-[10px] font-black uppercase whitespace-nowrap">{section.title}</span>
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="space-y-4">
        {currentSection.content.map((block, i) => (
          <div key={i} className="bg-[#111111] border border-white/5 rounded-3xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-orange-500 rounded-full"></div>
              <h3 className="text-sm font-black uppercase tracking-tight">{block.subtitle}</h3>
            </div>
            <div className="space-y-3">
              {block.items.map((item, j) => (
                <div key={j} className="flex gap-3">
                  <div className="mt-1 flex-shrink-0">
                    <CheckCircle2 size={14} className="text-orange-500" />
                  </div>
                  <p className="text-xs text-gray-400 font-bold leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 p-5 bg-orange-500/5 border border-orange-500/10 rounded-3xl">
        <p className="text-[10px] font-bold text-gray-500 italic text-center leading-relaxed">
          "Hệ thống tự động hóa 90% quy trình. Nếu gặp sự cố về số liệu, vui lòng sử dụng chức năng Đồng bộ trong bảng điều khiển Admin."
        </p>
      </div>
    </div>
  );
};

export default SystemManual;
