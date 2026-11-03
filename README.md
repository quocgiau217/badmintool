# 🏸🏓 Xếp Sân · Cầu lông & Pickleball

Web app chạy trên điện thoại để xếp cặp đánh đôi **cầu lông** hoặc **pickleball** cho nhóm 4–20 người. Web tĩnh, không cần server, dữ liệu lưu ngay trên máy (localStorage).

## Tính năng

**Xếp sân**
- **2 môn: Cầu lông và Pickleball** — mỗi phòng chọn 1 môn; đổi theo môn: màu sân (pickleball xanh dương, có vùng bếp), nút điểm nhanh (21 / 11), tông màu giao diện, tin nhắn gửi nhóm.
- **Đánh đôi hoặc đánh đơn.**
- **Xếp tự động**: ai ít trận được ưu tiên, không ai nghỉ 2 vòng liền (khi có thể), tránh trùng đồng đội / đối thủ; chế độ **Cân trình** (tổng trình 2 đội bằng nhau) hoặc **Ngẫu nhiên**; người đến muộn được bù trận.
- **2 cách luân phiên**: **Theo vòng** (các sân đổi người cùng lúc, có lịch dự kiến 2–8 vòng) hoặc **Xếp hàng** (sân nào xong thì 4 người đầu hàng vào ngay, người vừa đánh xuống cuối hàng).
- **Sân linh hoạt**: 1–10 sân, đặt tên theo nhà thi đấu, mở thêm / bỏ sân ngay giữa vòng; **đồng hồ** đếm thời gian từng sân.
- **Đổi chỗ thủ công**, **ghi tỉ số**, sửa kết quả cả các vòng đã xong.
- **Giải đấu nhỏ**: vòng tròn (bảng xếp hạng) hoặc loại trực tiếp (nhánh đấu, hạt giống, miễn đấu, **tranh hạng 3**, bục trao giải); tự chia đội cân trình; **lịch theo giờ và sân** (giờ bắt đầu, phút/trận, số sân — không đội nào đánh 2 trận cùng lúc).
- **Hoàn tác**: bấm nhầm *Xong vòng*, *Xong sân*, *Xếp lại*, *Bắt đầu buổi mới*… có 10 giây để bấm **Hoàn tác**.
- **Gửi nhóm**: dạng **ảnh** (vòng hiện tại + lịch dự kiến, hoặc sân & hàng chờ) hoặc dạng chữ cho Zalo, Messenger.

**Người chơi & thống kê**
- Thêm nhanh nhiều tên (dán từ Zalo), tích người có mặt, trình độ 1–5.
- **Trình độ tự cập nhật** (tuỳ chọn, kiểu Elo): thắng tăng, thua giảm, thắng đậm tăng nhiều hơn; cân đội theo điểm này.
- **Thống kê** Buổi này / Tháng này / Tất cả (mỗi buổi được lưu tổng kết khi bắt đầu buổi mới), bảng xếp hạng, **cặp đồng đội ăn ý nhất**.

**Tiền**
- Tab **Tiền**: nhập khoản chi (gõ 200k, 1.2tr…), chia đều hoặc theo số trận, làm tròn 1.000đ, miễn tiền cho chủ sân / khách, đánh dấu ai đã trả.
- Nhập tài khoản ngân hàng → mỗi người chạm tên là có **mã QR VietQR** đúng số tiền của mình. Gửi bảng tiền vào nhóm.

**Phòng online** (tuỳ chọn, Firebase miễn phí)
- **Sảnh phòng**: mở web là thấy danh sách phòng (lọc theo môn, tìm theo tên), tạo phòng / nhập mã; phòng đã vào nằm ở *Phòng của bạn*.
- Mỗi phòng có **mật khẩu xem** và **mã quản lý**; cả nhóm xem trực tiếp, chỉ quản lý được sửa.
- **Xin vào danh sách**: người mới bấm *Xin thêm tên*, quản lý bấm *Thêm* là máy người đó tự nhận tên.
- **Tự điểm danh**: người chơi chọn "Tôi là…", bấm *Tôi có mặt / Tôi về*; được **báo khi tới lượt** vào sân (rung + thông báo).
- **Quản lý chính / phụ**: cấp **mã phụ** cho người giúp xếp sân (không đổi được cài đặt phòng), thu hồi bất cứ lúc nào.
- Quản lý chính: **đổi tên phòng, đổi mật khẩu xem, đổi mã quản lý** (thu hồi mọi máy khác), **xoá phòng**.
- **Gộp thay đổi**: 2 người quản lý sửa cùng lúc, hoặc sửa lúc mất mạng, đều được gộp (người chơi, kết quả, tiền, kết quả giải); chỉ khi cả hai sửa cùng một chỗ mới giữ bản trên phòng và báo số chỗ trùng.
- **Dùng được khi mất mạng** ở sân: app mở bằng bản đã lưu, phòng đã vào vẫn mở được; có mạng lại tự đồng bộ.

## Cách dùng
1. Tab **Người chơi**: thêm tên, tích người có mặt, chọn trình độ.
2. Tab **Xếp sân**: chọn số sân, bấm **Xếp vòng 1**. Không ưng thì bấm **Xếp lại**.
3. Đánh xong bấm **Vòng tiếp** để sang vòng mới.
4. Hết buổi: tab **Tiền** để thu tiền, rồi tab **Thống kê** → **Bắt đầu buổi mới** (tổng kết buổi được lưu lại).

## Đưa lên mạng (miễn phí) với GitHub Pages
Repo → **Settings → Pages** → Source: *Deploy from a branch* → chọn branch, thư mục `/ (root)` → Save.
Sau 1–2 phút mở `https://<tên-github>.github.io/badmintool/` trên điện thoại, chọn **Thêm vào màn hình chính** để dùng như app.

## Bật phòng online (miễn phí với Firebase)

Không bật thì app vẫn chạy bình thường, dữ liệu chỉ lưu trên 1 máy. Làm 1 lần (~10 phút):

1. Vào https://console.firebase.google.com → **Create project** (có thể tắt Google Analytics). Gói **Spark** miễn phí, không cần thẻ.
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
3. **Build → Realtime Database → Create database** → chọn vùng **Singapore (asia-southeast1)** → **Start in locked mode**.
4. Trong Realtime Database, mở tab **Rules**, xoá hết rồi dán nội dung file [`database.rules.json`](database.rules.json) → **Publish**. *(Bắt buộc — đây là phần bảo mật mật khẩu và quyền quản lý.)*
5. **Project settings (⚙️) → Your apps → biểu tượng `</>`** → đặt tên app → **Register**. Copy đoạn `firebaseConfig`.
6. Mở file [`config.js`](config.js), thay `window.FIREBASE_CONFIG = null;` bằng config vừa copy (nhớ có dòng `databaseURL`). Commit & push.
7. Mở trang → màn hình danh sách phòng → **Tạo phòng**.

> Đã dán Rules từ bản cũ? Hãy dán lại **toàn bộ** nội dung mới của `database.rules.json` và **Publish** — bản mới cho phép xem danh sách phòng, xoá phòng và đổi môn của phòng. Phòng tạo bằng bản cũ không xoá được trong app, hãy xoá trong Firebase Console (tab Data).

### Bảo mật hoạt động thế nào
- Danh sách phòng (chỉ gồm **tên nhóm, mã phòng, môn, ngày tạo**) là công khai để mọi người tìm phòng.
- Ai có link phòng chỉ ghi được **trạng thái điểm danh** của từng người; mọi thay đổi khác cần mã quản lý. Quản lý phụ chỉ sửa được dữ liệu buổi chơi; cài đặt phòng (tên, mật khẩu, mã, mã phụ, xoá phòng) chỉ quản lý chính làm được — đều do Rules kiểm tra ở máy chủ.
- Dữ liệu nhận về luôn được kiểm tra / lọc trước khi hiển thị.
- Dữ liệu mỗi phòng (người chơi, lịch, kết quả) nằm ở địa chỉ là mã băm SHA-256 của *(mã phòng + mật khẩu)* — không biết mật khẩu thì không tìm được.
- Chỉ thiết bị đã nhập đúng **mã quản lý** mới được ghi; quy tắc này do máy chủ Firebase kiểm tra (file `database.rules.json`), không thể vượt qua bằng cách sửa code trên trình duyệt.
- Link mời chứa khoá xem (không chứa mật khẩu gốc), ai có link là xem được — chỉ gửi trong nhóm.
- Hãy dùng mật khẩu không quá dễ đoán. Mật khẩu và mã quản lý **đổi được** (☁️ Phòng → Đổi mật khẩu / Đổi mã QL, cần nhập mã quản lý hiện tại) nhưng **không khôi phục được** nếu quên mã quản lý — khi đó tạo phòng mới.

### Giới hạn gói miễn phí
Khoảng 100 người mở cùng lúc, 1 GB lưu trữ, 10 GB tải/tháng — dư sức cho nhiều nhóm 4–20 người.

### Cấu trúc code (cho lập trình viên)
Web tĩnh, không cần build: `index.html` nạp `css/app.css`, `css/icons.css` (bộ icon SVG) và các file trong `js/` theo thứ tự; `sw.js` cho phép dùng khi mất mạng:

| File | Nội dung |
|---|---|
| `js/state.js` | Dữ liệu, lưu trên máy, kiểm tra & chuẩn hoá dữ liệu, thống kê |
| `js/algo.js` | Thuật toán xếp sân (đôi/đơn), lịch dự kiến, xếp hàng, thêm/bỏ sân |
| `js/rating.js` | Trình độ tự động (Elo), lưu tổng kết buổi, thống kê nhiều buổi |
| `js/actions.js` | Thao tác: thêm người, xong vòng, ghi kết quả, đổi chỗ… |
| `js/ui.js` | Tiện ích giao diện, môn chơi, cài đặt |
| `js/money.js` | Chia tiền, mã QR VietQR |
| `js/me.js` | "Tôi là ai", tự điểm danh, báo tới lượt |
| `js/tour.js` | Giải đấu vòng tròn / loại trực tiếp |
| `js/shareimg.js` | Vẽ lịch thành ảnh để gửi nhóm |
| `js/undo.js` | Hoàn tác |
| `js/merge.js` | Gộp 3 chiều (gốc / trên máy / máy chủ) |
| `js/cloud.js` | Phòng online (Firebase), đồng bộ có phiên bản, sảnh phòng |
| `js/roomadmin.js` | Đổi tên / mật khẩu / mã quản lý, mã quản lý phụ |
| `js/views.js` | Vẽ các màn hình |
| `js/main.js` | Khởi động (nạp cuối) |

Chạy test thuật toán (cần Node 18+, không cần cài gì thêm):
```bash
npm test
```

### Thử trên máy với trình giả lập (cho lập trình viên)
```bash
npx firebase-tools emulators:start --only auth,database --project demo-badminton
```
Rules trong `database.rules.json` được nạp tự động cho database `demo-badminton-default-rtdb`.
