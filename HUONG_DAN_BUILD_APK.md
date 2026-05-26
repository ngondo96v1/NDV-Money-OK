# HƯỚNG DẪN BUILD APP ANDROID (.APK)

Tôi đã cấu hình đầy đủ **Capacitor** và **Firebase Push Notifications** trong mã nguồn này. Vì môi trường trình duyệt không thể chạy trực tiếp lệnh build Android (cần Java & Android SDK), bạn hãy làm theo các bước sau để tạo file `.apk`:

### Bước 1: Chuẩn bị Môi trường Máy tính (Local)
1. Tải toàn bộ mã nguồn này về máy (Sử dụng nút **Export** trên AI Studio).
2. Cài đặt **Node.js** và **Android Studio**.
3. Chạy lệnh cài đặt thư viện: `npm install`.

### Bước 2: Build Native Android
Mở terminal tại thư mục gốc và chạy:
```bash
# 1. Build web app
npm run build

# 2. Đồng bộ mã nguồn vào thư mục Android
npx cap sync android

# 3. Mở Android Studio để hoàn tất build
npx cap open android
```

### Bước 3: Xuất file APK trong Android Studio
1. Chờ Android Studio tải xong Gradle (khoảng vài phút).
2. Vào menu: **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
3. Sau khi hoàn tất, nhấn **Locate** để lấy file `app-debug.apk`.

---

## CẤU HÌNH THÔNG BÁO ĐẨY (PUSH NOTIFICATION)

Để thông báo đẩy hoạt động thực tế trên app, bạn cần làm thêm:

1. **Firebase Console**: Truy cập [Firebase Console](https://console.firebase.google.com/).
2. **Thêm App Android**: Khai báo Package Name là `com.ndvmoney.app`.
3. **Tải file google-services.json**: Để vào thư mục `android/app/`.
4. **Cấu hình Secret**:
   - Vào **Project Settings** > **Service Accounts** > **Generate new private key**.
   - Copy nội dung file JSON đó và dán vào biến môi trường `FIREBASE_SERVICE_ACCOUNT_JSON` trong cài đặt AI Studio (hoặc file `.env`).

## TÍNH NĂNG ĐÃ TÍCH HỢP
- **Tự động đăng ký Token**: Khi User đăng nhập trên App Android, Token sẽ tự lưu vào Database.
- **Admin Manual Push**: Trong trang **Quản trị > Hệ thống > Tiện ích**, tôi đã thêm công cụ gửi thông báo thủ công tới toàn bộ máy Android.
- **Thông báo tự động**: Thông báo khi có hợp đồng mới, nợ đến hạn, duyệt tiền...

Nếu bạn gặp khó khăn trong lúc build local, hãy cho tôi biết!
