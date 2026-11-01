import fs from "node:fs";
import EmbeddedPostgres from "embedded-postgres";
const pg = new EmbeddedPostgres({ databaseDir: "./pgdata", user: "psy", password: "localtestonly", port: 54329, persistent: true, initdbFlags: ["--encoding=UTF8", "--locale=C"] });
if (!fs.existsSync("./pgdata/PG_VERSION")) await pg.initialise();
await pg.start();
try { await pg.createDatabase("psydemo"); } catch {}
console.log("PG READY");
process.on("SIGTERM", async () => { await pg.stop(); process.exit(0); });
setInterval(() => {}, 1 << 30);
