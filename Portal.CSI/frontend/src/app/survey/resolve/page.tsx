import { redirect } from "next/navigation";
import ResolveClient from "./resolve-client";

const API_BASE = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:6000";

export default async function ResolveShortLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  if (!code || !/^[A-Za-z0-9]{6}$/.test(code)) {
    redirect("/");
  }

  try {
    const res = await fetch(`${API_BASE}/api/v1/public/survey-link/${encodeURIComponent(code)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && (data.slug || data.surveyId)) {
        redirect(`/survey/${data.slug || data.surveyId}`);
      }
    }
  } catch {
    // Server-side fetch failed — fall through to client-side resolution
  }

  // Fallback: resolve via client-side fetch through the API proxy
  return <ResolveClient code={code} />;
}
