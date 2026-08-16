/**
 * ĐIỂM CHẠM — Hàm hỏi KẾT QUẢ Hỏi nhanh (Netlify Functions v2).
 * Trình duyệt hỏi lặp lại (poll) hàm này với ?id=... cho tới khi bản nền
 * hoi-background ghi xong kết quả vào kho tạm Netlify Blobs.
 * Trả { xong:false } khi chưa có, hoặc { xong:true, traLoi / loi } khi đã có.
 * Dùng API v2 để Netlify tự cấu hình môi trường Blobs (bản v1 báo thiếu context).
 */
import { getStore } from "@netlify/blobs";

export default async (req) => {
  const url = new URL(req.url);
  const id = String(url.searchParams.get("id") || "").slice(0, 80);
  const headers = { "Cache-Control": "no-store" };

  if (!id) return Response.json({ loi: "thieu_id" }, { status: 400, headers });

  const store = getStore("hoi-ketqua");
  let val = null;
  try { val = await store.get(id, { type: "json" }); }
  catch (e) { return Response.json({ xong: false }, { headers }); }

  if (!val) return Response.json({ xong: false }, { headers });

  // Lấy xong thì xóa để kho khỏi phình. Poll tuần tự nên không lo tranh chấp.
  try { await store.delete(id); } catch (e) { /* bỏ qua */ }

  return Response.json(val, { headers });
};
