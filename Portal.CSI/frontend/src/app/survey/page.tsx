import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "./survey-index.module.css";

export default async function PublicSurveyIndex({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  if (id) {
    redirect(`/survey/${encodeURIComponent(id)}`);
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.heading}>Survey Link Tidak Valid</h1>
        <p className={styles.description}>
          Parameter survey tidak ditemukan. Gunakan link survey yang valid dari email blast atau halaman operations.
        </p>
        <Link href="/login" className={styles.link}>
          Kembali ke portal
        </Link>
      </div>
    </main>
  );
}
