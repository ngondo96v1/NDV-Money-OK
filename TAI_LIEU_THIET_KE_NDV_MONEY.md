# TÀI LIỆU KHẢO SÁT & ĐẶC TẢ HỆ THỐNG NDV MONEY (VNV LOAN)
## DÀNH RIÊNG CHO SỰ PHÁT TRIỂN & TÁI TẠO ỨNG DỤNG ANDROID PHẲNG NATIVE

Tài liệu này tổng hợp toàn bộ cấu trúc cơ sở dữ liệu, logic luồng nghiệp vụ, giao diện người dùng và cơ chế thanh toán tự động nâng cao của hệ thống **NDV Money** hiện tại. Bạn có thể sao chép toàn bộ nội dung tài liệu này và cung cấp trực tiếp vào ô chat của các hệ thống AI để tái tạo ứng dụng Android hoàn hảo 100% giống ứng dụng gốc cực kỳ nhanh chóng.

---

## I. MỤC TIÊU & TÍNH CHẤT ỨNG DỤNG
*   **Tên ứng dụng:** NDV Money (Hệ thống xác thực tài chính & Quản lý dư nợ tiêu dùng nhanh).
*   **Màu sắc chủ đạo:** Cosmic Dark UI (Nền đen sẫm hoặc xám cực sâu `#0D0E12`, chữ trắng, điểm nhấn là màu vàng hổ phách tươi sáng `#F59E0B` hoặc cam rực rỡ, mang phong cách ứng dụng tài chính ngân hàng tối tân và bảo mật cao).
*   **Phân quyền hệ thống:** Có 2 vai trò chính:
    1.  **Khách hàng (User):** Đăng ký, đăng nhập, nạp hồ sơ KYC đầy đủ, ký hợp đồng điện tử trực tiếp bằng màn hình cảm ứng (Canvas Draw), gửi yêu cầu vay tiền, gia hạn khoản vay bằng PayOS hoặc chuyển khoản tay, nâng cấp Rank VIP/Hạn mức bằng bill chuyển khoản hoặc tự động qua cổng PayOS.
    2.  **Quản trị viên (Admin):** Quản lý dòng ngân sách trực tuyến, xem lịch sử thu chi chi tiết (Budget logs), duyệt hồ sơ KYC/vào hạn mức, phê duyệt giải ngân, điều chỉnh thủ công nợ, quản lý khóa/mở khóa tài khoản, cấu hình toàn bộ tham số hệ thống không cần sửa code.

---

## II. THÔNG SỐ CẤU HÌNH HỆ THỐNG (SETTINGS)
Toàn bộ hệ thống được vận hành động qua các tham số mà Admin có thể sửa đổi trong trang Quản Trị:
1.  **PRE_DISBURSEMENT_FEE (15%):** Phí xử lý hồ sơ và giải ngân. Khoản phí này được trừ thẳng vào số tiền khách nhận thực tế hoặc cộng dồn chu kỳ nợ tùy cấu hình.
2.  **INITIAL_LIMIT (Hạn mức cơ sở ban đầu):** Thường là `2,000,000 đ` cho tài khoản ban đầu khi chưa kiểm duyệt sâu.
3.  **MAX_LOAN_PER_CYCLE (1):** Tối đa số khoản vay đang có nợ cùng thời điểm (tránh nợ xấu chồng chéo).
4.  **FINE_RATE (Phí phạt quá hạn):** Lãi suất phạt quá hạn theo ngày tính trên tổng dư nợ gốc.
5.  **ENABLE_PAYOS (Bật/Tắt PayOS):** Cấu hình cổng thanh toán tự động PayOS để thanh toán dư nợ, gia hạn nợ hoặc thanh toán phí nâng hạng VIP tự động gạch nợ 24/7.
6.  **ZALO_GROUP_LINK:** Đường dẫn nút Hỗ trợ khách hàng qua Zalo hoặc Hotline CSKH.
7.  **RANK_CONFIG:** Bảng cấu hình cấp bậc khách hàng (Standard, Bronze, Silver, Gold, Diamond) tương ứng với từng khoảng hạn mức cho phép và quyền lợi đặc trưng.

---

## III. CHI TIẾT CƠ SỞ DỮ LIỆU CHUẨN (SUPABASE / FIRESTORE SCHEMA)

### 1. Bảng `users` (Quản lý khách hàng)
*   `id`: Chuỗi định danh hoặc Số thứ tự định dạng đặc thù (VD: "2690").
*   `phone`: Số điện thoại đăng nhập (Zalo).
*   `fullName`: Họ và tên khách hàng (In hoa không dấu).
*   `idNumber`: Số CCCD/CMND.
*   `password`: Mật khẩu băm an toàn.
*   `balance`: Hạn mức vay khả dụng hiện tại (Ví dụ: `5,000,000 đ`).
*   `totalLimit`: Tổng hạn mức tín dụng được duyệt cấp tối đa (Ví dụ: `20,000,000 đ`).
*   `rank`: Cấp bậc hiện tại (`standard`, `bronze`, `silver`, `gold`, `diamond`).
*   `pendingUpgradeRank`: Cấp bậc đang chờ phê duyệt nâng hạng (khi người dùng thanh toán/gửi bill nâng VIP thủ công).
*   `rankUpgradeBill`: Ảnh biên lai chuyển khoản phí nâng hạng (nếu chọn hình thức thủ công).
*   `isLocked`: Trạng thái khóa tài khoản (`true` / `false`).
*   `lockedReason`: Lý do khóa hiển thị trực tiếp cho người dùng.
*   `bankName`, `bankAccountNumber`, `bankAccountHolder`, `bankBin`: Thông tin tài khoản nhận tiền đã kiểm thực (Admin đối chiếu khi giải ngân).
*   `idFront`, `idBack`: Ảnh hai mặt CCCD phục vụ định danh KYC.
*   `refZalo`, `relationship`: Số Zalo người thân và quan hệ nhân thân để liên hệ đối soát tín dụng khẩn cấp.
*   `spins`: Số lượt quay may mắn được tặng mỗi khi thanh toán đúng hạn.

### 2. Bảng `loans` (Quản lý khoản vay & Dư nợ)
*   `id`: Mã hợp đồng vay duy nhất (Format động: `[ID_Người_Dùng] [Ký_Hiệu_Chu_Kỳ]`, ví dụ: `6745 NDV2` - Người dùng 6745, chu kỳ vay đợt 2).
*   `userId`: Định danh người vay.
*   `userName`: Họ tên người vay.
*   `amount`: Số tiền giải ngân gốc (Số tiền đăng ký vay).
*   `date`: Ngày tạo khoản vay hoặc ngày ký kết nợ định dạng chuẩn `DD/MM/YYYY`.
*   `status`: Quản lý chặt chẽ theo các trạng thái sau:
    *   `CHỜ DUYỆT`: Khách đã gửi yêu cầu, đang đợi Admin thẩm định.
    *   `ĐANG GIẢI NGÂN`: Hợp đồng được phê duyệt, chuyển sang phòng ban giải ngân tiền mặt.
    *   `ĐANG NỢ`: Giải ngân thành công, khách đang ôm dư nợ cần thanh toán.
    *   `QUÁ HẠN`: Khoản vay quá hạn thanh toán quy định, hệ thống tự động/Admin tính phí phạt.
    *   `CHỜ TẤT TOÁN`: Người dùng bấm tất toán thủ công tải bill chuyển khoản lên đợi duyệt.
    *   `ĐANG ĐỐI SOÁT`: Hệ thống đang trong quy trình rà soát giao dịch ngân hàng khớp lệnh.
    *   `ĐÃ TẤT TOÁN`: Hợp đồng hoàn thành xuất sắc, dư nợ trở về 0, khôi phục lại hạn mức tài khoản.
    *   `ĐÃ CỘNG DỒN`: Đại diện hợp đồng nợ cũ đã được hệ thống nhập gốc + lãi dồn tích trực tiếp sang hợp đồng hợp cộng mới.
    *   `BỊ TỪ CHỐI` / `ĐÃ HỦY`: Yêu cầu vay không hợp lệ bị bãi bỏ.
*   `signature`: Ảnh nét vẽ chữ ký của khách hàng (Lưu dạng URL ảnh Base64/ImgBB).
*   `loanPurpose`: Lý do vay (ví dụ: Tiêu dùng cá nhân, Kinh doanh nhỏ).
*   `fine`: Số tiền phạt quá hạn tích lũy (VND).
*   `partialAmount`: Số tiền gốc khách hàng đã thanh toán một phần (để giảm trừ dư nợ gốc trực tiếp).

### 3. Bảng `budget_logs` (Quản lý dòng tiền ngân sách Admin)
Lưu trữ nhật ký thu/chi thực tế của hệ thống để phân tích dòng lời lỗ:
*   `id`: Khóa chính ngẫu nhiên.
*   `type`: Loại nghiệp vụ tài chính (`INITIAL` - Khởi tạo, `ADD` - Bơm quỹ, `WITHDRAW` - Rút quỹ tiêu dùng, `LOAN_DISBURSE` - Chi giải ngân, `LOAN_REPAY` - Thu hồi nợ/Gia hạn nợ).
*   `amount`: Số tiền giao dịch phát sinh.
*   `balanceAfter`: Số dư quỹ hệ thống sau khi áp dụng giao dịch.
*   `note`: Nội dung giải trình chi tiết giao dịch (ví dụ: *"Giải ngân khoản vay 6745 NDV2 cho HUYNH NGOC TUAN"*).
*   `createdAt`: Thời điểm diễn ra giao nghiệp dưới múi giờ chuẩn.

---

## IV. LOGIC NGHIỆP VỤ ĐẶC THÙ & QUY TẮC CẮT NỢ (BUSINESS LOGIC)

### 1. Phép cộng dồn nợ tự động (Loan Consolidation)
Một trong những logic đặc thù và cốt lõi nhất của hệ thống NDV Money:
*   **Tình huống:** Người dùng đang có một khoản vay ở trạng thái `ĐANG NỢ` (VD: mã `6745 NDV2` trị giá `10,000,000 đ`) nhưng muốn vay thêm một khoản mới trị giá `5,000,000 đ`.
*   **Quy trình hợp nhất:** Khi Admin phê duyệt yêu cầu vay mới:
    *   Hợp đồng nợ cũ sẽ chuyển trạng thái từ `ĐANG NỢ` sang `ĐÃ CỘNG DỒN` (Mục đích: Không cho hiển thị ở phần nợ thanh toán trực tiếp của khách để tránh nhầm lẫn, nhưng vẫn lưu lịch sử).
    *   Một hợp đồng nợ mới sẽ tự động được sinh ra với mã con là `6745 NDV4-GOP` (Hợp đồng cộng dồn nợ) gộp cả dư nợ cũ và sáp nhập nợ mới (Tổng dư nợ mới ví dụ: `15,000,000 đ`).
    *   Mọi thông số thanh toán, lịch sử gia hạn, hay mức phí phạt sau này sẽ liên kết trực tiếp ứng xử với thực thể nợ gộp mới này.

### 2. Logic thanh toán & gia hạn tự động qua PayOS
*   Hệ thống tích hợp thư viện của PayOS để tạo QRCode thanh toán chuẩn VietQR:
    *   **Tất toán toàn bộ (Full Settlement):** Tạo mã QRCode tương ứng trị giá tổng nợ (Gốc + Phạt). Khi webhook PayOS phản hồi `Thành công`, trạng thái khoản vay sẽ tự động chuyển sang `ĐÃ TẤT TOÁN`, giải phóng hạn mức cho User.
    *   **Gia hạn khoản vay (Loan Extension):** Người dùng muốn tạm hoãn ngày trả nợ bằng cách đóng phí gia hạn (Ví dụ đóng `600,000 đ`). PayOS sinh mã quét QR riêng, khi thanh toán thành công, hạn trả nợ tức thì kéo dài thêm 1 chu kỳ, tạo bản ghi log gia hạn tự động.
    *   **Thanh toán một phần (Partial Repayment):** Khách hàng đóng một khoản tiền tùy ý lớn hơn mức quy định. Cổng thanh toán trừ thẳng vào số nợ gốc thực tế, tính toán lại % lãi cho chu kỳ tiếp theo dựa trên số tiền còn lại sau giảm trừ.

---

## V. CƠ CẤU GIAO DIỆN PHẲNG (UI/UX) CHO PHẦN CỨNG DI ĐỘNG

### 1. Phân luồng User (Mobile Client)
*   **Màn hình Đăng nhập (Login):**
    *   Phần header hiển thị logo NDV Money rực rỡ với dòng chữ hiệu suất cực cao: "HỆ THỐNG XÁC THỰC LỚP VIÊN V1.26".
    *   Ô nhập số điện thoại (Hệ thống liên kết trực quan Zalo).
    *   Ô nhập mật khẩu có nút hiển thị/ẩn mật khẩu bằng Icon con mắt tinh tế.
    *   Thông báo lỗi trực quan ngay dưới nút bấm nếu sai mật khẩu hoặc tài khoản đang bị khóa tạm thời.
*   **Màn hình Đăng ký (Register):**
    *   Đăng ký nhanh với Họ tên, Số điện thoại, và thiết lập Mật khẩu. Khi đăng ký xong sẽ chuyển tiếp đến màn hình nạp hồ sơ định danh KYC đầy đủ.
*   **Màn hình Trang chủ (Dashboard):**
    *   Vòng tròn động (Circle Progress) hiển thị tỷ trọng: "Hạn mức khả dụng / Tổng hạn mức được cấp".
    *   Banner hiển thị thông báo nghiệp vụ khẩn cập chạy ngang (Marquee text) từ quản trị viên.
    *   Khu vực chức năng bento grid:
        *   Nút **ĐĂNG KÝ VAY**: Gửi yêu cầu vay mới nếu chưa có dư nợ hoặc muốn yêu cầu nợ gộp.
        *   Nút **VÒNG QUAY MAY MẮN (Lucky Spin)**: Sử dụng lượt quay thưởng để kiếm Voucher giảm trừ phí đóng nợ.
        *   Nút **NÂNG VIP / RANK**: Gửi hồ sơ nâng hạn mức để nâng cấp tối ưu quyền lợi tiêu dùng.
        *   Khung Hợp đồng / Lịch sử nợ: Liệt kê chi tiết toàn bộ các hợp đồng cũ, ngày giải ngân, trạng thái khoản vay thời gian thực rất rõ ràng kèm mã QR đóng tiền tức thì.
*   **Màn hình Đăng ký khoản vay & Ký hợp đồng điện tử (Apply Loan):**
    *   Thanh trượt chọn số tiền đăng ký vay trực quan (Tiền nhảy sinh động kèm chữ bằng tiếng Việt, ví dụ: `5.000.000 đ` -> Năm triệu đồng chẵn).
    *   Khung hiển thị điều khoản hợp đồng tín dụng bảo mật tuyệt đối.
    *   **Khung canvas vẽ chữ ký tay:** Khách hàng bắt buộc phải dùng ngón tay ký trực tiếp lên vùng canvas để ghi dấu hợp đồng điện tử trước khi gửi yêu cầu lên máy chủ.

### 2. Phân luồng Admin (Mobile Admin View)
Để thuận tiện cho Admin dùng trên điện thoại di động:
*   **Trang tổng quan ngân sách:**
    *   Thống kê 6 chỉ số lớn dạng thẻ card lơ lửng: **Gốc ngân sách hiện có, Lợi nhuận giải ngân tổng, Tổng thu tiền phạt, Lợi nhuận thu phí nâng VIP, Dự nợ đang hoạt động ngoài hệ thống, Số lượng khách nợ**.
    *   Đồ thị biểu diễn phân bổ chi tiêu hàng tháng (Dùng biểu đồ D3 / Recharts thu nhỏ tương thích tốt trên mobile).
*   **Trang Danh Sách Người Dùng (Admin Users):**
    *   Có thanh tìm kiếm nhanh theo số điện thoại hoặc Tên.
    *   Có bộ nút lọc nhanh trạng thái tài khoản: Đang nợ, Đang rảnh, Bị khóa.
    *   Có nút bấm hành động khẩn cấp: Khóa / Mở khóa tài khoản vĩnh viễn, Nâng/Hạ thứ hạng VIP thủ công, Điều chỉnh hạn mức sử dụng theo từng cá nhân bất kỳ.
*   **Trang Danh Sách Khoản Vay (Admin Loans):**
    *   Nơi hiển thị toàn bộ hồ sơ đang chờ xét duyệt. admin có thể nhấn vào xem thông tin tài khoản ngân hàng của khách, hình ảnh CCCD sắc nét, chữ ký tay điện tử.
    *   Hai nút lựa chọn chính: **TỪ CHỐI** (yêu cầu điền lý do rõ ràng gửi về thông báo của user) hoặc **PHÊ DUYỆT** (Tự động tính phí dịch vụ 15%, trừ tiền từ ngân sách hệ thống, tạo nợ mới và gửi thông báo về máy khách hàng).

---

## VI. BẢN SAO CHO TRÌNH TẠO ỨNG DỤNG ANDROID NATIVE CỦA AI STUDIO
*(Hãy Copy toàn bộ đoạn lệnh/hướng dẫn chi tiết dưới đây bỏ vào phiên AI Studio Android của bạn)*

> **Yêu cầu xây dựng ứng dụng:**
> Xây dựng một ứng dụng tài chính cá nhân chạy trên Android (sử dụng Kotlin / Jetpack Compose hoặc React Native / Capacitor tùy biến nền tảng di động) theo phong cách thiết kế Cosmic Dark UI siêu sang trọng.
>
> **1. Yêu cầu giao diện (UI):**
> * Toàn bộ ứng dụng sử dụng theme tối sâu `#0D0E12`, các chữ viết và nhãn tuân thủ độ tương phản tuyệt đối cao để tránh mỏi mắt. Cạnh các thẻ bo góc mịn màng, phủ bóng viền hổ phách mờ rất cao cấp.
> * Trang chủ của người dùng có biểu đồ tiến trình hình tròn (Hạn mức còn lại / Tổng hạn mức). Có các nút thao tác lưới bao gồm: Đăng ký vay nhanh, Nâng cấp Rank thành viên VIP bằng cách quét VietQR tự động, Vòng quay may mắn (Lucky Spin) trúng voucher và nút hỗ trợ trực tuyến kết nối Zalo.
> * Form đăng ký khoản vay bắt buộc tích hợp **khung canvas vẽ ký tên thủ công** của khách hàng và tính năng tải lên ảnh gốc thẻ hai mặt CCCD hỗ trợ chụp trực tiếp từ camera.
>
> **2. Logical dữ liệu đặc thù:**
> * Cấu hình đầy đủ quyền hạn Khách hàng và Admin điều hành toàn quyền.
> * Áp dụng cơ chế **Cộng dồn dư nợ giải ngân (Consolidation)**: Khi Admin đồng ý giải ngân khoản vay mới của người dùng đang có nợ, chuyển trạng thái khoản nợ cũ thành `ĐÃ CỘNG DỒN` để ẩn khỏi danh tác nợ hiện hữu và sinh ra hợp đồng nợ tích hợp gộp mới của cả gốc lẫn nợ mới có mã `[ID]-GOP`.
> * Tích hợp webhook tự động hoặc liên kết PayOS thanh toán hóa đơn gốc/phí gia hạn hoặc phí nâng Rank VIP cập nhật trạng thái cơ sở dữ liệu thời gian thực không độ trễ.
