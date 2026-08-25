const express = require("express");
const router = express.Router();

// 👉 .env me daalna
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_KEY = process.env.CF_API_KEY;
const CF_MODEL = process.env.CF_IMAGE_MODEL || "@cf/black-forest-labs/flux-1-schnell";

const HORDE_API_KEY = process.env.HORDE_API_KEY || "0000000000"; // anonymous key bhi chalega

// ---------- Primary: Cloudflare Workers AI ----------
async function generateWithCloudflare(prompt) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_MODEL}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CF_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!resp.ok) throw new Error(`Cloudflare image error: ${resp.status}`);

  const contentType = resp.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await resp.json();
    // some CF models return base64 inside result.image
    if (data.result?.image) {
      return { provider: "cloudflare", image_base64: data.result.image };
    }
    throw new Error("Cloudflare returned unexpected JSON shape");
  }

  // binary image response
  const buffer = Buffer.from(await resp.arrayBuffer());
  return { provider: "cloudflare", image_base64: buffer.toString("base64") };
}

// ---------- Fallback: AI Horde (async polling) ----------
async function generateWithHorde(prompt) {
  const submit = await fetch("https://aihorde.net/api/v2/generate/async", {
    method: "POST",
    headers: {
      apikey: HORDE_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      params: { n: 1, width: 512, height: 512 },
    }),
  });
  if (!submit.ok) throw new Error(`AI Horde submit error: ${submit.status}`);
  const { id } = await submit.json();

  // poll until done (simple loop, add max attempts to avoid infinite wait)
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const check = await fetch(`https://aihorde.net/api/v2/generate/check/${id}`);
    const status = await check.json();
    if (status.done) {
      const result = await fetch(`https://aihorde.net/api/v2/generate/status/${id}`);
      const final = await result.json();
      const imageUrl = final.generations?.[0]?.img;
      return { provider: "ai-horde", image_url: imageUrl };
    }
  }
  throw new Error("AI Horde timed out");
}

router.post("/generate", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt required" });

  try {
    const result = await generateWithCloudflare(prompt);
    return res.json(result);
  } catch (cfErr) {
    console.warn("[image] Cloudflare failed, falling back to AI Horde:", cfErr.message);
    try {
      const result = await generateWithHorde(prompt);
      return res.json(result);
    } catch (hordeErr) {
      console.error("[image] AI Horde also failed:", hordeErr.message);
      return res.status(500).json({ error: "Both image providers failed", details: hordeErr.message });
    }
  }
});

module.exports = router;
