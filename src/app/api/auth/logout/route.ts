import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { appOrigin } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/login", appOrigin(req)), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
