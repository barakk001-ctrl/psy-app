// Retakes the landing page screenshots (src/components/landing/*.jpg) from the
// local app on the made-up demo practice (seed.cjs). Same setup as record.mjs:
// a production build on http://localhost:3459 against the throwaway database.
// Run from the scratch folder that holds puppeteer-core:
//   node <repo>/scripts/explainer/landing-shots.mjs <repo>/src/components/landing
// Desk shots: 1280x800 at 1.5x (1920x1200). Phone shots: 390x844 at 2.5x (975x2110).
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = "http://localhost:3459";
const OUT = process.argv[2];
if (!OUT) {
  console.error("usage: node landing-shots.mjs <output folder>");
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1.5 });
await page.goto(BASE + "/login", { waitUntil: "networkidle2" });
await page.type('input[name="email"]', "demo@demo.co.il");
await page.type('input[name="password"]', "Demo-pass-2026");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
  page.click('form button[type="submit"]'),
]);
await page.waitForFunction(() => location.pathname === "/dashboard", { timeout: 20000 });

async function open(url) {
  await page.goto(BASE + url, { waitUntil: "networkidle2" });
  // The help button floats over the page; it isn't part of these pictures
  await page.addStyleTag({ content: ".help-fab{display:none!important}" });
  await page.evaluate(() => document.fonts.ready);
  await sleep(600);
}
async function shot(name) {
  // No focus ring left from a click
  await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); });
  await page.mouse.move(1, 1);
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, name), type: "jpeg", quality: 82 });
  console.log("saved", name);
}

// ── Desk ──────────────────────────────────────────────────────────────────────
await open("/calendar");
await page.click(".fc-timeGridWeek-button");
await sleep(800);
await shot("desk-calendar.jpg");

await open("/clients");
const client = await page.$eval('main a[href^="/clients/c"]', (a) => a.getAttribute("href"));
await open(client);
await shot("desk-client.jpg");

await open("/reports");
await shot("desk-reports.jpg");

// ── Phone ─────────────────────────────────────────────────────────────────────
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true });
await open("/calendar");
await shot("phone-calendar.jpg");

await open("/dashboard");
await shot("phone-dashboard.jpg");

await browser.close();
