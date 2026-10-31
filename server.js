require("dotenv").config();
const path = require("path");
const express = require("express");

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const SYSTEM_PROMPT =
  "You are a helpful voice assistant. Answers are read aloud, so keep them short, conversational, and free of markdown, lists, and code blocks unless asked.";
const MAX_TURNS = 12; // messages of history sent to the model
const MAX_CHARS = 2000; // per message

// Very small per-IP limiter so a public deployment can't run up the bill.
const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip;
  const recent = (hits.get(key) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 20) return res.status(429).json({ error: "Too many requests. Wait a minute and try again." });
  recent.push(now);
  hits.set(key, recent);
  next();
}

// Keeps only well-formed user/assistant turns, trimmed to the limits above.
function cleanHistory(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
}

function createApp({ fetchImpl = fetch } = {}) {
  const app = express();
  app.use(express.json({ limit: "64kb" }));
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/api/health", (req, res) => res.json({ ok: true, mode: "server", model: MODEL, configured: Boolean(process.env.OPENAI_API_KEY) }));

  // The OpenAI key stays on the server. The original version exposed it at
  // GET /api/key so the browser could call OpenAI directly.
  app.post("/api/chat", rateLimit, async (req, res) => {
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "The server has no OpenAI API key configured." });
    const history = cleanHistory(req.body.messages);
    if (!history.length || history[history.length - 1].role !== "user") return res.status(400).json({ error: "Send at least one user message." });
    try {
      const r = await fetchImpl("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: MODEL, max_tokens: 400, messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history] }),
      });
      const data = await r.json();
      if (!r.ok) return res.status(502).json({ error: data.error?.message || "The model request failed." });
      res.json({ reply: data.choices?.[0]?.message?.content?.trim() || "" });
    } catch (err) {
      console.error(err);
      res.status(502).json({ error: "Could not reach OpenAI." });
    }
  });
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, () => console.log(`GPT Audio Web App on http://localhost:${port} (model ${MODEL})`));
}

module.exports = { createApp, cleanHistory, SYSTEM_PROMPT };
