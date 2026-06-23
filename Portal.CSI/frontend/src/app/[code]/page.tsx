import { redirect } from "next/navigation";
import type { Metadata } from "next";
import ResolveClient from "../survey/resolve/resolve-client";

const API_BASE = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:6000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

// 6-char alphanumeric short code pattern
const SHORT_CODE_REGEX = /^[A-Za-z0-9]{6}$/;

async function fetchMetaByCode(code: string) {
  try {
    const resolveRes = await fetch(`${API_BASE}/api/v1/public/survey-link/${encodeURIComponent(code)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!resolveRes.ok) return null;

    const resolved = await resolveRes.json();
    if (!resolved?.success || (!resolved?.slug && !resolved?.surveyId)) return null;

    const targetId = String(resolved.slug || resolved.surveyId);
    const formRes = await fetch(`${API_BASE}/api/v1/responses/survey/${encodeURIComponent(targetId)}/form`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!formRes.ok) return null;

    const formPayload = await formRes.json();
    if (!formPayload?.success || !formPayload?.form) return null;

    return {
      targetId,
      form: formPayload.form as {
        title?: string;
        description?: string;
        configuration?: {
          heroTitle?: string;
          heroSubtitle?: string;
          heroImageUrl?: string;
          logoUrl?: string;
        };
      },
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;

  if (!code || !SHORT_CODE_REGEX.test(code)) {
    return {
      title: "CSI Portal",
      description: "Portal internal CSI",
    };
  }

  const meta = await fetchMetaByCode(code);
  if (!meta) {
    return {
      title: "Survey CSI",
      description: "Silakan isi survey Customer Satisfaction Index",
    };
  }

  const title = meta.form.configuration?.heroTitle || meta.form.title || "Survey CSI";
  const description = meta.form.configuration?.heroSubtitle || meta.form.description || "Silakan isi survey Customer Satisfaction Index";
  const rawImageUrl = meta.form.configuration?.heroImageUrl || "/assets/img/logo.png";
  const imageUrl = /^https?:\/\//i.test(rawImageUrl) ? rawImageUrl : new URL(rawImageUrl, APP_URL).toString();
  const canonicalUrl = new URL(`/${encodeURIComponent(code)}`, APP_URL).toString();

  return {
    title: `${title} - Survey`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${title} - Survey`,
      description,
      url: canonicalUrl,
      type: "website",
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} - Survey`,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function ShortLinkCatchAll({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  if (!code || !SHORT_CODE_REGEX.test(code)) {
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
