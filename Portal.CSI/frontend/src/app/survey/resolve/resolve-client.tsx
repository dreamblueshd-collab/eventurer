"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ResolveClient({ code }: { code: string }) {
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/v1/public/survey-link/${encodeURIComponent(code)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && (data.slug || data.surveyId)) {
          router.replace(`/survey/${data.slug || data.surveyId}`);
        } else {
          router.replace("/");
        }
      })
      .catch(() => {
        router.replace("/");
      });
  }, [code, router]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <p>Redirecting...</p>
    </div>
  );
}
