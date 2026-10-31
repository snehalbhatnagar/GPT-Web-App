# GPT Audio Web App

Ask a question out loud and hear the answer. The browser turns your speech into text (Web Speech API), a GPT model answers with the conversation so far as context, and the browser reads the reply aloud. You can also type.

**Live demo:** https://snehalbhatnagar.github.io/GPT-Web-App/

The hosted demo has no server, so it starts in **echo mode**: it reads your own words back, which shows the speech-to-text and text-to-speech loop without an API key. To get real answers there, open Settings and paste your own OpenAI key. It stays in that browser tab's session storage and goes only to api.openai.com.

Voice input works in Chrome, Edge, and Safari. In other browsers, type instead.

## Run it with the server

```bash
cp .env.example .env    # add OPENAI_API_KEY; OPENAI_MODEL defaults to gpt-4o-mini
npm install
npm start               # http://localhost:3000
```

With the server running, the page detects it and sends questions to `POST /api/chat`. The server adds the system prompt, trims history to the last 12 messages, rate-limits each IP to 20 requests a minute, and calls OpenAI with the key from `.env`.

`npm test` checks that the key is never exposed, that history is filtered and capped, and that chat requests are built correctly (OpenAI is stubbed in tests). `npm run build:pages` copies `public/` to `docs/` for GitHub Pages.

## Project history

- **June 2023:** first version built with Node.js, Express, the Web Speech API, and GPT-3.5. A near-identical copy lived in a second repo, GPT-Web-App-Bot.
- **2026:** reworked with help from Claude (see commit history):
  - The original server returned the OpenAI key from `GET /api/key` so the browser could call OpenAI directly, which exposed the key to every visitor. The key now stays on the server behind `POST /api/chat`.
  - Multi-turn context, typed input, voice selection, stop-speaking control, error messages, and a rate limit.
  - Merged GPT-Web-App-Bot into this repo and removed committed `node_modules`.
  - Added a static mode (echo or your own key) so the app runs on GitHub Pages.
