// Dewatermark test: mirror-strip over the pollinations.ai corner + blend
const sharp = require("sharp");

async function deWatermark(buf) {
  const img = sharp(buf);
  const meta = await img.metadata();
  const w = meta.width, h = meta.height;
  if (!w || !h || h < 200) return buf;
  const ph = Math.max(24, Math.round(h * 0.075)); // patch height ~7.5%
  const pw = Math.min(w - 8, Math.round(h * 0.34)); // patch width ~34% of height
  const px = w - pw, py = h - ph;
  const sy = Math.max(0, py - ph); // clean strip just above the watermark band
  const strip = await sharp(buf)
    .extract({ left: px, top: sy, width: pw, height: ph })
    .flip()
    .blur(6)
    .toBuffer();
  return sharp(buf).composite([{ input: strip, left: px, top: py }]).jpeg({ quality: 92 }).toBuffer();
}

(async () => {
  const fs = require("fs");
  const src = fs.readFileSync("/home/z/my-project/download/preview-white-tiger.jpg");
  const out = await deWatermark(src);
  fs.writeFileSync("/home/z/my-project/download/preview-white-tiger-clean.jpg", out);
  const m = await sharp(out).metadata();
  console.log("clean:", m.width + "x" + m.height, m.format, out.length + "B");
  // corner crop of the cleaned image for visual check
  const w = m.width, h = m.height;
  await sharp(out).extract({ left: w - 260, top: h - 70, width: 260, height: 70 })
    .resize(520, 140).toFile("/tmp/wm-zone-clean.png");
  console.log("corner crop saved");
})();
