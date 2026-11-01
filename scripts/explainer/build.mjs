// Composes the final silent video: title card, tour (app above, caption band
// below) and end card. 1280x720, 30 fps, no audio track.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const FONTS = "C:/Users/Barakk/Downloads/psy-app/psy-app/public/fonts";
const uri = (w) => `data:font/ttf;base64,${fs.readFileSync(`${FONTS}/heebo-${w}.ttf`).toString("base64")}`;
const css = `
@font-face{font-family:Heebo;font-weight:400;src:url(${uri(400)})}
@font-face{font-family:Heebo;font-weight:500;src:url(${uri(500)})}
@font-face{font-family:Heebo;font-weight:700;src:url(${uri(700)})}
*{margin:0;box-sizing:border-box}
html,body{width:100%;height:100%;font-family:Heebo,sans-serif}`;

const { frames, end, captions } = JSON.parse(fs.readFileSync("timeline.json", "utf8"));
fs.rmSync("build", { recursive: true, force: true });
fs.mkdirSync("build");

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--force-device-scale-factor=1"],
});
const page = await browser.newPage();

// The clinic-room illustration, from the app itself
await page.setViewport({ width: 1280, height: 720 });
await page.goto("http://localhost:3459/login", { waitUntil: "networkidle2" });
await page.type('input[name="email"]', "demo@demo.co.il");
await page.type('input[name="password"]', "Demo-pass-2026");
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}), page.keyboard.press("Enter")]);
await page.waitForFunction(() => location.pathname === "/dashboard");
await page.waitForSelector("main svg");
await new Promise((r) => setTimeout(r, 800));
const hero = await page.evaluate(() => {
  const svgs = [...document.querySelectorAll("main svg")].sort(
    (a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width,
  );
  return svgs[0].outerHTML;
});

async function shot(html, file, w, h) {
  await page.setViewport({ width: w, height: h });
  await page.setContent(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, type: "png" });
}

// Caption band: big enough to read when the video is phone-width
const band = (title, sub) => `
<div style="height:130px;background:#2b2620;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;text-align:center;padding:0 40px">
  <div style="font-size:44px;font-weight:700;color:#fdfbf7;line-height:1.12">${title}</div>
  <div style="font-size:36px;font-weight:500;color:#f1ece2;line-height:1.18">${sub}</div>
</div>`;
for (let i = 0; i < captions.length; i++) {
  await shot(band(captions[i].title, captions[i].sub), `build/cap${i}.png`, 1280, 130);
}

const card = (lines) => `
<div style="height:720px;background:linear-gradient(160deg,#faf7f1,#f1f4ed);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
  <div style="width:420px;margin-bottom:26px">${hero.replace(/<svg /, '<svg style="width:100%;height:auto" ')}</div>
  ${lines}
</div>`;
await shot(card(`<div style="font-size:84px;font-weight:700;color:#1a1714;line-height:1.1">מרפאה אישית</div>
  <div style="font-size:42px;font-weight:500;color:#6b5f52;margin-top:10px">מערכת לניהול קליניקה</div>`), "build/title.png", 1280, 720);
await shot(card(`<div style="font-size:72px;font-weight:700;color:#1a1714;line-height:1.1">מרפאה אישית</div>
  <div style="font-size:42px;font-weight:500;color:#5c7559;margin-top:12px">הקליניקה שלך, מסודרת במקום אחד</div>
  <div style="font-size:34px;font-weight:500;color:#6b5f52;margin-top:12px">ההרשמה כרגע בהזמנה בלבד</div>`), "build/end.png", 1280, 720);
await browser.close();

// Exact timing: one image per 1/30 s (the frame showing at that moment)
fs.mkdirSync("build/seq");
const total = Math.round(end * 30);
let fi = 0;
for (let n = 0; n < total; n++) {
  const t = n / 30;
  while (fi + 1 < frames.length && frames[fi + 1].t <= t) fi++;
  fs.linkSync(frames[fi].file, `build/seq/${String(n).padStart(6, "0")}.jpg`);
}

const caps = ["ffconcat version 1.0"];
captions.forEach((c, i) => {
  const next = i + 1 < captions.length ? captions[i + 1].t : end;
  caps.push(`file 'cap${i}.png'`, `duration ${(next - c.t).toFixed(3)}`);
});
caps.push(`file 'cap${captions.length - 1}.png'`);
fs.writeFileSync("build/caps.ffconcat", caps.join("\n"));

const enc = ["-c:v", "libx264", "-preset", "slow", "-crf", "27", "-pix_fmt", "yuv420p", "-r", "30", "-an"];
const ff = (...a) => execFileSync("ffmpeg", ["-v", "error", "-y", ...a], { stdio: "inherit" });

ff("-framerate", "30", "-i", "build/seq/%06d.jpg", "-f", "concat", "-safe", "0", "-i", "build/caps.ffconcat",
  "-filter_complex", "[0:v]fps=30,format=yuv420p,setsar=1[a];[1:v]fps=30,format=yuv420p,setsar=1[c];[a][c]vstack=inputs=2:shortest=1[v]",
  "-map", "[v]", ...enc, "build/tour.mp4");
ff("-loop", "1", "-t", "3.2", "-i", "build/title.png", "-vf", "fade=in:0:15,fade=out:st=2.8:d=0.4,setsar=1", ...enc, "build/title.mp4");
ff("-loop", "1", "-t", "4.5", "-i", "build/end.png", "-vf", "fade=in:0:12,fade=out:st=3.9:d=0.6,setsar=1", ...enc, "build/end.mp4");
fs.writeFileSync("build/all.txt", ["title", "tour", "end"].map((n) => `file '${n}.mp4'`).join("\n"));
ff("-f", "concat", "-safe", "0", "-i", "build/all.txt", ...enc, "-movflags", "+faststart", "explainer-new.mp4");
console.log("built", (fs.statSync("explainer-new.mp4").size / 1e6).toFixed(2), "MB");
