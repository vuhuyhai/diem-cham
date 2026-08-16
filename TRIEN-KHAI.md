# Triển khai ĐIỂM CHẠM — làm đúng thứ tự

Làm y như app SỨC BẬT. Sáu bước, khoảng 15 phút.

---

## Bước 1. Đưa mã lên GitHub

**Đã xong.** Repo: https://github.com/vuhuyhai/diem-cham

Về sau muốn đẩy thay đổi lên thì đứng trong thư mục `diem-cham-deploy` và gõ:

```bash
git add -A && git commit -m "Cập nhật" && git push
```

---

## Bước 2. Nối Netlify

1. Vào https://app.netlify.com → **Add new site** → **Import an existing project** → **GitHub**
   → chọn repo `diem-cham`.
2. Màn hình cấu hình build, Netlify tự đọc `netlify.toml` nên thường điền sẵn. Kiểm lại cho đúng:
   - **Build command**: để trống
   - **Publish directory**: `diem-cham-app`
   - **Functions directory**: `netlify/functions`
3. Bấm **Deploy**.

---

## Bước 3. Đổi tên miền thành diem-cham

Site settings → **Domain management** → **Options** → **Edit site name** → gõ `diem-cham`.

Địa chỉ thành **https://diem-cham.netlify.app**. Tên này đã được viết cứng trong
`index.html` (canonical, Open Graph), `robots.txt`, `sitemap.xml` và `thu-thap.js`, nên đặt
đúng tên là mọi thứ khớp. Nếu buộc phải dùng tên khác, tìm và thay hết chuỗi
`diem-cham.netlify.app` trong bốn file đó.

---

## Bước 4. Thêm khóa API

Site settings → **Environment variables** → **Add a variable**:

- Key: `ANTHROPIC_API_KEY`
- Value: khóa của anh, lấy ở https://console.anthropic.com
- Scopes: để mặc định (tất cả)

Xong bấm **Deploys** → **Trigger deploy** → **Clear cache and deploy site** để hàm nhận khóa mới.

Khóa chỉ nằm ở Netlify. GitHub không cần biết, vì bộ quét gọi hàm trên Netlify chứ không gọi
thẳng Anthropic.

---

## Bước 5. Bật quyền ghi cho GitHub Actions

Vào repo trên GitHub → **Settings** → **Actions** → **General** → kéo xuống mục
**Workflow permissions** → chọn **Read and write permissions** → **Save**.

Không bật cái này thì workflow quét được tin nhưng không commit ngược về repo được.

---

## Bước 6. Chạy thử và kiểm

Vào repo → tab **Actions** → chọn workflow **Quét tin Service Marketing hằng ngày** →
**Run workflow** → **Run workflow**.

Chạy mất khoảng 5 tới 8 phút (phần lớn là thời gian nghỉ để né chặn tốc độ của Reddit).
Xong thì mở https://diem-cham.netlify.app và kiểm ba việc:

1. Dòng trạng thái trên cùng chuyển sang xanh: **Dữ liệu tự động · cập nhật lúc …**
2. Mỗi thẻ bài có ô **Tóm tắt tiếng Việt** và dòng **Góc nhìn ứng dụng**.
   Nếu vẫn thấy câu "Bản dịch tiếng Việt sẽ có sau lần chạy phân tích tới" thì khóa API chưa
   nhận, quay lại bước 4.
3. Vào tab **Hỏi nhanh**, hỏi thử một câu. Trả lời mất khoảng 30 giây tới 2 phút vì trợ lý
   đang tra web, đó là bình thường.

Từ đó workflow tự chạy 00:00 UTC mỗi ngày, tức **7h sáng giờ Việt Nam**.

---

## Muốn dịch bù cho các bài cũ

Mỗi lần chạy chỉ gọi AI cho tối đa 60 bài, để không tốn quá nhiều một lúc. Muốn dịch dồn:

```bash
cd diem-cham-app
```

```bash
MAX_PHANTICH=250 node thu-thap.js
```

Chạy xong nhớ commit và đẩy `du-lieu/tin-tuc.json` lên.

---

## Khi có gì hỏng

| Hiện tượng | Nguyên nhân thường gặp |
|---|---|
| Thẻ bài không có tóm tắt tiếng Việt | Chưa có `ANTHROPIC_API_KEY`, hoặc hết credit |
| Hỏi nhanh báo "Mất kết nối tới trợ lý AI" | Hàm nền chưa deploy, hoặc thiếu `@netlify/blobs` |
| Hỏi nhanh báo `MissingBlobsEnvironmentError` | Ai đó đổi hàm về API v1. Phải giữ `export default async (req)` |
| Tab Thảo luận thiếu vài nhóm Reddit | Reddit chặn tốc độ hôm đó. Lần chạy sau tự nhặt tiếp |
| Một nguồn im hẳn nhiều ngày | Chạy `node kiem-tra-nguon.js` xem nguồn đó còn sống không |
