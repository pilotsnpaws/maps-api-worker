/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// mysql2 v3.13.0 or later is required
import { createConnection } from "mysql2/promise";

export interface Env {
  // If you set another name in the Wrangler config file as the value for 'binding',
  // replace "HYPERDRIVE" with the variable name you defined.
  HYPERDRIVE: Hyperdrive;
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/trips") {
      return new Response("Not Found", { status: 404 });
    }

    let connection;
    try {
      connection = await createConnection({
        host: env.HYPERDRIVE.host,
        user: env.HYPERDRIVE.user,
        password: env.HYPERDRIVE.password,
        database: env.HYPERDRIVE.database,
        port: env.HYPERDRIVE.port,
        disableEval: true,
      });

      // Parse filter query parameters
      const lastPostBefore = url.searchParams.get("last_post_before");
      const lastPostAfter = url.searchParams.get("last_post_after");
      const updatedLastDays = url.searchParams.get("updated_last_days");

      // Build the query dynamically based on filters
      let baseQuery = `SELECT
        last_post,
        last_post_human,
        topic_id,
        topic_title,
        pnp_sendZip,
        sendLat,
        sendLon,
        pnp_recZip,
        recLat,
        recLon,
        sendCity,
        recCity,
        diffLat,
        diffLon,
        icon_id,
        forum_id,
        trip_status
      FROM prod_forum.vw_lines`;
      const whereClauses: string[] = [];
      const params: any[] = [];

      if (lastPostBefore) {
        whereClauses.push("last_post < ?");
        params.push(lastPostBefore);
      }
      if (lastPostAfter) {
        whereClauses.push("last_post > ?");
        params.push(lastPostAfter);
      }
      if (updatedLastDays) {
        const daysInt = parseInt(updatedLastDays, 10);
        if (!isNaN(daysInt) && daysInt > 0) {
          // Use the provided local time as the source of truth
          const now = new Date("2025-04-15T12:51:54-06:00");
          const cutoff = new Date(now.getTime() - daysInt * 24 * 60 * 60 * 1000);
          // Format as 'YYYY-MM-DD HH:mm:ss'
          const pad = (n: number) => n.toString().padStart(2, '0');
          const cutoffStr = `${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())} ${pad(cutoff.getHours())}:${pad(cutoff.getMinutes())}:${pad(cutoff.getSeconds())}`;
          whereClauses.push("last_post >= ?");
          params.push(cutoffStr);
        }
      }
      if (whereClauses.length > 0) {
        baseQuery += " WHERE " + whereClauses.join(" AND ");
      }

      const [results] = await connection.query(baseQuery, params);
      ctx.waitUntil(connection.end());

      return new Response(JSON.stringify(results), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (e) {
      if (connection) ctx.waitUntil(connection.end());
      console.error(e);
      return Response.json(
        { error: e instanceof Error ? e.message : e },
        { status: 500 },
      );
    }
  },
} satisfies ExportedHandler<Env>;