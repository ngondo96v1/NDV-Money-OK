import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { User, LoanRecord, AppSettings } from '../types';
import { Wallet, X, Eye, FileText, CheckCircle2, ShieldCheck, Eraser, ChevronLeft, CreditCard, CircleHelp, Info, Award, Landmark, FileCheck, AlertCircle, AlertTriangle, ShieldAlert, ChevronRight, History, Calendar, Scale, Check, Loader2, MessageCircle, ArrowUpCircle, ArrowDownToLine, Copy, Camera, Download } from 'lucide-react';
import ContractModal from './ContractModal';
import { compressImage, generateContractId, uploadToImgBB, getSystemFormat, generatePaymentContent, replaceContractPlaceholders } from '../utils';
import { BANK_BINS } from '../constants';

interface LoanApplicationProps {
  user: User | null;
  loans: LoanRecord[];
  systemBudget: number;
  isGlobalProcessing: boolean;
  onApplyLoan: (amount: number, signature?: string, loanPurpose?: string) => Promise<void> | void;
  onSettleLoan: (loanId: string, bill: string, settlementType: 'ALL' | 'PRINCIPAL' | 'PARTIAL', bankTransactionId?: string, partialAmount?: number, voucherId?: string) => Promise<void> | void;
  onPayOSPayment: (type: 'SETTLE' | 'UPGRADE', id: string, amount: number, targetRank?: string, settleType?: 'ALL' | 'PRINCIPAL' | 'PARTIAL', partialAmount?: number, voucherId?: string) => Promise<void> | void;
  onBack: () => void;
  initialLoanToSettle?: LoanRecord | null;
  initialLoanToView?: LoanRecord | null;
  settings: AppSettings;
}

enum LoanStep {
  LIST = 'LIST',
  SELECT_AMOUNT = 'SELECT_AMOUNT',
  CONTRACT = 'CONTRACT',
  SETTLE_DETAIL = 'SETTLE_DETAIL'
}

const SignaturePad: React.FC<{ onSign: (signature: string | null) => void }> = ({ onSign }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasContent, setHasContent] = useState(false);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    const ctx = canvas.getContext('2d', { 
      desynchronized: true,
      willReadFrequently: false 
    });
    
    if (!ctx) return;
    
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#000000';
    ctxRef.current = ctx;
  }, []);

  useEffect(() => {
    initCanvas();
    const observer = new ResizeObserver(() => initCanvas());
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [initCanvas]);

  const getCoords = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const getSignatureData = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasContent) return null;
    return canvas.toDataURL('image/png');
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    
    const coords = getCoords(e);
    isDrawing.current = true;
    lastPoint.current = coords;

    const ctx = ctxRef.current;
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    }
    
    if (!hasContent) {
      setHasContent(true);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDrawing.current || !ctxRef.current || !lastPoint.current) return;
    e.preventDefault();

    const ctx = ctxRef.current;
    const currentPoint = getCoords(e);
    const midPoint = {
      x: lastPoint.current.x + (currentPoint.x - lastPoint.current.x) / 2,
      y: lastPoint.current.y + (currentPoint.y - lastPoint.current.y) / 2,
    };

    ctx.quadraticCurveTo(lastPoint.current.x, lastPoint.current.y, midPoint.x, midPoint.y);
    ctx.stroke();

    lastPoint.current = currentPoint;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDrawing.current) return;
    const ctx = ctxRef.current;
    if (ctx && lastPoint.current) {
      ctx.lineTo(lastPoint.current.x, lastPoint.current.y);
      ctx.stroke();
    }
    isDrawing.current = false;
    lastPoint.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    onSign(getSignatureData());
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas || !ctxRef.current) return;
    ctxRef.current.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    onSign(null);
  };

  return (
    <div className="relative aspect-[16/9] w-full bg-[#fdfdfd] border border-dashed border-gray-200 rounded-lg overflow-hidden touch-none shadow-inner">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="w-full h-full cursor-crosshair touch-none"
        style={{ touchAction: 'none' }}
      />
      {!hasContent && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20">
          <span className="text-[7px] font-black text-black uppercase tracking-[0.2em]">Ký tại đây</span>
          <div className="w-6 h-px bg-black mt-1"></div>
        </div>
      )}
      {hasContent && (
        <button
          onClick={clear}
          className="absolute top-1 right-1 p-1 bg-white border border-gray-100 rounded-full text-gray-400 hover:text-red-500 transition-all shadow-md active:scale-90"
        >
          <Eraser size={10} />
        </button>
      )}
    </div>
  );
};

const LoanApplication: React.FC<LoanApplicationProps> = ({ user, loans, systemBudget, isGlobalProcessing, onApplyLoan, onSettleLoan, onPayOSPayment, onBack, initialLoanToSettle, initialLoanToView, settings }) => {
  const [step, setStep] = useState<LoanStep>(initialLoanToSettle ? LoanStep.SETTLE_DETAIL : LoanStep.LIST);
  const [selectedAmount, setSelectedAmount] = useState<number>(Number(settings.MIN_LOAN_AMOUNT || 1000000));
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [selectedContract, setSelectedContract] = useState<LoanRecord | null>(initialLoanToView || null);
  const [settleType, setSettleType] = useState<'ALL' | 'PRINCIPAL' | 'PARTIAL'>('ALL');
  const [partialAmount, setPartialAmount] = useState<number>(1000000);
  const [settleLoan, setSettleLoan] = useState<LoanRecord | null>(initialLoanToSettle || null);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'PAYOS' | 'VIETQR'>(settings.ENABLE_PAYOS ? 'PAYOS' : 'VIETQR');
  const [showHelp, setShowHelp] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [billImage, setBillImage] = useState<string | null>(null);
  const [isUploadingBill, setIsUploadingBill] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copyToast, setCopyToast] = useState(false);
  const [successToast, setSuccessToast] = useState(false);
  const [loanPurpose, setLoanPurpose] = useState<string>('Tiêu dùng cá nhân');

  const handleDownloadQR = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `QR_Thanh_Toan_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Lỗi khi tải QR:', error);
      // Fallback: open in new tab if fetch fails
      window.open(url, '_blank');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingBill(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result as string, 800, 800);
          const fileName = `BILL_${user?.fullName || 'user'}_${Date.now()}`;
          const imageUrl = await uploadToImgBB(compressed, fileName, settings.IMGBB_API_KEY);
          setBillImage(imageUrl);
        } catch (error) {
          console.error("Lỗi xử lý ảnh biên lai:", error);
        } finally {
          setIsUploadingBill(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const sortedLoans = useMemo(() => {
    return loans
      .filter(l => l.userId === user?.id && l.status !== 'ĐÃ CỘNG DỒN')
      .sort((a, b) => {
        const aIsInactive = ['ĐÃ TẤT TOÁN', 'BỊ TỪ CHỐI'].includes(a.status);
        const bIsInactive = ['ĐÃ TẤT TOÁN', 'BỊ TỪ CHỐI'].includes(b.status);
        if (aIsInactive !== bIsInactive) return aIsInactive ? 1 : -1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
  }, [loans, user?.id]);

  const totalPages = Math.ceil(sortedLoans.length / itemsPerPage);
  const displayedLoans = sortedLoans.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const userAvailableBalance = user?.balance || 0;
  const actualMaxAllowed = Math.min(userAvailableBalance, systemBudget);
  
  // Custom Limit Exception: If Admin manually edited totalLimit, use user's totalLimit as the cap instead of global settings
  const singleLoanLimit = user?.hasCustomLimit ? (user.totalLimit || 1000000000) : Number(settings.MAX_SINGLE_LOAN_AMOUNT || 10000000);
  const cycleLimit = user?.hasCustomLimit ? (user.totalLimit || 1000000000) : Number(settings.MAX_LOAN_PER_CYCLE || 10000000);

  const isSystemOutOfCapital = systemBudget <= 0 || systemBudget < Number(settings.MIN_SYSTEM_BUDGET || 1000000);

  const nextSequence = (user?.lastLoanSeq || 0) + 1;
  const nextContractId = useMemo(() => {
    if (!user) return 'TEMP-ID';
    const format = getSystemFormat(settings, 'contract', 'HD-{RANDOM}');
    const nextSeq = (user.lastLoanSeq || 0) + 1;
    return generateContractId(user.id, format, settings, undefined, nextSeq);
  }, [user?.id, step === LoanStep.CONTRACT, settings.SYSTEM_FORMATS_CONFIG, settings.CONTRACT_CODE_FORMAT, user?.lastLoanSeq]);

  const getCalculatedDueDate = () => {
    const now = new Date();
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
    return `${dayStr}/${monthStr}/${finalDate.getFullYear()}`;
  };

  const dueDate = getCalculatedDueDate();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Tính tổng tiền vay trong chu kỳ hiện tại (các khoản vay được TẠO trong tháng/năm hiện tại)
  // Chỉ tính các khoản vay chưa tất toán hoàn toàn (ĐANG NỢ, CHỜ DUYỆT, ĐÃ DUYỆT, ĐANG GIẢI NGÂN, CHỜ TẤT TOÁN)
  // QUAN TRỌNG: Loại trừ 'ĐÃ CỘNG DỒN' để tránh tính trùng hạn mức
  const currentCycleTotal = loans
    .filter(l => {
      if (!l.createdAt || typeof l.createdAt !== 'string') return false;
      if (['BỊ TỪ CHỐI', 'ĐÃ TẤT TOÁN', 'ĐÃ CỘNG DỒN', 'ĐÃ HUỶ'].includes(l.status)) return false;
      
      try {
        // Parse createdAt: "HH:mm:ss DD/MM/YYYY" or ISO format
        let datePart = l.createdAt;
        if (l.createdAt.includes(' ')) {
          datePart = l.createdAt.split(' ')[1];
        }
        
        if (datePart.includes('/')) {
          const [d, m, y] = datePart.split('/').map(Number);
          return m === currentMonth && y === currentYear;
        } else if (l.createdAt.includes('-')) {
          // Fallback for ISO format
          const dateObj = new Date(l.createdAt);
          return (dateObj.getMonth() + 1) === currentMonth && dateObj.getFullYear() === currentYear;
        }
      } catch (e) {
        console.error("Error parsing loan createdAt:", l.createdAt, e);
      }
      return false;
    })
    .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

  const handleConfirmSignature = async () => {
    if (signatureData && !isSubmitting && !isGlobalProcessing) {
      setIsSubmitting(true);
      try {
        // Tải chữ ký lên ImgBB trước khi gửi yêu cầu vay, thêm prefix ID để dễ quản lý
        const fileName = `CK_${user?.id || 'unknown'}_${Date.now()}`;
        const signatureUrl = await uploadToImgBB(signatureData, fileName);
        await onApplyLoan(selectedAmount, signatureUrl, loanPurpose);
        setStep(LoanStep.LIST);
      } catch (e) {
        console.error("Lỗi đăng ký vay:", e);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2000);
  };

  const getStatusColor = (status: string, isOverdue: boolean, settlementType?: string) => {
    if (isOverdue) return 'text-red-500';
    switch (status) {
      case 'CHỜ DUYỆT': return 'text-amber-400';
      case 'ĐÃ DUYỆT': return 'text-indigo-400';
      case 'ĐANG GIẢI NGÂN': return 'text-sky-400';
      case 'ĐANG NỢ': return 'text-orange-500';
      case 'CHỜ TẤT TOÁN': 
        if (settlementType === 'ALL') return 'text-emerald-500';
        if (settlementType === 'PARTIAL') return 'text-amber-400';
        return 'text-indigo-400';
      case 'ĐANG ĐỐI SOÁT': return 'text-purple-400';
      case 'ĐÃ TẤT TOÁN': return 'text-emerald-500';
      case 'BỊ TỪ CHỐI': return 'text-rose-500';
      case 'ĐÃ CỘNG DỒN': return 'text-slate-400';
      default: return 'text-gray-400';
    }
  };

  const renderList = () => {
    // Các trạng thái đang xử lý (ngăn chặn spam đơn vay mới)
    const isProcessingLoan = loans.some(l => ['CHỜ DUYỆT', 'ĐÃ DUYỆT', 'ĐANG GIẢI NGÂN', 'CHỜ TẤT TOÁN', 'ĐANG ĐỐI SOÁT'].includes(l.status));

    const today = new Date();
    
    const isLimitReached = currentCycleTotal >= cycleLimit;

    const hasOverdue = loans.some(l => {
      if ((l.status !== 'ĐANG NỢ' && l.status !== 'CHỜ TẤT TOÁN') || !l.date || typeof l.date !== 'string') return false;
      const [d, m, y] = l.date.split('/').map(Number);
      const dueDateObj = new Date(y, m - 1, d);
      return dueDateObj < today;
    });

    const isApplyDisabled = hasOverdue || isSystemOutOfCapital || isProcessingLoan || isLimitReached || (user?.balance || 0) <= 0;

    return (
      <div className="w-full space-y-4 animate-in fade-in duration-500">
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-white tracking-tighter uppercase">Vay</h2>
            <button 
              onClick={() => setShowHelp(!showHelp)}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all animate-bounce-subtle ${showHelp ? 'bg-[#ff8c00] text-black shadow-lg shadow-orange-500/20' : 'bg-white/5 text-gray-500'}`}
            >
              <CircleHelp size={16} />
            </button>
          </div>
            <button 
            disabled={isApplyDisabled}
            onClick={() => {
              const maxLoanPerCycle = Number(settings.MAX_LOAN_PER_CYCLE || 10000000);
              const maxPossible = Math.min(maxLoanPerCycle - currentCycleTotal, actualMaxAllowed);
              const minAmount = Number(settings.MIN_LOAN_AMOUNT || 1000000);
              setSelectedAmount(Math.min(minAmount, maxPossible));
              setStep(LoanStep.SELECT_AMOUNT);
            }}
            className={`font-black px-4 py-1.5 rounded-full text-[8px] tracking-widest transition-all shadow-lg ${
              isApplyDisabled 
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50' 
                : 'bg-[#ff8c00] text-black active:scale-95 shadow-orange-950/20'
            }`}
          >
            {hasOverdue 
              ? 'NỢ XẤU - KHÓA' 
              : isLimitReached
                ? `ĐẠT GIỚI HẠN ${Math.round(cycleLimit/1000000)}TR/THÁNG`
                : isProcessingLoan 
                  ? 'CHỜ DUYỆT KHOẢN TRƯỚC' 
                  : isSystemOutOfCapital 
                    ? 'BẢO TRÌ VỐN' 
                    : 'ĐĂNG KÝ MỚI'}
          </button>
        </div>

        {showHelp && (
          <div className="bg-[#ff8c00]/5 border border-[#ff8c00]/20 rounded-2xl p-5 animate-in fade-in zoom-in duration-300 space-y-5">
             <div className="flex items-center gap-3">
                <Info size={18} className="text-[#ff8c00]" />
                <span className="text-[14px] font-black text-[#ff8c00] uppercase tracking-widest">Chính sách vay vốn</span>
             </div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-[#ff8c00] rounded-full flex items-center justify-center shrink-0 font-black text-[12px] text-black">1</div>
                  <p className="text-[12px] font-bold text-gray-300 leading-relaxed">
                    <span className="text-[#ff8c00]">Lãi suất:</span> Ưu đãi 0% cho tất cả các khoản vay trong kỳ hạn quy định.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-[#ff8c00] rounded-full flex items-center justify-center shrink-0 font-black text-[12px] text-black">2</div>
                  <p className="text-[12px] font-bold text-gray-300 leading-relaxed">
                    <span className="text-[#ff8c00]">Hạn mức chu kỳ:</span> Tổng dư nợ tối đa không vượt quá {cycleLimit.toLocaleString()} VNĐ trong chu kỳ 30 ngày.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-[#ff8c00] rounded-full flex items-center justify-center shrink-0 font-black text-[12px] text-black">3</div>
                  <p className="text-[12px] font-bold text-gray-300 leading-relaxed">
                    <span className="text-[#ff8c00]">Vay bổ sung:</span> Bạn có thể đăng ký vay nhiều lần nếu tổng dư nợ chưa đạt giới hạn tối đa và không có nợ quá hạn.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-[#ff8c00] rounded-full flex items-center justify-center shrink-0 font-black text-[12px] text-black">4</div>
                  <p className="text-[12px] font-bold text-gray-300 leading-relaxed">
                    <span className="text-[#ff8c00]">Gia hạn:</span> Bạn có thể gia hạn khoản vay tối đa {settings.MAX_EXTENSIONS || 3} lần nếu gặp khó khăn trong việc tất toán đúng hạn.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-[#ff8c00] rounded-full flex items-center justify-center shrink-0 font-black text-[12px] text-black">5</div>
                  <p className="text-[12px] font-bold text-gray-300 leading-relaxed">
                    <span className="text-[#ff8c00]">Quy trình:</span> Hệ thống chỉ xử lý duy nhất 01 yêu cầu vay tại một thời điểm. Vui lòng tất toán khoản vay cũ để đăng ký khoản mới.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-[#ff8c00] rounded-full flex items-center justify-center shrink-0 font-black text-[12px] text-black">6</div>
                  <p className="text-[12px] font-bold text-gray-300 leading-relaxed">
                    <span className="text-[#ff8c00]">Bảo mật:</span> Mọi thông tin khoản vay đều được mã hóa và bảo vệ bởi hệ thống NDV-SAFE, đảm bảo an toàn tuyệt đối.
                  </p>
                </div>
              </div>
          </div>
        )}

        <div className="bg-[#111111] border border-white/5 rounded-3xl p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
                <Wallet className="text-[#ff8c00]" size={20} />
              </div>
              <div>
                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Hạn mức khả dụng</p>
                <p className="text-lg font-black text-white">{(userAvailableBalance).toLocaleString()} đ</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {isProcessingLoan && !hasOverdue && (
                <div className="flex items-center gap-1 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20 animate-pulse">
                  <Info size={10} className="text-blue-500" />
                  <span className="text-[7px] font-black text-blue-500 uppercase tracking-widest">Đang xét duyệt</span>
                </div>
              )}
              {isSystemOutOfCapital && !hasOverdue && !isProcessingLoan && (
                <div className="flex items-center gap-1 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20 animate-pulse">
                  <ShieldAlert size={10} className="text-orange-500" />
                  <span className="text-[7px] font-black text-orange-500 uppercase tracking-widest">Bảo trì vốn</span>
                </div>
              )}
            </div>
          </div>
          
          {isLimitReached && !hasOverdue && (
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest text-center px-1">
              Đã đạt giới hạn vay {cycleLimit.toLocaleString()} đ trong chu kỳ này
            </p>
          )}

          {!isLimitReached && (isProcessingLoan || isSystemOutOfCapital) && !hasOverdue && (
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest text-center px-1">
              {isProcessingLoan 
                  ? 'Đợi duyệt khoản vay trước' 
                  : 'Hệ thống đang bảo trì vốn'}
            </p>
          )}

          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#ff8c00] transition-all duration-1000" 
              style={{ width: `${(userAvailableBalance / (user?.totalLimit || 2000000)) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Loan History List in Apply Tab */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1 text-gray-400">
            <div className="flex items-center gap-2">
              <History size={14} />
              <h3 className="text-[9px] font-black uppercase tracking-widest">Lịch sử giao dịch</h3>
            </div>
          </div>

          <div className="space-y-2 pb-4">
            {loans.length === 0 ? (
              <div className="bg-[#111111]/50 border border-white/5 border-dashed rounded-2xl p-8 text-center">
                <p className="text-[9px] font-black text-gray-700 uppercase tracking-widest">Chưa có giao dịch nào</p>
              </div>
            ) : (
              <>
                {displayedLoans.map((item, idx) => {
                  if (!item.date || typeof item.date !== 'string') return null;
                  const [d, m, y] = item.date.split('/').map(Number);
                  const isOverdue = (item.status === 'ĐANG NỢ' || item.status === 'CHỜ TẤT TOÁN') && new Date(y, m - 1, d) < today;
                  const statusColor = getStatusColor(item.status, isOverdue, item.settlementType);

                  return (
                    <div key={idx} className={`bg-[#111111] border rounded-2xl p-3.5 flex flex-col gap-2.5 ${isOverdue ? 'border-red-600/30 bg-red-600/5' : 'border-white/5'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-500">
                            <FileText size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <p className="text-sm font-black text-white leading-none">{item.amount.toLocaleString()} đ</p>
                              <span className="text-[7px] font-black text-gray-600 uppercase tracking-widest">#{item.id}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className={`w-1 h-1 rounded-full ${
                                item.status === 'ĐÃ TẤT TOÁN' ? 'bg-green-500' : 
                                isOverdue ? 'bg-red-500 animate-pulse' : 
                                item.status === 'CHỜ TẤT TOÁN' ? (
                                  item.settlementType === 'ALL' ? 'bg-green-500 animate-pulse' : 
                                  (item.settlementType === 'PARTIAL' ? 'bg-amber-500 animate-pulse' : 'bg-blue-500 animate-pulse')
                                ) : 'bg-orange-500 animate-pulse'
                              }`}></div>
                              <span className={`text-[7px] font-black uppercase flex items-center ${statusColor}`}>
                                {isOverdue ? 'QUÁ HẠN' : item.status}
                                {item.status === 'CHỜ TẤT TOÁN' && (
                                  <span className={`px-1 rounded text-[6px] ml-1 ${
                                    item.settlementType === 'ALL' ? 'bg-green-500 text-white' : 
                                    (item.settlementType === 'PARTIAL' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white')
                                  }`}>
                                    {item.settlementType === 'PRINCIPAL' ? 'GH' : (item.settlementType === 'PARTIAL' ? 'TTMP' : 'TT')}
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                           <button 
                             onClick={() => setSelectedContract(item)}
                             className="w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-all"
                           >
                             <Eye size={14} />
                           </button>
                           {(item.status === 'ĐANG NỢ' || item.status === 'ĐANG GIẢI NGÂN') && (
                             <button 
                               onClick={() => {
                                 setSettleLoan(item);
                                 setPartialAmount(1000000);
                                 setStep(LoanStep.SETTLE_DETAIL);
                                 setQrLoading(true);
                               }}
                               className="bg-white text-black font-black px-2.5 py-1.5 rounded-lg text-[7px] uppercase tracking-widest active:scale-95 transition-all"
                             >
                               Tất toán
                             </button>
                           )}
                        </div>
                      </div>
                      
                      <div className="mt-1">
                        {item.rejectionReason && (
                          <div className="flex items-center justify-center gap-1.5 whitespace-nowrap overflow-hidden mb-0.5">
                            <AlertTriangle size={8} className="text-red-500 shrink-0" />
                            <p className="text-[7px] font-black text-red-500 uppercase tracking-widest truncate">
                              Lý do từ chối: {item.rejectionReason}
                            </p>
                          </div>
                        )}

                        <div className="border-t border-white/5 pt-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex gap-2.5">
                              <p className="text-[7px] font-bold text-gray-700">Hạn: {item.date}</p>
                              <p className="text-[7px] font-bold text-gray-700">Tạo: {item.createdAt}</p>
                            </div>
                            {isOverdue && (
                              <div className="text-right">
                                <p className="text-[6px] font-black text-gray-600 uppercase tracking-widest leading-none">Phí phạt trễ hạn</p>
                                <p className="text-[9px] font-black text-red-500">{(item.fine || 0).toLocaleString()} đ</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 px-1 pt-2 border-t border-white/5">
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
              </>
            )}
          </div>
        </div>

        {selectedContract && (
          <ContractModal 
            contract={selectedContract} 
            user={user} 
            onClose={() => {
              setSelectedContract(null);
              if (initialLoanToView) onBack();
            }} 
            settings={settings}
          />
        )}
      </div>
    );
  };

  const renderSelectAmount = () => {
    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value);
      if (val <= actualMaxAllowed) {
        setSelectedAmount(val);
      }
    };

    const isLimitedByBudget = systemBudget < userAvailableBalance;

    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-500 overflow-hidden">
        <div className="w-full p-3 flex items-center justify-between bg-black text-white border-b border-white/5 flex-none">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-500/10 rounded-lg flex items-center justify-center text-[#ff8c00]">
              <Award size={16} />
            </div>
            <div>
              <h3 className="text-[9px] font-black uppercase tracking-widest leading-none">Đăng ký khoản vay</h3>
              <p className="text-[6px] font-bold text-gray-500 uppercase mt-0.5 tracking-tighter">XÁC THỰC ĐIỆN TỬ NDV-SAFE</p>
            </div>
          </div>
          <button 
            onClick={() => setStep(LoanStep.LIST)}
            className="w-7 h-7 bg-white/5 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-all active:scale-90"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 bg-black px-2 pt-1 pb-2 overflow-hidden flex flex-col">
          <div className="bg-[#111111] w-full rounded-2xl p-4 relative overflow-hidden shadow-2xl border border-white/10 flex-1 flex flex-col justify-center space-y-8">
            <div className="space-y-2 text-center">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Chọn số tiền vay</h3>
              <p className="text-4xl font-black text-[#ff8c00] tracking-tighter">
                {selectedAmount.toLocaleString()} <span className="text-lg">đ</span>
              </p>
              <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Lãi suất 0% (Ưu đãi thành viên)</p>
            </div>

            {isLimitedByBudget && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl animate-in zoom-in duration-300 flex flex-col items-center text-center">
                 <div className="flex items-center gap-1.5 mb-1">
                    <AlertCircle size={14} className="text-red-500" />
                    <span className="text-[9px] font-black text-red-500 uppercase">Nguồn vốn giới hạn</span>
                 </div>
                 <p className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">
                   Tối đa {systemBudget.toLocaleString()} đ. Hạn mức sẽ mở lại sau khi nạp vốn.
                 </p>
              </div>
            )}

            <div className="space-y-8 px-2">
              <div className="relative pt-4 pb-1">
                <input
                  type="range"
                  min={Number(settings.MIN_LOAN_AMOUNT || 1000000)}
                  max={Math.max(Number(settings.MIN_LOAN_AMOUNT || 1000000), Math.min(cycleLimit - currentCycleTotal, actualMaxAllowed, singleLoanLimit))}
                  step="1000000"
                  value={selectedAmount}
                  onChange={handleSliderChange}
                  className="w-full h-2 bg-gray-800 rounded-full appearance-none cursor-pointer accent-[#ff8c00] focus:outline-none"
                />
                <div className="flex justify-between mt-6">
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Tối thiểu</span>
                    <span className="text-[11px] font-black text-white">{Number(settings.MIN_LOAN_AMOUNT || 1000000).toLocaleString()} đ</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[9px] font-black uppercase tracking-widest ${isLimitedByBudget ? 'text-red-500' : 'text-orange-500/50'}`}>
                      {isLimitedByBudget ? 'Ngân sách hệ thống' : (user?.hasCustomLimit ? 'Hạn mức riêng' : 'Hạn mức khả dụng')}
                    </span>
                    <span className={`text-[11px] font-black ${isLimitedByBudget ? 'text-red-500' : 'text-[#ff8c00]'}`}>
                      {Math.min(cycleLimit - currentCycleTotal, actualMaxAllowed, singleLoanLimit).toLocaleString()} đ
                    </span>
                  </div>
                </div>
              </div>

              {/* Loan Purpose Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1 h-3 bg-[#ff8c00] rounded-full"></div>
                  <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Mục đích vay vốn</h4>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'Tiêu dùng cá nhân',
                    'Mua sắm đồ gia dụng',
                    'Thanh toán hóa đơn',
                    'Chi phí y tế',
                    'Học phí & Giáo dục',
                    'Sửa chữa nhà cửa',
                    'Kinh doanh nhỏ',
                    'Khác'
                  ].map((purpose) => (
                    <button
                      key={purpose}
                      onClick={() => setLoanPurpose(purpose)}
                      className={`py-2.5 px-3 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all border ${
                        loanPurpose === purpose
                          ? 'bg-[#ff8c00] text-black border-[#ff8c00] shadow-lg shadow-orange-500/20'
                          : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      {purpose}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 left-0 right-0 p-3 bg-black flex gap-2 z-[110] border-t border-white/5 mt-auto">
          <button
            disabled={actualMaxAllowed < Number(settings.MIN_LOAN_AMOUNT || 1000000)}
            onClick={() => { setStep(LoanStep.CONTRACT); setSignatureData(null); }}
            className={`w-full font-black py-4 rounded-xl text-[10px] uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all ${
              actualMaxAllowed < Number(settings.MIN_LOAN_AMOUNT || 1000000) ? 'bg-white/5 text-gray-600 cursor-not-allowed opacity-50' : 'bg-[#ff8c00] text-black shadow-orange-950/20'
            }`}
          >
            {actualMaxAllowed < Number(settings.MIN_LOAN_AMOUNT || 1000000) ? 'KHÔNG ĐỦ NGÂN SÁCH' : 'TIẾP TỤC ĐẾN HỢP ĐỒNG'}
          </button>
        </div>
      </div>
    );
  };

  const renderSettleDetail = () => {
    if (!settleLoan) return null;
    
    const amountAll = Math.round(settleLoan.amount + (settleLoan.fine || 0));
    const amountPrincipal = Math.round((settleLoan.amount * (settings.PRE_DISBURSEMENT_FEE / 100)) + (settleLoan.fine || 0));
    const amountPartial = Math.round(partialAmount + ((settleLoan.amount - partialAmount) * (settings.PRE_DISBURSEMENT_FEE / 100)) + (settleLoan.fine || 0));
    
    // Voucher logic
    const availableVouchers = (user?.vouchers || []).filter(v => {
      if (v.isUsed) return false;
      if (!v.expiryDate) return true;
      try {
        const exp = new Date(v.expiryDate);
        return exp > new Date();
      } catch (e) {
        return true;
      }
    }).sort((a, b) => b.amount - a.amount);
    const selectedVoucher = availableVouchers.find(v => v.id === selectedVoucherId);
    const voucherDiscount = (settleType === 'ALL' && selectedVoucher) ? selectedVoucher.amount : 0;

    // Logic giới hạn gia hạn
    const extensionCount = settleLoan.extensionCount || 0;
    const canSettlePrincipal = extensionCount < settings.MAX_EXTENSIONS;
    const isLastExtension = extensionCount === (settings.MAX_EXTENSIONS - 1);
    const isLimitReached = extensionCount >= settings.MAX_EXTENSIONS;

    const currentAmount = Math.max(0, (settleType === 'ALL' ? amountAll : (settleType === 'PRINCIPAL' ? amountPrincipal : amountPartial)) - voucherDiscount);
    const content = generatePaymentContent('SETTLE', {
      id: settleLoan.id,
      userId: user?.id,
      originalBaseId: settleLoan.originalBaseId,
      settleType,
      userPhone: user?.phone,
      extensionCount: settleLoan.extensionCount || 0,
      partialCount: settleLoan.partialPaymentCount || 0
    }, settings);
    
    // Find bank BIN from settings or constants
    const bankBin = settings.PAYMENT_ACCOUNT.bankBin || BANK_BINS[settings.PAYMENT_ACCOUNT.bankName.toUpperCase()] || "970422";
    const qrUrl = `https://img.vietqr.io/image/${bankBin}-${settings.PAYMENT_ACCOUNT.accountNumber}-compact2.png?amount=${currentAmount}&addInfo=${encodeURIComponent(content)}&accountName=${encodeURIComponent(settings.PAYMENT_ACCOUNT.accountName)}`;

    const showPayOS = settings.ENABLE_PAYOS;
    const showVietQR = settings.ENABLE_VIETQR;

    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-500 overflow-hidden">
        <div className="w-full p-3 flex items-center justify-between bg-black text-white border-b border-white/5 flex-none">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                if (initialLoanToSettle) {
                  onBack();
                } else {
                  setStep(LoanStep.LIST);
                }
              }} 
              className="w-7 h-7 bg-white/5 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-all active:scale-90"
            >
              <ChevronLeft size={16} />
            </button>
            <div>
              <h3 className="text-[9px] font-black uppercase tracking-widest leading-none">Tất toán khoản vay</h3>
              <p className="text-[6px] font-bold text-gray-500 uppercase mt-0.5 tracking-tighter">XÁC THỰC GIAO DỊCH NDV-SAFE</p>
            </div>
          </div>
          <button 
            onClick={() => setShowHelp(!showHelp)} 
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${showHelp ? 'bg-[#ff8c00] text-black shadow-lg shadow-orange-500/20' : 'bg-white/5 text-gray-400'}`}
          >
            <CircleHelp size={16} />
          </button>
        </div>

        <div className="flex-1 bg-black px-2 pt-1 pb-2 overflow-hidden flex flex-col">
          <div className="bg-[#111111] w-full rounded-2xl p-3 relative overflow-hidden shadow-2xl border border-white/10 flex-1 flex flex-col">
            <div className="flex-none mb-3">
              {isLimitReached && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2 mb-2 flex items-center justify-center gap-2 animate-in slide-in-from-top-2 duration-300">
                  <AlertCircle size={12} className="text-red-500 shrink-0" />
                  <p className="text-[7px] font-black text-red-500 uppercase tracking-widest text-center">
                    Bạn đã hết lượt gia hạn ({extensionCount}/{settings.MAX_EXTENSIONS}). Vui lòng Tất toán toàn bộ hoặc TTMP.
                  </p>
                </div>
              )}
              {settleType === 'PRINCIPAL' && isLastExtension && !isLimitReached && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 mb-2 flex items-center justify-center gap-2 animate-in slide-in-from-top-2 duration-300">
                  <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                  <p className="text-[7px] font-black text-amber-500 uppercase tracking-widest text-center">
                    Cảnh báo: Đây là lần gia hạn cuối cùng của bạn.
                  </p>
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0 flex flex-col space-y-4">
              {showHelp ? (
                <div className="h-full bg-[#ff8c00]/5 border border-[#ff8c00]/20 rounded-2xl p-5 animate-in fade-in zoom-in duration-300 space-y-5 overflow-y-auto">
                   <div className="flex items-center gap-3">
                      <Info size={18} className="text-[#ff8c00]" />
                      <span className="text-[14px] font-black text-[#ff8c00] uppercase tracking-widest">
                        {paymentMethod === 'PAYOS' ? 'Hướng dẫn PayOS' : 'Hướng dẫn VietQR'}
                      </span>
                   </div>
                   <div className="space-y-4">
                      {(paymentMethod === 'PAYOS' ? [
                        "Thanh toán: Hệ thống sử dụng cổng PayOS để thanh toán tự động, an toàn và bảo mật tuyệt đối.",
                        "Xác nhận: Sau khi thanh toán thành công, khoản vay của bạn sẽ được cập nhật ngay lập tức trên hệ thống.",
                        "Voucher: Bạn có thể áp dụng tối đa 01 Voucher cho mỗi lần tất toán toàn bộ khoản vay.",
                        "Hỗ trợ: Nếu gặp vấn đề trong quá trình thanh toán, vui lòng liên hệ bộ phận CSKH 24/7."
                      ] : [
                        "Chuyển khoản: Thực hiện chuyển khoản chính xác số tiền và nội dung hiển thị trên màn hình.",
                        "Biên lai: Sau khi chuyển khoản thành công, hãy chụp ảnh biên lai và tải lên để hệ thống xác thực.",
                        "Xác thực: Bộ phận kế toán sẽ kiểm tra và phê duyệt yêu cầu của bạn trong vòng 5-15 phút.",
                        "Lưu ý: Vui lòng giữ lại biên lai gốc cho đến khi trạng thái khoản vay được cập nhật thành công."
                      ]).map((text, idx) => (
                        <div key={idx} className="flex gap-3">
                          <div className="w-6 h-6 bg-[#ff8c00] rounded-full flex items-center justify-center shrink-0 font-black text-[12px] text-black">{idx + 1}</div>
                          <p className="text-[12px] font-bold text-gray-300 leading-relaxed">{text}</p>
                        </div>
                      ))}
                   </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
                    {/* Payment Method Selection */}
                    {showPayOS && showVietQR && (
                      <div className="space-y-3 shrink-0">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-3 bg-[#ff8c00] rounded-full"></div>
                            <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Phương thức thanh toán</h4>
                          </div>
                        </div>
                        <div className="flex bg-black/60 p-1 rounded-2xl border border-white/5 gap-1">
                          <button
                            onClick={() => setPaymentMethod('PAYOS')}
                            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl transition-all border ${
                              paymentMethod === 'PAYOS' 
                                ? 'bg-white/10 text-[#ff8c00] font-black border-[#ff8c00]/40 shadow-inner' 
                                : 'text-gray-500 hover:text-white border-transparent'
                            }`}
                          >
                            <ShieldCheck size={12} />
                            <span className="text-[7px] font-black uppercase tracking-widest mt-0.5">Tự động (PayOS)</span>
                          </button>
                          <button
                            onClick={() => setPaymentMethod('VIETQR')}
                            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl transition-all border ${
                              paymentMethod === 'VIETQR' 
                                ? 'bg-white/10 text-[#ff8c00] font-black border-[#ff8c00]/40 shadow-inner' 
                                : 'text-gray-500 hover:text-white border-transparent'
                            }`}
                          >
                            <CreditCard size={12} />
                            <span className="text-[7px] font-black uppercase tracking-widest mt-0.5">Thủ công (VietQR)</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Settlement Type Selection */}
                    <div className="space-y-3 shrink-0">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-3 bg-[#ff8c00] rounded-full"></div>
                          <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Hình thức tất toán</h4>
                        </div>
                      </div>
                      <div className="flex bg-black/60 p-1 rounded-2xl border border-white/5 gap-1">
                        {[
                          { id: 'ALL', label: 'Tất toán', icon: <Scale size={12} /> },
                          { id: 'PARTIAL', label: 'TTMP', icon: <Award size={12} /> },
                          { id: 'PRINCIPAL', label: `Gia hạn`, icon: <ShieldCheck size={12} />, sub: `(${extensionCount}/${settings.MAX_EXTENSIONS})` }
                        ].map((type) => {
                          const isPrincipalDisabled = type.id === 'PRINCIPAL' && !canSettlePrincipal;
                          const isPartialDisabled = type.id === 'PARTIAL' && settleLoan?.amount === 1000000;
                          const isDisabled = isPrincipalDisabled || isPartialDisabled;
                          const isActive = settleType === type.id;
                          return (
                            <button
                              key={type.id}
                              disabled={isDisabled}
                              onClick={() => {
                                setSettleType(type.id as any);
                                setQrLoading(true);
                              }}
                              className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl transition-all border ${
                                isActive 
                                  ? 'bg-white/10 text-[#ff8c00] font-black border-[#ff8c00]/40 shadow-inner' 
                                  : isDisabled ? 'opacity-20 cursor-not-allowed border-transparent' : 'text-gray-500 hover:text-white border-transparent'
                              }`}
                            >
                              {type.icon}
                              <span className="text-[7px] font-black uppercase tracking-widest mt-0.5">{type.label}</span>
                              {type.sub && <span className="text-[5px] font-bold opacity-60">{type.sub}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Voucher Selection */}
                    {settleType === 'ALL' && availableVouchers.length > 0 && (
                      <div className="space-y-2 shrink-0">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-3 bg-[#ff8c00] rounded-full"></div>
                            <h4 className="text-[9px] font-black text-white uppercase tracking-widest">Voucher ưu đãi</h4>
                          </div>
                          <span className="text-[7px] font-bold text-gray-500 uppercase tracking-widest">{availableVouchers.length} khả dụng</span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar snap-x">
                          {availableVouchers.map(v => (
                            <button
                              key={v.id}
                              onClick={() => setSelectedVoucherId(selectedVoucherId === v.id ? null : v.id)}
                              className={`flex-none w-32 p-2.5 rounded-xl border transition-all snap-start relative overflow-hidden ${
                                selectedVoucherId === v.id 
                                  ? 'bg-[#ff8c00]/10 border-[#ff8c00] text-[#ff8c00]' 
                                  : 'bg-black/40 border-white/5 text-gray-400 hover:border-white/20'
                              }`}
                            >
                              <div className="relative z-10 flex flex-col items-start gap-1">
                                <div className="flex items-center justify-between w-full">
                                  <Award size={12} className={selectedVoucherId === v.id ? 'text-[#ff8c00]' : 'text-gray-600'} />
                                  {selectedVoucherId === v.id && <CheckCircle2 size={10} />}
                                </div>
                                <p className="text-[9px] font-black uppercase tracking-tight">-{v.amount.toLocaleString()} đ</p>
                                <p className="text-[6px] font-bold opacity-50 uppercase truncate w-full">
                                  Hạn: {v.expiryDate ? (v.expiryDate.includes('T') ? new Date(v.expiryDate).toLocaleDateString('vi-VN') : v.expiryDate) : 'N/A'}
                                </p>
                              </div>
                              {/* Ticket Notch effect */}
                              <div className="absolute top-1/2 -left-1 w-2 h-2 bg-black rounded-full -translate-y-1/2 border-r border-white/5"></div>
                              <div className="absolute top-1/2 -right-1 w-2 h-2 bg-black rounded-full -translate-y-1/2 border-l border-white/5"></div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Payment Details */}
                    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                      <div className="space-y-4 pb-4">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-3 bg-[#ff8c00] rounded-full"></div>
                            <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Chi tiết thanh toán</h4>
                          </div>
                        </div>

                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                          {paymentMethod === 'PAYOS' ? (
                            <div className="bg-[#ff8c00]/5 border border-[#ff8c00]/20 rounded-2xl p-5 space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#ff8c00]/10 rounded-full flex items-center justify-center text-[#ff8c00]">
                                  <ShieldCheck size={20} />
                                </div>
                                <div>
                                  <h3 className="text-[12px] font-black text-white uppercase tracking-wider">Thanh toán qua PayOS</h3>
                                  <p className="text-[9px] font-bold text-[#ff8c00]/60 uppercase tracking-widest">Duyệt tự động • An toàn • 24/7</p>
                                </div>
                              </div>
                              
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                                  <div className="w-1.5 h-1.5 bg-[#ff8c00] rounded-full"></div>
                                  <span>Hệ thống tự động cập nhật ngay sau khi thanh toán</span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                                  <div className="w-1.5 h-1.5 bg-[#ff8c00] rounded-full"></div>
                                  <span>Hỗ trợ thanh toán qua mã QR của mọi ngân hàng</span>
                                </div>
                              </div>

                              {settleType === 'PARTIAL' && (
                                <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Số tiền gốc trả</span>
                                    <span className="text-[12px] font-black text-[#ff8c00]">{partialAmount.toLocaleString()} đ</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="1000000"
                                    max={Math.max(1000000, settleLoan.amount - 1000000)}
                                    step="1000000"
                                    value={partialAmount}
                                    onChange={(e) => {
                                      setPartialAmount(parseInt(e.target.value));
                                    }}
                                    className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer accent-[#ff8c00] focus:outline-none"
                                  />
                                </div>
                              )}

                              <div className="pt-2 space-y-2">
                                {settleLoan.fine > 0 && (
                                  <div className="flex items-center justify-between px-4 text-[9px] font-black text-red-500 uppercase tracking-widest animate-in fade-in slide-in-from-top-1 duration-300">
                                    <span>Bao gồm phí quá hạn:</span>
                                    <span>+{(settleLoan.fine || 0).toLocaleString()} đ</span>
                                  </div>
                                )}
                                <div className="bg-black/40 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                                  <span className="text-[10px] font-black text-gray-500 uppercase">Số tiền cần trả</span>
                                  <span className="text-[18px] font-black text-[#ff8c00]">{currentAmount.toLocaleString()} đ</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              {settleType === 'PARTIAL' && (
                                <div className="bg-black/40 p-3 rounded-2xl border border-white/5 space-y-2 animate-in slide-in-from-top-2 duration-300">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Số tiền gốc trả</span>
                                    <span className="text-[12px] font-black text-[#ff8c00]">{partialAmount.toLocaleString()} đ</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="1000000"
                                    max={Math.max(1000000, settleLoan.amount - 1000000)}
                                    step="1000000"
                                    value={partialAmount}
                                    onChange={(e) => {
                                      setPartialAmount(parseInt(e.target.value));
                                      setQrLoading(true);
                                    }}
                                    className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer accent-[#ff8c00] focus:outline-none"
                                  />
                                  <p className="text-[7px] font-bold text-gray-600 uppercase text-center">Kéo để điều chỉnh số tiền muốn thanh toán</p>
                                </div>
                              )}

                              <div className="bg-white rounded-2xl p-3 shadow-xl">
                                <div className="flex gap-3">
                                  {/* Left: QR Code */}
                                  <div className="w-[40%] flex flex-col items-center justify-center">
                                    <div className="relative group w-full">
                                      <div className="absolute -inset-2 bg-orange-500/5 rounded-2xl blur-xl group-hover:bg-orange-500/10 transition-all duration-500"></div>
                                      <div className="relative bg-white p-1.5 rounded-xl shadow-inner border border-gray-100 w-full aspect-square flex items-center justify-center">
                                        {qrLoading && (
                                          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 rounded-xl">
                                            <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                                          </div>
                                        )}
                                        <img 
                                          src={qrUrl} 
                                          alt="VietQR" 
                                          className="w-full h-full object-contain"
                                          onLoad={() => setQrLoading(false)}
                                          referrerPolicy="no-referrer"
                                        />
                                      </div>
                                    </div>
                                    <button 
                                      onClick={() => handleDownloadQR(qrUrl)}
                                      className="flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-orange-500/10 rounded-full hover:bg-orange-500/20 transition-all active:scale-95"
                                    >
                                      <Download size={8} className="text-orange-500" />
                                      <span className="text-[7px] font-black text-orange-500 uppercase tracking-widest">Tải về QR</span>
                                    </button>
                                  </div>

                                  {/* Right: Payment Details */}
                                  <div className="flex-1 space-y-2">
                                    <div className="space-y-1">
                                      <p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest">Thông tin thụ hưởng</p>
                                      <div 
                                        onClick={() => copyToClipboard(`${settings.PAYMENT_ACCOUNT.bankName} ${settings.PAYMENT_ACCOUNT.accountNumber}`)}
                                        className="bg-gray-50 p-1.5 rounded-lg border border-gray-100 cursor-pointer active:scale-95 transition-all group"
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2 overflow-hidden">
                                            <p className="text-[8px] font-black text-black uppercase truncate">{settings.PAYMENT_ACCOUNT.bankName}</p>
                                            <div className="w-1 h-1 bg-gray-300 rounded-full shrink-0"></div>
                                            <p className="text-[9px] font-black text-orange-600 tracking-tighter shrink-0">{settings.PAYMENT_ACCOUNT.accountNumber}</p>
                                          </div>
                                          <Copy size={9} className="text-gray-400 group-hover:text-orange-600 shrink-0" />
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest">Chủ tài khoản</p>
                                      <div 
                                        onClick={() => copyToClipboard(settings.PAYMENT_ACCOUNT.accountName)}
                                        className="flex items-center justify-between bg-gray-50 px-1.5 py-1 rounded-lg border border-gray-100 cursor-pointer active:scale-95 transition-all group"
                                      >
                                        <p className="text-[8px] font-black text-black uppercase">{settings.PAYMENT_ACCOUNT.accountName}</p>
                                        <Copy size={9} className="text-gray-400 group-hover:text-orange-600" />
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest">Nội dung chuyển khoản</p>
                                      <div 
                                        onClick={() => copyToClipboard(content)}
                                        className="flex items-center justify-between bg-orange-50 px-1.5 py-1 rounded-lg border border-orange-100 cursor-pointer active:scale-95 transition-all group"
                                      >
                                        <p className="text-[8px] font-black text-orange-600 uppercase">{content}</p>
                                        <Copy size={9} className="text-orange-400 group-hover:text-orange-600" />
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest">Số tiền thanh toán</p>
                                      {settleLoan.fine > 0 && (
                                        <div className="flex items-center justify-between px-1 text-[7px] font-black text-red-500 uppercase tracking-widest animate-in fade-in slide-in-from-top-1 duration-300">
                                          <span>Bao gồm phí quá hạn:</span>
                                          <span>+{(settleLoan.fine || 0).toLocaleString()} đ</span>
                                        </div>
                                      )}
                                      <div 
                                        onClick={() => copyToClipboard(currentAmount.toString())}
                                        className="flex items-center justify-between bg-orange-50 px-1.5 py-1 rounded-lg border border-orange-100 cursor-pointer active:scale-95 transition-all group"
                                      >
                                        <p className="text-[11px] font-black text-orange-600">{currentAmount.toLocaleString()} đ</p>
                                        <Copy size={9} className="text-orange-400 group-hover:text-orange-600" />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2.5 flex items-start gap-2.5">
                                <Info size={12} className="text-blue-500 shrink-0 mt-0.5" />
                                <p className="text-[8px] font-bold text-blue-400 leading-tight">
                                  Vui lòng chuyển chính xác số tiền và nội dung để hệ thống tự động nhận diện. Sau khi hoàn tất, hãy tải ảnh biên lai lên để xác thực.
                                </p>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1 h-3 bg-[#ff8c00] rounded-full"></div>
                                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Xác thực biên lai</h4>
                                  </div>
                                </div>
                                
                                <input 
                                  type="file" 
                                  ref={fileInputRef}
                                  onChange={handleFileChange}
                                  accept="image/*"
                                  className="hidden"
                                />

                                <div 
                                  onClick={() => !isUploadingBill && fileInputRef.current?.click()}
                                  className={`h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-all overflow-hidden relative ${
                                    billImage ? 'border-green-500/50 bg-green-500/5' : 'border-[#332a1e] bg-[#1a1a1e]'
                                  }`}
                                >
                                  {billImage ? (
                                    <>
                                      <img src={billImage} className="w-full h-full object-cover opacity-60" alt="Biên lai" referrerPolicy="no-referrer" />
                                      <div className="absolute inset-0 bg-green-500/10 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg mb-0.5">
                                          <CheckCircle2 size={12} color="black" />
                                        </div>
                                        <span className="text-[7px] font-black text-white uppercase tracking-widest">
                                          {billImage.startsWith('http') ? 'Xác thực OK' : 'Đã nén'}
                                        </span>
                                      </div>
                                      <div className="absolute top-1.5 right-1.5 z-10">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setBillImage(null);
                                          }}
                                          className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg active:scale-90 transition-all"
                                        >
                                          <X size={10} />
                                        </button>
                                      </div>
                                    </>
                                  ) : isUploadingBill ? (
                                    <div className="flex flex-col items-center gap-1">
                                      <div className="w-4 h-4 border-2 border-[#ff8c00] border-t-transparent rounded-full animate-spin"></div>
                                      <span className="text-[7px] font-black text-gray-600 uppercase">Đang xử lý...</span>
                                    </div>
                                  ) : (
                                    <>
                                      <Camera size={16} className="text-[#ff8c00]" />
                                      <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Tải lên biên lai</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 left-0 right-0 p-3 bg-black flex gap-2 z-[110] border-t border-white/5 mt-auto">
          {paymentMethod === 'PAYOS' ? (
            <button
              onClick={() => onPayOSPayment('SETTLE', settleLoan.id, currentAmount, undefined, settleType, settleType === 'PARTIAL' ? partialAmount : undefined, selectedVoucherId || undefined)}
              disabled={isSubmitting || isGlobalProcessing}
              className={`w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-[0.15em] transition-all shadow-xl active:scale-95 bg-[#ff8c00] text-black shadow-orange-950/20`}
            >
              {isSubmitting || isGlobalProcessing ? 'ĐANG XỬ LÝ...' : 'THANH TOÁN PAYOS NGAY'}
            </button>
          ) : (
            <button
              onClick={async () => {
                if (billImage) {
                  setIsSubmitting(true);
                  try {
                    await onSettleLoan(settleLoan.id, billImage, settleType, undefined, settleType === 'PARTIAL' ? partialAmount : undefined, selectedVoucherId || undefined);
                    setSuccessToast(true);
                    setTimeout(() => {
                      setSuccessToast(false);
                      onBack();
                    }, 2000);
                  } catch (error) {
                    console.error("Lỗi gửi biên lai:", error);
                  } finally {
                    setIsSubmitting(false);
                  }
                } else {
                  fileInputRef.current?.click();
                }
              }}
              disabled={isSubmitting || isGlobalProcessing || isUploadingBill}
              className={`w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-[0.15em] transition-all shadow-xl active:scale-95 ${
                billImage 
                  ? 'bg-[#ff8c00] text-black shadow-orange-950/20' 
                  : 'bg-white/10 text-gray-500 border border-white/5'
              } flex items-center justify-center gap-2`}
            >
              {isUploadingBill ? (
                <Loader2 size={14} className="animate-spin" />
              ) : billImage ? (
                <CheckCircle2 size={14} />
              ) : (
                <ArrowUpCircle size={14} />
              )}
              {isUploadingBill ? 'ĐANG XỬ LÝ ẢNH...' : billImage ? 'GỬI BIÊN LAI XÁC THỰC' : 'TẢI BIÊN LAI LÊN'}
            </button>
          )}
        </div>
      </div>
    );
  };
  const renderContract = () => (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-500 overflow-hidden">
      <div className="w-full p-3 flex items-center justify-between bg-black text-white border-b border-white/5 flex-none">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-orange-500/10 rounded-lg flex items-center justify-center text-[#ff8c00]">
            <Award size={16} />
          </div>
          <div>
            <h3 className="text-[9px] font-black uppercase tracking-widest leading-none">Phác thảo hợp đồng</h3>
            <p className="text-[6px] font-bold text-gray-500 uppercase mt-0.5 tracking-tighter">XÁC THỰC ĐIỆN TỬ NDV-SAFE</p>
          </div>
        </div>
        <button 
          onClick={() => setStep(LoanStep.SELECT_AMOUNT)}
          className="w-7 h-7 bg-white/5 rounded-full flex items-center justify-center text-gray-400 hover:text-white active:scale-90 transition-all"
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
                {replaceContractPlaceholders(settings.CONTRACT_CLAUSES?.title || 'Hợp đồng vay tiêu dùng', user, {
                  id: nextContractId,
                  amount: selectedAmount,
                  loanPurpose: loanPurpose,
                  date: dueDate
                })}
              </h2>
              {settings.CONTRACT_CLAUSES?.subtitle && (
                <p className="text-[7px] font-black text-[#ff8c00] uppercase tracking-[0.2em] mt-0.5">
                  {replaceContractPlaceholders(settings.CONTRACT_CLAUSES.subtitle, user, {
                    id: nextContractId,
                    amount: selectedAmount,
                    loanPurpose: loanPurpose,
                    date: dueDate
                  })}
                </p>
              )}
              <p className="text-[6px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Mã số: {nextContractId}</p>
            </div>
          </div>

          <div className="w-full h-px bg-gray-100 my-2 relative z-10 flex-none"></div>

          <div className="flex-1 min-h-0 relative z-10 overflow-y-auto pr-1 custom-scrollbar py-2 space-y-4">
            
            {/* Nội dung các điều khoản động */}
            {(settings.CONTRACT_CLAUSES?.clauses || [
              { title: 'Các bên giao kết', content: 'Bên A (Bên cho vay): HỆ THỐNG TÀI CHÍNH NDV FINANCIAL\nBên B (Bên vay): {FULL_NAME}\nSố CMND/CCCD: {ID_NUMBER}\nSố điện thoại: {PHONE}\nĐịa chỉ: {ADDRESS}' },
              { title: 'Nội dung thỏa thuận vay', content: 'Bên A đồng ý cho Bên B vay số tiền gốc là {AMOUNT} theo yêu cầu đã được phê duyệt trên hệ thống.\nMục đích vay: {LOAN_PURPOSE}.\nLãi suất vay là 0% (Ưu đãi).' },
              { title: 'Giải ngân và Thanh toán', content: '3.1. Bên A thực hiện giải ngân trực tiếp vào tài khoản ngân hàng {BANK_NAME} - STK: {BANK_ACCOUNT} đã được Bên B cung cấp.\n3.2. Bên B có trách nhiệm hoàn trả toàn bộ số tiền gốc vào ngày đến hạn {DATE}.\n3.3. Mọi giao dịch thanh toán phải được thực hiện đúng theo nội dung chuyển khoản được hệ thống chỉ định.' },
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
                  {clause.title.toLowerCase().includes('phí phạt') && (
                    <div className="grid grid-cols-1 gap-4 mb-2">
                      <div className="space-y-1">
                        <p className="text-[6px] font-black text-gray-400 uppercase">Phí phạt quá hạn</p>
                        <p className="text-[9px] font-black text-red-600">{settings.FINE_RATE}% / Ngày chậm trả</p>
                      </div>
                    </div>
                  )}
                  <div className={`text-[7px] font-bold leading-relaxed whitespace-pre-line ${clause.title.toLowerCase().includes('phí phạt') ? 'text-gray-600 border-t border-red-100 pt-2' : 'text-gray-700'}`}>
                    {(() => {
                      const content = replaceContractPlaceholders(clause.content, user, {
                        id: nextContractId,
                        amount: selectedAmount,
                        loanPurpose: loanPurpose,
                        date: dueDate
                      });

                      // Function to highlight placeholders in the final content
                      const highlightPlaceholders = (text: string) => {
                        if (!user) return text;
                        const placeholders = [
                          new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(selectedAmount),
                          dueDate, 
                          user.fullName, 
                          user.idNumber, 
                          loanPurpose,
                          user.bankName,
                          user.bankAccountNumber,
                          user.phone,
                          user.address,
                          nextContractId,
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

                      if (content.includes('[COLUMN_SPLIT]')) {
                        const parts = content.split('[COLUMN_SPLIT]');
                        const sideA = parts[0] || "";
                        const sideB = parts[1] || "";
                        
                        const linesA = sideA.split('\n').map(l => l.trim()).filter(Boolean);
                        const linesB = sideB.split('\n').map(l => l.trim()).filter(Boolean);
                        const maxLines = Math.max(linesA.length, linesB.length);

                        return (
                          <div className="border-t border-b border-gray-100 py-2 my-1 space-y-1">
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
                      return highlightPlaceholders(content);
                    })()}
                  </div>
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

                <div className="flex flex-col items-center space-y-1">
                  <p className="text-[6px] font-black text-gray-400 uppercase tracking-widest">Người vay (Bên B)</p>
                  <div className="w-full aspect-[16/9] bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
                    <SignaturePad onSign={setSignatureData} />
                  </div>
                  <p className="text-[6px] font-black text-blue-600 uppercase tracking-tighter truncate w-full text-center">{user?.fullName}</p>
                </div>
              </div>
            </section>
          </div>

          <div className="flex justify-center pt-2 mt-1 border-t border-gray-50 flex-none">
             <p className="text-[5px] font-bold text-gray-300 uppercase tracking-[0.2em]">Hợp đồng số hóa NDV Financial System v1.26</p>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 left-0 right-0 p-3 bg-black flex gap-2 z-[110] border-t border-white/5 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] mt-auto">
        <button 
          onClick={() => setStep(LoanStep.SELECT_AMOUNT)}
          className="flex-1 py-3.5 rounded-xl border border-white/10 text-white font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all"
        >
          Hủy bỏ
        </button>
        <button 
          onClick={handleConfirmSignature}
          disabled={!signatureData || isSubmitting || isGlobalProcessing}
          className={`flex-[1.5] py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all shadow-xl ${
            signatureData && !isSubmitting && !isGlobalProcessing ? 'bg-[#ff8c00] text-black shadow-orange-950/20' : 'bg-white/5 text-gray-600 cursor-not-allowed opacity-50'
          }`}
        >
          {isSubmitting || isGlobalProcessing ? 'ĐANG GỬI...' : (signatureData ? 'Ký & Gửi hồ sơ' : 'Vui lòng ký tên')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full bg-black px-5 pt-4 overflow-x-hidden relative">
      {copyToast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-green-600 text-white px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl flex items-center gap-2">
            <CheckCircle2 size={16} />
            Đã sao chép thành công
          </div>
        </div>
      )}

      {successToast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-green-600 text-white px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl flex items-center gap-2">
            <CheckCircle2 size={16} />
            Gửi biên lai thành công
          </div>
        </div>
      )}

      {step === LoanStep.LIST && renderList()}
      {step === LoanStep.SELECT_AMOUNT && (<>{renderList()}{renderSelectAmount()}</>)}
      {step === LoanStep.CONTRACT && renderContract()}
      {step === LoanStep.SETTLE_DETAIL && renderSettleDetail()}
    </div>
  );
};

export default LoanApplication;