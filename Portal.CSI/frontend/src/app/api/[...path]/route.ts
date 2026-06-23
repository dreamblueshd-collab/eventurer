import { NextRequest, NextResponse } from "next/server";
import http from "http";

// Backend configuration - reads from env var for flexibility
// For IIS deployment: port 6000, for local dev: port 3000
const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:6000";
const backendUrl = new URL(BACKEND_URL);
const BACKEND_HOST = backendUrl.hostname;
const BACKEND_PORT = parseInt(backendUrl.port || "6000");

console.log(`[API Proxy] Backend: http://${BACKEND_HOST}:${BACKEND_PORT}`);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path);
}

async function proxyRequest(request: NextRequest, pathSegments: string[]) {
  return new Promise<NextResponse>((resolve) => {
    try {
      const path = pathSegments.join("/");
      const searchParams = request.nextUrl.searchParams.toString();
      const fullPath = `/api/${path}${searchParams ? `?${searchParams}` : ""}`;

      console.log(`[API Proxy] ${request.method} ${fullPath}`);

      // Build headers
      const headers: Record<string, string> = {};
      
      const safeHeaders = [
        "content-type",
        "authorization",
        "accept",
        "accept-language",
        "cookie",
        "user-agent",
      ];

      safeHeaders.forEach((key) => {
        const value = request.headers.get(key);
        if (value) {
          headers[key] = value;
        }
      });

      const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || request.headers.get("x-real-ip")
        || (request as unknown as { ip?: string }).ip
        || "unknown";
      headers["x-forwarded-for"] = clientIp;
      headers["x-forwarded-proto"] = request.headers.get("x-forwarded-proto") || "https";
      headers["x-real-ip"] = clientIp;
      headers["x-forwarded-host"] = request.headers.get("host") || "localhost";

      // Get request body - handle both text and binary data
      const contentType = request.headers.get("content-type") || "";
      const isMultipart = contentType.includes("multipart/form-data");
      
      const bodyPromise = (request.method !== "GET" && request.method !== "HEAD") 
        ? (isMultipart ? request.arrayBuffer() : request.text())
        : Promise.resolve(null);

      bodyPromise.then((body) => {
        if (body) {
          if (body instanceof ArrayBuffer) {
            const buffer = Buffer.from(body);
            headers["content-length"] = buffer.length.toString();
          } else {
            headers["content-length"] = Buffer.byteLength(body as string).toString();
          }
        }

        const options: http.RequestOptions = {
          hostname: BACKEND_HOST,
          port: BACKEND_PORT,
          path: fullPath,
          method: request.method,
          headers: headers,
        };

        const proxyReq = http.request(options, (proxyRes) => {
          const responseHeaders = new Headers();
          Object.entries(proxyRes.headers).forEach(([key, value]) => {
            if (!value || ["content-encoding", "transfer-encoding"].includes(key.toLowerCase())) {
              return;
            }

            // Set-Cookie must be forwarded as separate header lines; joining breaks cookies.
            if (key.toLowerCase() === "set-cookie") {
              const cookieValues = Array.isArray(value) ? value : [value];
              cookieValues.forEach((cookieValue) => responseHeaders.append("set-cookie", cookieValue));
              return;
            }

            responseHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
          });

          const chunks: Buffer[] = [];
          proxyRes.on("data", (chunk) => chunks.push(chunk));
          proxyRes.on("end", () => {
            const responseBody = Buffer.concat(chunks);
            const statusCode = proxyRes.statusCode || 200;
            const contentType = String(proxyRes.headers["content-type"] || "").toLowerCase();

            if (statusCode >= 400) {
              const rawText = responseBody.toString("utf8").trim();
              let message = proxyRes.statusMessage || "Request failed";
              let type = "ProxyError";

              if (contentType.includes("application/json")) {
                try {
                  const parsed = JSON.parse(rawText) as Record<string, unknown>;
                  const nestedMessage =
                    (parsed.error as { message?: unknown } | undefined)?.message ??
                    (parsed.message as unknown);
                  if (typeof nestedMessage === "string" && nestedMessage.trim()) {
                    message = nestedMessage.trim();
                  }
                  const nestedType =
                    (parsed.error as { type?: unknown } | undefined)?.type ??
                    (parsed.type as unknown);
                  if (typeof nestedType === "string" && nestedType.trim()) {
                    type = nestedType.trim();
                  }
                } catch {
                  message = proxyRes.statusMessage || "Request failed";
                }
              } else if (rawText.startsWith("<!DOCTYPE") || rawText.startsWith("<html")) {
                message = proxyRes.statusMessage || "Server returned an HTML error page";
                type = "HtmlErrorResponse";
              } else if (rawText) {
                message = rawText;
              }

              resolve(
                NextResponse.json(
                  {
                    error: {
                      message,
                      type,
                      statusCode,
                    },
                  },
                  {
                    status: statusCode,
                    headers: responseHeaders,
                  }
                )
              );
              return;
            }

            resolve(
              new NextResponse(responseBody, {
                status: statusCode,
                statusText: proxyRes.statusMessage,
                headers: responseHeaders,
              })
            );
          });
        });

        proxyReq.on("error", (error) => {
          console.error("[API Proxy] Error:", error);
          resolve(
            NextResponse.json(
              { error: "Proxy request failed", message: error.message },
              { status: 502 }
            )
          );
        });

        if (body) {
          if (body instanceof ArrayBuffer) {
            proxyReq.write(Buffer.from(body));
          } else {
            proxyReq.write(body);
          }
        }
        proxyReq.end();
      });
    } catch (error) {
      console.error("[API Proxy] Error:", error);
      resolve(
        NextResponse.json(
          { error: "Proxy request failed", message: error instanceof Error ? error.message : "Unknown error" },
          { status: 502 }
        )
      );
    }
  });
}
