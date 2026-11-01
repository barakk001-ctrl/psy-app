// A private local Postgres for the *.db.test.ts suites. See README.md here.
// Run from a scratch folder that has `embedded-postgres` installed.
import fs from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const pg = new EmbeddedPostgres({
  databaseDir: "./pgdata",
  user: "psy",
  password: "localtestonly",
  port: 54330,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});
if (!fs.existsSync("./pgdata/PG_VERSION")) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase("psy_test");
} catch {
  // already there
}
console.log("Postgres ready on 127.0.0.1:54330, database psy_test");
process.on("SIGINT", async () => {
  await pg.stop();
  process.exit(0);
});
setInterval(() => {}, 1 << 30);
