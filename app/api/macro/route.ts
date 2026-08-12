import { NextResponse } from "next/server";
import { getMacroEvents } from "@/lib/cmc/agentHubData";
export const revalidate = 3600;
export async function GET() { return NextResponse.json(await getMacroEvents()); }
