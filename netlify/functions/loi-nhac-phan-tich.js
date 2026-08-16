/**
 * ĐIỂM CHẠM — Lời nhắc và lệnh gọi cho phần dịch + Góc nhìn ứng dụng.
 *
 * Đặt riêng ra một file để CHỈ CÓ MỘT BẢN lời nhắc. Hai nơi dùng chung nó:
 *   - netlify/functions/phan-tich.js  (khi app chạy trên Netlify)
 *   - diem-cham-app/thu-thap.js       (khi anh chạy bộ quét ngay trên máy)
 * Nếu chép lời nhắc ra hai chỗ thì sớm muộn hai bản sẽ lệch giọng nhau.
 *
 * File nằm trong thư mục netlify/functions để Netlify chắc chắn đóng gói theo.
 */

const MODEL = "claude-sonnet-5";

const HE_THONG = [
  "Bạn là chuyên gia Service Marketing và Trải nghiệm khách hàng, cố vấn cho chủ doanh nghiệp dịch vụ và người làm marketing, CX, CS tại Việt Nam.",
  "Bạn đọc mọi bài qua lăng kính dịch vụ: điểm chạm khách hàng, hành trình khách hàng, con người tuyến đầu, quy trình, đo lường, phục hồi sau sự cố dịch vụ.",
  "Với mỗi bài, viết đúng hai phần, thật ngắn gọn:",
  "1. tomTat: tóm tắt nội dung bài trong 1 tới 2 câu, TỐI ĐA 45 TỪ, tiếng Việt dễ hiểu cho người trong nghề.",
  "2. yKien: đúng MỘT câu góc nhìn ứng dụng cho doanh nghiệp dịch vụ Việt Nam, TỐI ĐA 40 TỪ, gợi ý điều nên lưu ý hoặc nên làm, thực tế và cụ thể, không nói suông.",
  "Giới hạn số từ là bắt buộc. Một câu là một câu, không nối thêm vế bằng dấu phẩy hay dấu chấm phẩy cho dài ra. Viết xong thử bỏ bớt chữ mà nghĩa vẫn nguyên.",
  "",
  "QUAN TRỌNG về câu yKien: người đọc lướt hàng trăm bài liền nhau, mở đầu giống hệt nhau là đọc không vào.",
  "TUYỆT ĐỐI không mở đầu bằng 'Doanh nghiệp dịch vụ Việt Nam nên', 'Doanh nghiệp dịch vụ nên', hay bất kỳ biến thể nào của cụm đó.",
  "Nếu tin nhắn có dòng 'Kiểu mở đầu lần này', hãy theo đúng kiểu đó. Không có thì tự chọn một kiểu và đừng dùng chữ 'Thử'.",
  "",
  "Câu ngắn, từ thông dụng. Không dùng dấu gạch ngang dài. Không dùng các từ rỗng như kiến tạo, lan tỏa, nâng tầm, truyền cảm hứng, cuộc cách mạng. Không lặp lại nguyên văn tiêu đề.",
  "Nguồn phần lớn bằng tiếng Anh. Luôn tóm tắt và viết góc nhìn BẰNG TIẾNG VIỆT, không giữ nguyên tiếng Anh. Thuật ngữ chuyên ngành giữ tiếng Anh thì kèm nghĩa Việt trong ngoặc.",
  "Hệ thống hỗ trợ con người, không nâng, không bẻ. Luôn nói đi cùng, không nói đi theo. Con người là nhân, lợi nhuận là quả.",
].join("\n");

const NHAN_NHOM = {
  case: "Đây là một case study hoặc bài phân tích thực chiến.",
  tin: "Đây là tin ngành hoặc bài nghiên cứu học thuật.",
  thaoluan: "Đây là một bài thảo luận trên cộng đồng Reddit hoặc Hacker News, giọng người trong nghề, không phải bài báo.",
};

/**
 * Sáu kiểu mở đầu cho câu "Góc nhìn ứng dụng", luân phiên theo thứ tự bài.
 *
 * Mỗi lần gọi Claude là một cuộc hội thoại riêng, nó không biết bài trước đã mở thế nào,
 * nên nếu để tự do thì hàng trăm câu sẽ mở gần giống nhau hết. Ép luân phiên từ ngoài là
 * cách chắc chắn nhất để cả trang đọc không bị đều đều.
 */
const KIEU_MO = [
  "Bắt đầu bằng một việc cụ thể phải làm, dùng động từ đứng đầu câu (Rà lại, Đo, Ghi, Tách, Hỏi, Cắt...).",
  "Bắt đầu bằng một câu hỏi để người đọc tự soi lại chỗ mình.",
  "Bắt đầu bằng một mốc thời gian hoặc điều kiện (Trước khi..., Sau mỗi..., Nếu...).",
  "Bắt đầu bằng một tình huống cụ thể ở quán ăn, spa, phòng khám, cửa hàng, tổng đài hoặc phòng tập.",
  "Bắt đầu bằng con số hoặc chỉ số cần theo dõi.",
  "Bắt đầu bằng cái bẫy hay gặp, kiểu 'Chỗ dễ nhầm là...' hoặc 'Cái khó không nằm ở...'.",
];

function soanTinNhan({ tieuDe, tomTat, nhom, thuTu }) {
  const kieu = Number.isInteger(thuTu) ? KIEU_MO[thuTu % KIEU_MO.length] : "";
  return [
    "Bài về Service Marketing / Trải nghiệm khách hàng:",
    NHAN_NHOM[nhom] || "",
    "Tiêu đề: " + tieuDe,
    "Tóm tắt: " + (tomTat || "(không có, hãy suy ra từ tiêu đề)"),
    kieu ? "\nKiểu mở đầu lần này cho câu yKien: " + kieu : "",
  ].filter(Boolean).join("\n");
}

/**
 * Gọi Claude, trả về { tomTat, yKien }.
 * Ném lỗi khi gọi hỏng để nơi gọi tự quyết định thử lại hay bỏ qua.
 * Khóa truyền vào từ bên ngoài, file này không tự đọc biến môi trường.
 */
async function phanTichBai({ key, tieuDe, tomTat, nhom, thuTu, signal }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      // 1000 chứ không phải 320. Tiếng Việt tốn token hơn tiếng Anh nhiều, để chật thì
      // câu trả lời bị cắt giữa chừng, khối JSON hụt dấu ngoặc và không đọc ra được.
      // Giới hạn số từ nằm ở lời nhắc; trần token này chỉ là lưới an toàn.
      max_tokens: 1000,
      // Tắt thinking. Đây là việc ngắn và có khuôn sẵn, không cần suy nghĩ dài.
      // Quan trọng hơn: phần thinking ĐẾM VÀO max_tokens. Bật nó thì nhiều bài tiêu
      // hai ba trăm token để nghĩ rồi mới viết, chạm trần giữa chừng và hỏng khối JSON.
      thinking: { type: "disabled" },
      system: HE_THONG,
      messages: [{ role: "user", content: soanTinNhan({ tieuDe, tomTat, nhom, thuTu }) }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: { tomTat: { type: "string" }, yKien: { type: "string" } },
            required: ["tomTat", "yKien"],
            additionalProperties: false,
          },
        },
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const e = new Error((data && data.error && data.error.message) || ("HTTP " + res.status));
    e.tenLoi = "api";
    throw e;
  }

  const raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  let out;
  try { out = JSON.parse(raw); } catch { out = null; }
  if (!out || !out.tomTat || !out.yKien) {
    // Phân biệt rõ hai kiểu hỏng, vì cách chữa khác hẳn nhau: bị cắt vì hết token thì
    // nới max_tokens, còn trả về sai định dạng thì phải xem lại lời nhắc.
    const biCat = data.stop_reason === "max_tokens";
    const e = new Error(biCat
      ? "câu trả lời bị cắt vì chạm trần token, hãy nới max_tokens"
      : "không đọc được kết quả: " + raw.slice(0, 160));
    e.tenLoi = biCat ? "cut_token" : "khong_doc_duoc";
    throw e;
  }
  return { tomTat: String(out.tomTat).trim(), yKien: String(out.yKien).trim() };
}

module.exports = { MODEL, HE_THONG, soanTinNhan, phanTichBai };
