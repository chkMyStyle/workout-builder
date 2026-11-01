"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

test("CSS and script URLs contain current content hashes to prevent mixed cached releases", () => {
  const root = path.join(__dirname, "..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const references = [...html.matchAll(/(?:src|href)="([^"?]+\.(?:css|js)(?:\?[^"\s]*)?)"/g)].map(match => match[1]);
  const expected = ["style.css", "exercises.js", "templates.js", "training-load.js", "app.js"].sort();
  assert.deepEqual(references.map(reference => new URL(reference, "https://local.test/").pathname.slice(1)).sort(), expected);
  for (const reference of references) {
    const url = new URL(reference, "https://local.test/");
    assert.equal(url.origin, "https://local.test");
    const file = path.join(root, url.pathname.slice(1));
    const version = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 12);
    assert.equal(url.searchParams.get("v"), version, `Update the asset version after editing ${path.basename(file)}`);
  }
});
