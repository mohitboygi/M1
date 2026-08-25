require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Note: repo me "routes" folder nahi hai, saari files root me hain — isliye "./chat" wagera
const chatRoutes = require("./chat");
const imageRoutes = require("./image");
const videoRoutes = require("./video");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ---------- ROUTES ----------
app.use("/api/chat", chatRoutes);   // normal / fast / code / websearch
app.use("/api/image", imageRoutes); // cloudflare -> horde fallback
app.use("/api/video", videoRoutes); // pixazo / ltx

app.get("/", (req, res) => {
  res.json({ status: "AI Router running ✅" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`AI Router listening on port ${PORT}`));
