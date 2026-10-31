// GPT Audio Web App: browser speech-to-text -> chat model -> speech synthesis.
// Works against this repo's Express server, or standalone on a static host
// (GitHub Pages) with either echo mode or the visitor's own OpenAI key.

const $ = (id) => document.getElementById(id);
const els = {
  conversation: $("conversation"), empty: $("empty"), status: $("status"), mic: $("mic"),
  form: $("composer"), input: $("text-input"), clear: $("clear"), stop: $("stop-speaking"),
  settingsBtn: $("settings-btn"), settings: $("settings"), modeServer: $("mode-server"), modeStatic: $("mode-static"),
  keyRow: $("key-row"), key: $("api-key"), speak: $("speak-toggle"), voice: $("voice-select"), model: $("model-name"),
};

const state = { server: false, history: [], busy: false, listening: false };
const BROWSER_MODEL = "gpt-4o-mini";
const SYSTEM_PROMPT = "You are a helpful voice assistant. Answers are read aloud, so keep them short, conversational, and free of markdown, lists, and code blocks unless asked.";

const store = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

function setStatus(text, kind = "") { els.status.textContent = text; els.status.className = `status ${kind}`; }

function addMessage(role, text) {
  els.empty.hidden = true;
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = role === "user" ? "You" : "Assistant";
  const body = document.createElement("p");
  body.textContent = text;
  div.append(who, body);
  els.conversation.append(div);
  els.conversation.scrollTop = els.conversation.scrollHeight;
  return div;
}

/* ---------- mode detection ---------- */
async function detectServer() {
  try {
    const r = await fetch("api/health", { cache: "no-store" });
    if (!r.ok) return false;
    const info = await r.json();
    if (info.mode !== "server") return false;
    els.model.textContent = info.model;
    if (!info.configured) setStatus("The server has no API key yet. Add OPENAI_API_KEY to .env and restart.", "warn");
    return true;
  } catch { return false; }
}

const staticMode = () => document.querySelector('input[name="mode"]:checked')?.value || "echo";

/* ---------- answering ---------- */
async function answer(history) {
  if (state.server) {
    const r = await fetch("api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: history }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "The server could not answer.");
    return data.reply;
  }
  if (staticMode() === "echo") {
    return `You said: "${history[history.length - 1].content}". Echo mode only repeats your words. Add an OpenAI key in Settings to get real answers.`;
  }
  const key = els.key.value.trim();
  if (!key) { openSettings(); throw new Error("Add your OpenAI API key in Settings, or switch to echo mode."); }
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: BROWSER_MODEL, max_tokens: 400, messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history.slice(-12)] }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error?.message || "OpenAI rejected the request. Check the key.");
  return data.choices[0].message.content.trim();
}

async function ask(text) {
  text = text.trim();
  if (!text || state.busy) return;
  state.busy = true;
  const bubble = addMessage("user", text);
  state.history.push({ role: "user", content: text });
  setStatus("Thinking...");
  try {
    const reply = await answer(state.history);
    state.history.push({ role: "assistant", content: reply });
    addMessage("assistant", reply);
    setStatus("");
    speak(reply);
  } catch (err) {
    state.history.pop();
    bubble.remove();
    if (!els.conversation.querySelector(".msg")) els.empty.hidden = false;
    els.input.value = text; // keep the question so it can be resent
    setStatus(err.message, "error");
  } finally {
    state.busy = false;
  }
}

/* ---------- speech synthesis ---------- */
const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
function loadVoices() {
  if (!synth) { els.voice.disabled = true; els.speak.checked = false; els.speak.disabled = true; return; }
  const voices = synth.getVoices().filter((v) => v.lang.startsWith("en"));
  const saved = store.get("gpt-audio.voice");
  els.voice.hidden = els.voice.previousElementSibling.hidden = voices.length === 0;
  els.voice.innerHTML = "";
  for (const v of voices) {
    const o = document.createElement("option");
    o.value = v.name; o.textContent = `${v.name} (${v.lang})`;
    if (v.name === saved) o.selected = true;
    els.voice.append(o);
  }
}
function speak(text) {
  if (!synth || !els.speak.checked) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = synth.getVoices().find((x) => x.name === els.voice.value);
  if (v) u.voice = v;
  u.onstart = () => { els.stop.hidden = false; };
  u.onend = u.onerror = () => { els.stop.hidden = true; };
  synth.speak(u);
}

/* ---------- speech recognition ---------- */
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (Recognition) {
  recognition = new Recognition();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.onstart = () => { state.listening = true; els.mic.classList.add("live"); els.mic.setAttribute("aria-pressed", "true"); els.mic.setAttribute("aria-label", "Stop listening"); setStatus("Listening..."); synth?.cancel(); };
  recognition.onresult = (e) => {
    const r = e.results[e.results.length - 1];
    els.input.value = r[0].transcript;
    if (r.isFinal) { const t = els.input.value; els.input.value = ""; ask(t); }
  };
  recognition.onerror = (e) => {
    const msg = { "not-allowed": "Microphone access was blocked. Allow it in your browser's site settings.", "no-speech": "No speech heard. Try again closer to the microphone.", "network": "Speech recognition needs an internet connection." }[e.error];
    setStatus(msg || `Speech recognition stopped (${e.error}).`, "error");
  };
  recognition.onend = () => { state.listening = false; els.mic.classList.remove("live"); els.mic.setAttribute("aria-pressed", "false"); els.mic.setAttribute("aria-label", "Start listening"); if (els.status.textContent === "Listening...") setStatus(""); };
} else {
  els.mic.disabled = true;
  els.mic.title = "Voice input needs Chrome, Edge, or Safari";
}

/* ---------- wiring ---------- */
function openSettings() { els.settings.hidden = false; els.settingsBtn.setAttribute("aria-expanded", "true"); }
els.settingsBtn.addEventListener("click", () => { const open = els.settings.hidden; els.settings.hidden = !open; els.settingsBtn.setAttribute("aria-expanded", String(open)); });
els.mic.addEventListener("click", () => { if (!recognition) return; state.listening ? recognition.stop() : recognition.start(); });
els.form.addEventListener("submit", (e) => { e.preventDefault(); const t = els.input.value; els.input.value = ""; ask(t); });
els.clear.addEventListener("click", () => { state.history = []; els.conversation.querySelectorAll(".msg").forEach((m) => m.remove()); els.empty.hidden = false; synth?.cancel(); setStatus(""); });
els.stop.addEventListener("click", () => { synth?.cancel(); els.stop.hidden = true; });
els.voice.addEventListener("change", () => store.set("gpt-audio.voice", els.voice.value));
document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", () => { els.keyRow.hidden = staticMode() !== "key"; }));
els.key.value = store.get("gpt-audio.key") || "";
els.key.addEventListener("input", () => store.set("gpt-audio.key", els.key.value.trim()));
if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; } else loadVoices();

(async () => {
  state.server = await detectServer();
  els.modeServer.hidden = !state.server;
  els.modeStatic.hidden = state.server;
  if (!state.server) {
    if (els.key.value) { document.querySelector('input[value="key"]').checked = true; els.keyRow.hidden = false; }
    setStatus(!Recognition ? "Voice input isn't supported in this browser. Type your question instead." : "Running without a server, in echo mode. Open Settings to use your own OpenAI key.");
  } else if (!Recognition) {
    setStatus("Voice input isn't supported in this browser. Type your question instead.");
  }
})();
