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

test("Browser and home-screen branding uses local versioned icons and stays within the GitHub Pages project", () => {
  const root = path.join(__dirname, "..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const base = new URL("https://local.test/workout-builder/");
  const readVersioned = reference => {
    const url = new URL(reference, base);
    assert.equal(url.origin, base.origin);
    assert.ok(url.pathname.startsWith(base.pathname));
    const data = fs.readFileSync(path.join(root, url.pathname.slice(base.pathname.length)));
    assert.equal(url.searchParams.get("v"), crypto.createHash("sha256").update(data).digest("hex").slice(0, 12));
    return data;
  };
  assert.match(html, /name="application-name" content="Сила"/);
  assert.match(html, /name="apple-mobile-web-app-title" content="Сила"/);
  assert.doesNotMatch(html, /Работает офлайн|offline-badge/);
  const iconLinks = [...html.matchAll(/<link rel="(icon|apple-touch-icon|manifest)"[^>]*href="([^"]+)"[^>]*>/g)];
  assert.equal(iconLinks.length, 4);
  for (const [, rel, reference] of iconLinks) {
    const data = readVersioned(reference);
    if (rel === "apple-touch-icon") {
      assert.equal(data.subarray(1, 4).toString(), "PNG");
      assert.equal(data.readUInt32BE(16), 180);
      assert.equal(data.readUInt32BE(20), 180);
    }
  }
  const manifest = JSON.parse(readVersioned(iconLinks.find(link => link[1] === "manifest")[2]));
  assert.equal(manifest.name, "Сила");
  assert.equal(manifest.short_name, "Сила");
  assert.equal(manifest.display, "browser");
  assert.equal(new URL(manifest.start_url, base).href, base.href);
  assert.equal(new URL(manifest.scope, base).href, base.href);
  assert.deepEqual(manifest.icons.map(icon => icon.sizes).sort(), ["192x192", "512x512"]);
  for (const icon of manifest.icons) {
    const data = readVersioned(icon.src);
    assert.equal(data.subarray(1, 4).toString(), "PNG");
    assert.equal(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`, icon.sizes);
    assert.equal(icon.type, "image/png");
  }
});
