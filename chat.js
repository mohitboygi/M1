const express = require("express");
const router = express.Router();

// ---------- Provider: Groq ----------
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env.GROQ_API_KEY; // 👉 .env me daalo

const MODELS = {
  normal: "openai/gpt-oss-120b",   // 🧠 Normal Chat
  fast: "openai/gpt-oss-20b",      // ⚡ Fast/Simple Chat
  code: "openai/gpt-oss-120b",     // 💻 Coding
  websearch: "groq/compound",      // 🌐 Live Web Search
};

// ---------- Provider: tokenin.my.id ----------
const TOKENIN_URL = "https://tokenin.my.id/v1/chat/completions";
const TOKENIN_API_KEY = process.env.TOKENIN_API_KEY; // 👉 .env me daalo
const TOKENIN_MODEL = process.env.TOKENIN_MODEL || "gpt-4o-mini"; // dashboard me apna free model naam check kar lena

// ---------- Provider: bynara router ----------
// ⚠️ Domain confirm nahi hua tha (tumne "nynara.id" bola, sabse milta service "bynara.id" hai).
// Galat nikle to sirf .env me NYNARA_BASE_URL badal dena, code touch nahi karna padega.
const NYNARA_URL = `${process.env.NYNARA_BASE_URL || "https://router.bynara.id/v1"}/chat/completions`;
const NYNARA_API_KEY = process.env.NYNARA_API_KEY; // 👉 .env me daalo (sk-nry-... jaisi key)
const NYNARA_MODEL = process.env.NYNARA_MODEL || "auto/bynara";

// generic OpenAI-compatible caller — sabhi provider isi shape ko follow karte hain
async function callOpenAiCompatible(url, apiKey, model, messages) {
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`(${resp.status}) ${errText}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

// Har provider ka "caller" — order array me inhe jis sequence me daalenge, usi order me try honge
const PROVIDERS = {
  groq: (messages, mode) => callOpenAiCompatible(GROQ_URL, GROQ_API_KEY, MODELS[mode], messages),
  tokenin: (messages) => callOpenAiCompatible(TOKENIN_URL, TOKENIN_API_KEY, TOKENIN_MODEL, messages),
  nynara: (messages) => callOpenAiCompatible(NYNARA_URL, NYNARA_API_KEY, NYNARA_MODEL, messages),
};

// har mode ka apna fallback order — 'normal' ke liye nynara -> tokenin -> groq
// baaki modes ke liye groq -> tokenin -> nynara (default)
const PROVIDER_ORDER = {
  normal: ["nynara", "tokenin", "groq"],
  fast: ["groq", "tokenin", "nynara"],
  code: ["groq", "tokenin", "nynara"],
  websearch: ["groq", "tokenin", "nynara"],
};

// helper to build a route for a given mode, using its configured provider order
function makeChatHandler(mode, systemPrompt) {
  return async (req, res) => {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });

    const messages = [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      ...history,
      { role: "user", content: message },
    ];

    const order = PROVIDER_ORDER[mode];
    let lastError;

    for (const providerName of order) {
      try {
        const reply = await PROVIDERS[providerName](messages, mode);
        return res.json({ mode, provider: providerName, reply });
      } catch (err) {
        console.warn(`[chat/${mode}] ${providerName} failed:`, err.message);
        lastError = err;
      }
    }

    console.error(`[chat/${mode}] all providers failed. last error:`, lastError?.message);
    res.status(500).json({ error: "All chat providers failed", details: lastError?.message });
  };
}

// 🧠 Normal Chat — order: nynara -> tokenin -> groq
router.post("/normal", makeChatHandler("normal"));

// ⚡ Fast / Simple Chat
router.post("/fast", makeChatHandler("fast"));

// 💻 Coding
router.post(
  "/code",
  makeChatHandler(
    "code",
    "You are an expert coding assistant. Answer with clean, correct, well-explained code."
  )
);

// 🌐 Live Web Search (Groq compound model has built-in browser search tool)
router.post("/websearch", makeChatHandler("websearch"));

module.exports = router;
