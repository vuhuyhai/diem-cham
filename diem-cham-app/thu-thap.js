/**
 * ĐIỂM CHẠM — Bộ thu thập tin Service Marketing & Trải nghiệm khách hàng
 * Chạy một lần:  node thu-thap.js
 *
 * Không cần cài thư viện. Chỉ cần Node.js phiên bản 18 trở lên (có fetch sẵn).
 * Đọc cấu hình từ cau-hinh.json, quét RSS/Atom/JSON (Google News, blog chuyên ngành,
 * tạp chí học thuật, Reddit, Hacker News), lọc theo từ khóa chủ đề, khử trùng lặp,
 * chấm mức quan trọng, chia về 3 nhóm (case / tin / thaoluan), ghi ra
 * du-lieu/tin-tuc.json và chèn SSR vào index.html cho SEO.
 *
 * Nguồn phần lớn tiếng Anh. Phần dịch sang tiếng Việt và câu "Góc nhìn ứng dụng"
 * do hàm nền phan-tich trên Netlify đảm nhiệm.
 */

const fs = require("fs");
const path = require("path");

const THU_MUC = __dirname;
const DU_LIEU = path.join(THU_MUC, "du-lieu");
const LICH_SU = path.join(DU_LIEU, "lich-su");
const FILE_TIN = path.join(DU_LIEU, "tin-tuc.json");
const FILE_LOG = path.join(DU_LIEU, "nhat-ky.txt");

/* ---------- Dịch + Góc nhìn ứng dụng ----------
 * Hai đường đi, tự chọn:
 *
 * 1. CHẠY Ở MÁY, có sẵn ANTHROPIC_API_KEY trong biến môi trường: gọi thẳng Anthropic.
 *    Nhờ vậy dùng được ngay tại chỗ, không phải chờ deploy site lên Netlify.
 * 2. CHẠY TRÊN GITHUB ACTIONS: ở đó cố ý KHÔNG có khóa (khóa chỉ nằm ở Netlify),
 *    nên đi đường gọi hàm nền phan-tich đã deploy.
 *
 * Lời nhắc dùng chung một bản ở netlify/functions/loi-nhac-phan-tich.js, để giọng văn
 * của hai đường không lệch nhau.
 */
const URL_PHANTICH = process.env.URL_PHANTICH ||
  "https://diem-cham.netlify.app/.netlify/functions/phan-tich";
const MAX_PHANTICH = Number(process.env.MAX_PHANTICH) || 60; // trần số tin phân tích mỗi lần chạy
const WA_VER = 1;        // phiên bản góc nhìn (đổi model/giọng thì tăng số này để tạo lại toàn bộ)

const KHOA_MAY = process.env.ANTHROPIC_API_KEY || "";
let phanTichBai = null;
try { ({ phanTichBai } = require("../netlify/functions/loi-nhac-phan-tich.js")); }
catch (e) { /* thiếu file thì rơi về đường gọi hàm nền */ }

const dungKhoaMay = () => Boolean(KHOA_MAY && phanTichBai);

// Lỗi khóa thì thử lại bao nhiêu lần cũng vô ích, phải dừng ngay và nói đúng bệnh.
// Còn lại (mạng chập, quá tải nhất thời) thì thử lại vài lần là qua.
function laLoiKhoa(e) {
  const s = String((e && e.message) || e).toLowerCase();
  return /api key|authentication|unauthorized|401|invalid x-api-key|credit balance|quota/.test(s);
}

/**
 * Gọi phân tích cho một bài, có thử lại khi mạng chập.
 *
 * Dịch cả kho là hàng trăm lần gọi liên tiếp trong nhiều chục phút. Trong quãng đó chỉ
 * cần rớt mạng vài giây là hỏng liên tiếp mấy bài rồi cả lượt chạy tự dừng. Thử lại có
 * lùi thời gian giúp lượt chạy đi hết kho thay vì bỏ dở giữa chừng.
 */
async function goiPhanTich(item, thuTu, soLanThu = 3) {
  let doi = 4000;
  for (let lan = 1; ; lan++) {
    try {
      return await goiPhanTichMotLan(item, thuTu);
    } catch (e) {
      if (laLoiKhoa(e) || lan >= soLanThu) throw e;
      await nghi(doi);
      doi *= 3;
    }
  }
}

async function goiPhanTichMotLan(item, thuTu) {
  // Phải có hạn giờ. Khi site chưa deploy hoặc hàm nền treo, fetch không tự bỏ cuộc,
  // cả lượt chạy sẽ đứng im hàng chục phút mà không báo gì.
  const ctrl = new AbortController();
  const hen = setTimeout(() => ctrl.abort(), 45000);
  try {
    if (dungKhoaMay()) {
      return await phanTichBai({
        key: KHOA_MAY, tieuDe: item.t, tomTat: item.s, nhom: item.g, thuTu, signal: ctrl.signal,
      });
    }
    const res = await fetch(URL_PHANTICH, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tieuDe: item.t, tomTat: item.s, nhom: item.g, thuTu }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const d = await res.json();
    if (!d || !d.tomTat || !d.yKien) throw new Error(d && d.loi ? d.loi : "thiếu dữ liệu");
    return d;
  } finally {
    clearTimeout(hen);
  }
}

// Với mỗi tin chưa có góc nhìn (thiếu cờ .wa), gọi hàm phân tích.
// Lỗi thì giữ nguyên gợi ý cũ và thử lại lần chạy sau.
const CU_MOI = 25; // cứ ngần này bài dịch xong thì ghi tạm ra file một lần

async function boSungYKien(list, luuTam) {
  let n = 0, hongLienTiep = 0, loiCuoi = "", loiKhoa = false;
  const canDich = list.filter(x => x.wa !== WA_VER && !x.khongPT).length;
  if (!canDich) { ghiLog("Mọi bài đã có bản dịch tiếng Việt, bỏ qua bước gọi AI."); return; }
  ghiLog(dungKhoaMay()
    ? `Dịch bằng khóa ở máy (ANTHROPIC_API_KEY). Còn ${canDich} bài chưa dịch, lần này làm tối đa ${MAX_PHANTICH}.`
    : `Dịch qua hàm nền ${URL_PHANTICH}. Còn ${canDich} bài chưa dịch, lần này làm tối đa ${MAX_PHANTICH}.`);
  for (const it of list) {
    if (it.wa === WA_VER) continue;
    if (it.khongPT) continue;
    if (n >= MAX_PHANTICH) break;
    // Mỗi bài đã tự thử lại 3 lần rồi mới tính là hỏng. Hỏng liên tiếp 8 bài nghĩa là
    // hỏng thật chứ không phải mạng chập, khi đó dừng thay vì gọi tiếp hàng trăm lần.
    if (hongLienTiep >= 8) {
      ghiLog(`Dừng bước dịch: 8 bài liên tiếp không xong. Lỗi cuối: ${loiCuoi}`);
      ghiLog(loiKhoa
        ? "  Đây là lỗi khóa API. Kiểm tra ANTHROPIC_API_KEY và số dư ở console.anthropic.com."
        : dungKhoaMay()
          ? "  Nhiều khả năng do mạng. Chạy lại sau, những bài đã dịch vẫn được giữ nguyên."
          : "  Chưa đặt ANTHROPIC_API_KEY ở máy, mà hàm nền trên Netlify cũng chưa trả lời. Xem HUONG-DAN.md mục 5.");
      break;
    }
    try {
      // Truyền số thứ tự để lời nhắc luân phiên kiểu mở đầu câu Góc nhìn ứng dụng.
      const r = await goiPhanTich(it, n);
      it.w = r.tomTat;
      it.y = r.yKien;
      it.wa = WA_VER;
      n++;
      hongLienTiep = 0;
      // Ghi tạm sau mỗi CU_MOI bài. Dịch cả kho mất gần nửa tiếng; nếu chỉ ghi lúc xong
      // thì mất mạng ở bài thứ 250 là mất trắng công của 249 bài trước.
      if (luuTam && n % CU_MOI === 0) {
        try { luuTam(); ghiLog(`  đã dịch ${n}/${Math.min(canDich, MAX_PHANTICH)} bài, ghi tạm.`); }
        catch (e2) { ghiLog("  ghi tạm hỏng (bỏ qua): " + e2.message); }
      }
    } catch (e) {
      // giữ .w cũ, chưa đặt .wa để lần chạy sau thử lại
      hongLienTiep++;
      loiCuoi = String((e && e.message) || e);
      // Lỗi khóa thì dừng ngay, không chờ đủ 8 bài: thử tiếp cũng hỏng y hệt.
      if (laLoiKhoa(e)) {
        loiKhoa = true;
        ghiLog(`Dừng bước dịch: lỗi khóa API (${loiCuoi}).`);
        ghiLog("  Kiểm tra ANTHROPIC_API_KEY và số dư ở console.anthropic.com.");
        break;
      }
    }
  }
  if (n) ghiLog(`Đã tạo tóm tắt + góc nhìn ứng dụng cho ${n} tin.`);
}

/* ---------- SSR: chèn tin dạng HTML tĩnh vào index.html cho SEO ---------- */
const IMP_LABEL = { cao: "Nên đọc", vua: "Đáng chú ý", thap: "Tham khảo" };
const FILE_HTML = path.join(THU_MUC, "index.html");
const SSR_SO_TIN = 30; // số tin render tĩnh, đủ cho SEO và nhẹ trang

function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function ngayVN(d) {
  const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : escHtml(d);
}
function ssrTin(list) {
  return list.slice(0, SSR_SO_TIN).map(n => {
    const u = escHtml(n.u);
    const s = n.s ? `<p>${escHtml(n.s)}</p>` : "";
    const yk = n.y ? `<p class="yk"><span>Góc nhìn ứng dụng</span> ${escHtml(n.y)}</p>` : "";
    return `<article class="news"><div class="news__meta"><span class="d">${ngayVN(n.d)}</span><span>${escHtml(n.src)}</span><span class="dot dot--${escHtml(n.imp)}">${escHtml(IMP_LABEL[n.imp] || "")}</span></div>`
      + `<h3><a href="${u}" target="_blank" rel="noopener">${escHtml(n.t)}</a></h3>`
      + s
      + `<div class="why"><b>Tóm tắt tiếng Việt</b><p>${escHtml(n.w)}</p>${yk}</div>`
      + `<a class="go" href="${u}" target="_blank" rel="noopener">Đọc bản gốc</a></article>`;
  }).join("\n");
}
// Chèn giữa hai mốc. Không có mốc thì bỏ qua an toàn, không đụng file.
function chenSSR(list) {
  try {
    if (!fs.existsSync(FILE_HTML)) return;
    let html = fs.readFileSync(FILE_HTML, "utf8");
    const re = /(<!--TIN-SSR-START-->)[\s\S]*?(<!--TIN-SSR-END-->)/;
    if (!re.test(html)) { ghiLog("SSR: không thấy mốc trong index.html, bỏ qua."); return; }
    const noiDung = ssrTin(list); // dùng hàm thay thế để '$' trong tin không bị hiểu đặc biệt
    html = html.replace(re, (m, a, b) => a + "\n" + noiDung + "\n" + b);
    fs.writeFileSync(FILE_HTML, html, "utf8");
    ghiLog(`SSR: đã chèn ${Math.min(list.length, SSR_SO_TIN)} tin tĩnh vào index.html.`);
  } catch (e) { ghiLog("SSR lỗi (bỏ qua): " + e.message); }
}

/* ---------- tiện ích ---------- */

function ghiLog(dong) {
  const t = new Date().toISOString().replace("T", " ").slice(0, 19);
  const s = `[${t}] ${dong}`;
  console.log(s);
  try {
    fs.mkdirSync(DU_LIEU, { recursive: true });
    fs.appendFileSync(FILE_LOG, s + "\n");
  } catch (e) { /* không chặn luồng chính vì lỗi ghi log */ }
}

function boDau(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase();
}

const soVeKyTu = (raw, he) => {
  try { return String.fromCodePoint(parseInt(raw, he)); } catch (e) { return " "; }
};

/**
 * Giải mã thực thể HTML.
 * Tin tiếng Anh rất hay dính &#8217; &#8230; và cả &amp;#39; nên phải giải mã số,
 * rồi mới đổi &amp; thành &, rồi giải mã số lần nữa. Bỏ lượt nào cũng để lọt rác ra trang.
 */
function giaiMaThucThe(s) {
  return String(s)
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&(?:rsquo|lsquo|apos);/gi, "'")
    .replace(/&(?:rdquo|ldquo);/gi, '"')
    .replace(/&(?:mdash|ndash);/gi, "-")
    .replace(/&hellip;/gi, "…")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => soVeKyTu(h, 16))
    .replace(/&#(\d+);/g, (_, n) => soVeKyTu(n, 10))
    .replace(/&amp;/gi, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => soVeKyTu(h, 16))
    .replace(/&#(\d+);/g, (_, n) => soVeKyTu(n, 10));
}

/**
 * Gỡ thẻ HTML và giải mã thực thể.
 *
 * Chạy HAI LƯỢT gỡ thẻ rồi giải mã. Lý do: nội dung bài Reddit là HTML đã bị mã hóa
 * thành thực thể (&lt;div class="md"&gt;...). Làm một lượt thì lượt gỡ thẻ chạy trước
 * lúc giải mã, không thấy thẻ nào, giải mã xong lại lòi nguyên khối
 * "<!-- SC_OFF --><div class=\"md\"><p>" ra thẳng trang.
 */
function goHtml(s) {
  let t = String(s);
  for (let i = 0; i < 2; i++) {
    t = t
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]*>/g, " ");
    t = giaiMaThucThe(t);
  }
  return t.replace(/\s+/g, " ").trim();
}

function layThe(khoi, the) {
  const re = new RegExp("<" + the + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + the + ">", "i");
  const m = khoi.match(re);
  if (!m) return "";
  return m[1].replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "").trim();
}

/**
 * Chuẩn hóa ngày.
 * Một số CMS trả offset 2 chữ số ("+07") mà Date của JS không hiểu,
 * phải đổi thành "+0700" trước khi parse.
 */
function chuanNgay(raw) {
  if (!raw) return null;
  let s = String(raw).trim().replace(/([+-]\d{2})$/, "$1" + "00");
  let d = new Date(s);
  if (isNaN(d.getTime())) d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d;
}

function ngayISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const n = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${n}`;
}

/* ---------- đọc RSS và Atom ---------- */

function docFeed(xml) {
  const ra = [];

  // RSS 2.0
  const reItem = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = reItem.exec(xml)) !== null) {
    const b = m[1];
    ra.push({
      tieuDe: goHtml(layThe(b, "title")),
      lien: goHtml(layThe(b, "link") || layThe(b, "guid")),
      ngay: layThe(b, "pubDate") || layThe(b, "dc:date") || layThe(b, "date"),
      tom: goHtml(layThe(b, "description") || layThe(b, "summary") || layThe(b, "content:encoded")),
      nguonGoc: goHtml(layThe(b, "source")) // Google News gắn tên báo gốc ở thẻ <source>
    });
  }
  if (ra.length) return ra;

  // Atom (arXiv, SAGE, một số blog dùng Atom)
  const reEntry = /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi;
  while ((m = reEntry.exec(xml)) !== null) {
    const b = m[1];
    let lien = layThe(b, "id");
    const href = b.match(/<link[^>]*href=["']([^"']+)["']/i);
    if (href) lien = href[1];
    ra.push({
      tieuDe: goHtml(layThe(b, "title")),
      lien: goHtml(lien),
      ngay: layThe(b, "published") || layThe(b, "updated"),
      tom: goHtml(layThe(b, "summary") || layThe(b, "content")),
      nguonGoc: ""
    });
  }
  return ra;
}

/* ---------- đọc Reddit (Atom) ----------
 * Reddit CÓ RSS thật: /r/<sub>/top/.rss?t=week — không cần khóa, không cần cầu nối.
 * Nhược điểm: feed KHÔNG kèm số upvote. Bù lại, bản thân đường dẫn /top/?t=week đã là
 * bộ lọc upvote: Reddit xếp bài nhiều upvote nhất tuần lên trước. Vì vậy ta ghi lại
 * THỨ HẠNG trong feed (rank) và dùng nó thay cho điểm số.
 * Tác giả nằm ở <author><name>/u/xxx</name>, nội dung bài ở <content type="html">.
 */
function docReddit(xml, tenSub) {
  const ra = [];
  const reEntry = /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi;
  let m, i = 0;
  while ((m = reEntry.exec(xml)) !== null) {
    const b = m[1];
    let lien = "";
    const href = b.match(/<link[^>]*href=["']([^"']+)["']/i);
    if (href) lien = href[1];
    if (!lien) lien = goHtml(layThe(b, "id"));
    const tacGia = goHtml(layThe(b, "name"));
    ra.push({
      tieuDe: goHtml(layThe(b, "title")),
      lien,
      ngay: layThe(b, "updated") || layThe(b, "published"),
      tom: goHtml(layThe(b, "content")),
      nguonGoc: tenSub || "",
      rank: ++i,
      tacGia
    });
  }
  return ra;
}

/* ---------- đọc Hacker News (Algolia API, JSON) ----------
 * Đây là nguồn DUY NHẤT trong app có SỐ UPVOTE THẬT (points) và số bình luận.
 * Dùng nó để lọc bài thực sự được cộng đồng quan tâm, thay vì đoán.
 * Bài Ask HN không có url ngoài, khi đó trỏ về trang thảo luận trên news.ycombinator.com.
 */
function docHN(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return []; }
  const hits = Array.isArray(data && data.hits) ? data.hits : [];
  const ra = [];
  for (const h of hits) {
    if (!h || !h.title) continue;
    const id = h.objectID;
    const lien = h.url || (id ? "https://news.ycombinator.com/item?id=" + id : "");
    if (!lien) continue;
    ra.push({
      tieuDe: goHtml(h.title),
      lien,
      ngay: h.created_at || "",
      tom: goHtml(String(h.story_text || "").slice(0, 900)),
      nguonGoc: "Hacker News",
      diem: Number(h.points) || 0,
      binhLuan: Number(h.num_comments) || 0,
      thaoLuan: id ? "https://news.ycombinator.com/item?id=" + id : ""
    });
  }
  return ra;
}

/* ---------- đọc JSON chung (cầu nối RSS.app, Apify, ...) ---------- */
function docJson(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return []; }
  const arr = Array.isArray(data) ? data
    : (Array.isArray(data.items) ? data.items
      : (Array.isArray(data.data) ? data.data
        : (Array.isArray(data.results) ? data.results : [])));

  const layTruong = (o, keys) => {
    for (const k of keys) {
      const v = k.split(".").reduce((a, c) => (a && a[c] != null ? a[c] : null), o);
      if (v != null && v !== "") return v;
    }
    return "";
  };

  const ra = [];
  for (const it of arr) {
    if (!it || typeof it !== "object") continue;
    const txt = goHtml(String(layTruong(it, ["title", "text", "message", "content", "description"]) || ""));
    const lien = String(layTruong(it, ["url", "link", "permalink", "postUrl"]) || "");
    if (!lien) continue;

    let ngay = layTruong(it, ["date_published", "pubDate", "publishedAt", "date", "time", "createdAt"]);
    if (typeof ngay === "number") {
      const ms = ngay > 1e12 ? ngay : ngay * 1000;
      ngay = new Date(ms).toISOString();
    }
    const tieuDe = txt ? (txt.length > 160 ? txt.slice(0, 157).trim() + "…" : txt) : "(Bài viết)";
    const tom = goHtml(String(layTruong(it, ["summary", "content_text", "description"]) || ""));
    ra.push({ tieuDe, lien, ngay: ngay || "", tom, nguonGoc: "" });
  }
  return ra;
}

/**
 * Thay ${TEN_BIEN} trong URL.
 *
 * Hai loại:
 * - ${TS_7NGAY} và ${TS_30NGAY}: mốc thời gian Unix của 7 hoặc 30 ngày trước. Cần cho
 *   Hacker News. Nếu hỏi bài mới nhất rồi lọc theo upvote thì gần như không còn gì, vì bài
 *   vừa đăng chưa kịp có điểm. Cách đúng là hỏi bài trong cửa sổ vài tuần gần đây VÀ đã
 *   đủ điểm, tức lọc ngay trên máy chủ Algolia bằng created_at_i.
 * - Còn lại: lấy từ biến môi trường, để token bí mật nằm ngoài file cấu hình.
 */
function thayEnv(url) {
  const giay = Math.floor(Date.now() / 1000);
  const dacBiet = {
    TS_7NGAY: String(giay - 7 * 86400),
    TS_30NGAY: String(giay - 30 * 86400),
    TS_180NGAY: String(giay - 180 * 86400),
  };
  return String(url).replace(/\$\{(\w+)\}/g, (m, k) =>
    (k in dacBiet ? dacBiet[k] : (process.env[k] || "")));
}

const nghi = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Tải một nguồn, có thử lại khi bị chặn tốc độ.
 *
 * Reddit chặn rất gắt: gọi liên tiếp vài lần là trả 429 ngay, dù mỗi lần đều hợp lệ.
 * Vì vậy gặp 429 hoặc 503 thì nghỉ rồi thử lại, mỗi lần nghỉ dài gấp đôi lần trước.
 * Không thử lại với các mã khác (403, 404) vì thử lại cũng vô ích.
 */
async function tai(url, soLanThu = 3, doiDauMs = 15000) {
  let doiMs = doiDauMs;
  for (let lan = 1; ; lan++) {
    const ctrl = new AbortController();
    const hen = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: {
          // Nhiều trang từ chối yêu cầu không có User-Agent. Reddit chặn khá gắt,
          // phải khai User-Agent giống trình duyệt thật.
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Accept": "application/rss+xml, application/xml, text/xml, application/atom+xml, application/json, */*",
          "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
          // Google News đôi khi trả trang xin đồng ý cookie nếu thiếu cái này
          "Cookie": "CONSENT=YES+1"
        }
      });
      if ((res.status === 429 || res.status === 503) && lan < soLanThu) {
        clearTimeout(hen);
        ghiLog(`    bị chặn tốc độ (${res.status}), nghỉ ${Math.round(doiMs / 1000)}s rồi thử lại`);
        await nghi(doiMs);
        doiMs *= 2;
        continue;
      }
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      if (!text || text.length < 80) throw new Error("nội dung rỗng");
      return text;
    } finally {
      clearTimeout(hen);
    }
  }
}

/* ---------- lọc và chấm điểm ---------- */

/**
 * So khớp có ranh giới từ.
 * Nếu chỉ dùng includes() thì "cx" khớp vào giữa từ khác, "ces" bắt nhầm lung tung.
 * Ở đây yêu cầu hai đầu từ khóa phải là ký tự không phải chữ hoặc số.
 */
function coTuKhoa(vChuan, tuKhoa) {
  const k = boDau(tuKhoa).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(^|[^a-z0-9])" + k + "($|[^a-z0-9])").test(vChuan);
}

function demTuKhoa(vanBan, danhSach) {
  const v = boDau(vanBan);
  const trung = [];
  for (const tk of danhSach) if (coTuKhoa(v, tk)) trung.push(tk);
  return { soLan: trung.length, trung };
}

/**
 * Chấm mức quan trọng cho tin và case study.
 * "cao" đòi hỏi tín hiệu chất lượng MẠNH (case study, nghiên cứu, số liệu, framework)
 * đi cùng ít nhất một từ khóa chủ đề, chứ không phải bất kỳ bài marketing nào.
 */
function chamMuc(nganh, chuDe, manh) {
  if (manh >= 1 && nganh >= 1) return "cao";
  if (nganh >= 2 && chuDe >= 1) return "vua";
  if (manh >= 1 || (nganh >= 1 && chuDe >= 1)) return "vua";
  return "thap";
}

/* ---------- CHỐT GIỮ LẠI ----------
 * Bài có bằng chứng thật thì GIỮ, dù có dính vài mẫu bị loại ở dưới.
 * Bằng chứng thật = số liệu (%, đô la, NPS, CSAT, churn), hoặc ngôn ngữ phân tích
 * (case study, nghiên cứu, thí nghiệm, kết quả, framework, teardown, benchmark),
 * hoặc kể một tình huống có thật ("we did", "our team", "after 6 months").
 * Đây là chốt chặn quan trọng nhất: thà giữ nhầm một bài hay còn hơn lọc mất nó.
 */
function chotGiuLai(text) {
  const raw = String(text || "");
  const v = boDau(raw);

  // Số liệu: phần trăm, tiền, bội số, quy mô người dùng.
  if (/\d+(\.\d+)?\s?%/.test(raw)) return true;
  if (/[$£€]\s?\d/.test(raw)) return true;
  if (/\d+(\.\d+)?\s?x\b/.test(v)) return true;
  if (/\b\d[\d,.]*\s?(customers|users|clients|respondents|stores|locations|tickets|reviews)\b/.test(v)) return true;

  // Chỉ số dịch vụ có tên.
  if (/\b(nps|csat|ces|clv|ltv|churn rate|first contact resolution|fcr|aht|retention rate)\b/.test(v)) return true;

  // Ngôn ngữ phân tích và bằng chứng.
  const phanTich = [
    "case study", "case-study", "research", "study finds", "new study", "survey of",
    "we studied", "experiment", "a/b test", "ab test", "benchmark", "framework",
    "teardown", "postmortem", "post-mortem", "lessons from", "what we learned",
    "how we", "we increased", "we reduced", "we cut", "results show", "data shows",
    "findings", "meta-analysis", "longitudinal", "field study", "white paper",
    "playbook", "deep dive", "breakdown of", "anatomy of"
  ];
  for (const k of phanTich) if (v.includes(k)) return true;

  // Kể tình huống thật, có mốc thời gian.
  if (/(after|over)\s+\d+\s+(month|months|year|years|weeks)/.test(v)) return true;

  return false;
}

/* ---------- nhận diện QUẢNG CÁO / RAO VẶT / CHÀO HÀNG ----------
 * Người đọc cần case study, nghiên cứu, tin ngành, thảo luận có chiều sâu.
 * KHÔNG cần bài chào công cụ, mời mua khóa học, săn khách hàng.
 */
function laQuangCao(text) {
  const v = boDau(text);

  const manh = [
    "sign up now", "sign up today", "book a demo", "request a demo", "get a demo",
    "start your free trial", "claim your", "limited time offer", "use code",
    "discount code", "coupon code", "buy now", "order now", "shop now",
    "dm me", "dm us", "message me", "pm me", "hit me up", "reach out to me",
    "check out my", "check out our new", "i built", "i've built", "ive built",
    "i made a tool", "i launched", "free skill", "free tool",
    "we just launched", "just launched my", "introducing our", "promo",
    "let me know if you're interested", "happy to share it", "link in comments",
    "affiliate", "sponsored post", "buy my course", "my new course", "enroll now",
    // Cố ý KHÔNG để riêng chữ "hiring": bài phân tích thật về nhân sự tuyến đầu
    // cũng dùng chữ đó ("we stopped hiring more agents and fixed the root cause").
    "we are hiring", "we're hiring", "job opening", "apply now",
    "job board", "jobs board", "hiring roundup", "open roles", "now hiring",
    "looking for clients", "offering my services", "freelancer available",
    "upvote if", "please upvote", "follow me on", "subscribe to my newsletter"
  ];
  for (const k of manh) if (v.includes(k)) return true;

  // Giá kèm đơn vị thời gian (kiểu 49$/month) gần như luôn là chào hàng.
  if (/[$£€]\s?\d+\s?\/\s?(mo|month|yr|year|user|seat)/.test(v)) return true;

  return false;
}

/* ---------- nhận diện HỎI ĐÁP CÁ NHÂN / CHUYỆN NGHỀ VỤN ----------
 * Chủ yếu gặp trên Reddit: hỏi xin lời khuyên nghề nghiệp, than công việc, hỏi lương,
 * hỏi nên học gì, hỏi công cụ nào rẻ. Không mang tri thức dịch vụ.
 */
function laHoiDapCaNhan(text) {
  const raw = String(text || "").trim();
  const v = boDau(raw);

  // Chuyện nghề nghiệp cá nhân.
  const ngheNghiep = [
    "career advice", "should i quit", "should i take this job", "resume help",
    "resume review", "cv review", "interview tips", "got an interview",
    "salary expectations", "how much should i charge", "is this salary",
    "am i underpaid", "my boss", "my manager is", "toxic workplace",
    "should i major in", "what degree", "breaking into", "entry level",
    "internship", "first job", "just got fired", "laid off",
    // Hỏi kinh nghiệm phỏng vấn và điều kiện làm việc ở một công ty cụ thể.
    "be interviewed", "interviewing at", "interview at", "interview next week",
    "work life balance", "work-life balance", "working hours", "lay offs", "layoffs",
    "anyone working at", "anyone work at", "insights before i dive",
    // Hỏi lương và hỏi đường thăng tiến.
    "good money", "how much do you make", "pay range", "compensation range",
    "base salary", "as an ic", "individual contributor", "csm to ", "moving into",
    "career change", "career path", "next step in my career"
  ];
  for (const k of ngheNghiep) if (v.includes(k)) return true;

  // Hỏi công cụ rẻ, hỏi ai dùng gì (không có bối cảnh, không có bài học).
  const hoiVat = [
    "what tool do you use", "which tool should i", "any recommendations for a tool",
    "best free", "cheapest", "alternative to", "is it worth buying",
    "rate my", "roast my", "thoughts on my", "what do you think of my",
    "how do i start", "where do i start", "beginner question", "noob question",
    "can someone explain", "eli5", "help me understand"
  ];
  for (const k of hoiVat) {
    // Bài dài và có bằng chứng thì đã được chotGiuLai cứu ở tầng trên.
    if (v.includes(k) && raw.length < 700) return true;
  }

  // Tiêu đề kêu cứu chung chung, không nói vấn đề là gì.
  const keuCuu = [
    "guidance needed", "advice needed", "need advice", "need help", "help needed",
    "any tips", "any advice", "looking for advice", "new to this role",
    "just started as", "first week", "what should i do", "am i wrong",
    "thoughts?", "is this normal", "please help"
  ];
  for (const k of keuCuu) if (v.includes(k) && raw.length < 600) return true;

  // Bài quá ngắn, chỉ một câu hỏi cụt.
  if (raw.length < 90 && /\?$/.test(raw.replace(/\s+$/, ""))) return true;

  // Bài chỉ có mỗi tiêu đề ngắn, không kèm nội dung ("I'm confused."). Không có gì để đọc.
  if (raw.length < 60) return true;

  return false;
}

/* ---------- nhận diện LỐI SỐNG / TÁM CHUYỆN / SPAM ----------
 * Meme, than thở khách hàng khó tính, chuyện phiếm, rừng hashtag.
 */
function laVunVat(text) {
  const raw = String(text || "");
  const v = boDau(raw);

  // Rừng hashtag: gần như luôn là spam.
  if ((raw.match(/#/g) || []).length >= 4) return true;

  // Văng tục trong tiêu đề. Gần như luôn là bài xả giận, không phải bài có bài học.
  if (/\b(fuck|fucking|shit|bullshit|asshole|bitch|piss(ed)? off|screw (you|this))\b/i.test(raw)) return true;

  const vun = [
    "meme", "rant", "just venting", "am i the only one", "unpopular opinion",
    "shower thought", "funny story", "you won't believe", "worst customer ever",
    "karen", "cringe", "hot take", "shitpost", "circlejerk",
    "happy friday", "weekend vibes", "monday motivation", "good morning everyone"
  ];
  for (const k of vun) if (v.includes(k)) return true;

  // Nhân viên tuyến đầu than ca trực. Đây là tiếng nói thật nhưng là chuyện một ca làm,
  // không rút ra được bài học vận hành. Người đọc của app cần góc quản lý.
  const thanCa = [
    "i feel bad", "i don't get paid enough", "i dont get paid enough",
    "my coworker", "my shift", "worst shift", "closed the store", "closing time",
    "my manager made me", "my boss made me", "minimum wage", "retail hell",
    "worked retail", "working retail", "i quit today", "i hate this job",
    "why are customers so", "customers are so", "entitled customer",
    "this lady", "this guy came in", "a customer came in", "customer yelled",
    "i cried", "im so tired of", "i'm so tired of", "tired of dealing with"
  ];
  for (const k of thanCa) if (v.includes(k)) return true;

  return false;
}

/* ---------- chạy ---------- */

const NHOM_HOP_LE = new Set(["case", "tin", "thaoluan"]);

async function chay() {
  const cauHinh = JSON.parse(fs.readFileSync(path.join(THU_MUC, "cau-hinh.json"), "utf8"));

  // CHI_DICH=1: bỏ hẳn bước lấy tin, chỉ lọc lại kho cũ rồi dịch tiếp những bài chưa dịch.
  // Dùng cho lần đầu dịch bù cả kho, khỏi phải ngồi chờ Reddit nhả thêm 10 phút nữa.
  const CHI_DICH = process.env.CHI_DICH === "1";
  const nguonBat = CHI_DICH ? [] : cauHinh.nguon.filter(n => n.trangThai === "bat");

  ghiLog(CHI_DICH
    ? "Chế độ CHỈ DỊCH: không lấy tin mới, chỉ dịch tiếp kho đang có."
    : `Bắt đầu quét ${nguonBat.length} nguồn`);

  const thoRa = [];
  // Reddit đếm số lần gọi theo địa chỉ IP, không theo từng sub. Gọi liền tay là 429.
  // Nghỉ giữa hai lần gọi Reddit là cách rẻ nhất để lấy đủ các sub.
  const NGHI_REDDIT = Number(process.env.NGHI_REDDIT) || 20000;
  let lanRedditCuoi = 0;

  for (const ng of nguonBat) {
    try {
      const laReddit = ng.loai === "reddit";
      if (laReddit) {
        const cho = NGHI_REDDIT - (Date.now() - lanRedditCuoi);
        if (lanRedditCuoi && cho > 0) await nghi(cho);
        lanRedditCuoi = Date.now();
      }
      // Reddit: thử lại nhiều lần hơn và nghỉ dài hơn. Sub nào vẫn lỡ thì lần chạy
      // hôm sau nhặt tiếp, vì dữ liệu được gộp dồn chứ không ghi đè.
      const text = laReddit
        ? await tai(thayEnv(ng.url), 4, 25000)
        : await tai(thayEnv(ng.url));
      let items;
      if (ng.loai === "hn") items = docHN(text);
      else if (ng.loai === "reddit") items = docReddit(text, ng.ten);
      else if (ng.loai === "json") items = docJson(text);
      else items = docFeed(text);

      if (!items.length) { ghiLog(`  ${ng.ten}: đọc được nhưng không thấy tin nào`); continue; }

      // Hacker News: bỏ ngay bài dưới ngưỡng upvote. Đây là bộ lọc chất lượng thật,
      // không phải phỏng đoán, nên đặt sát nguồn cho gọn.
      if (ng.loai === "hn" && ng.diemToiThieu) {
        items = items.filter(x => (x.diem || 0) >= ng.diemToiThieu);
      }
      // Reddit: chỉ lấy N bài đầu của bảng xếp hạng tuần.
      if (ng.loai === "reddit" && ng.soBaiDau) {
        items = items.filter(x => (x.rank || 99) <= ng.soBaiDau);
      }

      items.forEach(it => thoRa.push({
        ...it, nguon: ng.ten, hang: ng.hang,
        nhom: NHOM_HOP_LE.has(ng.nhom) ? ng.nhom : "tin",
        loai: ng.loai || "rss",
        giuTatCa: !!ng.giuTatCa,        // giữ mọi bài, không đòi từ khóa chủ đề
        khongPT: !!ng.khongPhanTich     // bỏ qua góc nhìn AI cho nguồn này
      }));
      ghiLog(`  ${ng.ten}: ${items.length} tin`);
    } catch (e) {
      ghiLog(`  ${ng.ten}: LỖI — ${e.message}`);
    }
  }

  // lọc theo từ khóa
  const locRa = [];
  for (const it of thoRa) {
    if (!it.tieuDe || !it.lien) continue;

    // Google News gắn " - Tên báo" ở cuối tiêu đề và tên báo thật ở thẻ <source>.
    // Bỏ đuôi đó cho tiêu đề sạch, lấy tên báo gốc làm nguồn hiển thị.
    let tieuDe = it.tieuDe;
    let nguonHienThi = it.nguonGoc || it.nguon;
    const laGoogle = /news\.google\.com/i.test(it.lien) || /google\.com\/rss/i.test(it.lien);
    if (it.nguonGoc) {
      const duoi = " - " + it.nguonGoc;
      if (tieuDe.endsWith(duoi)) tieuDe = tieuDe.slice(0, -duoi.length).trim();
    }

    // Mô tả của Google News là một khối HTML danh sách link, không dùng làm tóm tắt.
    let tom = laGoogle ? "" : it.tom;

    const toanVan = tieuDe + " " + (it.tom || "");

    const loaiTru = demTuKhoa(toanVan, cauHinh.tuKhoaLoaiTru);
    const giuBangChung = chotGiuLai(toanVan);
    if (loaiTru.soLan > 0 && !giuBangChung) continue;

    const nganh = demTuKhoa(toanVan, cauHinh.tuKhoaNganh);
    // Nguồn thường: đòi ít nhất 1 từ khóa chủ đề. Nguồn đã chuyên đề (giuTatCa,
    // ví dụ blog NN/g): giữ mọi bài.
    if (!it.giuTatCa && nganh.soLan < 1) continue;

    const chuDe = demTuKhoa(toanVan, cauHinh.tuKhoaChuDe);
    const manh = demTuKhoa(toanVan, cauHinh.tuKhoaManh || []);
    const d = chuanNgay(it.ngay);

    // Mức quan trọng theo nhóm.
    let imp;
    if (it.nhom === "thaoluan") {
      if (it.loai === "hn") {
        imp = (it.diem >= 150) ? "cao" : (it.diem >= 40 ? "vua" : "thap");
      } else {
        imp = (it.rank && it.rank <= 3) ? "vua" : "thap";
      }
    } else if (it.nhom === "case") {
      imp = (manh.soLan >= 1) ? "cao" : "vua";
    } else {
      imp = chamMuc(nganh.soLan, chuDe.soLan, manh.soLan);
    }

    locRa.push({
      d: d ? ngayISO(d) : ngayISO(new Date()),
      src: nguonHienThi,
      hang: it.hang,
      g: it.nhom,
      imp,
      t: tieuDe,
      s: tom.length > 420 ? tom.slice(0, 417).trim() + "…" : tom,
      // Chỗ giữ tạm trước khi AI dịch. Sau lần chạy đầu, .w là tóm tắt tiếng Việt thật.
      w: goiYTam(it.nhom, nganh.trung, manh.trung),
      u: it.lien,
      // Số liệu cộng đồng: chỉ Hacker News có thật.
      diem: it.diem || 0,
      binhLuan: it.binhLuan || 0,
      tl: it.thaoLuan || "",
      khongPT: it.khongPT,
      khoa: [...new Set([...manh.trung, ...nganh.trung, ...chuDe.trung])].slice(0, 8)
    });
  }

  // gộp với dữ liệu cũ, khử trùng lặp theo đường dẫn
  let cu = [];
  let nguonCu = [];
  if (fs.existsSync(FILE_TIN)) {
    try {
      const j = JSON.parse(fs.readFileSync(FILE_TIN, "utf8"));
      cu = j.tin || [];
      nguonCu = j.nguonDaQuet || [];
    } catch (e) { cu = []; }
  }
  // Gộp: bài vừa quét lại LUÔN dùng bản mới, không giữ bản cũ. Nhờ vậy mỗi lần sửa lỗi
  // bóc tách (ví dụ gỡ thẻ HTML trong bài Reddit) là dữ liệu cũ cũng được chữa theo,
  // thay vì ôm cái sai mãi. Riêng phần AI đã trả tiền (w, y, wa) thì bê nguyên từ bản cũ
  // sang để khỏi phải dịch lại.
  const cuTheoU = new Map(cu.map(x => [x.u, x]));
  for (const x of locRa) {
    const c = cuTheoU.get(x.u);
    if (c && c.wa) { x.w = c.w; x.y = c.y; x.wa = c.wa; }
  }
  const daLoc = [...locRa, ...cu]
    .filter((x, i, a) => a.findIndex(y => y.u === x.u) === i)
    .filter(x => {
      const t = (x.t || "") + " " + (x.s || "");
      // Bài ra mắt sản phẩm trên Hacker News ("Launch HN: ...", "Show HN: ..."). Bỏ thẳng,
      // đặt TRƯỚC chốt giữ lại, vì bài loại này hay khoe "500 khách hàng, tăng 40%" nên
      // chốt giữ lại sẽ cứu nhầm. Neo vào đầu tiêu đề để không đụng bài bàn về chúng.
      if (/^(launch|show)\s+hn\b/i.test(String(x.t || "").trim())) return false;
      // Chốt giữ lại số một: đã có nhiều người thật bấm ủng hộ. Điểm upvote đáng tin hơn
      // mọi phỏng đoán của bộ lọc. Không có nó thì "Ask HN: Will low quality AI customer
      // support be the new normal?" (27 điểm, 32 bình luận) bị bỏ chỉ vì tiêu đề ngắn
      // và kết thúc bằng dấu hỏi.
      if ((x.diem || 0) >= 20) return true;
      // Chốt giữ lại số hai: bài có số liệu, nghiên cứu, tình huống thật.
      if (chotGiuLai(t)) return true;
      if (laQuangCao(t)) return false;
      if (laVunVat(t)) return false;
      // Hỏi đáp cá nhân chỉ áp cho nhóm thảo luận; bài báo hiếm khi dính.
      if (x.g === "thaoluan" && laHoiDapCaNhan(t)) return false;
      return true;
    })
    .sort((a, b) => b.d.localeCompare(a.d));

  // Cắt trần RIÊNG cho từng nhóm, để nhóm đăng dày (tin) không lấn chỗ của
  // nhóm đăng thưa (case study, thảo luận).
  const tinCase = daLoc.filter(x => x.g === "case").slice(0, cauHinh.soTinCase || 90);
  const tinTin = daLoc.filter(x => x.g === "tin").slice(0, cauHinh.soTinTin || 140);
  const tinTL = daLoc.filter(x => x.g === "thaoluan").slice(0, cauHinh.soTinThaoLuan || 90);
  const tatCa = [...tinCase, ...tinTin, ...tinTL];

  // Đếm bài mới SAU khi đã lọc và cắt trần, không đếm lúc vừa quét về. Mỗi lượt quét kéo
  // về hơn nghìn bài thô mà giữ lại vài chục; đếm ở đầu vào thì con số trong nhật ký vô
  // nghĩa và file lịch sử ngày phình toàn bài đã bị bỏ.
  const moi = tatCa.filter(x => !cuTheoU.has(x.u));

  const soanKetQua = () => ({
    capNhatLuc: new Date().toISOString(),
    soTin: tatCa.length,
    tinMoiLanNay: moi.length,
    theoNhom: { case: tinCase.length, tin: tinTin.length, thaoluan: tinTL.length },
    // Chế độ chỉ dịch không quét nguồn nào, giữ lại danh sách của lần quét trước
    // để dòng trạng thái trên trang không tụt về "0 nguồn".
    nguonDaQuet: CHI_DICH ? nguonCu : nguonBat.map(n => n.ten),
    tin: tatCa
  });
  fs.mkdirSync(LICH_SU, { recursive: true });
  const ghiFileTin = () => fs.writeFileSync(FILE_TIN, JSON.stringify(soanKetQua(), null, 1), "utf8");

  // Tạo tóm tắt tiếng Việt + góc nhìn ứng dụng cho các tin chưa có.
  // Ưu tiên case study trước, vì đó là tab người đọc vào đầu tiên.
  await boSungYKien(tatCa, ghiFileTin);

  const ketQua = soanKetQua();
  ghiFileTin();
  chenSSR(tinCase.length ? tinCase : tinTin); // SSR tab đầu tiên (Case study) cho SEO
  fs.writeFileSync(
    path.join(LICH_SU, ngayISO(new Date()) + ".json"),
    JSON.stringify({ capNhatLuc: ketQua.capNhatLuc, tin: moi }, null, 1),
    "utf8"
  );
  donLichSu(cauHinh.soNgayGiuLichSu);

  ghiLog(`Xong. ${moi.length} tin mới, tổng ${tatCa.length} tin (case ${tinCase.length}, tin ${tinTin.length}, thảo luận ${tinTL.length}).`);
  if (moi.length) {
    ghiLog("Tin mới nổi bật:");
    moi.filter(x => x.imp === "cao").slice(0, 5).forEach(x => ghiLog(`  · ${x.t}`));
  }
  return ketQua;
}

// Câu giữ chỗ trước khi AI dịch xong. Không để trống để trang không bị hụt.
function goiYTam(nhom, nganh, manh) {
  const dau = nhom === "case" ? "Case study Service Marketing."
    : nhom === "thaoluan" ? "Thảo luận từ cộng đồng người làm nghề."
      : "Tin ngành hoặc nghiên cứu mới.";
  if (manh.length) return `${dau} Có tín hiệu bằng chứng: ${manh.slice(0, 3).join(", ")}. Bản dịch tiếng Việt sẽ có sau lần chạy phân tích tới.`;
  if (nganh.length) return `${dau} Liên quan tới ${nganh.slice(0, 3).join(", ")}. Bản dịch tiếng Việt sẽ có sau lần chạy phân tích tới.`;
  return `${dau} Bản dịch tiếng Việt sẽ có sau lần chạy phân tích tới.`;
}

function donLichSu(soNgay) {
  try {
    const han = Date.now() - soNgay * 86400000;
    for (const f of fs.readdirSync(LICH_SU)) {
      const p = path.join(LICH_SU, f);
      if (fs.statSync(p).mtimeMs < han) fs.unlinkSync(p);
    }
  } catch (e) { /* bỏ qua */ }
}

if (require.main === module) {
  chay().catch(e => { ghiLog("LỖI NGHIÊM TRỌNG: " + e.message); process.exit(1); });
}

module.exports = {
  chay, docFeed, docReddit, docHN, docJson, thayEnv, chuanNgay, goHtml, boDau,
  chotGiuLai, laQuangCao, laHoiDapCaNhan, laVunVat
};
