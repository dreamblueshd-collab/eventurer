import { NextRequest, NextResponse } from "next/server";

/**
 * Debug endpoint for local development only.
 * In production this must not expose headers.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: { message: "Not found", type: "NotFoundError", statusCode: 404 } },
      { status: 404 }
    );
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return NextResponse.json({
    note: "Headers received by Next.js from IIS (frontend site)",
    ip: (request as unknown as { ip?: string }).ip || null,
    headers,
  });
}
