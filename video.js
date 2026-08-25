const express = require("express");
const router = express.Router();

// 👉 .env me daalna. Pixazo/LTX ka exact endpoint unke docs se confirm kar lena —
// yeh generic scaffold hai jisme sirf URL/body key names badalne honge.
const PIXAZO_API_URL = process.env.PIXAZO_API_URL || "https://api.pixazo.com/v1/video/generate";
const PIXAZO_API_KEY = process.env.PIXAZO_API_KEY;

router.post("/generate", async (req, res) => {
  const { prompt, duration = 4 } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt required" });

  try {
    const resp = await fetch(PIXAZO_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PIXAZO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, duration }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Pixazo/LTX error (${resp.status}): ${errText}`);
    }

    const data = await resp.json();
    // 👉 response shape unke docs dekh ke yahan map karna (video_url / task_id etc.)
    res.json({ provider: "pixazo-ltx", result: data });
  } catch (err) {
    console.error("[video]", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
