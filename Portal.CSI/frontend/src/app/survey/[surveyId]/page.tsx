import type { Metadata } from "next";
import SurveyClient from "./survey-client";

const API_BASE = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:6000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

async function fetchSurveyMeta(surveyId: string) {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/responses/survey/${encodeURIComponent(surveyId)}/form`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success || !data.form) return null;
    return data.form as {
      title?: string;
      description?: string;
      configuration?: {
        heroTitle?: string;
        heroSubtitle?: string;
        heroImageUrl?: string;
        logoUrl?: string;
      };
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ surveyId: string }>;
}): Promise<Metadata> {
  const { surveyId } = await params;
  const form = await fetchSurveyMeta(surveyId);

  const title = form?.configuration?.heroTitle || form?.title || "Survey CSI";
  const description =
    form?.configuration?.heroSubtitle || form?.description || "Silakan isi survey Customer Satisfaction Index";
  const rawImageUrl = form?.configuration?.heroImageUrl || "/assets/img/logo.png";
  const imageUrl = /^https?:\/\//i.test(rawImageUrl) ? rawImageUrl : new URL(rawImageUrl, APP_URL).toString();
  const canonicalUrl = new URL(`/survey/${encodeURIComponent(surveyId)}`, APP_URL).toString();

  return {
    title: `${title} - Survey`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${title} - Survey`,
      description,
      url: canonicalUrl,
      type: "website",
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function PublicSurveyPage({
  params,
}: {
  params: Promise<{ surveyId: string }>;
}) {
  const { surveyId } = await params;
  return <SurveyClient surveyId={surveyId} />;
}
