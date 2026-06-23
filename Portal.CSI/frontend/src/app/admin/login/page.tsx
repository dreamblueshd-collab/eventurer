import { redirect } from "next/navigation";

interface AdminLoginAliasPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function AdminLoginAliasPage({
  searchParams,
}: AdminLoginAliasPageProps) {
  const params = await searchParams;
  const nextTarget = params.next ? `?next=${encodeURIComponent(params.next)}` : "";
  redirect(`/login${nextTarget}`);
}
