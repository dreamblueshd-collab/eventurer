/**
 * survey-form-states.tsx — Static/terminal UI states for the public survey.
 * Loading, error, not-found, already-submitted, and success screens.
 */

import type { CSSProperties } from "react";
import styles from "./survey-public.module.css";

type HeroConfig = {
  heroImageUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  primaryColor: string;
  fontFamily?: string;
  pageStyle: CSSProperties;
};

export function SurveyLoading() {
  return (
    <section className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.card}>
          <div className={styles.loadingWrap}>Memuat survey...</div>
        </div>
      </div>
    </section>
  );
}

export function SurveyAlreadySubmitted() {
  return (
    <section className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.card}>
          <div className={styles.heroWrap}>
            <div className={styles.heroImagePlaceholder} />
            <div className={styles.brandBadge}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/img/logo.png" alt="PT Astra Otoparts Tbk" className={styles.brandBadgeLogo} />
            </div>
          </div>
          <div className={styles.titlebar}>Survey</div>
          <div className={styles.successBody}>
            <div className={styles.successPanel}>
              <div className={styles.successIcon}>✅</div>
              <h2 className={styles.successTitle}>Anda sudah mengisi survey ini.</h2>
              <p className={styles.successText}>
                Response Anda sudah tercatat sebelumnya. Terima kasih atas partisipasi Anda.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SurveyError({ message }: { message: string }) {
  return (
    <section className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.card}>
          <div className={styles.body}>
            <div className={styles.alertError}>{message}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SurveyNotFound() {
  return (
    <section className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.card}>
          <div className={styles.body}>
            <div className={styles.empty}>Survey tidak tersedia.</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SurveySuccess({ hero, message }: { hero: HeroConfig; message: string }) {
  return (
    <section className={styles.page} style={hero.pageStyle}>
      <div className={styles.shell}>
        <div className={styles.card}>
          <div className={styles.heroWrap}>
            {hero.heroImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hero.heroImageUrl} alt="Survey header" className={styles.heroImage} />
            ) : (
              <div className={styles.heroImagePlaceholder} />
            )}
            <div className={styles.brandBadge}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/img/logo.png" alt="PT Astra Otoparts Tbk" className={styles.brandBadgeLogo} />
            </div>
          </div>
          <div className={styles.titlebar} style={{ fontFamily: hero.fontFamily }}>
            {hero.heroTitle}
          </div>
          <div className={styles.subbar}>
            <span className={`${styles.subbarStatus} ${styles.statusActive}`}>Terima Kasih</span>
          </div>
          <div className={styles.successBody}>
            <div className={styles.successPanel}>
              <div className={styles.successIcon}>✅</div>
              <h2 className={styles.successTitle}>Terima kasih atas partisipasi Anda.</h2>
              <p className={styles.successText}>
                Response untuk survey ini sudah berhasil dikirim. Anda tidak perlu mengisi ulang halaman ini.
              </p>
              {message ? <div className={styles.alertSuccess}>{message}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
