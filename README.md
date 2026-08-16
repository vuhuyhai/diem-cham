# ĐIỂM CHẠM

App tin tức về **Service Marketing** và **Trải nghiệm khách hàng**, cho chủ doanh nghiệp dịch vụ,
marketer, và người làm CX, CS tại Việt Nam.

Nguồn phần lớn tiếng Anh. Mỗi bài có tóm tắt tiếng Việt và một câu **Góc nhìn ứng dụng** cho
doanh nghiệp dịch vụ Việt Nam, do Claude viết qua hàm nền trên Netlify.

**Trang chạy:** https://diem-cham.netlify.app

---

## Bốn tab

1. **Case study nổi bật** — bài thực chiến từ nguồn biên tập thật: CustomerThink, CMSWire,
   McKinsey, HBR, MarketingProfs, CXL, CX Today, Shep Hyken, Service Design Show, UX Collective.
2. **Tin tức & Nghiên cứu** — tin mới qua Google News (tiếng Anh và tiếng Việt), nghiên cứu từ
   Nielsen Norman Group và arXiv.
3. **Thảo luận cộng đồng** — bài top tuần ở 9 nhóm Reddit về CX, customer success, dịch vụ,
   SaaS, doanh nghiệp nhỏ; và Hacker News lọc theo số upvote thật.
4. **Hỏi nhanh** — trợ lý AI có tra web, chạy bằng Netlify Background Function.

---

## Dùng riêng trên máy

Cần Node.js 18 trở lên. Không phải cài thư viện nào. Cả bốn tab đều chạy được ở máy, kể cả
Hỏi nhanh có tra web.

Đặt khóa API một lần (mở lại cửa sổ dòng lệnh sau khi đặt):

```bash
setx ANTHROPIC_API_KEY "khoa-cua-ban"
```

Rồi bấm **`QUET-TIN.bat`** để lấy tin và dịch, xong bấm **`MO-APP.bat`** để xem ở
`http://localhost:8765`.

Muốn gõ lệnh thì:

```bash
npm run quet
```

```bash
npm run xem
```

Một lần quét mất khoảng 8 tới 10 phút, phần lớn là thời gian nghỉ để né chặn tốc độ của
Reddit. Chưa đặt khóa thì tin vẫn về đủ, chỉ thiếu bản dịch tiếng Việt.
Xem thêm [diem-cham-app/HUONG-DAN.md](diem-cham-app/HUONG-DAN.md).

---

## Deploy

- **Netlify**: publish thư mục `diem-cham-app`, functions ở `netlify/functions`, không build.
  Thêm biến môi trường `ANTHROPIC_API_KEY`.
- **GitHub Actions**: `.github/workflows/quet-tin.yml` chạy 7h sáng giờ Việt Nam mỗi ngày,
  quét tin rồi commit dữ liệu mới về repo. Cần bật quyền Actions ở mức đọc và ghi.

---

## Ghi chú kỹ thuật quan trọng

- Hỏi nhanh **bắt buộc** chạy qua Background Function rồi hỏi lặp kết quả. Hàm thường của
  Netlify hết giờ ở 26 giây, tra web luôn lâu hơn.
- Netlify Blobs **bắt buộc** dùng Functions API v2 (`export default async (req) => {}`).
- HBR, MarketingProfs, CXL, CX Today chặn bot ở feed gốc, phải đọc vòng qua Google News.
- Reddit không còn cho lấy số upvote qua API mở. Dùng đường `/top/.rss?t=week` làm bộ lọc thay thế.
- Quora không có RSS mở nên không đưa vào.

Cố vấn nội dung: **Vũ Hải** · H-OE Model.
