// Applies the idempotent SQL files in database/brimble/ to the Brimble
// Postgres, in name order, one transaction per file. Runs as brimble.toml's
// before_start, inside Brimble's private network (the database is not
// public). Skips cleanly when BETTER_AUTH_DATABASE_URL isn't set, so a
// deploy without the database still starts.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const url = process.env.BETTER_AUTH_DATABASE_URL;
if (!url) {
    console.log("[brimble-apply-sql] BETTER_AUTH_DATABASE_URL not set; skipping");
    process.exit(0);
}

const dir = path.join(process.cwd(), "database", "brimble");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
const client = new pg.Client({ connectionString: url });
await client.connect();

try {
    for (const file of files) {
        const sql = await readFile(path.join(dir, file), "utf8");
        await client.query("begin");
        try {
            // A DDL statement waiting for a lock queues every later query on
            // that table behind it, so a stuck file must fail the deploy in
            // seconds, not hold production for Brimble's 25-minute timeout.
            await client.query("set local lock_timeout = '10s'");
            await client.query(sql);
            await client.query("commit");
            console.log(`[brimble-apply-sql] applied ${file}`);
        } catch (error) {
            await client.query("rollback");
            throw new Error(`${file}: ${error.message}`);
        }
    }

    // PostgREST logs in as `authenticator` (0003_postgrest_roles.sql); its
    // password comes from the environment so it never sits in a SQL file.
    const authenticatorPassword = process.env.POSTGREST_AUTHENTICATOR_PASSWORD;
    if (authenticatorPassword) {
        await client.query(`alter role authenticator with login password ${client.escapeLiteral(authenticatorPassword)}`);
        console.log("[brimble-apply-sql] set authenticator password");
    }

    // Long-open transactions hold locks that stall DDL and the queries queued
    // behind it (2026-11-01). The database is private, so report them here,
    // where the deploy log can show them. No query text: it can hold data.
    const { rows: longTransactions } = await client.query(`
        select a.pid, a.usename, a.application_name, a.client_addr::text as client_addr, a.state,
               a.wait_event_type, round(extract(epoch from now() - a.xact_start)) as xact_seconds,
               round(extract(epoch from now() - a.state_change)) as state_seconds,
               (select string_agg(distinct c.relname || ':' || l.mode, ', ')
                  from pg_locks l join pg_class c on c.oid = l.relation
                 where l.pid = a.pid and l.granted and c.relkind = 'r') as table_locks
        from pg_stat_activity a
        where a.xact_start < now() - interval '2 minutes' and a.pid <> pg_backend_pid()
        order by a.xact_start
    `);
    console.log(`[brimble-apply-sql] transactions open > 2 min: ${longTransactions.length}`);
    for (const row of longTransactions) console.log(`[brimble-apply-sql] long transaction ${JSON.stringify(row)}`);
} finally {
    await client.end();
}
