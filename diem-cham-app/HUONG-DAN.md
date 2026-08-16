# ĐIỂM CHẠM — Hướng dẫn vận hành

App tin Service Marketing và Trải nghiệm khách hàng. Nguồn phần lớn tiếng Anh, app dịch sang
tiếng Việt và viết thêm một câu góc nhìn ứng dụng cho doanh nghiệp dịch vụ Việt Nam.

Địa chỉ khi đã đưa lên mạng: https://diem-cham.netlify.app

---

## 0. Dùng riêng trên máy, chưa cần đưa lên mạng

Ba bước. Làm một lần bước 1, sau đó chỉ bấm hai file.

**Bước 1. Đặt khóa API một lần.** Mở Command Prompt, gõ:

```bash
setx ANTHROPIC_API_KEY "khoa-cua-ban"
```

Lấy khóa ở https://console.anthropic.com. Đặt xong phải **đóng và mở lại** cửa sổ dòng lệnh thì
biến mới có hiệu lực. Không có khóa thì tin vẫn về đủ, chỉ thiếu bản dịch tiếng Việt và câu góc
nhìn ứng dụng.

**Bước 2. Bấm `QUET-TIN.bat`** để lấy tin về và dịch. Lần chạy mất khoảng 8 tới 10 phút, phần
lớn là thời gian nghỉ để né chặn tốc độ của Reddit. Cứ để đấy, đừng tắt cửa sổ.

**Bước 3. Bấm `MO-APP.bat`** để xem. Nó bật máy chủ nhỏ rồi tự mở trình duyệt ở
`http://localhost:8765`. Bấm Ctrl + C ở cửa sổ đen để dừng.

**Lần đầu, bấm thêm `DICH-BU.bat`.** Mỗi lượt quét chỉ dịch tối đa 60 bài để khỏi tốn nhiều
một lúc, mà kho đang có hơn 260 bài. File này dịch nốt phần còn lại và **không lấy tin mới**,
nên chạy nhanh, khỏi phải chờ Reddit thêm 10 phút nữa. Từ lần sau chỉ cần `QUET-TIN.bat`.

Đừng mở thẳng `index.html` bằng cách bấm đúp. Mở kiểu đó trình duyệt chặn lệnh đọc file dữ
liệu, trang sẽ trống.

**Cả bốn tab đều dùng được ở máy**, kể cả Hỏi nhanh. Khi có khóa trong biến môi trường:

- Bộ quét **gọi thẳng Anthropic** để dịch, không cần site đã lên Netlify.
- `may-chu.js` đóng vai luôn hai hàm nền của Netlify, nên tab Hỏi nhanh tra web được như thật.
  Kết quả giữ trong bộ nhớ thay vì Netlify Blobs, tắt máy chủ là hết, đúng như mong đợi.

Nhật ký và dòng chữ lúc khởi động máy chủ sẽ ghi rõ đang đi đường nào.

Nếu chưa đặt khóa: tin vẫn về, vẫn đọc được, chỉ thiếu bản dịch tiếng Việt, và Hỏi nhanh sẽ
trả lời tạm từ kho câu hỏi có sẵn trong app.

---

## 1. Cấu trúc thư mục

```
diem-cham-deploy/
├── QUET-TIN.bat              bấm để lấy tin về và dịch
├── DICH-BU.bat               bấm để dịch nốt kho, không lấy tin mới
├── MO-APP.bat                bấm để xem app ở máy
├── diem-cham-app/            ← thư mục Netlify publish
│   ├── index.html            giao diện, 4 tab, có mốc SSR cho SEO
│   ├── thu-thap.js           bộ quét (Node thuần, không cần cài gì)
│   ├── may-chu.js            máy chủ tĩnh nhỏ để xem tại chỗ
│   ├── kiem-tra-nguon.js     thử từng nguồn, xem nguồn nào còn sống
│   ├── cau-hinh.json         khai báo nguồn + từ khóa + trần số bài
│   ├── du-lieu/
│   │   ├── tin-tuc.json      dữ liệu app đọc
│   │   ├── nhat-ky.txt       log các lần chạy
│   │   └── lich-su/          bài mới theo từng ngày, giữ 180 ngày
│   ├── og.png, icon*.png, icon.svg, site.webmanifest, robots.txt, sitemap.xml
├── netlify/functions/
│   ├── loi-nhac-phan-tich.js lời nhắc + lệnh gọi Claude, DÙNG CHUNG cho cả hai đường
│   ├── phan-tich.js          dịch + viết Góc nhìn ứng dụng (hàm thường)
│   ├── hoi-background.mjs    Hỏi nhanh có tra web (BACKGROUND function)
│   └── hoi-ket-qua.mjs       lấy kết quả từ Netlify Blobs
├── netlify.toml, package.json, .node-version
└── .github/workflows/quet-tin.yml   chạy tự động 7h sáng
```

---

## 2. Ba tab lấy bài từ đâu

Mỗi nguồn trong `cau-hinh.json` có trường `nhom` quyết định nó hiện ở tab nào.

| Tab | `nhom` | Nguồn |
|---|---|---|
| Case study nổi bật | `case` | CustomerThink, CMSWire, McKinsey, Shep Hyken, Service Design Show, UX Collective, HBR, MarketingProfs, CXL, CX Today |
| Tin tức & Nghiên cứu | `tin` | 8 truy vấn Google News tiếng Anh, 4 truy vấn tiếng Việt, Nielsen Norman Group, 2 truy vấn arXiv |
| Thảo luận cộng đồng | `thaoluan` | 9 nhóm Reddit (top tuần) + 4 truy vấn Hacker News |

Mỗi nhóm có trần số bài riêng (`soTinCase`, `soTinTin`, `soTinThaoLuan`) để nhóm đăng dày
không lấn chỗ nhóm đăng thưa.

---

## 3. Những chỗ đã trả giá, đừng sửa lại cho "gọn"

**Bốn trang chặn bot.** HBR, MarketingProfs, CXL và CX Today trả 403 hoặc rớt kết nối khi gọi
thẳng feed. App đọc vòng qua Google News với truy vấn `site:tên-miền`. Bài vẫn về đủ, chỉ mất
phần mô tả. Đừng đổi lại URL feed gốc.

**Reddit chặn tốc độ rất gắt.** Gọi liên tiếp vài sub là 429 ngay, dù mỗi lần gọi đều hợp lệ.
Bộ quét nghỉ 20 giây giữa hai lần gọi Reddit và thử lại 4 lần với thời gian nghỉ tăng dần.
Vì vậy một lần chạy đầy đủ mất khoảng 5 tới 8 phút, đó là bình thường, không phải treo.
Sub nào vẫn lỡ thì lần chạy hôm sau nhặt tiếp, vì dữ liệu gộp dồn chứ không ghi đè.

**Reddit không cho biết số upvote.** Bản `.json` có số upvote nhưng nay trả 403, phải OAuth.
Vì vậy app dùng đường dẫn `/top/.rss?t=week`: Reddit đã xếp bài nhiều upvote nhất tuần lên
trước, nên `soBaiDau` chính là lấy N bài top tuần. Số upvote thật chỉ Hacker News có.

**Nội dung bài Reddit là HTML đã bị mã hóa thành thực thể.** Tức trong feed nó nằm dưới dạng
`&lt;div class="md"&gt;`. Nếu chỉ gỡ thẻ một lượt thì lúc gỡ chưa thấy thẻ nào, giải mã xong
lại lòi nguyên khối `<!-- SC_OFF --><div class="md"><p>` ra thẳng thẻ bài. Vì vậy `goHtml`
chạy hai lượt gỡ thẻ rồi giải mã. Đừng rút gọn về một lượt.

**Hacker News phải hỏi theo cửa sổ thời gian, không hỏi bài mới nhất.** Bản `search_by_date`
trả về bài vừa đăng, chưa kịp có upvote, nên lọc theo điểm là trắng bảng. Cách đúng là bản
`search` kèm `created_at_i` giới hạn 180 ngày và `points>10`, tức lấy bài trong cửa sổ gần đây
VÀ đã đủ điểm. Cửa sổ phải rộng vì Hacker News bàn về chủ đề dịch vụ rất thưa: để 30 ngày thì
ra 0 bài. Ngoài ra bài ra mắt sản phẩm (`Launch HN:`, `Show HN:`) lọt vào chỉ vì phần mô tả có
nhắc customer service, nên bộ quét chặn riêng hai tiền tố đó ở đầu tiêu đề.

**r/CustomerService đã tắt.** Sub đó gần như toàn bài nhân viên tuyến đầu than ca trực (khách
quát, đóng cửa sớm, ghét việc). Thật lòng nhưng không rút ra được bài học vận hành. Muốn nghe
tiếng nói tuyến đầu thì bật lại trong `cau-hinh.json`.

**Bài cũ được bóc tách lại mỗi lần chạy.** Khi gộp dữ liệu, bản vừa quét luôn thắng bản cũ,
chỉ bê lại phần AI đã trả tiền (`w`, `y`, `wa`). Nhờ vậy mỗi lần sửa lỗi bóc tách là dữ liệu cũ
cũng được chữa theo. Nếu làm ngược lại, một lỗi lọt vào hôm nay sẽ nằm trong kho mãi mãi.

**Quora không có RSS mở.** Giống Facebook ở app SỨC BẬT. Đã bỏ, thay bằng Hacker News.

**Hỏi nhanh phải chạy nền.** Hàm thường của Netlify hết giờ ở 26 giây, mà tra web luôn lâu hơn,
nên gọi đồng bộ là 502 hoặc 504. Luồng đúng: trình duyệt sinh `id` → POST vào
`hoi-background` → hỏi lặp `hoi-ket-qua?id=...` cho tới khi có kết quả trong Netlify Blobs.

**Netlify Blobs phải dùng Functions API v2.** Tức `export default async (req) => {}`.
Bản v1 (`exports.handler`) báo `MissingBlobsEnvironmentError`. Đó là lý do hai file Hỏi nhanh
để đuôi `.mjs` còn `phan-tich.js` vẫn là v1 (nó không đụng Blobs).

**Giải mã thực thể HTML hai lượt.** Tiêu đề tiếng Anh hay dính `&#8217;` và cả `&amp;#8217;`.
Hàm `goHtml` giải mã số, rồi mới đổi `&amp;` thành `&`, rồi giải mã số lần nữa. Bỏ bớt lượt
nào cũng để lọt rác ra trang.

---

## 4. Bộ lọc chất lượng

Thứ tự xét trong `thu-thap.js`, đúng theo trình tự này:

1. Bỏ thẳng bài ra mắt sản phẩm Hacker News (`Launch HN:`, `Show HN:` ở đầu tiêu đề).
   Đặt trước mọi chốt giữ lại, vì bài loại này hay khoe "500 khách hàng, tăng 40%" nên
   chốt giữ lại sẽ cứu nhầm.
2. **Chốt giữ lại số một**: bài Hacker News từ 20 điểm upvote trở lên. Đã có nhiều người thật
   bấm ủng hộ thì tin họ hơn tin bộ lọc.
3. **Chốt giữ lại số hai** (`chotGiuLai`): bài có số liệu (%, tiền, bội số), có chỉ số dịch vụ
   có tên (NPS, CSAT, CES, churn rate), có ngôn ngữ phân tích (case study, research, framework,
   benchmark, how we, we increased), hoặc kể tình huống thật có mốc thời gian.
   **Đã dính chốt này thì giữ, không lọc tiếp.** Thà giữ nhầm một bài hay còn hơn lọc mất nó.
4. Bỏ quảng cáo, chào hàng, rao vặt, tuyển dụng (`laQuangCao`).
5. Bỏ meme, tám chuyện, rừng hashtag, và bài nhân viên tuyến đầu than ca trực (`laVunVat`).
6. Riêng tab thảo luận: bỏ hỏi đáp nghề nghiệp cá nhân, hỏi kinh nghiệm phỏng vấn, tiêu đề
   kêu cứu chung chung, câu hỏi cụt (`laHoiDapCaNhan`).

Muốn siết hay nới, sửa các mảng từ khóa trong các hàm đó. Đừng đưa từ quá chung vào danh sách
loại trừ, vì bài phân tích thật cũng dùng những từ đó. Ví dụ đã cố ý **không** để riêng chữ
`hiring`, vì một bài hay về nhân sự tuyến đầu cũng viết "we stopped hiring more agents".

---

## 5. Chạy tay

```bash
cd diem-cham-app
node thu-thap.js
```

Thử từng nguồn để xem cái nào chết:

```bash
node kiem-tra-nguon.js
```

Xem app tại chỗ:

```bash
node may-chu.js
```

Biến môi trường có thể đặt thêm:

| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `ANTHROPIC_API_KEY` | có khóa thì gọi thẳng Anthropic, khỏi cần site đã deploy | không có |
| `URL_PHANTICH` | địa chỉ hàm dịch, chỉ dùng khi KHÔNG có khóa ở máy | hàm trên diem-cham.netlify.app |
| `MAX_PHANTICH` | số bài gọi AI mỗi lần chạy | 60 |
| `CHI_DICH` | đặt `1` để bỏ bước lấy tin, chỉ dịch tiếp kho đang có | không đặt |
| `NGHI_REDDIT` | mili giây nghỉ giữa hai lần gọi Reddit | 20000 |

Hai đường dịch dùng chung một bản lời nhắc ở `netlify/functions/loi-nhac-phan-tich.js`. Muốn
đổi giọng văn thì sửa đúng file đó, đừng chép ra hai nơi, sẽ lệch nhau.

Dịch bù cho kho cũ mà không lấy tin mới:

```bash
CHI_DICH=1 MAX_PHANTICH=300 node thu-thap.js
```

---

## 6. Thêm hoặc bớt nguồn

Mở `cau-hinh.json`, thêm một khối vào mảng `nguon`:

```json
{ "ten": "Tên hiện trên thẻ bài",
  "hang": "Chuyên trang",
  "nhom": "case",
  "url": "https://...",
  "trangThai": "bat" }
```

- `nhom`: `case`, `tin` hoặc `thaoluan`.
- `loai`: bỏ trống là RSS/Atom. `reddit` cho Reddit, `hn` cho Hacker News, `json` cho cầu nối JSON.
- `giuTatCa`: đặt `true` khi cả trang đều đúng chủ đề, khỏi cần lọc từ khóa.
- `khongPhanTich`: đặt `true` để bỏ qua bước gọi AI cho nguồn đó.
- `diemToiThieu`: chỉ dùng với `loai: "hn"`, chặn bài dưới ngưỡng upvote.
- `soBaiDau`: chỉ dùng với `loai: "reddit"`, lấy N bài đầu bảng top tuần.

Thêm xong chạy `node kiem-tra-nguon.js` để chắc nguồn còn sống, rồi mới `node thu-thap.js`.

---

## 7. Khóa API

`ANTHROPIC_API_KEY` đặt ở **Netlify** (Site settings → Environment variables), không đặt ở
GitHub. Bộ quét gọi hàm trên Netlify chứ không gọi thẳng Anthropic, nên GitHub Actions không
cần biết khóa.

Chưa có khóa thì app vẫn chạy: bài vẫn về đủ, chỉ thiếu bản dịch tiếng Việt và câu góc nhìn,
còn Hỏi nhanh sẽ trả lời tạm từ kho câu hỏi có sẵn.
