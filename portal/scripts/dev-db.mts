// Starts a persistent local Postgres on :5433 for `npm run dev`. Ctrl-C to stop.
import { startLocalPg } from "./pg-embedded.mts";
const pg = await startLocalPg({ dir: "./.data/pg", port: 5433 });
console.log(`[dev-db] ready\n  DATABASE_OWNER_URL=${pg.ownerUrl}\n  DATABASE_URL=${pg.appUrl}`);
process.on("SIGINT", async () => { await pg.stop(); process.exit(0); });
setInterval(() => {}, 1 << 30);
