"use client";

import { useMemo, useRef, useState } from "react";
import ImageCropperModal from "@/app/(admin)/admin/event-management/survey-create/image-cropper-modal";
import styles from "./email-template-editor.module.css";

// ─── Template Layout Definitions ────────────────────────────────────────────

export type TemplateLayout = "hero-banner" | "classic" | "minimal" | "split-info";

export interface EmailTemplateConfig {
  layout: TemplateLayout;
  primaryColor: string;
  buttonColor: string;
  badgeColor: string;
  headerTitle: string;
  headerSubtitle: string;
  showBadge: boolean;
  badgeText: string;
  showButton: boolean;
  buttonLabel: string;
  showQrCode: boolean;
  showLinkFallback: boolean;
  showPeriod: boolean;
  bannerImageUrl: string;
  footerText: string;
}

interface EmailTemplateEditorProps {
  title: string;
  message?: string;
  surveyLink?: string;
  periodText?: string;
  qrCodeUrl?: string;
  config: EmailTemplateConfig;
  onConfigChange: (config: EmailTemplateConfig) => void;
  /** If provided, user can upload banner image */
  onBannerUpload?: (file: File) => void;
  /** Hide CTA button and link fallback toggles (for standalone without survey context) */
  hideSurveyControls?: boolean;
}

const LAYOUT_OPTIONS: Array<{ id: TemplateLayout; name: string; desc: string; emoji: string }> = [
  { id: "hero-banner", name: "Hero Banner", desc: "Full-width gambar atas, judul besar, CTA", emoji: "🖼️" },
  { id: "classic", name: "Classic Professional", desc: "Header warna, badge, message box, button", emoji: "📋" },
  { id: "minimal", name: "Minimal Clean", desc: "Tanpa gambar, header tipis, teks bersih", emoji: "✉️" },
  { id: "split-info", name: "Split Info", desc: "Banner kecil + detail event di samping", emoji: "📰" },
];

export function getDefaultConfig(template: "blast" | "reminder" | "standalone"): EmailTemplateConfig {
  if (template === "reminder") {
    return {
      layout: "classic",
      primaryColor: "#d97706",
      buttonColor: "",
      badgeColor: "",
      headerTitle: "Portal Event",
      headerSubtitle: "PT Astra Otoparts Tbk",
      showBadge: true,
      badgeText: "PENGINGAT SURVEY",
      showButton: true,
      buttonLabel: "Isi Survey Sekarang",
      showQrCode: false,
      showLinkFallback: true,
      showPeriod: true,
      bannerImageUrl: "",
      footerText: "Email ini dikirim secara otomatis oleh <strong>Portal Event</strong> — PT Astra Otoparts Tbk.",
    };
  }
  if (template === "standalone") {
    return {
      layout: "minimal",
      primaryColor: "#1d4ed8",
      buttonColor: "",
      badgeColor: "",
      headerTitle: "Portal Event",
      headerSubtitle: "PT Astra Otoparts Tbk",
      showBadge: false,
      badgeText: "",
      showButton: false,
      buttonLabel: "",
      showQrCode: false,
      showLinkFallback: false,
      showPeriod: false,
      bannerImageUrl: "",
      footerText: "Email ini dikirim secara otomatis oleh <strong>Portal Event</strong> — PT Astra Otoparts Tbk.",
    };
  }
  return {
    layout: "classic",
    primaryColor: "#c0392b",
    buttonColor: "",
    badgeColor: "",
    headerTitle: "Portal Event",
    headerSubtitle: "PT Astra Otoparts Tbk",
    showBadge: true,
    badgeText: "UNDANGAN SURVEY",
    showButton: true,
    buttonLabel: "Mulai Survey",
    showQrCode: false,
    showLinkFallback: true,
    showPeriod: true,
    bannerImageUrl: "",
    footerText: "Email ini dikirim secara otomatis oleh <strong>Portal Event</strong> — PT Astra Otoparts Tbk.",
  };
}

// ─── HTML Builders per Layout ───────────────────────────────────────────────

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "<br/>");
}

function baseStyles(c: EmailTemplateConfig): string {
  const btnColor = c.buttonColor || c.primaryColor;
  const bdgColor = c.badgeColor || c.primaryColor;
  const qrSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 21 21'%3E%3Crect width='21' height='21' fill='%23fff'/%3E%3Cpath d='M1 1h7v7H1zM13 1h7v7h-7zM1 13h7v7H1zM3 3h3v3H3zM15 3h3v3h-3zM3 15h3v3H3zM9 1h1v1H9zM11 1h1v1h-1zM9 3h1v1H9zM11 3h1v1h-1zM9 5h1v1H9zM11 5h1v2h-1zM9 7h2v1H9zM1 9h1v1H1zM3 9h2v1H3zM6 9h1v2H6zM9 9h1v1H9zM11 9h1v1h-1zM13 9h1v1h-1zM15 9h2v1h-2zM18 9h2v1h-2zM1 11h1v1H1zM3 11h1v1H3zM5 11h1v1H5zM9 11h2v1H9zM13 11h1v1h-1zM15 11h1v1h-1zM17 11h1v1h-1zM19 11h1v2h-1zM9 13h1v1H9zM11 13h3v1h-3zM15 13h1v1h-1zM17 13h1v1h-1zM9 15h1v1H9zM11 15h1v1h-1zM13 15h2v1h-2zM17 15h1v1h-1zM19 15h1v1h-1zM9 17h1v1H9zM13 17h1v1h-1zM15 17h3v1h-3zM19 17h1v2h-1zM9 19h2v1H9zM12 19h1v1h-1zM14 19h1v1h-1zM17 19h1v1h-1z' fill='%23374151'/%3E%3C/svg%3E`;
  return `body{margin:0;padding:24px 16px;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;-webkit-font-smoothing:antialiased}*{box-sizing:border-box}.wrap{max-width:540px;margin:0 auto}.footer{padding:16px 24px;text-align:center}.footer p{font-size:10px;color:#8b95a5;margin:0;line-height:1.7}.footer a{color:${c.primaryColor};text-decoration:none;font-weight:600}.btn{display:inline-block;background:${btnColor};color:#fff!important;font-size:14px;font-weight:700;padding:13px 36px;border-radius:8px;text-decoration:none;text-align:center;letter-spacing:.02em}.badge{display:inline-block;background:${bdgColor}12;border:1px solid ${bdgColor}30;color:${bdgColor};font-size:10px;font-weight:700;padding:4px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:.05em}.qr-area{text-align:center;padding:16px;background:#f8fafb;border:1px solid #edf0f3;border-radius:8px;margin:16px 0}.qr-img{width:88px;height:88px;border-radius:4px;margin:0 auto 8px;display:block;border:1px solid #edf0f3}.qr-label{font-size:10px;color:#8b95a5;margin:0}.link-alt{font-size:11px;color:#8b95a5;text-align:center;margin:12px 0 0;word-break:break-all}.link-alt a{color:${c.primaryColor}}.img-round{width:100%;border-radius:8px;margin-bottom:20px;display:block}.qr-src{content:url('${qrSvg}')}`;
}

function buildHeroBanner(c: EmailTemplateConfig, title: string, message?: string, surveyLink?: string, periodText?: string, qrCodeUrl?: string): string {
  const t = esc(title || "Judul Email"), msg = message ? esc(message) : "", link = surveyLink || "#";
  const heroBg = c.bannerImageUrl ? `background:url('${esc(c.bannerImageUrl)}') center/cover no-repeat` : `background:linear-gradient(135deg,${c.primaryColor},${c.primaryColor}cc)`;
  return `<!DOCTYPE html><html><head><style>${baseStyles(c)}.hero{${heroBg};border-radius:12px 12px 0 0;padding:40px 28px 36px;position:relative;overflow:hidden}.hero::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.45));border-radius:12px 12px 0 0}.hero-inner{position:relative;z-index:1}.hero-brand{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}.hero-brand b{color:#fff;font-size:13px}.hero-brand span{color:rgba(255,255,255,.75);font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}.hero h1{color:#fff;font-size:24px;font-weight:900;margin:0;line-height:1.25;text-shadow:0 1px 4px rgba(0,0,0,.2)}.hero-meta{color:rgba(255,255,255,.85);font-size:11px;margin:8px 0 0}.card{background:#fff;border-radius:0 0 12px 12px;padding:28px;box-shadow:0 2px 16px rgba(0,0,0,.04)}.card p{font-size:14px;color:#3d4852;line-height:1.75;margin:0 0 18px;white-space:pre-line}</style></head><body><div class="wrap"><div class="hero"><div class="hero-inner"><div class="hero-brand"><b>${esc(c.headerTitle)}</b><span>${esc(c.headerSubtitle)}</span></div>${c.showBadge ? `<span class="badge" style="background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.3);color:#fff;margin-bottom:10px">${esc(c.badgeText)}</span>` : ""}<h1>${t}</h1>${c.showPeriod && periodText ? `<p class="hero-meta">📅 ${esc(periodText)}</p>` : ""}</div></div><div class="card">${msg ? `<p>${msg}</p>` : ""}${c.showButton ? `<div style="text-align:center;margin:20px 0"><a class="btn" href="${esc(link)}">${esc(c.buttonLabel)} →</a></div>` : ""}${c.showQrCode ? `<div class="qr-area">${qrCodeUrl ? `<img class="qr-img" src="${qrCodeUrl}" alt="QR Code"/>` : `<img class="qr-img qr-src" alt="QR Code"/>`}<p class="qr-label">QR Code</p></div>` : ""}${c.showLinkFallback ? `<p class="link-alt"><a href="${esc(link)}">${esc(link)}</a></p>` : ""}</div><div class="footer"><p>${c.footerText}</p></div></div></body></html>`;
}

function buildClassic(c: EmailTemplateConfig, title: string, message?: string, surveyLink?: string, periodText?: string, qrCodeUrl?: string): string {
  const t = esc(title || "Judul Email"), msg = message ? esc(message) : "", link = surveyLink || "#";
  return `<!DOCTYPE html><html><head><style>${baseStyles(c)}.header{background:${c.primaryColor};padding:18px 28px;border-radius:12px 12px 0 0}.header-row{display:flex;align-items:center;justify-content:space-between}.header-row b{color:#fff;font-size:14px}.header-row span{color:rgba(255,255,255,.8);font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}.card{background:#fff;border-radius:0 0 12px 12px;padding:28px;box-shadow:0 2px 16px rgba(0,0,0,.04)}.card h1{font-size:20px;font-weight:800;color:#1a202c;text-align:center;margin:0 0 20px;line-height:1.3}.msg-box{background:#f8fafb;border:1px solid #edf0f3;border-radius:8px;padding:16px 18px;margin-bottom:20px}.msg-box p{font-size:13px;color:#3d4852;margin:0;line-height:1.75;white-space:pre-line}.period-strip{border-left:3px solid ${c.primaryColor};background:#f8fafb;border-radius:0 6px 6px 0;padding:10px 16px;margin-bottom:20px}.period-strip p{font-size:12px;color:#4a5568;margin:0}.period-strip strong{color:#1a202c}</style></head><body><div class="wrap"><div class="header"><div class="header-row"><b>${esc(c.headerTitle)}</b><span>${esc(c.headerSubtitle)}</span></div></div><div class="card">${c.bannerImageUrl ? `<img class="img-round" src="${esc(c.bannerImageUrl)}" alt=""/>` : ""}${c.showBadge ? `<div style="text-align:center;margin-bottom:14px"><span class="badge">${esc(c.badgeText)}</span></div>` : ""}<h1>${t}</h1>${msg ? `<div class="msg-box"><p>${msg}</p></div>` : ""}${c.showPeriod && periodText ? `<div class="period-strip"><p><strong>📅 Periode:</strong> ${esc(periodText)}</p></div>` : ""}${c.showButton ? `<div style="text-align:center;margin:22px 0"><a class="btn" href="${esc(link)}">${esc(c.buttonLabel)} →</a></div>` : ""}${c.showQrCode ? `<div class="qr-area">${qrCodeUrl ? `<img class="qr-img" src="${qrCodeUrl}" alt="QR Code"/>` : `<img class="qr-img qr-src" alt="QR Code"/>`}<p class="qr-label">QR Code</p></div>` : ""}${c.showLinkFallback ? `<p class="link-alt"><a href="${esc(link)}">${esc(link)}</a></p>` : ""}</div><div class="footer"><p>${c.footerText}</p></div></div></body></html>`;
}

// ─── Template 3: Minimal Clean ──────────────────────────────────────────────
// Minimal: accent bar, clean card — modern SaaS style
function buildMinimal(c: EmailTemplateConfig, title: string, message?: string, surveyLink?: string, periodText?: string, _qrCodeUrl?: string): string {
  const t = esc(title || "Judul Email"), msg = message ? esc(message) : "", link = surveyLink || "#";
  return `<!DOCTYPE html><html><head><style>${baseStyles(c)}.accent-bar{height:5px;background:linear-gradient(90deg,${c.primaryColor},${c.primaryColor}55);border-radius:12px 12px 0 0}.card{background:#fff;border-radius:0 0 12px 12px;padding:28px;box-shadow:0 2px 16px rgba(0,0,0,.04);border:1px solid #edf0f3;border-top:none}.brand-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid #f1f4f7}.brand-name{font-size:14px;font-weight:700;color:#1a202c}.brand-org{font-size:11px;color:#8b95a5;margin-top:1px}.card h1{font-size:19px;font-weight:800;color:#1a202c;margin:0 0 16px;line-height:1.35}.body-text{font-size:13px;color:#4a5568;line-height:1.8;margin:0 0 20px;white-space:pre-line}.highlight-box{background:${c.primaryColor}08;border:1px solid ${c.primaryColor}18;border-radius:8px;padding:12px 16px;margin-bottom:20px}.highlight-box p{font-size:12px;color:#3d4852;margin:0}.highlight-box strong{color:${c.primaryColor}}</style></head><body><div class="wrap"><div class="accent-bar"></div><div class="card"><div class="brand-row"><div><div class="brand-name">${esc(c.headerTitle)}</div><div class="brand-org">${esc(c.headerSubtitle)}</div></div></div>${c.bannerImageUrl ? `<img class="img-round" src="${esc(c.bannerImageUrl)}" alt=""/>` : ""}${c.showBadge ? `<div style="margin-bottom:12px"><span class="badge">${esc(c.badgeText)}</span></div>` : ""}<h1>${t}</h1>${msg ? `<p class="body-text">${msg}</p>` : ""}${c.showPeriod && periodText ? `<div class="highlight-box"><p><strong>📅 Periode:</strong> ${esc(periodText)}</p></div>` : ""}${c.showButton ? `<div style="margin:20px 0"><a class="btn" href="${esc(link)}">${esc(c.buttonLabel)} →</a></div>` : ""}${c.showLinkFallback ? `<p class="link-alt" style="text-align:left"><a href="${esc(link)}">${esc(link)}</a></p>` : ""}</div><div class="footer"><p>${c.footerText}</p></div></div></body></html>`;
}

// Split Info: thin top bar, 2-column with detail card — conference style
function buildSplitInfo(c: EmailTemplateConfig, title: string, message?: string, surveyLink?: string, periodText?: string, qrCodeUrl?: string): string {
  const t = esc(title || "Judul Email"), msg = message ? esc(message) : "", link = surveyLink || "#";
  return `<!DOCTYPE html><html><head><style>${baseStyles(c)}.top-bar{height:4px;background:${c.primaryColor};border-radius:12px 12px 0 0}.card{background:#fff;border-radius:0 0 12px 12px;padding:28px;box-shadow:0 2px 16px rgba(0,0,0,.04)}.brand-line{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid #f1f4f7}.brand-line b{font-size:13px;color:#1a202c}.brand-line span{font-size:9px;font-weight:600;color:#8b95a5;text-transform:uppercase;letter-spacing:.05em}.card h1{font-size:19px;font-weight:800;color:#1a202c;margin:0 0 18px;line-height:1.3}.columns{display:flex;gap:20px}.col-content{flex:1;min-width:0}.col-content p{font-size:13px;color:#4a5568;line-height:1.75;margin:0 0 16px;white-space:pre-line}.col-detail{width:165px;flex-shrink:0}.detail-card{background:#f8fafb;border:1px solid #edf0f3;border-radius:10px;padding:16px}.detail-heading{font-size:10px;font-weight:700;color:${c.primaryColor};text-transform:uppercase;letter-spacing:.05em;margin:0 0 10px}.detail-row{margin-bottom:8px}.detail-label{font-size:10px;font-weight:700;color:#1a202c;margin:0}.detail-value{font-size:11px;color:#4a5568;margin:2px 0 0}</style></head><body><div class="wrap"><div class="top-bar"></div><div class="card"><div class="brand-line"><b>${esc(c.headerTitle)}</b><span>${esc(c.headerSubtitle)}</span></div>${c.bannerImageUrl ? `<img class="img-round" src="${esc(c.bannerImageUrl)}" alt=""/>` : ""}${c.showBadge ? `<div style="margin-bottom:12px"><span class="badge">${esc(c.badgeText)}</span></div>` : ""}<h1>${t}</h1><div class="columns"><div class="col-content">${msg ? `<p>${msg}</p>` : ""}${c.showButton ? `<a class="btn" href="${esc(link)}">${esc(c.buttonLabel)} →</a>` : ""}</div><div class="col-detail"><div class="detail-card"><p class="detail-heading">Detail Event</p><div class="detail-row"><p class="detail-label">📅 Tanggal</p><p class="detail-value">${c.showPeriod && periodText ? esc(periodText) : "-"}</p></div><div class="detail-row"><p class="detail-label">📍 Lokasi</p><p class="detail-value">-</p></div><div class="detail-row"><p class="detail-label">🕐 Waktu</p><p class="detail-value">-</p></div></div></div></div>${c.showQrCode ? `<div class="qr-area">${qrCodeUrl ? `<img class="qr-img" src="${qrCodeUrl}" alt="QR Code"/>` : `<img class="qr-img qr-src" alt="QR Code"/>`}<p class="qr-label">QR Code</p></div>` : ""}${c.showLinkFallback ? `<p class="link-alt"><a href="${esc(link)}">${esc(link)}</a></p>` : ""}</div><div class="footer"><p>${c.footerText}</p></div></div></body></html>`;
}

function buildPreviewHtml(config: EmailTemplateConfig, title: string, message?: string, surveyLink?: string, periodText?: string, qrCodeUrl?: string): string {
  switch (config.layout) {
    case "hero-banner": return buildHeroBanner(config, title, message, surveyLink, periodText, qrCodeUrl);
    case "minimal": return buildMinimal(config, title, message, surveyLink, periodText, qrCodeUrl);
    case "split-info": return buildSplitInfo(config, title, message, surveyLink, periodText, qrCodeUrl);
    default: return buildClassic(config, title, message, surveyLink, periodText, qrCodeUrl);
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function EmailTemplateEditor({ title, message, surveyLink, periodText, qrCodeUrl, config, onConfigChange, onBannerUpload, hideSurveyControls }: EmailTemplateEditorProps) {
  const html = useMemo(() => buildPreviewHtml(config, title, message, surveyLink, periodText, qrCodeUrl), [config, title, message, surveyLink, periodText, qrCodeUrl]);
  const [showPanel, setShowPanel] = useState(true);
  const [cropperFile, setCropperFile] = useState<File | null>(null);
  const [bannerFileName, setBannerFileName] = useState("");
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof EmailTemplateConfig>(key: K, value: EmailTemplateConfig[K]) => {
    onConfigChange({ ...config, [key]: value });
  };

  const handleBannerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFileName(file.name);
    setCropperFile(file);
    e.target.value = "";
  };

  const handleCropApply = async (croppedFile: File) => {
    setCropperFile(null);
    if (onBannerUpload) {
      onBannerUpload(croppedFile);
    }
    const url = URL.createObjectURL(croppedFile);
    update("bannerImageUrl", url);
  };

  return (
    <div className={styles.wrapper}>
      {/* Toolbar */}
      <div className={styles.toolbarHeader}>
        <div className={styles.toolbarLeft}>
          <span className={styles.toolbarIcon}>🎨</span>
          <span className={styles.toolbarTitle}>Template Email</span>
        </div>
        <button type="button" className={styles.toggleBtn} onClick={() => setShowPanel((v) => !v)}>
          {showPanel ? "Sembunyikan ▲" : "Tampilkan ▼"}
        </button>
      </div>

      {showPanel && (
        <div className={styles.panel}>
          {/* Layout Gallery */}
          <div className={styles.panelSection}>
            <div className={styles.panelSectionTitle}>Pilih Layout</div>
            <div className={styles.layoutGallery}>
              {LAYOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`${styles.layoutCard} ${config.layout === opt.id ? styles.layoutCardActive : ""}`}
                  onClick={() => update("layout", opt.id)}
                >
                  <span className={styles.layoutEmoji}>{opt.emoji}</span>
                  <span className={styles.layoutName}>{opt.name}</span>
                  <span className={styles.layoutDesc}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Banner Image */}
          <div className={styles.panelSection}>
            <div className={styles.panelSectionTitle}>Banner Image</div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="tpl-banner">Banner Image</label>
                <div className={styles.fileUploadRow}>
                  <input id="tpl-banner" name="tpl-banner" type="file" accept="image/*" className={styles.fileInputHidden} onChange={handleBannerFile} ref={bannerInputRef} />
                  <button type="button" className={styles.fileUploadBtn} onClick={() => bannerInputRef.current?.click()}>📁 Pilih Gambar</button>
                  <span className={styles.fileUploadName}>{bannerFileName || "Belum ada file"}</span>
                </div>
              </div>
              {config.bannerImageUrl && (
                <button type="button" className={styles.removeBannerBtn} onClick={() => { update("bannerImageUrl", ""); setBannerFileName(""); }}>✕ Hapus</button>
              )}
            </div>
            {config.bannerImageUrl && (
              <div className={styles.bannerPreview}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={config.bannerImageUrl} alt="Banner preview" className={styles.bannerThumb} />
              </div>
            )}
          </div>

          {/* Header */}
          <div className={styles.panelSection}>
            <div className={styles.panelSectionTitle}>Header</div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="tpl-header-title">Judul</label>
                <input id="tpl-header-title" name="tpl-header-title" className={styles.fieldInput} value={config.headerTitle} onChange={(e) => update("headerTitle", e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="tpl-header-sub">Subtitle</label>
                <input id="tpl-header-sub" name="tpl-header-sub" className={styles.fieldInput} value={config.headerSubtitle} onChange={(e) => update("headerSubtitle", e.target.value)} />
              </div>
              <div className={styles.fieldSmall}>
                <label className={styles.fieldLabel} htmlFor="tpl-color">Warna</label>
                <input id="tpl-color" name="tpl-color" type="color" className={styles.colorInput} value={config.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className={styles.panelSection}>
            <div className={styles.panelSectionTitle}>Elemen</div>
            <div className={styles.toggleGrid}>
              <label className={styles.toggleInline}>
                <input type="checkbox" id="tpl-show-badge" name="tpl-show-badge" checked={config.showBadge} onChange={(e) => update("showBadge", e.target.checked)} />
                <span>Badge</span>
              </label>
              {!hideSurveyControls && (
                <label className={styles.toggleInline}>
                  <input type="checkbox" id="tpl-show-btn" name="tpl-show-btn" checked={config.showButton} onChange={(e) => update("showButton", e.target.checked)} />
                  <span>Tombol CTA</span>
                </label>
              )}
              {!hideSurveyControls && (
                <label className={styles.toggleInline}>
                  <input type="checkbox" id="tpl-show-link" name="tpl-show-link" checked={config.showLinkFallback} onChange={(e) => update("showLinkFallback", e.target.checked)} />
                  <span>Link Fallback</span>
                </label>
              )}
              <label className={styles.toggleInline}>
                <input type="checkbox" id="tpl-show-period" name="tpl-show-period" checked={config.showPeriod} onChange={(e) => update("showPeriod", e.target.checked)} />
                <span>Info Periode</span>
              </label>
            </div>

            {/* Inline edits for enabled elements */}
            {config.showBadge && (
              <div className={styles.inlineEdit}>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="tpl-badge-text">Teks Badge</label>
                    <input id="tpl-badge-text" name="tpl-badge-text" className={styles.fieldInput} value={config.badgeText} onChange={(e) => update("badgeText", e.target.value)} placeholder="UNDANGAN SURVEY" />
                  </div>
                  <div className={styles.fieldSmall}>
                    <label className={styles.fieldLabel} htmlFor="tpl-badge-color">Warna</label>
                    <input id="tpl-badge-color" name="tpl-badge-color" type="color" className={styles.colorInput} value={config.badgeColor || config.primaryColor} onChange={(e) => update("badgeColor", e.target.value)} />
                  </div>
                </div>
              </div>
            )}
            {config.showButton && !hideSurveyControls && (
              <div className={styles.inlineEdit}>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="tpl-btn-label">Label Tombol</label>
                    <input id="tpl-btn-label" name="tpl-btn-label" className={styles.fieldInput} value={config.buttonLabel} onChange={(e) => update("buttonLabel", e.target.value)} placeholder="Mulai Survey" />
                  </div>
                  <div className={styles.fieldSmall}>
                    <label className={styles.fieldLabel} htmlFor="tpl-btn-color">Warna</label>
                    <input id="tpl-btn-color" name="tpl-btn-color" type="color" className={styles.colorInput} value={config.buttonColor || config.primaryColor} onChange={(e) => update("buttonColor", e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live Preview */}
      <div className={styles.previewContainer}>
        <div className={styles.previewLabel}>Preview</div>
        <iframe className={styles.iframe} title="Email Preview" srcDoc={html} />
      </div>

      {/* Image Cropper Modal */}
      {cropperFile && (
        <ImageCropperModal
          file={cropperFile}
          imageType="hero"
          onCancel={() => setCropperFile(null)}
          onApply={handleCropApply}
        />
      )}
    </div>
  );
}
