# Hướng Dẫn Sửa Lỗi Không Push Được Lên GitHub

Chào bạn! Dưới đây là nguyên nhân chi tiết và quy trình khắc phục lỗi không thể push mã nguồn lên GitHub trong môi trường này.

---

## 1. Nguyên Nhân Chính Gây Lỗi

### Nguyên nhân 1: GitHub Push Protection chặn commit chứa mật khẩu/chìa khóa bảo mật
Vì tệp `.env` (chứa `SUPABASE_SERVICE_ROLE_KEY`, `VITE_IMGBB_API_KEY`) và tệp `firebase-service-account.json` (chứa Google Service Account Private Key) trước đó **chưa được khai báo trong `.gitignore`**, chúng sẽ bị Git track và đưa vào commit. 
* **Hậu quả:** GitHub có hệ thống tự động quét và chặn đứng hoàn toàn việc push nếu phát hiện khóa bí mật (Secret). Bạn sẽ nhận được lỗi `[remote rejected] (push declined due to secret scan detection)`.
* **Cách xử lý:** Hệ thống đã được cập nhật tệp `.gitignore` chuẩn ở thư mục gốc để bỏ qua hoàn toàn các tệp nhạy cảm này:
  ```gitignore
  # Environment & Private Keys (Github Push Protection)
  .env
  .env.local
  .env.*.local
  firebase-service-account.json
  config.json
  settings.json
  ```

---

## 2. Các Bước Thực Hiện Để Khởi Tạo Và Push Lên GitHub

Để đẩy phiên bản code sạch (đã loại bỏ tệp bảo mật) lên GitHub mới, bạn hãy làm theo các bước sau bằng cách sử dụng công cụ hoặc chạy mã nguồn:

### Bước 2.1: Tạo Personal Access Token (PAT) trên GitHub
GitHub đã ngưng hỗ trợ mật khẩu tài khoản trực tiếp khi push bằng Git. Bạn cần tạo Token:
1. Truy cập GitHub của bạn -> **Settings** -> **Developer Settings** -> **Personal Access Tokens** -> Chọn **Tokens (classic)**.
2. Nhấp vào **Generate new token (classic)**.
3. Điền mô tả và tích chọn quyền **`repo`** (toàn bộ quyền kiểm soát kho lưu trữ).
4. Nhấp vào **Generate token** ở cuối trang và **sao chép mã token** này lại (Lưu ý: Bạn chỉ nhìn được mã này 1 lần duy nhất).

---

### Bước 2.2: Khởi tạo Git và thực hiện Commit đầu tiên
Để thuận tiện, bạn có thể thực thi đoạn code tự động hoàn thiện cấu hình hoặc chạy trực tiếp trong script:

Chúng tôi đã tích hợp công cụ hỗ trợ cấu hình Git nhanh bằng lệnh `git_helper.ts`. Bạn có thể chạy tệp này để tự động định danh tác giả commit:
```bash
npx tsx git_helper.ts
```

Sau khi chạy xong lệnh trên, bạn tiến hành thêm file và commit dự án sạch (file nhạy cảm sẽ tự động bị bỏ qua nhờ `.gitignore` mới):
```bash
git add .
git commit -m "Initialize project - removed secrets from git tracking"
```

---

### Bước 2.3: Đẩy Code lên GitHub Repo của bạn
Hãy thay thế `<YOUR_TOKEN>`, `<YOUR_USERNAME>`, và `<YOUR_REPO>` bằng thông tin tài khoản của bạn và chạy lệnh sau:

```bash
# Thêm Remote liên kết đến Repo GitHub của bạn
git remote add origin https://<YOUR_TOKEN>@github.com/<YOUR_USERNAME>/<YOUR_REPO>.git

# Nếu bị báo remote origin already exists, bạn chạy lệnh sau để cập nhật URL mới:
git remote set-url origin https://<YOUR_TOKEN>@github.com/<YOUR_USERNAME>/<YOUR_REPO>.git

# Thực hiện Push lên nhánh main (sử dụng cờ -f nếu muốn ghi đè trường hợp Repo mới tạo có file README sẵn)
git push -u origin main -f
```

*(Ví dụ thực tế: `git remote add origin https://ghp_abcdef123456789@github.com/ngondo1296/ndv-money.git`)*

---

## 3. Các Lỗi Thường Gặp Khác

1. **Lỗi `fatal: remote origin already exists`**
   * **Lý do:** Bạn đã thêm remote trước đó.
   * **Giải pháp:** Chạy `git remote remove origin` rồi sau đó chạy lại lệnh `git remote add origin ...` phiên bản có Token của bạn.

2. **Lỗi `Updates were rejected because the remote contains work that you do...`**
   * **Lý do:** Repo trên GitHub của bạn có chứa file sẵn (như README.md hoặc LICENSE) chưa có dưới máy của bạn.
   * **Giải pháp:** Sử dụng cờ `-f` khi push (`git push -u origin main -f`) để ghi đè, hoặc chạy `git pull origin main --rebase` trước khi push.
