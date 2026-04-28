
export const removeAccents = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase();
};

export const compressImage = (base64Str: string, maxWidth = 600, maxHeight = 600): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => resolve(base64Str);
  });
};

export const calculateFine = (amount: number, dueDateStr: string, fineRate = 0.001, maxFinePercent = 30): number => {
  const [d, m, y] = dueDateStr.split('/').map(Number);
  const dueDate = new Date(y, m - 1, d);
  const today = new Date();
  
  // Set time to midnight for accurate day comparison
  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  if (today <= dueDate) return 0;
  
  const diffTime = Math.abs(today.getTime() - dueDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return 0;

  // fineRate is now passed as an argument, defaulting to 0.001 (0.1%)
  let fine = amount * fineRate * diffDays;
  
  const maxFine = amount * (maxFinePercent / 100); 
  const finalFine = Math.min(fine, maxFine);
  return Math.ceil(finalFine / 1000) * 1000;
};

export const replaceContractPlaceholders = (text: string, user: any, contract: any): string => {
  if (!text) return "";
  
  let result = text;
  const replacements: Record<string, string> = {
    '{FULL_NAME}': user?.fullName || 'CÁ NHÂN ĐỊNH DANH',
    '{ID_NUMBER}': user?.idNumber || '................',
    '{PHONE}': user?.phone || '................',
    '{ADDRESS}': user?.address || '................',
    '{LOAN_PURPOSE}': contract?.loanPurpose || 'Tiêu dùng cá nhân',
    '{AMOUNT}': contract?.amount ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(contract.amount) : '................',
    '{DATE}': contract?.date || '................',
    '{BANK_NAME}': user?.bankName || '................',
    '{BANK_ACCOUNT}': user?.bankAccountNumber || '................',
    '{CONTRACT_ID}': contract?.id || '................',
    '{RANK}': user?.rank ? user.rank.toUpperCase() : 'STANDARD',
    '{DATE_NOW}': new Date().toLocaleDateString('vi-VN'),
  };

  Object.entries(replacements).forEach(([placeholder, value]) => {
    const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(regex, value);
  });

  return result;
};

/**
 * Sinh mã hợp đồng duy nhất dựa trên định dạng cấu hình
 * Mặc định: HD{RANDOM}
 */
// Helper to resolve nested master configurations
interface ResolutionContext {
  userId?: string;
  originalId?: string;
  sequence?: number;
  n?: number;
  slgh?: number;
  slttmp?: number;
  phone?: string;
  rank?: string;
}

const resolveMasterConfig = (
  format: string, 
  settings: any, 
  context: ResolutionContext = {},
  depth = 0
): string => {
  if (depth > 10) return format; // Prevent infinite loops
  
  let result = format;
  const masterConfigs = (settings && Array.isArray(settings.MASTER_CONFIGS)) ? settings.MASTER_CONFIGS : [];
  
  // 1. Iterative replacement to handle nested user-defined variables
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 5) {
    changed = false;
    iterations++;
    
    for (const cfg of masterConfigs) {
      if (!cfg.abbreviation) continue;
      
      const placeholder = `{${cfg.abbreviation}}`;
      if (result.toUpperCase().includes(placeholder.toUpperCase())) {
        const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        
        let replacement = "";
        const type = cfg.systemMeaning;
        const cfgFormat = cfg.format;
        const abbr = cfg.abbreviation.toUpperCase();
        
        // Priority 1: Use existing data from context if the type matches OR if abbreviation is a common system name
        let dataValue = null;
        if (type === 'user_id' && context.userId) dataValue = context.userId;
        if ((type === 'contract_id' || type === 'contract_id_original') && context.originalId) dataValue = context.originalId;
        if (type === 'sequence' && (context.sequence !== undefined || context.n !== undefined)) {
          dataValue = (context.sequence ?? context.n ?? 0).toString();
        }
        if (type === 'phone' && context.phone) dataValue = context.phone;

        // Handle new contract formats and transfer content formats specifically
        if (type === 'contract_id_new' || type === 'contract_partial_format' || type === 'contract_extension_format' ||
            type === 'transfer_full' || type === 'transfer_extension' || type === 'transfer_partial' || type === 'transfer_disburse') {
          let targetFormat = cfgFormat;
          if (!targetFormat || targetFormat.trim() === "") {
            // Fallback to system settings if no custom format is provided for the abbreviation
            if (type === 'contract_partial_format') targetFormat = getSystemContractFormat(settings, 'PARTIAL_SETTLEMENT', "{MHD}NEW");
            else if (type === 'contract_extension_format') targetFormat = getSystemContractFormat(settings, 'EXTENSION', "{MHD}NEW");
            else if (type === 'transfer_full') targetFormat = settings.TRANSFER_CONTENTS_CONFIG?.find((c: any) => c.key === 'FULL_SETTLEMENT')?.value || "TAT TOAN {ID}";
            else if (type === 'transfer_extension') targetFormat = settings.TRANSFER_CONTENTS_CONFIG?.find((c: any) => c.key === 'EXTENSION')?.value || "GIA HAN {ID} LAN {SLGH}";
            else if (type === 'transfer_partial') targetFormat = settings.TRANSFER_CONTENTS_CONFIG?.find((c: any) => c.key === 'PARTIAL_SETTLEMENT')?.value || "TTMP {ID} LAN {SLTTMP}";
            else if (type === 'transfer_disburse') targetFormat = settings.TRANSFER_CONTENTS_CONFIG?.find((c: any) => c.key === 'DISBURSE')?.value || "GIAI NGAN {ID}";
            else targetFormat = "{MHD}NEW";
          }
          dataValue = resolveMasterConfig(targetFormat, settings, context, depth + 1);
        }

        // Smart Fallback: If no type-based match, check if abbreviation itself implies a system field
        if (dataValue === null) {
          if ((abbr === 'US' || abbr === 'USER' || abbr === 'ID') && context.userId) {
            dataValue = context.userId;
          } else if ((abbr === 'MHD' || abbr === 'CONTRACT' || abbr === 'HD') && context.originalId) {
            dataValue = context.originalId;
          } else if (abbr === 'N' && (context.sequence !== undefined || context.n !== undefined)) {
            dataValue = (context.sequence ?? context.n ?? 0).toString();
          }
        }

        if (dataValue !== null) {
          replacement = dataValue;
        } else if (cfgFormat && cfgFormat.trim() !== "") {
          // Priority 2: If no context data, resolve the custom format
          replacement = resolveMasterConfig(cfgFormat, settings, context, depth + 1);
        } else {
          // Priority 3: Default system logic
          const now = new Date();
          const year = now.getFullYear().toString();
          const month = (now.getMonth() + 1).toString().padStart(2, '0');
          const day = now.getDate().toString().padStart(2, '0');
          const dateStr = `${day}${month}${year.slice(-2)}`;

          switch(type) {
            case 'random':
              const lengthMatch = (cfg.originalName || '')?.match(/\d+/);
              const length = lengthMatch ? parseInt(lengthMatch[0]) : 6;
              const min = Math.pow(10, length - 1);
              const max = Math.pow(10, length) - 1;
              replacement = Math.floor(min + Math.random() * (max - min + 1)).toString();
              break;
            case 'user_id':
              replacement = context.userId || "USER";
              break;
            case 'contract_id':
            case 'contract_id_original':
              replacement = context.originalId || '';
              break;
            case 'contract_id_new':
              replacement = context.originalId ? `${context.originalId}NEW` : '';
              break;
            case 'sequence':
              replacement = (context.sequence ?? context.n ?? 0).toString();
              break;
            case 'date':
            case 'date_now':
              replacement = dateStr;
              break;
            case 'year':
              replacement = year;
              break;
            case 'month':
              replacement = month;
              break;
            case 'day':
              replacement = day;
              break;
            case 'phone':
              replacement = context.phone || "{PHONE}";
              break;
            case 'rank':
              replacement = context.rank || "MEMBER";
              break;
            case 'slgh':
              replacement = (context.slgh || 0).toString();
              break;
            case 'slttmp':
              replacement = (context.slttmp || 0).toString();
              break;
            default:
              replacement = cfg.originalName || "";
          }
        }
        
        const newResult = result.replace(regex, replacement);
        if (newResult !== result) {
          result = newResult;
          changed = true;
        }
      }
    }
  }

  // 2. Handle system placeholders if not replaced by user variables
  const randomRegex = /\{(RANDOM|MÃ NGẪU NHIÊN)\s*(\d+)?\s*(SỐ)?\}|\{(MHD|RD|HD)\s*(\d+)\s*(SỐ)?\}/gi;
  result = result.replace(randomRegex, (match, p1, p2, p3, p4, p5) => {
    const length = p2 ? parseInt(p2) : (p5 ? parseInt(p5) : 4);
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  });

  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const dateStr = `${day}${month}${year.slice(-2)}`;
  const userPart = context.userId || "USER";

  // Legacy placeholders
  result = result.replace(/\{ID\}|\{USER\}/gi, userPart);
  result = result.replace(/\{MHD\}|\{CONTRACT\}/gi, context.originalId || "HD0001");
  result = result.replace(/\{N\}/gi, (context.sequence !== undefined ? context.sequence : (context.n !== undefined ? context.n : 0)).toString());
  result = result.replace(/\{DATE\}|\{NGÀY\}/gi, dateStr);

  return result;
};

export const generateContractId = (userId: string, format = 'HD{RANDOM}', settings?: any, originalId?: string, sequence?: number, phone?: string, slgh?: number, slttmp?: number): string => {
  return resolveMasterConfig(format, settings, { userId, originalId, sequence, phone, slgh, slttmp });
};

export const generateUserId = (format = '{RANDOM 4 SỐ}', settings?: any, userId?: string, phone?: string): string => {
  return resolveMasterConfig(format, settings, { userId, phone });
};

/**
 * Tải ảnh lên ImgBB để tiết kiệm dung lượng Supabase
 * @param base64Data Dữ liệu ảnh dạng base64 (bao gồm cả prefix data:image/...)
 * @param name Tên ảnh (tùy chọn)
 * @returns URL ảnh đã tải lên
 */
export const uploadToImgBB = async (base64Data: string, name?: string, customApiKey?: string): Promise<string> => {
  // Đảm bảo lấy API Key từ đúng nguồn: Ưu tiên customApiKey từ settings, sau đó là env
  const apiKey = customApiKey || import.meta.env.VITE_IMGBB_API_KEY;
  
  // Kiểm tra API Key hợp lệ (không trống, không phải chuỗi mặc định, không phải chuỗi "undefined")
  if (!apiKey || 
      apiKey === 'your-imgbb-api-key-here' || 
      apiKey === '' || 
      apiKey === 'undefined' || 
      apiKey === 'null') {
    console.warn("[ImgBB] API Key chưa được cấu hình hoặc không hợp lệ. Đang lưu tạm Base64.");
    return base64Data;
  }

  try {
    // Tách phần data base64 thực tế (loại bỏ prefix data:image/...)
    const base64Image = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    
    const formData = new FormData();
    formData.append('image', base64Image);
    if (name) {
      formData.append('name', name);
    }

    // Sử dụng timeout để tránh treo fetch quá lâu
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // Tăng lên 30s timeout

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey.trim())}`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      mode: 'cors'
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ImgBB] Phản hồi lỗi từ server:", errorText);
      throw new Error(`ImgBB Server Error: ${response.status} - ${errorText.substring(0, 100)}`);
    }

    const result = await response.json();
    if (result.success && result.data && result.data.url) {
      console.log("[ImgBB] Tải ảnh thành công:", result.data.url);
      return result.data.url;
    } else {
      throw new Error(result.error?.message || "Lỗi định dạng phản hồi từ ImgBB");
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error("[ImgBB] Lỗi: Yêu cầu quá hạn (Timeout 30s)");
    } else {
      console.error("[ImgBB] Lỗi kết nối/tải ảnh. Nếu là 'Load failed', có thể do Adblocker chặn api.imgbb.com hoặc lỗi mạng:", error.message || error);
    }
    
    // Fallback về base64 nếu lỗi để không làm gián đoạn trải nghiệm người dùng
    // Điều này đảm bảo ứng dụng vẫn chạy được ngay cả khi ImgBB bị lỗi hoặc bị chặn
    return base64Data;
  }
};

/**
 * Sinh nội dung chuyển khoản dựa trên định dạng cấu hình
 */
export const generatePaymentContent = (type: 'SETTLE' | 'UPGRADE' | 'DISBURSE', data: any, settings: any): string => {
  if (!settings) return "";
  
  let template = "";
  let abbr = "";
  const settleType = data.settleType;
  const id = data.id || "";
  const userId = data.userId || "";
  const userPhone = (data.userPhone || "").replace(/\s/g, "");
  const targetRank = data.targetRank || "";
  const extensionCount = data.extensionCount || 0;
  let partialCount = data.partialCount || 0;
  
  // Fallback: try to extract partial count from ID if it's 0 and the ID looks like it has one
  if (partialCount === 0 && id.toLowerCase().includes('ttmp')) {
    const match = id.match(/(?:LAN|LẦN|L|#)\s*(\d+)$/i);
    if (match) partialCount = parseInt(match[1]);
  }

  // Select template based on type
  if (type === 'UPGRADE') {
    const config = (Array.isArray(settings.MASTER_CONFIGS) && settings.MASTER_CONFIGS.length > 0)
      ? settings.MASTER_CONFIGS.find((c: any) => c.category === 'TRANSFER_CONTENT' && (c.systemMeaning === 'UPGRADE' || c.systemMeaning === 'transfer_upgrade'))
      : settings.TRANSFER_CONTENTS_CONFIG?.find((c: any) => c.original === 'Nâng hạng' || c.key === 'UPGRADE');
    
    template = config?.format || config?.value || "HANG {RANK} {USER}";
    const upgradeOp = getBusinessOp(settings, 'UPGRADE');
    abbr = config?.abbreviation || config?.abbr || upgradeOp?.abbr || 'NH';
  } else if (type === 'DISBURSE') {
    const config = (Array.isArray(settings.MASTER_CONFIGS) && settings.MASTER_CONFIGS.length > 0)
      ? settings.MASTER_CONFIGS.find((c: any) => c.category === 'TRANSFER_CONTENT' && (c.systemMeaning === 'DISBURSE' || c.systemMeaning === 'transfer_disburse'))
      : settings.TRANSFER_CONTENTS_CONFIG?.find((c: any) => c.original === 'Giải ngân' || c.key === 'DISBURSE');
    
    template = config?.format || config?.value || "GIAI NGAN {ID}";
    const disburseOp = getBusinessOp(settings, 'DISBURSE');
    abbr = config?.abbreviation || config?.abbr || disburseOp?.abbr || 'GN';
  } else {
    if (settleType === 'PARTIAL') {
      const config = (Array.isArray(settings.MASTER_CONFIGS) && settings.MASTER_CONFIGS.length > 0)
        ? settings.MASTER_CONFIGS.find((c: any) => c.category === 'TRANSFER_CONTENT' && (c.systemMeaning === 'PARTIAL_SETTLEMENT' || c.systemMeaning === 'transfer_partial'))
        : settings.TRANSFER_CONTENTS_CONFIG?.find((c: any) => c.original === 'TT 1 phần' || c.key === 'PARTIAL_SETTLEMENT');
      
      template = config?.format || config?.value || "TTMP {ID} LAN {SLTTMP}";
      const partialOp = getBusinessOp(settings, 'PARTIAL_SETTLEMENT');
      abbr = config?.abbreviation || config?.abbr || partialOp?.abbr || 'TTMP';
    } else if (settleType === 'PRINCIPAL') {
      const config = (Array.isArray(settings.MASTER_CONFIGS) && settings.MASTER_CONFIGS.length > 0)
        ? settings.MASTER_CONFIGS.find((c: any) => c.category === 'TRANSFER_CONTENT' && (c.systemMeaning === 'EXTENSION' || c.systemMeaning === 'transfer_extension'))
        : settings.TRANSFER_CONTENTS_CONFIG?.find((c: any) => c.original === 'Gia hạn' || c.key === 'EXTENSION');
      
      template = config?.format || config?.value || "GIA HAN {ID} LAN {SLGH}";
      const extensionOp = getBusinessOp(settings, 'EXTENSION');
      abbr = config?.abbreviation || config?.abbr || extensionOp?.abbr || 'GH';
    } else {
      const config = (Array.isArray(settings.MASTER_CONFIGS) && settings.MASTER_CONFIGS.length > 0)
        ? settings.MASTER_CONFIGS.find((c: any) => c.category === 'TRANSFER_CONTENT' && (c.systemMeaning === 'FULL_SETTLEMENT' || c.systemMeaning === 'transfer_full'))
        : settings.TRANSFER_CONTENTS_CONFIG?.find((c: any) => c.original === 'Tất toán' || c.key === 'FULL_SETTLEMENT');
      
      template = config?.format || config?.value || "TAT TOAN {ID}";
      const fullOp = getBusinessOp(settings, 'FULL_SETTLEMENT');
      abbr = config?.abbreviation || config?.abbr || fullOp?.abbr || 'TT';
    }
  }

  // Use resolveMasterConfig for consistent resolution
  // Clean the original ID from existing prefixes to avoid duplication (e.g., TTMP TTMP... -> TTMP...)
  const cleanId = id;
  
  // Use originalBaseId if available, otherwise strip prefixes from current ID
  let baseId = data.originalBaseId || '';
  
  if (!baseId) {
    // Get all possible prefixes to strip them from the ID if they exist
    const masterConfigs = Array.isArray(settings?.MASTER_CONFIGS) ? settings.MASTER_CONFIGS : [];
    const allAbbrs = masterConfigs
      .filter((c: any) => c.category === 'ABBREVIATION' || c.category === 'TRANSFER_CONTENT' || c.category === 'CONTRACT_NEW')
      .map((c: any) => c.abbreviation)
      .filter(Boolean);
    
    // Add some common system ones just in case
    const systemAbbrs = ['TTMP', 'GH', 'GN', 'NH', 'TT', 'TATTOAN', 'GIAHAN', 'GIAINGAN'];
    const stripRegex = new RegExp(`^(${[...new Set([...allAbbrs, ...systemAbbrs])].join('|')})`, 'i');
    
    // We only strip if the ID actually starts with one of these, to keep the core ID intact
    const oldId = cleanId;
    baseId = cleanId.replace(stripRegex, '').trim();
    // Only strip trailing digits and connectors if we actually removed a system prefix (indicating it's already an extension/partial)
    if (oldId !== baseId) {
      // Remove common connectors like LAN, LẦN, L, # followed by digits, or just digits
      baseId = baseId.replace(/(LAN|LẦN|L|#)\s*\d+$/i, '').replace(/\d+$/, '').trim();
    }
  }

  // Final pass for legacy and special placeholders
  const rankConfig = Array.isArray(settings.RANK_CONFIG) ? settings.RANK_CONFIG : [];
  const foundRank = rankConfig.find((r: any) => r.id === targetRank);
  const rankName = foundRank ? removeAccents(foundRank.name) : removeAccents(targetRank);

  const resolved = resolveMasterConfig(template, settings, {
    userId: userId || id.slice(-4).toUpperCase(), 
    originalId: baseId || cleanId, // Use the stripped base ID if possible
    sequence: settleType === 'PARTIAL' ? (partialCount + 1) : (extensionCount + 1),
    n: settleType === 'PARTIAL' ? (partialCount + 1) : (extensionCount + 1),
    slgh: extensionCount + 1,
    slttmp: partialCount + 1,
    phone: userPhone,
    rank: rankName
  });

  return resolved
    .replace(/\{ID\}|\{Mã Hợp Đồng\}|\{LOAN_ID\}|\{MHD\}/gi, id)
    .replace(/\{USER\}|\{MÃ USER\}|\{NGƯỜI DÙNG\}/gi, userId || id.slice(-4).toUpperCase())
    .replace(/\{PHONE\}|\{SĐT\}|\{SDT\}|\{SỐ ĐIỆN THOẠI\}|\{SO DIEN THOAI\}/gi, userPhone)
    .replace(/\{RANK\}|\{HẠNG\}|\{HANG\}|\{TÊN HẠNG CẦN NÂNG\}|\{TEN HANG NANG CAP\}|\{TEN HANG\}|\{TÊN HẠNG\}/gi, rankName)
    .replace(/\{SỐ LẦN GIA HẠN\}|\{EXTENSION_COUNT\}|\{SLGH\}/gi, settleType === 'PRINCIPAL' ? (extensionCount + 1).toString() : '')
    .replace(/\{SỐ LẦN TTMP\}|\{PARTIAL_COUNT\}|\{SLTTMP\}/gi, settleType === 'PARTIAL' ? (partialCount + 1).toString() : '')
    .replace(/\{VT\}|\{VIẾT TẮT\}|\{VIET TAT\}/gi, abbr);
};

/**
 * Lấy giá trị định dạng hệ thống từ cấu hình mới hoặc cũ
 */
export const getSystemFormat = (settings: any, type: 'user' | 'contract', defaultValue: string): string => {
  if (!settings) return defaultValue;
  
  if (Array.isArray(settings.MASTER_CONFIGS) && settings.MASTER_CONFIGS.length > 0) {
    const config = settings.MASTER_CONFIGS.find((f: any) => 
      f.category === 'ID_FORMAT' && (f.systemMeaning === type || f.systemMeaning === `${type}_format` || f.systemMeaning === `contract_original_format` && type === 'contract')
    );
    if (config) return config.format || defaultValue;
  }

  const config = settings.SYSTEM_FORMATS_CONFIG?.find((f: any) => f.type === type || f.key === (type === 'user' ? 'USER_ID_FORMAT' : 'CONTRACT_CODE_FORMAT') || f.original === (type === 'user' ? 'USER_ID_FORMAT' : 'CONTRACT_CODE_FORMAT'));
  return config?.value || defaultValue;
};

/**
 * Lấy giá trị định dạng hợp đồng hệ thống (TTMP, Gia hạn)
 */
export const getSystemContractFormat = (settings: any, type: 'PARTIAL_SETTLEMENT' | 'EXTENSION', defaultValue: string): string => {
  if (!settings) return defaultValue;

  if (Array.isArray(settings.MASTER_CONFIGS) && settings.MASTER_CONFIGS.length > 0) {
    const config = settings.MASTER_CONFIGS.find((f: any) => 
      f.category === 'CONTRACT_NEW' && (f.systemMeaning === type || f.systemMeaning === `contract_${type.toLowerCase().replace('_settlement', '')}_format`)
    );
    if (config) return config.format || defaultValue;
  }

  const config = settings.SYSTEM_CONTRACT_FORMATS_CONFIG?.find((f: any) => f.type === type || f.key === type || f.original === type);
  return config?.value || defaultValue;
};

/**
 * Lấy thông tin nghiệp vụ từ cấu hình
 */
export const getBusinessOp = (settings: any, key: string) => {
  if (!settings) return null;

  if (Array.isArray(settings.MASTER_CONFIGS) && settings.MASTER_CONFIGS.length > 0) {
    const config = settings.MASTER_CONFIGS.find((f: any) => 
      f.category === 'ABBREVIATION' && (
        f.systemMeaning === key || 
        (key === 'user' && f.systemMeaning === 'user_id') ||
        (key === 'contract_original' && f.systemMeaning === 'contract_id_original') ||
        (key === 'contract_new' && f.systemMeaning === 'contract_id_new') ||
        (key === 'date' && f.systemMeaning === 'date_now')
      )
    );
    if (config) return { ...config, abbr: config.abbreviation, original: config.originalName, type: config.systemMeaning };
  }

  return settings.BUSINESS_OPERATIONS_CONFIG?.find((op: any) => op.key === key);
};
