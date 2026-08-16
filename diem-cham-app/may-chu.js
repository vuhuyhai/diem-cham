/**
 * ĐIỂM CHẠM — Máy chủ nhỏ để dùng app ngay trên máy, không cần deploy.
 * Chạy:  node may-chu.js       (rồi mở http://localhost:8765)
 *        node may-chu.js 9000  (đổi cổng)
 *
 * Không cần cài gì. Chỉ dùng module có sẵn của Node.
 * Phải xem qua máy chủ chứ đừng mở thẳng file index.html: mở thẳng file thì trình duyệt
 * chặn lệnh đọc du-lieu/tin-tuc.json, trang sẽ trống.
 *
 * Máy chủ này phục vụ hai việc:
 *   1. Trả file tĩnh (index.html, du-lieu/tin-tuc.json, ảnh...).
 *   2. Đóng vai hai hàm nền của Netlify cho tab Hỏi nhanh, để ở máy cũng hỏi được:
 *        POST /.netlify/functions/hoi-background   nhận câu hỏi, chạy nền, trả 202
 *        GET  /.netlify/functions/hoi-ket-qua?id=  hỏi kết quả
 *      Trên Netlify kết quả để trong Blobs; ở đây chỉ cần giữ trong bộ nhớ, vì tắt máy
 *      chủ là hết phiên. Dùng chung một bản lời nhắc với hàm nền thật.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const GOC = __dirname;
const CONG = Number(process.argv[2]) || 8765;

const KHOA = process.env.ANTHROPIC_API_KEY || "";
let hoiTroLy = null;
try { ({ hoiTroLy } = require("../netlify/functions/loi-nhac-hoi.js")); }
catch (e) { /* thiếu file thì tab Hỏi nhanh tự rơi về kho câu trả lời có sẵn */ }

// Kết quả Hỏi nhanh đang chờ, theo id do trình duyệt sinh ra.
const khoHoi = new Map();

function docBody(req) {
  return new Promise((giai, hong) => {
    let s = "";
    req.on("data", (c) => {
      s += c;
      if (s.length > 200000) { req.destroy(); hong(new Error("body qua lon")); }
    });
    req.on("end", () => giai(s));
    req.on("error", hong);
  });
}

const traJson = (res, obj, ma = 200) => {
  res.writeHead(ma, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(obj));
};

async function xuLyHoiNhanh(req, res, duong, truyVan) {
  if (duong.endsWith("/hoi-ket-qua")) {
    const id = String(truyVan.get("id") || "");
    if (!id) return traJson(res, { loi: "thieu_id" }, 400);
    const val = khoHoi.get(id);
    if (!val) return traJson(res, { xong: false });
    khoHoi.delete(id); // lấy xong thì xóa, giống hàm thật
    return traJson(res, val);
  }

  // hoi-background: trả 202 ngay rồi chạy tiếp phía sau, đúng như Netlify.
  let body = {};
  try { body = JSON.parse(await docBody(req) || "{}"); } catch (e) { return traJson(res, {}, 400); }
  const id = String(body.id || "").slice(0, 80);
  if (!id) return traJson(res, { loi: "thieu_id" }, 400);

  res.writeHead(202, { "content-type": "application/json; charset=utf-8" });
  res.end("{}");

  if (!KHOA || !hoiTroLy) { khoHoi.set(id, { xong: true, loi: "chua_co_key" }); return; }
  const cauHoi = String(body.cauHoi || "").trim().slice(0, 2000);
  if (!cauHoi) { khoHoi.set(id, { xong: true, loi: "thieu_cau_hoi" }); return; }

  console.log("  [Hỏi nhanh] đang tra web: " + cauHoi.slice(0, 70).replace(/\s+/g, " "));
  try {
    const traLoi = await hoiTroLy({
      key: KHOA, cauHoi,
      kho: String(body.kho || "").slice(0, 6000),
      lichSu: body.lichSu,
    });
    khoHoi.set(id, { xong: true, traLoi });
    console.log("  [Hỏi nhanh] xong.");
  } catch (e) {
    khoHoi.set(id, { xong: true, loi: e.tenLoi || "mang", chiTiet: String((e && e.message) || e) });
    console.log("  [Hỏi nhanh] lỗi: " + String((e && e.message) || e));
  }
}

const KIEU = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

const may = http.createServer((req, res) => {
  const dayDu = new URL(String(req.url), "http://localhost");
  let duong = decodeURIComponent(dayDu.pathname);

  if (duong.startsWith("/.netlify/functions/")) {
    xuLyHoiNhanh(req, res, duong, dayDu.searchParams)
      .catch((e) => { try { traJson(res, { loi: "mang", chiTiet: String(e.message) }, 500); } catch (x) {} });
    return;
  }

  if (duong === "/") duong = "/index.html";
  const tep = path.join(GOC, duong);

  // Chặn đi ngược ra ngoài thư mục app.
  if (!tep.startsWith(GOC)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    return res.end("Không được phép");
  }

  fs.readFile(tep, (loi, du) => {
    if (loi) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      return res.end("Không thấy: " + duong);
    }
    res.writeHead(200, {
      "content-type": KIEU[path.extname(tep).toLowerCase()] || "application/octet-stream",
      // Không cho nhớ tạm, để quét tin xong bấm tải lại là thấy bài mới ngay.
      "cache-control": "no-store",
    });
    res.end(du);
  });
});

may.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`Cổng ${CONG} đang bận. Có thể app đã chạy sẵn ở http://localhost:${CONG}`);
    console.error(`Muốn dùng cổng khác:  node may-chu.js 9000`);
  } else {
    console.error("Lỗi máy chủ:", e.message);
  }
  process.exit(1);
});

may.listen(CONG, () => {
  console.log("");
  console.log("  ĐIỂM CHẠM đang chạy tại:  http://localhost:" + CONG);
  console.log("  Hỏi nhanh: " + (KHOA && hoiTroLy
    ? "bật, có tra web"
    : "tắt (chưa đặt ANTHROPIC_API_KEY), sẽ trả lời tạm từ kho có sẵn"));
  console.log("  Bấm Ctrl + C để dừng.");
  console.log("");
});
