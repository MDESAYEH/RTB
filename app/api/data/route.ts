import {NextResponse} from "next/server";
import {snapshotData} from "@/lib/store";
export const dynamic="force-dynamic";
export async function GET(){return NextResponse.json(await snapshotData(),{headers:{"Cache-Control":"no-store"}});}
