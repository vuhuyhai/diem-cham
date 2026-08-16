/**
 * ĐIỂM CHẠM — Hàm nền phân tích tin cho mục "Tóm tắt tiếng Việt"
 * Nhận tiêu đề + tóm tắt một bài Service Marketing (phần lớn tiếng Anh), trả về:
 *   - tomTat: tóm tắt 1-2 câu BẰNG TIẾNG VIỆT
 *   - yKien:  đúng 1 câu "Góc nhìn ứng dụng" cho chủ doanh nghiệp dịch vụ và marketer Việt
 *
 * Lời nhắc và lệnh gọi Claude nằm ở loi-nhac-phan-tich.js, dùng chung với bộ quét chạy
 * ở máy. API key lấy từ biến môi trường ANTHROPIC_API_KEY của Netlify.
 */

const { phanTichBai } = require("./loi-nhac-phan-tich.js");

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers, body: JSON.stringify({ loi: "chi_nhan_post" }) };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { statusCode: 200, headers, body: JSON.stringify({ loi: "chua_co_key" }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ loi: "body_hong" }) }; }

  const tieuDe = String(body.tieuDe || "").trim().slice(0, 500);
  const tomTat = String(body.tomTat || "").trim().slice(0, 1200);
  const nhom = String(body.nhom || "").trim().slice(0, 40);
  // Số thứ tự bài, để lời nhắc luân phiên kiểu mở đầu câu Góc nhìn ứng dụng.
  const thuTu = Number.isInteger(body.thuTu) ? body.thuTu : undefined;
  if (!tieuDe) return { statusCode: 400, headers, body: JSON.stringify({ loi: "thieu_tieu_de" }) };

  try {
    const kq = await phanTichBai({ key, tieuDe, tomTat, nhom, thuTu });
    return { statusCode: 200, headers, body: JSON.stringify(kq) };
  } catch (e) {
    // Luôn trả 200 kèm mã lỗi, để bộ quét đọc được lý do thay vì chỉ thấy HTTP 500.
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ loi: e.tenLoi || "mang", chiTiet: String((e && e.message) || e) }),
    };
  }
};
