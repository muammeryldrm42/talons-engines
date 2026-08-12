import { NextResponse } from "next/server";
import { getNews } from "@/lib/cmc/agentHubData";
export const revalidate = 600;
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "1"; // default BTC
  return NextResponse.json(await getNews(id, 6));
}
