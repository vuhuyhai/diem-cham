/**
 * ĐIỂM CHẠM — Thử từng nguồn trong cau-hinh.json
 * Chạy:  node kiem-tra-nguon.js
 * In ra mỗi nguồn tải được bao nhiêu bài, để biết nguồn nào nên bật hoặc tắt.
 *
 * Reddit chặn tốc độ theo IP nên bản kiểm tra này cũng nghỉ giữa các lần gọi Reddit.
 * Chạy hết một lượt mất vài phút, đó là bình thường.
 */
const fs = require("fs");
const path = require("path");
const { docFeed, docReddit, docHN, docJson, thayEnv } = require("./thu-thap.js");

const nghi = (ms) => new Promise(r => setTimeout(r, ms));

async function tai(url, soLanThu = 3) {
  let doiMs = 15000;
  for (let lan = 1; ; lan++) {
    const ctrl = new AbortController();
    const hen = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal, redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Accept": "application/rss+xml, application/xml, text/xml, application/atom+xml, application/json, */*",
          "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
          "Cookie": "CONSENT=YES+1"
        }
      });
      if ((res.status === 429 || res.status === 503) && lan < soLanThu) {
        clearTimeout(hen);
        await nghi(doiMs); doiMs *= 2; continue;
      }
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.text();
    } finally { clearTimeout(hen); }
  }
}

(async () => {
  const ch = JSON.parse(fs.readFileSync(path.join(__dirname, "cau-hinh.json"), "utf8"));
  let lanReddit = 0;
  for (const ng of ch.nguon) {
    if (!ng.url || ng.url.includes("THAY_BANG") || ng.url.includes("DAN_URL")) {
      console.log(`[bỏ qua] ${ng.ten} — chưa điền URL thật`);
      continue;
    }
    if (ng.loai === "reddit") {
      const cho = 12000 - (Date.now() - lanReddit);
      if (lanReddit && cho > 0) await nghi(cho);
      lanReddit = Date.now();
    }
    try {
      const text = await tai(thayEnv(ng.url));
      const items = ng.loai === "hn" ? docHN(text)
        : ng.loai === "reddit" ? docReddit(text, ng.ten)
          : ng.loai === "json" ? docJson(text)
            : docFeed(text);
      const them = ng.loai === "hn" && items.length
        ? ` · điểm cao nhất ${Math.max(...items.map(x => x.diem || 0))}` : "";
      console.log(`[${items.length ? "OK " : "RỖNG"}] ${ng.ten} (${ng.trangThai}, ${ng.nhom}) — ${items.length} bài${them}`);
      if (items.length) console.log(`         ↳ ${String(items[0].tieuDe).slice(0, 78)}`);
    } catch (e) {
      console.log(`[LỖI] ${ng.ten} (${ng.trangThai}) — ${e.message}`);
    }
  }
})();
