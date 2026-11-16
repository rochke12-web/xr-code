// CR7 tribute demo — scene image generation (stylized cartoon, 1440x720).
// Continuity: same character description repeated in every prompt.
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";

const OUT = "/tmp/cr7demo";
fs.mkdirSync(OUT, { recursive: true });

const HERO =
  "a stylized 3D cartoon football hero, number 7 on his white kit, athletic build, " +
  "short dark hair, confident smile, Pixar-like character style";
const STADIUM =
  "a huge floodlit football stadium at night, roaring crowd, dramatic golden stadium lights, " +
  "green pitch, cinematic wide shot";

const SCENES = [
  {
    f: "s1.png",
    prompt:
      `Epic poster shot: ${HERO}, standing on ${STADIUM}, ` +
      `a glowing football at his feet, gold confetti starting to fall, ` +
      `a big fan banner in the crowd that reads "YUG SUNAR". Vibrant colors, cinematic lighting, 2:1 widescreen.`,
  },
  {
    f: "s2.png",
    prompt:
      `Dynamic action shot: ${HERO}, sprinting at full speed toward the corner flag on ` +
      `the pitch of ${STADIUM}, motion blur and speed lines, crowd rising to their feet, ` +
      `intense focus on his face. Vibrant colors, cinematic lighting, 2:1 widescreen.`,
  },
  {
    f: "s3.png",
    prompt:
      `The iconic leap frozen mid-air: ${HERO}, jumping high above the pitch of ${STADIUM}, ` +
      `both arms swept back and down, jaw set, kit rippling, golden light rays behind him, ` +
      `dramatic low angle. Vibrant colors, cinematic lighting, 2:1 widescreen.`,
  },
  {
    f: "s4.png",
    prompt:
      `The landing celebration: ${HERO}, landed with arms down and out, chest puffed out, ` +
      `shouting in triumph on the pitch of ${STADIUM}, stadium erupting, gold confetti everywhere, ` +
      `giant glowing banner "YUG SUNAR" in the stands behind him. Vibrant colors, cinematic lighting, 2:1 widescreen.`,
  },
];

const t0 = Date.now();
const zai = await ZAI.create();
for (const s of SCENES) {
  const t = Date.now();
  let done = false;
  // image API rate-limits bursts — patient retry, 25s spacing
  for (let a = 0; a < 6 && !done; a++) {
    try {
      const res = (await Promise.race([
        zai.images.generations.create({ prompt: s.prompt, size: "1472x736" }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout 120s")), 120000)),
      ]));
      const b64 = res?.data?.[0]?.base64;
      if (!b64) throw new Error("no base64 in response");
      fs.writeFileSync(`${OUT}/${s.f}`, Buffer.from(b64, "base64"));
      console.log(`${s.f}  ok  ${Math.round((Date.now() - t) / 1000)}s  ${Math.round(b64.length / 1024)}KB`);
      done = true;
    } catch (e) {
      const m = String(e);
      if (a < 5) {
        console.log(`${s.f}  retry ${a}: ${m.slice(0, 90)}`);
        await new Promise(r => setTimeout(r, 25000));
      } else console.log(`${s.f}  FAIL  ${m.slice(0, 120)}`);
    }
  }
}
console.log(`total ${Math.round((Date.now() - t0) / 1000)}s`);
