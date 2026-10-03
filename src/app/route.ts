import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  const html = await readFile(
    join(process.cwd(), "public", "order-of-service.html"),
    "utf-8"
  );
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
