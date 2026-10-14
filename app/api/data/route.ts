import { NextResponse } from "next/server";
import { snapshotData } from "@/lib/store";
import { publicApiLimit } from "@/lib/public-api-limit";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const limited = await publicApiLimit(req, "data");
  if (limited) return limited;
  return NextResponse.json(await snapshotData(), {
    headers: { "Cache-Control": "no-store" },
  });
}
