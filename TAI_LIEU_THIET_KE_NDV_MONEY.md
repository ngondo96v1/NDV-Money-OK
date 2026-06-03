# BẢN ĐẶC TẢ HỆ THỐNG CHI TIẾT & HƯỚNG DẪN PROMPT AI STUDIO
## PHÁT TRIỂN VÀ NÂNG CẤP ỨNG DỤNG DI ĐỘNG NDV MONEY (.APK CYCLIP/CAPACITOR)
*Tài liệu kỹ thuật được tối ưu hóa 100% để ra lệnh trực tiếp cho Google AI Studio phát triển màn hình, API, cơ sở dữ liệu và các tính năng di động gốc.*

---

## I. KIẾN TRÚC TỔNG THỂ & THẾ MẠNH DIAGRAM

Ứng dụng **NDV Money** được xây dựng theo mô thức **Hybrid Native** sử dụng React + Vite + Tailwind CSS làm tầng trải nghiệm UI di động, kết hợp với bộ công cụ **Capacitor** để biên dịch trực tiếp và khai thác 100% phần cứng Android (Camera chụp ảnh CCCD, Push Notification, local storage bảo mật).

*   **Platform Hướng Đích:** Android App (.apk) thông qua Capacitor 5+
*   **Theme Thiết Kế:** Cosmic Dark UI – Tone màu `#0D0E12` (sâu thẳm), hổ phách hỗ trợ hoặc cam sáng quý phái (`#F59E0B`) làm điểm nhấn hành động.
*   **Database chính:** Supabase / Firestore (lưu trữ đồng bộ thời gian thực).
*   **Tích hợp phần cứng gốc:**
    1.  **Capacitor Camera plugin** để chụp ảnh KYC hai mặt rõ nét.
    2.  **Firebase Messaging/Push Notification** để đăng ký token đẩy và thông báo trạng thái khoản vay tự động.
    3.  **HTML5 Canvas API** để ghi chữ ký tay trực tiếp của khách hàng khi ký hợp đồng tín dụng.

---

## II. ĐỊNH NGHĨA DỮ LIỆU ĐỒNG BỘ TRONG TYPESCRIPT (TYPES SPECIFICATION)

Để đảm bảo hiệu năng và không lỗi kiểu dữ liệu (Type-Safety) khi AI Studio biên dịch ứng dụng, hãy cung cấp định nghĩa Type sau vào hệ thống dữ liệu:

```typescript
// src/types.ts

export type LoanStatus = 
  | 'CHỜ DUYỆT' 
  | 'ĐANG GIẢI NGÂN' 
  | 'ĐANG NỢ' 
  | 'QUÁ HẠN' 
  | 'CHỜ TẤT TOÁN' 
  | 'ĐANG ĐỐI SOÁT' 
  | 'ĐÃ TẤT TOÁN' 
  | 'ĐÃ CỘNG DỒN' 
  | 'BỊ TỪ CHỐI' 
  | 'ĐÃ HỦY';

export type BudgetLogType = 
  | 'INITIAL'       // Khởi tạo dòng tiền
  | 'ADD'           // Bơm thêm quỹ
  | 'WITHDRAW'      // Rút tiền khỏi quỹ
  | 'LOAN_DISBURSE' // Thực tế chi giải ngân
  | 'LOAN_REPAY';   // Thực tế thu hồi nợ/lãi/phí gia hạn

export interface RankConfig {
  name: string;      // Standard, Bronze, Silver, Gold, Diamond
  minLimit: number;  // Hạn mức tối thiểu được duyệt
  maxLimit: number;  // Hạn mức tối đa được duyệt
  perks: string[];   // Quyền lợi đi kèm
  feeDiscount: number; // Mức giảm phần trăm phí giải ngân
}

export interface User {
  id: string;                      // ID duy nhất định dạng số (VD: "3562")
  phone: string;                   // Số ĐT đăng ký (kiêm tài khoản Zalo)
  fullName: string;                // Họ tên đầy đủ (In hoa, không dấu)
  idNumber: string;                // Số CCCD
  passwordHash: string;            // Mật khẩu băm an toàn
  balance: number;                 // Hạn mức vay khả dụng hiện tại (VND)
  totalLimit: number;              // Tổng hạn mức được cấp duyệt tối đa (VND)
  rank: 'standard' | 'bronze' | 'silver' | 'gold' | 'diamond';
  pendingUpgradeRank?: string;     // Hạng VIP đang chờ xét duyệt
  rankUpgradeBill?: string;        // URL ảnh hóa đơn/bill nâng hạng chuyển khoản tay
  isLocked: boolean;               // Có bị khóa hay không
  lockedReason?: string;           // Lý do khóa hiển thị trực quan cho người dùng
  bankName: string;                // Tên ngân hàng nhận giải ngân
  bankAccountNumber: string;       // Số tài khoản ngân hàng
  bankAccountHolder: string;       // Tên chủ sở hữu thẻ (In hoa không dấu)
  bankBin: string;                 // Mã ngân hàng phục vụ tự động gạch nợ
  idFront: string;                 // URL ảnh CCCD Mặt trước
  idBack: string;                  // URL ảnh CCCD Mặt sau
  refZalo: string;                 // SĐT Zalo người thân tham chiếu
  relationship: string;            // Mối quan hệ thân nhân
  spins: number;                   // Số lượt quay may mắn khả dụng
  fcmToken?: string;               // Token nhận Push Notification từ Firebase trên di động
  createdAt: string;
}

export interface Loan {
  id: string;                      // Định dạng động: `USERID-NDV[CYCLE]` (v.d: "3562-NDV1")
  userId: string;                  // ID người vay
  userName: string;                // Họ và tên người vay
  amount: number;                  // Tổng số tiền nợ gốc của hợp đồng vay này (VND)
  date: string;                    // Ngày tạo, ký nhận nợ (DD/MM/YYYY)
  dueDate: string;                 // Hạn cuối trả nợ (DD/MM/YYYY)
  status: LoanStatus;              // Trạng thái vận hành hợp đồng
  signature: string;               // Base64 URI nét vẽ chữ ký điện tử của khách hàng
  loanPurpose: string;             // Mục đích sử dụng khoản tiền
  fine: number;                    // Số dư tiền phạt quá hạn tích lũy hiện hành (VND)
  partialAmount: number;           // Tổng số tiền đã được giảm trừ vào nợ gốc (VND)
  createdAt: string;
}

export interface BudgetLog {
  id: string;
  type: BudgetLogType;
  amount: number;                  // Số tiền của giao dịch
  balanceAfter: number;            // Số dư quỹ của Admin sau khi kết toán giao dịch này
  note: string;                    // Ghi chú nghiệp cụ chi tiết
  createdAt: string;
}

export interface SystemConfig {
  preDisbursementFee: number;      // Tỷ lệ phí dịch vụ trước giải ngân (Ví dụ: 15%)
  initialLimit: number;            // Hạn mức cấp mặc định ban đầu (Ví dụ: 2,000,000đ)
  maxLoansPerCycle: number;        // Số hợp đồng nợ hoạt bát tối đa đồng thời (Mặc định: 1)
  fineRatePerDay: number;          // Tỷ số phạt quá hạn mỗi ngày ví dụ: 0.5%
  enablePayOS: boolean;            // Cho phép sử dụng cổng VietQR của PayOS
  zaloGroupLink: string;           // Link group hỗ trợ online
}
```

---

## III. LOGIC THẨM ĐỊNH & THỦ THUẬT NGHIỆP VỤ NHẠY CẢM

### 1. Phép Cộng Dồn & Hoán Đổi Hợp Đồng Nợ (Debt Consolidation Engine)
Quy trình này xuất hiện khi khách hàng **đang có nợ hiện hữu** (VD: Khoản vay gốc đang ở trạng thái `ĐANG NỢ`, trị giá `10,000,000 đ`) nhưng nộp hồ sơ xin giải ngân tiếp khoản vay mới trị giá `5,000,000 đ`.

Khi Admin ấn phê duyệt yêu cầu vay mới này, hệ thống **bắt buộc** thực hiện logic đóng nợ cũ và tạo hợp đồng gộp như sau:
1.  **Duyệt nợ mới:** Khởi tạo yêu cầu nợ thặng dư.
2.  **Khóa vết hợp đồng cũ:** Trạng thái của hợp đồng nợ cũ được đổi từ `ĐANG NỢ` hoặc `QUÁ HẠN` thành `ĐÃ CỘNG DỒN`. Thao tác này ẩn hợp đồng cũ khỏi danh sách nợ cần thanh toán chủ động ở màn hình người dùng nhưng giữ nguyên dữ liệu gốc cho bảng kiểm toán dòng tiền.
3.  **Tạo thực thể gộp:** Sinh ra một hợp đồng vay hoàn toàn mới với hậu tố định dạng `[MÃ_USER]-NDV[MÃ_CŨ]-GOP`. 
    *   **Công thức gốc mới:** `Tổng nợ mới = Nợ gốc hợp đồng cũ còn lại + Phí phạt cũ (nếu có) + Khoản vay đăng ký mới`.
    *   **Tổng số tiền thực tế giải ngân:** Thực tế chuyển khoản cho người dùng chỉ bằng số tiền họ đăng ký vay thêm sau khi trừ thẳng phí dịch vụ xử lý (ví dụ: `15%`).
4.  Tính toán lại ngày đáo hạn mới cách thời điểm gộp nợ thêm 1 chu kỳ hoàn chỉnh.

### 2. Định Danh & Liên Kết Cảnh Báo Android Native (Push Notification Alerts)
*   **Liên kết Thiết bị (Token Registry):** Khi người dùng duyệt đăng nhập trên hệ điều hành Android, ứng dụng tự động kiểm tra quyền thông báo trên máy. Khi có sự đồng ý, token FCM đăng ký sẽ lập tức được gửi ngược về cập nhật vào trường `fcmToken` của hồ sơ `users`.
*   **Trình Đẩy Tin Tự Động:** Mọi thay đổi trạng thái của bảng `loans` từ trang quản trị Administrator cần lập tức kích hoạt hàm đẩy tin nhắn (Push API) gửi về thông báo cho máy khách:
    *   `DUYỆT GIẢI NGÂN`: *"Hạn mức NDV Money đã được chuyển vào TK Ngân hàng của bạn!"*
    *   `KHI CHUYỂN QUÁ HẠN`: *"Cảnh báo: Khoản vay của bạn đã chuyển sang trạng thái QUÁ HẠN. Hãy đóng phí để tránh ảnh hưởng nợ xấu tín dụng!"*
    *   `XÁC THỰC VIETQR`: *"Hệ thống đã nhận được tiền tất toán. Trạng thái nợ trở lại Bình Thường!"*

---

## IV. ĐẶC TẢ CHI TIẾT MÀN HÌNH NATIVE DI ĐỘNG (DIỆP DIỆN MOBILE UX)

### Màn hình 1: Đăng nhập / Đăng ký Trực quan
*   **Visual:** Nền đen sẫm `#0D0E12`, các thẻ nhập liệu bao viền hổ phách mỏng nhẹ, sang trọng.
*   **Bảo mật:** Nhập số điện thoại (tự động kiểm tra định dạng độ dài), trường mật khẩu có icon ẩn hiện tiện dụng (Eye-slash).
*   **Chức năng:** Nút Đăng ký liên kết mượt mà sang form nhập thông tin cá nhân cơ bản. Có trang thông báo chi tiết nếu tài khoản của User bị khóa (Hiển thị trường `lockedReason`).

### Màn hình 2: KYC - Đăng ký hồ sơ định danh thông minh (Profile Matrix)
*   **Bắt buộc:** Khung điền thông tin ngân hàng nhận tiền cực kỳ trực quan (Bank Name, chủ TK nhận phải đồng bộ tự động viết hoa không dấu trùng khớp với trường Họ và tên khách hàng).
*   **Khối chụp ảnh thẻ CCCD:** Thiết kế 2 khung hình ảo chuyên dụng định dạng sẵn tỷ lệ Thẻ thông minh để người dùng căn chỉnh:
    *   Hỗ trợ tương tác chọn File hoặc kích hoạt camera của thiết bị Android (thông qua `Capacitor Camera plugin`) chụp ảnh chân thực không rung, mờ.
    *   Có chế độ nén ảnh Client-side xuống độ rộng tối đa `1280px` trước khi tải lên để tránh hao hụt băng thông 3G/4G trên điện thoại di động.

### Màn hình 3: Dashboard Trung tâm Người Dùng (Client Dashboard)
*   **Gây ấn tượng trực quan:** Vòng tròn tiến trình (Circular Progress Area) làm trung tâm, hiển thị dung lượng tài chính hiện hữu. 
    *   Ví dụ: Số tiền trung tâm có chữ "Hạn mức khả dụng" – `3.200.000 đ` bên dưới hiển thị thanh nhỏ chứa tổng hạn mức được phê duyệt `12.000.000 đ`.
*   **Dòng tin khẩn (Marquee Text):** Dòng chữ chạy hoạt cảnh ngang màu vàng hổ phách truyền tải thông tin cảnh báo nợ xấu hoặc thời gian bảo trì gạch nợ tự động của ngân hàng.
*   **Lưới Điều Hướng Tiện Ích (Bento Icons Grid - 4 Nút Lớn):**
    1.  **Đăng Ký Vay Trực Tuyến:** Đi thẳng tới form chọn hạn mức.
    2.  **Vòng Quay May Mắn:** Màn hình trò chơi may mắn (Lucky Spin) tăng tương tác, chứa các phần thưởng giảm trừ nợ gốc hoặc quà đặc biệt.
    3.  **Tăng Hạng VIP (Nâng Rank):** Xem mức Rank hiện tại, chọn nâng hạng VIP để gia tốc hạn mức, thanh toán khoản phí nâng cấp bằng tự động quét VietQR qua PayOS hoặc tải bill chụp chuyển khoản ngân hàng nếu thanh toán thủ công.
    4.  **Hỗ Trợ Nhanh:** Kết nối trực tuyến thẳng sang Hotline hoặc group Zalo CSKH từ xa.

### Màn hình 4: Màn hình Vay vốn & Chữ ký Điện Tử (Contract Signing Frame)
*   **Bộ trượt chọn mức tiền (Slider Value Input):** Tầm giá chọn từ `2,000,000 đ` đến `50,000,000 đ` tùy theo cấp Rank VIP hiện hữu. Khi kéo trượt, phần mệnh giá tự động phân rã thành văn bản dạng chữ tiếng Việt sinh động dưới thanh kéo.
*   **Legal Contract Box:** Hộp văn bản dài chứa đầy đủ các điều khoản nợ cam kết, bảo mật thông tin và lịch trình trả nợ.
*   **Canvas Điện Tử (Electronic Wet-ink Signature Canvas):** Khay Canvas chuyên biệt đón chạm đa điểm của hệ điều hành Android. Người dùng bắt buộc hoàn thành nét vẽ chữ ký tay hợp lệ mới mở khóa được nút **GỬI YÊU CẦU DUYỆT**. Chữ ký sau khi hoàn tất được bóc tách định dạng Base64 và đính kèm vào hợp đồng.

### Màn hình 5: Quản trị viên Di Động di động 100% (Mobile Admin Panel)
*   **Bộ Thẻ Thống Kê Tổng Quan (Quick Metrics Dashboard):**
    *   Tổng hợp quỹ và lợi nhuận hệ thống thời gian thực.
    *   Biểu đồ cấu trúc nhỏ gọn biểu diễn trạng thái tài chính (D3 / Recharts được nén tối ưu tương thích màn hình dọc, có thể vuốt ngang để xem chi tiết tháng).
*   **Hàng Đợi Bài Viết Chờ Thẩm Định (Loan Queue & KYC Evaluator):**
    *   Bộ lọc nhanh các khoản vay trạng thái `CHỜ DUYỆT`, `CHO TẤT TOÁN`, `NÂNG VIP CHỜ DUYỆT`.
    *   Khi Admin nhấn vào một hàng đợi, một bảng cấu trúc chi tiết nổi lên (Drawer bottom-sheet phong cách di động) hiển thị: Thông tin cá nhân, ảnh CCCD 2 mặt zoom lớn được, nét chữ ký tay bằng hình ảnh của khách và lịch sử số lần vay quá hạn trong quá khứ.
    *   Nút tác vụ **Từ Chối** (buộc nhập lý do) hoặc **Chấp Thuận Giải Ngân** tích hợp tính toán tự động khấu trừ phí dịch vụ tức thì.
*   **Bảng Điều Khiển Cấu Hình Nhanh:** Sửa trực tiếp các cài đặt hệ thống (Settings) bất cứ lúc nào trên giao diện di động mà không cần can thiệp mã nguồn.

---

## V. FRAMEWORK CÁC BƯỚC PROMPT TỔNG LỰC ĐỂ PHÁT TRIỂN TRÊN AI STUDIO

Khi bạn tiến hành xây dựng ứng dụng này bằng chính AI Studio, hãy áp dụng quy trình ra lệnh (Prompting Sequence) 3 giai đoạn sau để đạt hiệu suất thông tin cao nhất:

### Giai đoạn 1: Khởi tạo Kiến trúc và Database
> **PROMPT GỬI AI STUDIO:**
> *"Hãy xây dựng và cấu hình phần khung xương của ứng dụng tài chính cá nhân NDV Money theo cấu trúc mã nguồn phẳng bằng TypeScript và Tailwind CSS:
> 1. Đọc và hiện thực hóa toàn bộ các Type giao diện được định nghĩa trong `/src/types.ts` bao gồm các trường dữ liệu định dạng người dùng (User), chi tiết hợp đồng vay (Loan), lịch sử quỹ ngân sách hệ thống (BudgetLog), và bảng cấu hình (SystemConfig) một cách kiên cố, chính xác.
> 2. Hãy thiết lập một dịch vụ API mô phỏng (hoặc tích hợp Firestore/Supabase Client thực tùy cài đặt) để vận hành các thao tác nạp thông tin, lấy số dư tài khoản của người dùng, và danh sách các hợp đồng tín dụng hiện thời dựa trên các Type đã khai báo."*

### Giai đoạn 2: Phát triển Toàn bộ Giao diện Di động (Client-Flow & Canvas Chữ Ký)
> **PROMPT GỬI AI STUDIO:**
> *"Hãy tiến hành thiết kế và triển khai giao diện người dùng (Client Core UI) theo phong cách thiết kế Cosmic Dark UI `#0D0E12` và điểm nhấn màu cam ấm vàng `#F59E0B`:
> 1. Xây dựng Màn hình đăng nhập/đăng ký thông minh bằng số định dạng điện thoại liên lạc Zalo.
> 2. Thiết lập Màn hình Dashboard chính có thanh đo tiến trình hình tròn biểu diễn hạn mức vốn còn dư tuyệt đẹp và các bento-grid điều hướng cho phép truy cập: Vòng quay may mắn, Nâng VIP Rank và Đăng ký khoản vay mới.
> 3. Xây dựng Form nộp yêu cầu vay vốn bao gồm: Thanh trượt chọn tiền giải ngân trực quan kèm chuyển sang chữ Tiếng Việt, ô hiển thị điều khoản và quan trọng nhất là khung vẽ ký tên tay (HTML5 Canvas) đón điểm tương tác cảm ứng di động cực tốt, xuất ra Base64 để lưu trữ vào trường 'signature' của hợp một cách trọn vẹn."*

### Giai đoạn 3: Hiện thực hóa Logic Nghiệp vụ Admin & Gộp Nợ Hợp Nhất
> **PROMPT GỬI AI STUDIO:**
> *"Hãy triển khai bộ não xử trị dữ liệu cốt lõi của ứng dụng (Admin Control & Debt Consolidation Logic):
> 1. Tạo giao diện trang quản trị di động (Admin Control Desk) hiển thị các bảng thống kê dòng tiền chi tiết, đồ thị biến thiên lợi tức bằng Recharts mini cực mượt, danh sách người dùng và các hồ sơ vay nợ chờ thẩm duyệt.
> 2. Thiết lập chính xác Logic Gộp Nợ Tự Động (Consolidation): Khi người dùng đang có nợ ở trạng thái 'ĐANG NỢ' mà tiếp tục được duyệt yêu cầu giải ngân khoản mới, hệ thống tự động đổi trạng thái khoản nợ cũ thành 'ĐÃ CỘNG DỒN' và mở một hợp đồng nợ tích hợp gộp mới có mã mã định dạng '[MÃ_USER]-NDV[CYCLE]-GOP'. Số gốc của hợp đồng gộp mới này bảo đảm chứa cả nợ cũ lẫn số tiền mới đăng ký."*

---
*Tài liệu nội bộ NDV Money - Lưu hành nội bộ phục vụ chiến dịch phát triển di động.*
