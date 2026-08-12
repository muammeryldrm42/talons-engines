import { NextResponse } from "next/server";
import { getNarratives } from "@/lib/cmc/agentHubData";
export const revalidate = 600;
export async function GET() { return NextResponse.json(await getNarratives()); }
