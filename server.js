require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

// Cho phép nhận payload base64 / dữ liệu dung lượng lớn (ảnh, file)
app.use(express.json({ limit: "20mb" }));

// Serves static files từ thư mục hiện tại
app.use(express.static(path.join(__dirname)));

// Kiểm tra trạng thái server & API Key
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    apiKeyConfigured: Boolean(API_KEY),
    port: PORT
  });
});

// Endpoint chat với Gemini
app.post("/api/chat", async (req, res) => {
  try {
    const {
      message,
      model = "gemini-2.5-flash",
      history = [],
      systemPrompt = "Bạn là KAISOUL AI, chuyên gia lập trình. Không bịa thông tin.",
      fileData = null
    } = req.body;

    if (!API_KEY) {
      return res.status(500).json({
        error: "Chưa cấu hình GEMINI_API_KEY trong file .env"
      });
    }

    if ((!message || typeof message !== "string") && !fileData) {
      return res.status(400).json({
        error: "Nội dung tin nhắn hoặc file không hợp lệ."
      });
    }

    const contents = [];

    // Lọc và chuyển đổi lịch sử hội thoại
    if (Array.isArray(history)) {
      const filteredHistory = history.slice(-20).filter((item, index, arr) => {
        if (!item || !item.content) return false;
        // Loại bỏ phần tử cuối nếu lỡ bị trùng với tin nhắn người dùng vừa gửi
        if (index === arr.length - 1 && item.role === "user" && item.content === message) {
          return false;
        }
        return true;
      });

      for (const item of filteredHistory) {
        contents.push({
          role: item.role === "assistant" || item.role === "model" ? "model" : "user",
          parts: [{ text: String(item.content) }]
        });
      }
    }

    // Chuẩn bị parts cho tin nhắn hiện tại
    const currentParts = [];

    // Nếu người dùng gửi kèm file/ảnh dạng Base64
    if (fileData && fileData.mimeType && fileData.data) {
      currentParts.push({
        inlineData: {
          mimeType: fileData.mimeType,
          data: fileData.data
        }
      });
    }

    if (message) {
      currentParts.push({ text: message });
    }

    contents.push({
      role: "user",
      parts: currentParts
    });

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(API_KEY)}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data?.error?.message || `Gemini API lỗi HTTP ${response.status}`;
      return res.status(response.status).json({
        error: errorMessage
      });
    }

    const candidate = data?.candidates?.[0];
    const reply = candidate?.content?.parts?.map(part => part.text || "").join("") || "";

    if (!reply) {
      return res.status(502).json({
        error: candidate?.finishReason
          ? `Gemini dừng phản hồi với lý do: ${candidate.finishReason}`
          : "Gemini không trả về nội dung."
      });
    }

    res.json({ reply });

  } catch (error) {
    console.error("KAISOUL SERVER ERROR:", error);
    res.status(500).json({
      error: error.message || "Lỗi server."
    });
  }
});

// Điều hướng SPA (Single Page Application)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`KAISOUL AI đang chạy tại http://localhost:${PORT}`);
  console.log(`API key: ${API_KEY ? "ĐÃ CẤU HÌNH" : "CHƯA CẤU HÌNH"}`);
});
