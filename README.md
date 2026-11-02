# 🏸 Xếp Sân Cầu Lông

Web app chạy trên điện thoại để xếp cặp đánh đôi cho nhóm 4–20 người. Chỉ 1 file `index.html`, không cần server, dữ liệu lưu ngay trên máy (localStorage).

## Tính năng
- **Danh sách người chơi**: thêm nhanh nhiều tên (dán từ Zalo, mỗi dòng 1 tên), tích ✓ người có mặt hôm nay, chấm trình độ 1–5.
- **Xếp sân tự động** theo vòng, 1–5 sân:
  - Ai chơi ít trận hơn được ưu tiên vào sân → số trận đều nhau, không ai nghỉ 2 vòng liền (nếu có thể).
  - Tránh ghép lại cùng đồng đội và hạn chế gặp lại cùng đối thủ.
  - Chế độ **Cân trình**: tổng trình 2 đội gần bằng nhau, 4 người trên sân gần trình nhau. Chế độ **Ngẫu nhiên**: bỏ qua trình độ.
  - Người đến muộn được tính "bù trận" để không bị dồn đánh liên tục.
- **Xem trước các vòng sau** (2–8 vòng, chỉnh trong ⚙️): lịch dự kiến giữ nguyên khi sang vòng mới, tự tính lại nếu có người đến/về, đổi chỗ hoặc đổi cài đặt. Chạm vào tên để xem người đó đánh / nghỉ vòng nào.
- **Sân linh hoạt**: chọn số sân thuê được (1–10), đặt tên sân theo nhà thi đấu (vd: Sân 3, Sân 7). Đang đánh mà có thêm sân trống → **Mở thêm 1 sân** (lấy 4 người đang nghỉ); bị lấy mất sân → chạm tên sân → **Bỏ sân này** (4 người chuyển sang nghỉ, các vòng sau tự xếp lại).
- **Đổi chỗ thủ công**: chạm 2 người để hoán đổi (kể cả người đang nghỉ).
- **Gửi nhóm**: chia sẻ / copy vòng hiện tại hoặc cả lịch dự kiến để dán vào Zalo, Messenger.
- **Ghi & sửa kết quả** (tuỳ chọn): chọn đội thắng hoặc nhập tỉ số, sửa được cả các vòng đã xong (tab Thống kê → Lịch sử → chạm vào trận); bảng xếp hạng tính thắng + hiệu số (HS) và **thống kê**: số trận, thắng, nghỉ; lịch sử các vòng.

- **Phòng online** (tuỳ chọn): mỗi nhóm tạo 1 phòng có **mật khẩu xem** và **mã quản lý**. Cả nhóm mở link mời là thấy lịch, cập nhật trực tiếp; chỉ người có mã quản lý mới được xếp sân / sửa. Nhiều nhóm dùng chung 1 trang, dữ liệu tách riêng.
- **Sảnh phòng**: khi bật phòng online, mở web sẽ thấy ngay danh sách **phòng hiện có** (tìm theo tên / mã), nút **Tạo phòng** và **Nhập mã**. Chạm 1 phòng → nhập mật khẩu để vào. Phòng đã vào được lưu ở mục *Phòng của bạn*, lần sau chạm là vào luôn. Vẫn có thể chọn *Dùng trên máy này* để dùng không cần phòng.
- **Xoá phòng**: người quản lý vào ☁️ Phòng → **Xoá phòng** (gõ lại mã phòng để xác nhận). Dữ liệu bị xoá vĩnh viễn, mọi người đang xem được đưa về danh sách phòng.

## Cách dùng
1. Tab **Người chơi**: thêm tên, tích người có mặt, chọn trình độ.
2. Tab **Xếp sân**: chọn số sân, bấm **Xếp vòng 1**. Không ưng thì bấm **Xếp lại**.
3. Đánh xong bấm **Vòng tiếp** để sang vòng mới.
4. Hết buổi: tab **Thống kê** → **Bắt đầu buổi mới**.

## Đưa lên mạng (miễn phí) với GitHub Pages
Repo → **Settings → Pages** → Source: *Deploy from a branch* → chọn branch, thư mục `/ (root)` → Save.
Sau 1–2 phút mở `https://<tên-github>.github.io/badminton_tool/` trên điện thoại, chọn **Thêm vào màn hình chính** để dùng như app.

## Bật phòng online (miễn phí với Firebase)

Không bật thì app vẫn chạy bình thường, dữ liệu chỉ lưu trên 1 máy. Làm 1 lần (~10 phút):

1. Vào https://console.firebase.google.com → **Create project** (có thể tắt Google Analytics). Gói **Spark** miễn phí, không cần thẻ.
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
3. **Build → Realtime Database → Create database** → chọn vùng **Singapore (asia-southeast1)** → **Start in locked mode**.
4. Trong Realtime Database, mở tab **Rules**, xoá hết rồi dán nội dung file [`database.rules.json`](database.rules.json) → **Publish**. *(Bắt buộc — đây là phần bảo mật mật khẩu và quyền quản lý.)*
5. **Project settings (⚙️) → Your apps → biểu tượng `</>`** → đặt tên app → **Register**. Copy đoạn `firebaseConfig`.
6. Mở file [`config.js`](config.js), thay `window.FIREBASE_CONFIG = null;` bằng config vừa copy (nhớ có dòng `databaseURL`). Commit & push.
7. Mở trang → màn hình danh sách phòng → **Tạo phòng**.

> Đã dán Rules từ bản cũ? Hãy dán lại **toàn bộ** nội dung mới của `database.rules.json` và **Publish** — bản mới cho phép xem danh sách phòng và xoá phòng. Phòng tạo bằng bản cũ không xoá được trong app, hãy xoá trong Firebase Console (tab Data).

### Bảo mật hoạt động thế nào
- Danh sách phòng (chỉ gồm **tên nhóm, mã phòng, ngày tạo**) là công khai để mọi người tìm phòng.
- Dữ liệu mỗi phòng (người chơi, lịch, kết quả) nằm ở địa chỉ là mã băm SHA-256 của *(mã phòng + mật khẩu)* — không biết mật khẩu thì không tìm được.
- Chỉ thiết bị đã nhập đúng **mã quản lý** mới được ghi; quy tắc này do máy chủ Firebase kiểm tra (file `database.rules.json`), không thể vượt qua bằng cách sửa code trên trình duyệt.
- Link mời chứa khoá xem (không chứa mật khẩu gốc), ai có link là xem được — chỉ gửi trong nhóm.
- Hãy dùng mật khẩu không quá dễ đoán. Mật khẩu và mã quản lý **không đổi được và không khôi phục được** — quên thì tạo phòng mới.

### Giới hạn gói miễn phí
Khoảng 100 người mở cùng lúc, 1 GB lưu trữ, 10 GB tải/tháng — dư sức cho nhiều nhóm 4–20 người.

### Thử trên máy với trình giả lập (cho lập trình viên)
```bash
npx firebase-tools emulators:start --only auth,database --project demo-badminton
```
Rules trong `database.rules.json` được nạp tự động cho database `demo-badminton-default-rtdb`.
