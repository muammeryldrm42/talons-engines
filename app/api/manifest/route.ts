// GET /api/manifest — serve the skill manifest so agents/clients can discover
// the skill's schema, when_to_use, and data dependencies over HTTP.

import { NextResponse } from "next/server";
import manifest from "@/skill/manifest.json";

export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(manifest);
}
