// Copies the static front end to /docs for GitHub Pages. With no server there,
// the app falls back to echo mode or the visitor's own OpenAI key.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "public");
const out = path.join(__dirname, "..", "docs");
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });
fs.writeFileSync(path.join(out, ".nojekyll"), "");
console.log("Static site written to docs/");
