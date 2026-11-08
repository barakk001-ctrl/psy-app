// Records the explainer tour from the local app on the made-up demo practice.
// App area 1280x590; captions are composited below it afterwards (build.mjs).
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const BASE = "http://localhost:3459";
const OUT = "frames";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  headless: true,
  defaultViewport: { width: 1280, height: 590 },
  args: ["--force-device-scale-factor=1", "--hide-scrollbars"],
});
const page = await browser.newPage();

// A visible cursor that follows the mouse (headless Chrome draws none)
await page.evaluateOnNewDocument(() => {
  addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("div");
    c.id = "__cursor";
    c.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 3l14 9-6 1.5L10 20z" fill="#1a1714" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    c.style.cssText = "position:fixed;left:640px;top:300px;z-index:2147483647;pointer-events:none;transform:translate(-3px,-2px);filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))";
    document.documentElement.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
  });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const client = await page.createCDPSession();
const frames = [];
let cur = { x: 640, y: 300 };
let t0 = 0;
let paused = false, pausedAt = 0, pausedTotal = 0;
const now = () => Date.now() / 1000 - t0 - pausedTotal;
const captions = [];
const caption = (title, sub) => captions.push({ t: now(), title, sub });

client.on("Page.screencastFrame", async (f) => {
  if (!paused && t0) {
    const file = `${OUT}/f${String(frames.length).padStart(6, "0")}.jpg`;
    fs.writeFileSync(file, Buffer.from(f.data, "base64"));
    frames.push({ file, t: now() });
  }
  await client.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
});

const settled = () => page.waitForNetworkIdle({ idleTime: 300, timeout: 8000 }).catch(() => {});

// Run `fn` off the record (page loads, jumps between pages): its time and
// frames are dropped from the video.
async function cut(fn) {
  paused = true;
  pausedAt = Date.now() / 1000;
  await fn();
  await settled();
  await sleep(250);
  pausedTotal += Date.now() / 1000 - pausedAt;
  paused = false;
  await page.mouse.move(cur.x + 1, cur.y); // force a fresh frame
  await page.mouse.move(cur.x, cur.y);
  await sleep(60);
}
async function jump(path) {
  await cut(async () => {
    await page.goto(BASE + path, { waitUntil: "networkidle2" });
    await page.mouse.move(cur.x, cur.y);
  });
}
async function moveTo(x, y, ms = 420) {
  const steps = 14;
  const from = { ...cur };
  for (let i = 1; i <= steps; i++) {
    const k = i / steps, e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
    await sleep(ms / steps / 2);
  }
  cur = { x, y };
}
async function center(sel) {
  const el = typeof sel === "string" ? await page.waitForSelector(sel, { timeout: 15000 }) : sel;
  await page.evaluate((e) => e.scrollIntoView({ block: "nearest", behavior: "instant" }), el);
  const b = await el.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function clickOn(sel) {
  const c = await center(sel);
  await moveTo(c.x, c.y);
  await sleep(120);
  await page.mouse.click(c.x, c.y);
}
async function byText(tag, text) {
  const h = await page.evaluateHandle(
    (tag, text) => [...document.querySelectorAll(tag)].find((e) => e.textContent.trim().includes(text)),
    tag, text,
  );
  return h.asElement();
}
async function wheel(dy, ms = 1000) {
  const steps = 20;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel({ deltaY: dy / steps });
    await sleep(ms / steps / 2);
  }
}
async function nav(href) {
  await clickOn(`aside a[href="${href}"]`);
  await cut(async () => {
    await sleep(300);
    await settled();
    await page.evaluate(() => scrollTo(0, 0));
  });
}

await page.goto(BASE + "/login", { waitUntil: "networkidle2" });
await page.mouse.move(cur.x, cur.y);
await client.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 1280, maxHeight: 590, everyNthFrame: 1 });
t0 = Date.now() / 1000;
await page.mouse.move(cur.x + 1, cur.y);

// ── Login ────────────────────────────────────────────────────────────────────
caption("כניסה מאובטחת", "סיסמה, אימות דו-שלבי ונעילת Face ID");
await sleep(1500);
await clickOn('input[name="email"]');
await page.keyboard.type("demo@demo.co.il", { delay: 35 });
await clickOn('input[name="password"]');
await page.keyboard.type("Demo-pass-2026", { delay: 20 });
await sleep(800);
await clickOn('form button[type="submit"]');
await cut(() => page.waitForFunction(() => location.pathname === "/dashboard", { timeout: 20000 }));

// ── Dashboard ────────────────────────────────────────────────────────────────
caption("מסך הבית", "הפגישות של היום, ההכנסות והמשימות במבט אחד");
await sleep(3000);
await moveTo(760, 330);
await wheel(430);
caption("שום דבר לא נשכח", "ליד כל פגישה רואים מה חסר: תיעוד או תשלום");
await moveTo(330, 300);
await sleep(4300);

// ── Calendar ─────────────────────────────────────────────────────────────────
await cut(() => page.evaluate(() => scrollTo(0, 0)));
await nav("/calendar");
await page.waitForSelector(".fc-daygrid-event");
caption("היומן", "כל סוג מפגש בצבע משלו, כולל מועדי ישראל");
await moveTo(520, 330);
await sleep(4000);
caption("שבוע ויום במסך אחד", "רק השעות שיש בהן פגישות, בלי גלילה");
await clickOn(".fc-timeGridWeek-button");
await sleep(2700);
await clickOn(".fc-timeGridDay-button");
await sleep(2300);
await cut(async () => {
  await page.click(".fc-timeGridWeek-button");
  await sleep(300);
});
caption("עריכה מהירה", "לחיצה על פגישה: שינוי מועד לפגישה אחת או לכל הבאות");
const ev = (await page.$$(".fc-timegrid-event"))[6];
await clickOn(ev);
await page.waitForSelector("#qeDate");
await sleep(4500);

// ── Clients ──────────────────────────────────────────────────────────────────
await jump("/clients");
caption("תיקי לקוחות", "פרטים, היסטוריית פגישות, סיכומים מוצפנים ומסמכים");
await moveTo(700, 330);
await sleep(1500);
await clickOn('main a[href^="/clients/c"]');
await cut(async () => { await sleep(300); });
await moveTo(700, 340);
await sleep(1200);
await wheel(380);
await sleep(2000);
await jump("/clients");
caption("רשימת המתנה", "מי שמחכה למקום, והפיכה ללקוח בלחיצה");
await clickOn('a[href="/clients?view=waitlist"]');
await cut(async () => { await sleep(300); });
await moveTo(640, 360);
await sleep(600);
await wheel(190, 700);
await sleep(3000);

// ── Follow-up lists ──────────────────────────────────────────────────────────
await jump("/document");
caption("תיעוד פגישות", "מה חסר בסיכומים, עם סינון לפי לקוח/ה, סטטוס ותקופה");
await moveTo(600, 300);
await sleep(1500);
await wheel(190, 700);
await sleep(3400);
await jump("/collect");
caption("אישורי תשלום", "אילו פגישות עוד לא שולמו, באותו סינון נוח");
await sleep(1200);
await wheel(190, 700);
await sleep(3000);

// ── New document ─────────────────────────────────────────────────────────────
await jump("/invoices/new");
caption("מסמך חדש", "קבלה או חשבונית: בוחרים פגישות, בודקים בתצוגה מקדימה ושומרים");
await sleep(500);
await clickOn(await byText("main button", "חשבונית מס/קבלה"));
await sleep(700);
await moveTo(620, 420);
await wheel(330);
await page.select("#doc-client", await page.$eval("#doc-client option:nth-child(2)", (o) => o.value));
await sleep(900);
await wheel(390);
await sleep(2300);

// ── Reports ──────────────────────────────────────────────────────────────────
await cut(() => page.evaluate(() => scrollTo(0, 0)));
await nav("/reports");
caption("דוחות", "הכנסות לפי תקופה, לקוח ואמצעי תשלום, עם ייצוא ל-PDF");
await moveTo(600, 330);
await sleep(1200);
await wheel(420);
await sleep(2600);

// ── Plans ────────────────────────────────────────────────────────────────────
await cut(() => page.evaluate(() => scrollTo(0, 0)));
await nav("/subscription");
await cut(() => page.evaluate(() => scrollBy(0, 150)));
caption("מתחילים ב-30 יום חינם", "עם פגישות עד 30 יום קדימה, ואז מנוי חודשי או שנתי");
await moveTo(860, 300);
await sleep(5200);

// ── Security ─────────────────────────────────────────────────────────────────
await cut(() => page.evaluate(() => scrollTo(0, 0)));
await nav("/settings");
// The settings tabs, then the security one
caption("פרטיות ואבטחה", "סיכומים מוצפנים, שרתים באירופה, גיבוי יומי ויומן גישה");
await moveTo(700, 300);
await sleep(700);
await clickOn('a[href="/settings?tab=security"]');
await sleep(600);
await cut(async () => {
  const audit = await byText("main h2, main h3", "יומן גישה לרשומות");
  if (audit) await page.evaluate((e) => e.scrollIntoView({ block: "start", behavior: "instant" }), audit);
  await page.evaluate(() => scrollBy(0, -90));
});
await moveTo(600, 300);
await sleep(4800);

const end = now();
await client.send("Page.stopScreencast");
await sleep(300);
await browser.close();
fs.writeFileSync("timeline.json", JSON.stringify({ frames, end, captions }, null, 1));
console.log("frames", frames.length, "duration", end.toFixed(1), "captions", captions.length);
