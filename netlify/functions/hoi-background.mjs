/**
 * ĐIỂM CHẠM — Hàm NỀN Hỏi nhanh (AI Agent có tra web). Netlify Functions v2.
 * Tên kết thúc bằng "-background" nên đây là Background Function: chạy tới 15 phút,
 * không bị timeout 26 giây như hàm đồng bộ. Nhờ vậy Claude có đủ thời gian tra web
 * nhiều lượt rồi tổng hợp. Kết quả ghi vào kho tạm Netlify Blobs theo "id" do trình
 * duyệt tạo; trang web hỏi kết quả qua hàm hoi-ket-qua.
 * Dùng API v2 để Netlify tự cấu hình môi trường Blobs (bản v1 báo MissingBlobsEnvironmentError).
 *
 * Lời nhắc và lệnh gọi Claude nằm ở loi-nhac-hoi.js, dùng chung với máy chủ chạy tại máy.
 * API key giữ ở phía máy chủ qua ANTHROPIC_API_KEY (đặt trong Netlify).
 */
import { getStore } from "@netlify/blobs";
import loiNhacHoi from "./loi-nhac-hoi.js";

const { hoiTroLy } = loiNhacHoi;

export default async (req) => {
  // Background function: Netlify đã trả 202 cho trình duyệt, giá trị trả về ở đây bị bỏ qua.
  let body;
  try { body = await req.json(); }
  catch { return new Response("", { status: 400 }); }

  const id = String((body && body.id) || "").slice(0, 80);
  if (!id) return new Response("", { status: 400 });

  const store = getStore("hoi-ketqua");
  const ghi = async (obj) => { try { await store.setJSON(id, obj); } catch (e) { /* bỏ qua */ } };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { await ghi({ xong: true, loi: "chua_co_key" }); return new Response(""); }

  const cauHoi = String((body && body.cauHoi) || "").trim().slice(0, 2000);
  if (!cauHoi) { await ghi({ xong: true, loi: "thieu_cau_hoi" }); return new Response(""); }

  try {
    const traLoi = await hoiTroLy({
      key,
      cauHoi,
      kho: String((body && body.kho) || "").slice(0, 6000),
      lichSu: body && body.lichSu,
    });
    await ghi({ xong: true, traLoi });
  } catch (e) {
    await ghi({ xong: true, loi: e.tenLoi || "mang", chiTiet: String((e && e.message) || e) });
  }

  return new Response("");
};
