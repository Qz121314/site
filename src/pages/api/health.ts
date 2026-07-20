import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async () => {
  let database = "ok";
  try {
    await env.DB.prepare("SELECT 1").first();
  } catch {
    database = "unavailable";
  }

  return new Response(JSON.stringify({ status: database === "ok" ? "ok" : "degraded", database, timestamp: new Date().toISOString() }), {
    status: database === "ok" ? 200 : 503,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
};
