import { createConnection } from "mysql2/promise";

export interface Env {
  // If you set another name in the Wrangler config file as the value for 'binding',
  // replace "HYPERDRIVE" with the variable name you defined.
  HYPERDRIVE: Hyperdrive;
  ASSETS: Fetcher;
  GOOGLE_MAPS_API_KEY: string;
}

async function handleTrips(
  url: URL,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  let connection: any = undefined;
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
    let updatedLastDays = url.searchParams.get("updated_last_days");
    // Default to last 3 days if no last_post_before and no last_post_after provided
    if (!lastPostBefore && !lastPostAfter && !updatedLastDays) {
      updatedLastDays = "3";
    }

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
        const now = new Date();
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
}

async function handleVolunteers(
  url: URL,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  let connection: any = undefined;
  try {
    connection = await createConnection({
      host: env.HYPERDRIVE.host,
      user: env.HYPERDRIVE.user,
      password: env.HYPERDRIVE.password,
      database: env.HYPERDRIVE.database,
      port: env.HYPERDRIVE.port,
      disableEval: true,
    });

    // Parse filter query parameters - matching PHP defaults
    const lastVisitAge = url.searchParams.get("lastVisitAge") || "365";
    const typesToShow = url.searchParams.get("typesToShow") || "all";
    const zipCode = url.searchParams.get("zipCode");
    const distance = url.searchParams.get("distance") || "10";

    // Base query using vw_volunteers view (same as PHP implementation)
    let baseQuery = `SELECT
      last_visit as lastVisit,
      last_visit_human as lastVisitHuman,
      user_id as userID,
      username,
      pf_foster_yn as foster,
      pf_pilot_yn as pilot,
      pf_flying_radius as flyingRadius,
      UPPER(apt_id) as airportID,
      apt_name as airportName,
      zip,
      lat,
      lon,
      city,
      state
    FROM prod_forum.vw_volunteers
    WHERE 1=1
      AND pf_show_on_map != 2
      AND user_inactive_reason = 0`;

    const whereClauses: string[] = [];
    const params: any[] = [];

    // Filter by last visit age (in days) - using DATE_ADD like PHP
    const daysInt = parseInt(lastVisitAge, 10);
    if (!isNaN(daysInt) && daysInt > 0) {
      whereClauses.push("last_visit > DATE_ADD(CAST(CURRENT_DATE AS DATETIME), INTERVAL -? DAY)");
      params.push(daysInt);
    }

    // Filter by volunteer type - matching PHP logic exactly
    if (typesToShow === "both") {
      whereClauses.push("pf_pilot_yn = 1 AND pf_foster_yn = 1");
    } else if (typesToShow === "pilot") {
      whereClauses.push("pf_pilot_yn = 1");
    } else if (typesToShow === "foster") {
      whereClauses.push("pf_foster_yn = 1");
    } else if (typesToShow === "volunteer") {
      whereClauses.push("pf_pilot_yn = 2 AND pf_foster_yn = 2");
    }
    // "all" (default) shows everyone with 1=1 (no additional filter)

    // Filter by location (zipCode + distance)
    // Matches PHP implementation - finds volunteers within bounding box of provided zip codes
    if (zipCode && zipCode.trim() !== "") {
      // Escape single quotes and allow comma-separated zip codes
      const escapedZipCode = zipCode.replace(/'/g, "\\'");
      const distanceFilterSQL = `(
        apt_id IN (
          SELECT z1.apt_id FROM (
            SELECT a.apt_id, a.lat, a.lon, minB.minLat, maxB.maxLat, minB.minLon, maxB.maxLon
            FROM airports a,
            (SELECT MIN(CAST(lat AS DECIMAL(12,6))) - 1 AS minLat, MIN(CAST(lon AS DECIMAL(12,6))) - 1 AS minLon FROM zipcodes WHERE zip IN ('${escapedZipCode}')) minB,
            (SELECT MAX(CAST(lat AS DECIMAL(12,6))) + 1 AS maxLat, MAX(CAST(lon AS DECIMAL(12,6))) + 1 AS maxLon FROM zipcodes WHERE zip IN ('${escapedZipCode}')) maxB
            WHERE CAST(a.lat AS DECIMAL(12,6)) BETWEEN minB.minLat AND maxB.maxLat
              AND CAST(a.lon AS DECIMAL(12,6)) BETWEEN minB.minLon AND maxB.maxLon
              AND minB.minLat IS NOT NULL AND maxB.maxLat IS NOT NULL
          ) z1
        )
        OR zip IN (
          SELECT z2.zip FROM (
            SELECT a.zip, a.lat, a.lon, minB.minLat, maxB.maxLat, minB.minLon, maxB.maxLon
            FROM zipcodes a,
            (SELECT MIN(CAST(lat AS DECIMAL(12,6))) - 1 AS minLat, MIN(CAST(lon AS DECIMAL(12,6))) - 1 AS minLon FROM zipcodes WHERE zip IN ('${escapedZipCode}')) minB,
            (SELECT MAX(CAST(lat AS DECIMAL(12,6))) + 1 AS maxLat, MAX(CAST(lon AS DECIMAL(12,6))) + 1 AS maxLon FROM zipcodes WHERE zip IN ('${escapedZipCode}')) maxB
            WHERE CAST(a.lat AS DECIMAL(12,6)) BETWEEN minB.minLat AND maxB.maxLat
              AND CAST(a.lon AS DECIMAL(12,6)) BETWEEN minB.minLon AND maxB.maxLon
              AND minB.minLat IS NOT NULL AND maxB.maxLat IS NOT NULL
          ) z2
        )
      )`;
      whereClauses.push(distanceFilterSQL);
    }

    if (whereClauses.length > 0) {
      baseQuery += " AND " + whereClauses.join(" AND ");
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
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    // Data API routes
    if (url.pathname === "/api/trips") {
      return handleTrips(url, env, ctx);
    }

    if (url.pathname === "/api/volunteers") {
      return handleVolunteers(url, env, ctx);
    }

    // Config endpoint to provide frontend with API keys
    if (url.pathname === "/api/config") {
      return Response.json({
        googleMapsApiKey: env.GOOGLE_MAPS_API_KEY || '',
      }, {
        headers: {
          "Cache-Control": "public, max-age=3600",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Map page routes
    if (url.pathname === "/maps/trips" || url.pathname === "/maps/trips/") {
      // Serve the trips map HTML page
      return env.ASSETS.fetch(new Request(new URL("/trips.html", request.url)));
    }

    if (url.pathname === "/maps/volunteers" || url.pathname === "/maps/volunteers/") {
      // Serve the volunteer map HTML page
      return env.ASSETS.fetch(new Request(new URL("/index.html", request.url)));
    }

    // For any other path, return 404
    // Once we enable static assets, those will be served automatically
    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
