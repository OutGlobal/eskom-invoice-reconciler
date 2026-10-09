import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const original = read("public/images/enera-ai-logo-original.png");
assert.equal(
  createHash("sha256").update(original).digest("hex"),
  "f540763e435dcd222a1da30ba077fbb0d990e949f5cc455f980675d29738e450",
);
for (const [file, width, height] of [
  ["images/enera-ai-logo.png", 1585, 310],
  ["images/enera-ai-mark.png", 375, 310],
  ["images/enera-ai-social.png", 1200, 630],
  ["favicon.png", 64, 64],
  ["apple-touch-icon.png", 180, 180],
]) {
  const png = read(`public/${file}`);
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), width, file);
  assert.equal(png.readUInt32BE(20), height, file);
}
for (const route of ["__root", "index"]) {
  const source = read(`src/routes/${route}.tsx`).toString();
  assert.ok(source.includes("https://enera-ai.com/images/enera-ai-social.png"));
  assert.ok(!source.includes("r2.dev"));
}
console.log("ENERA branding assets and metadata verified.");
