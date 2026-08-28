const candidate = data?.candidates?.[0];
const finishReason = candidate?.finishReason;

// Nếu bị chặn bởi bộ lọc an toàn
if (finishReason && finishReason !== "STOP") {
  console.warn(`Gemini finished with reason: ${finishReason}`);
}

const reply =
  candidate?.content?.parts
    ?.map(part => part.text || "")
    .join("") || "";
