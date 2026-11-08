// Made-up demo practice for the explainer video. Local throwaway DB only.
const REPO = "C:/Users/Barakk/Downloads/psy-app/psy-app/node_modules/";
const { PrismaClient } = require(REPO + "@prisma/client");
const bcrypt = require(REPO + "bcryptjs");
const crypto = require("node:crypto");
const db = new PrismaClient();
const key = Buffer.from(process.env.NOTES_ENCRYPTION_KEY, "base64");
const enc = (t) => { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv("aes-256-gcm", key, iv); const ct = Buffer.concat([c.update(t, "utf8"), c.final()]); return { contentCiphertext: ct.toString("base64"), contentIv: iv.toString("base64"), contentTag: c.getAuthTag().toString("base64") }; };
const packed = (t) => { const p = enc(t); return `${p.contentIv}:${p.contentTag}:${p.contentCiphertext}`; };
const DAY = 86400000;
// clinic wall clock (Israel, UTC+2 in November) -> Date
const at = (dayOffset, h, m = 0) => { const n = new Date(Date.now() + 2 * 3600000); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + dayOffset, h - 2, m)); };
(async () => {
  await db.user.deleteMany({ where: { email: "demo@demo.co.il" } });
  const user = await db.user.create({ data: {
    email: "demo@demo.co.il", name: "נועה כהן-דמו", hashedPassword: await bcrypt.hash("Demo-pass-2026", 10), emailVerifiedAt: new Date(),
    agreementVersion: "draft-2026-10", agreementAcceptedAt: new Date(), trialEndsAt: new Date(Date.now() + 21 * DAY),
    showHolidays: true, vatLiable: true, businessName: "קליניקה לדוגמה", phone: "0501234567", onboardingCompletedAt: new Date(),
  } });
  const types = [["טיפול פרטני", "#5C7559"], ["טיפול זוגי", "#7A5C8E"], ["הדרכת הורים", "#4F6F94"], ["אבחון", "#B5654A"]];
  for (const [name, color] of types) await db.meetingType.create({ data: { userId: user.id, name, color } });
  const people = [["מיכל","אברהם",0,0,9],["שירה","אלוני",0,1,11],["יעל","בר-און",1,0,17],["תמר","גולן",2,1,18],["דניאל","לוי",2,2,10],["איתי","מור",3,0,12],["נועם","פרידמן",3,3,16],["רון","שפירא",4,0,19]];
  // weekday offsets from this Sunday are the third column
  const notes = ["נדון המעבר לעבודה חדשה. שיפור בשינה, ממשיכים בתרגול שבוע נוסף.", "המשך עבודה על גבולות במשפחה. סוכם על משימה קצרה לשבוע הבא.", "פגישה רגועה. עלו נושאים מהילדות, נמשיך לברר בפעם הבאה."];
  let n = 0;
  for (const [firstName, lastName, day, ty, hour] of people) {
    const client = await db.client.create({ data: { userId: user.id, firstName, lastName, phone: "05012345" + String(n + 10), defaultRate: 350, treatmentType: types[ty][0], status: "ACTIVE" } });
    for (let w = -6; w <= 3; w++) {
      const startsAt = at(day + w * 7, hour), endsAt = new Date(startsAt.getTime() + 50 * 60000);
      const past = startsAt.getTime() < Date.now();
      const old = startsAt.getTime() < Date.now() - 10 * DAY;
      const today = day === 0 && w === 0;
      const paid = past && (old || today || (n + w) % 3 !== 0);
      const s = await db.session.create({ data: { userId: user.id, clientId: client.id, startsAt, endsAt, rate: 350, treatmentType: types[ty][0], status: past ? "COMPLETED" : "SCHEDULED",
        paymentStatus: paid ? "PAID" : null, paymentMethod: paid ? (n % 2 ? "BIT" : "BANK_TRANSFER") : null, paidAmount: paid ? 350 : null } });
      if (past && (old || today || (n + w) % 2 === 0)) await db.sessionNote.create({ data: { sessionId: s.id, clientId: client.id, ...enc(notes[(n + w + 6) % 3]) } });
    }
    n++;
  }
  await db.waitlistEntry.createMany({ data: [
    { userId: user.id, fullName: "אורית שלו", phone: "0501234521", notesCiphertext: packed("מעדיפה שעות בוקר"), createdAt: new Date(Date.now() - 12 * DAY) },
    { userId: user.id, fullName: "גיא נחום", phone: "0501234522", notesCiphertext: packed("הפניה מרופא משפחה"), createdAt: new Date(Date.now() - 5 * DAY) },
    { userId: user.id, fullName: "ליאת דיין", phone: "0501234523", notesCiphertext: packed("טיפול זוגי, ימי חמישי"), createdAt: new Date(Date.now() - 2 * DAY) },
  ] });
  for (const text of ["להתקשר למעבדת האבחון", "לעדכן שעות לחגים", "להזמין דפי הערכה"]) await db.todo.create({ data: { userId: user.id, text } });
  console.log("seeded", n, "clients,", await db.session.count(), "meetings");
  await db.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
