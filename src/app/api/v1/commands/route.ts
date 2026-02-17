import { NextResponse } from "next/server";

import { withApiAuth } from "@/lib/apiAuth";

export async function GET(request: Request) {
  const authResult = await withApiAuth(request);
  if (!authResult.success) return authResult.response;

  return NextResponse.json({ status: "not-implemented" }, { status: 501 });
}
