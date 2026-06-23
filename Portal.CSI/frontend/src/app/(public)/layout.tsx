import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Doorprize Display",
  description: "Public doorprize winner display",
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
