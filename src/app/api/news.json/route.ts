import { getNews } from "@/lib/data";

export const dynamic = "force-static";

export async function GET() {
  const items = await getNews();
  return Response.json({ count: items.length, items });
}
