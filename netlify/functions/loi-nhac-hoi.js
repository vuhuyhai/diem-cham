/**
 * ĐIỂM CHẠM — Lời nhắc và lệnh gọi cho trợ lý "Hỏi nhanh" (có tra web).
 *
 * Đặt riêng ra một file CommonJS để dùng chung ở hai nơi:
 *   - netlify/functions/hoi-background.mjs  (khi app chạy trên Netlify, kết quả vào Blobs)
 *   - diem-cham-app/may-chu.js              (khi anh chạy app ngay trên máy, kết quả giữ trong bộ nhớ)
 * Nhờ vậy câu trả lời ở máy và trên mạng giống hệt nhau về giọng và luật.
 */

const MODEL = "claude-sonnet-5";

const LUAT = [
  "Bạn là cố vấn Service Marketing và Trải nghiệm khách hàng tại Việt Nam, trả lời cho chủ doanh nghiệp dịch vụ, marketer, và người làm CX, CS.",
  "Bạn nhìn mọi việc qua lăng kính dịch vụ: điểm chạm khách hàng, hành trình khách hàng, con người tuyến đầu, quy trình, đo lường, và phục hồi sau sự cố dịch vụ.",
  "",
  "Bạn là một trợ lý có thể TRA CỨU WEB. Bạn có công cụ web_search để tìm và tổng hợp thông tin mới trên internet, không chỉ trả lời từ trí nhớ.",
  "",
  "Khi nào tra web:",
  "- Tra web khi câu hỏi cần dữ kiện mới: số liệu, nghiên cứu, case study, xu hướng, tin ngành gần đây, hay hỏi một chuyện có thật hay không. Hãy tự tra rồi mới trả lời.",
  "- Câu hỏi nguyên tắc dịch vụ đã rõ thì trả lời thẳng từ kiến thức của bạn, không cần tra.",
  "- Khi đã tra web, hãy dẫn nguồn: nêu tên trang và đường link để người đọc tự kiểm chứng.",
  "",
  "Nguyên tắc bắt buộc:",
  "1. Trả lời trong phạm vi Service Marketing, trải nghiệm khách hàng, chăm sóc khách hàng, thiết kế dịch vụ, giữ chân khách, và vận hành doanh nghiệp dịch vụ. Câu hỏi ngoài phạm vi thì nói thẳng là ngoài phạm vi và dừng.",
  "2. Cụ thể, thực chiến, đưa được ra bước làm hoặc con số để người đọc dùng ngay. Tránh lời khuyên chung chung ai cũng gật.",
  "3. Không bịa số liệu thị trường, tên doanh nghiệp, hay tên nghiên cứu. Nếu tra web không ra thì nói thẳng là chưa tìm được, đừng bịa.",
  "4. Nguồn quốc tế thì dịch ý sang tiếng Việt, đừng bê nguyên đoạn tiếng Anh. Thuật ngữ giữ tiếng Anh thì kèm nghĩa Việt lần đầu.",
  "5. Luôn quy về bối cảnh doanh nghiệp dịch vụ Việt Nam: quy mô vừa và nhỏ, đội ngũ mỏng, ngân sách hạn chế. Nói rõ cái gì áp dụng được ngay, cái gì cần điều chỉnh.",
  "6. Trả lời bằng tiếng Việt, câu ngắn, từ thông dụng, dễ hiểu. Không dùng dấu gạch ngang dài.",
  "7. Không dùng từ rỗng: kiến tạo, lan tỏa, nâng tầm, truyền cảm hứng, cuộc cách mạng.",
  "8. Tinh thần H-OE: hệ thống hỗ trợ con người, không nâng không bẻ; con người là nhân, lợi nhuận là quả; luôn đi cùng, không đi theo.",
  "9. CHỈ xuất câu trả lời cuối cùng cho người đọc. KHÔNG kể lại quá trình tra cứu, không viết những câu như 'tôi tra web', 'tôi thử lại', không mô tả các bước bạn đang làm. Vào thẳng nội dung.",
].join("\n");

/**
 * Hỏi trợ lý, có tra web. Trả về chuỗi câu trả lời đã kèm mục Nguồn (nếu có trích dẫn).
 * Ném lỗi khi gọi hỏng, nơi gọi tự quyết định ghi lỗi thế nào.
 */
async function hoiTroLy({ key, cauHoi, kho, lichSu }) {
  const system = LUAT + (kho
    ? "\n\nCác chủ đề đang theo dõi trong app, dùng để đối chiếu khi liên quan:\n" + kho
    : "");

  const messages = [];
  for (const m of (Array.isArray(lichSu) ? lichSu.slice(-8) : [])) {
    if (m && (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" && m.content.trim()) {
      messages.push({ role: m.role, content: m.content.slice(0, 4000) });
    }
  }
  messages.push({ role: "user", content: cauHoi });

  // Dùng bản web_search cơ bản (không lọc động bằng code) cho nhanh, hợp với "hỏi nhanh".
  const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];

  const goiClaude = async () => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        // Tắt thinking để trả nhanh; hướng dẫn trong LUAT đủ để nó chủ động tra web.
        thinking: { type: "disabled" },
        system,
        messages,
        tools,
      }),
    });
    return { res, data: await res.json() };
  };

  // Công cụ tra web chạy phía máy chủ Anthropic. Vòng lặp tra dài thì API dừng
  // với stop_reason "pause_turn"; ta nối lại rồi gọi tiếp cho nó chạy nốt.
  let data;
  for (let i = 0; i < 4; i++) {
    const r = await goiClaude();
    if (!r.res.ok) {
      const e = new Error((r.data && r.data.error && r.data.error.message) || ("HTTP " + r.res.status));
      e.tenLoi = "api";
      throw e;
    }
    data = r.data;
    if (data.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: data.content });
  }

  const blocks = (data && data.content) || [];
  const traLoi = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();

  // Gom nguồn từ các trích dẫn web (nếu có) để hiện cho người đọc kiểm chứng.
  const nguon = [];
  const daCo = new Set();
  for (const b of blocks) {
    if (b.type !== "text" || !Array.isArray(b.citations)) continue;
    for (const c of b.citations) {
      const url = c && c.url;
      if (!url || daCo.has(url)) continue;
      daCo.add(url);
      nguon.push({ url, tieuDe: c.title || url });
    }
  }

  let output = traLoi || "(không có nội dung)";
  if (nguon.length) {
    output += "\n\n**Nguồn:**\n" +
      nguon.slice(0, 8).map((n) => `- [${n.tieuDe}](${n.url})`).join("\n");
  }
  return output;
}

module.exports = { MODEL, LUAT, hoiTroLy };
