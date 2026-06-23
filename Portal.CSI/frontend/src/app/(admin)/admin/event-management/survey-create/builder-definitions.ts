import type { CSSProperties } from "react";

export type ElementType = "hero" | "text" | "choice" | "checkbox" | "dropdown" | "rating" | "likert" | "matrix" | "date" | "signature";

export type FontPreset = "default" | "georgia" | "trebuchet" | "verdana" | "tahoma" | "courier";

export type DataSourceType =
  | "manual"
  | "bu"
  | "division"
  | "department"
  | "function"
  | "app_department"
  | "app_function";

export type ProfileFieldType = "bu" | "division" | "department" | "function" | null;

export interface BuilderElement {
  id: string;
  type: ElementType;
  title: string;
  subtitle: string;
  required: boolean;
  options: string[];
  coverUrl: string;
  ratingScale?: number;
  dataSource?: DataSourceType;
  optionLayout?: "vertical" | "horizontal";
  allowMultipleAnswers?: boolean;
  displayCondition?: "always" | "after_mapped_selection";
  conditionalRequiredSourceId?: string;
  conditionalRequiredThreshold?: number;
  /** Threshold untuk komentar wajib per row di likert. Komentar wajib jika nilai < threshold. Default 7. */
  likertCommentThreshold?: number;
  /** Aktifkan textbox komentar per statement di likert. Default true. */
  likertEnableComment?: boolean;
}

export interface BuilderPage {
  id: number;
  title: string;
  elements: BuilderElement[];
}

interface TemplateElementInput {
  type: ElementType;
  title: string;
  subtitle?: string;
  required?: boolean;
  options?: string[];
  dataSource?: DataSourceType;
  optionLayout?: "vertical" | "horizontal";
  allowMultipleAnswers?: boolean;
  displayCondition?: "always" | "after_mapped_selection";
  conditionalRequiredSourceIndex?: number;
  conditionalRequiredThreshold?: number;
}

interface TemplatePageInput {
  title: string;
  elements: TemplateElementInput[];
}

export interface BuilderTemplate {
  id: string;
  name: string;
  category: "feedback" | "employee" | "service" | "compliance" | "event" | "registration";
  description: string;
  pages: TemplatePageInput[];
}

export interface DraftPayload {
  surveyTitle: string;
  surveyDesc: string;
  targetRespondents: string;
  targetScore: string;
  scheduleStart: string;
  scheduleEnd: string;
  pages: BuilderPage[];
  savedAt?: string;
  syncedAt?: string;
  style: {
    logo: string;
    backgroundColor: string;
    backgroundImage: string;
    font: FontPreset;
    heroTitle: string;
    heroSubtitle: string;
    primaryColor: string;
    secondaryColor: string;
    buttonStyle: "rounded" | "pill" | "square";
    showProgressBar: boolean;
    showPageNumbers: boolean;
    multiPage: boolean;
    heroImagePositionX: number;
    heroImagePositionY: number;
    logoPositionX: number;
    logoPositionY: number;
    backgroundPositionX: number;
    backgroundPositionY: number;
  };
}

export function sanitizeSurveyDescription(value: string): string {
  return value
    .replace(/\s*\[Admin Event Target:[^\]]*\]\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export const FONT_MAP: Record<FontPreset, string> = {
  default: "inherit",
  georgia: 'Georgia, "Times New Roman", serif',
  trebuchet: '"Trebuchet MS", "Lucida Sans Unicode", sans-serif',
  verdana: "Verdana, Geneva, sans-serif",
  tahoma: "Tahoma, Geneva, sans-serif",
  courier: '"Courier New", Courier, monospace',
};

export const ELEMENTS: Array<{ type: ElementType; label: string; icon: string }> = [
  { type: "hero", label: "Hero Cover", icon: "\u{1F5BC}\uFE0F" },
  { type: "text", label: "Text Input", icon: "T" },
  { type: "choice", label: "Multiple Choice", icon: "\u25CF" },
  { type: "checkbox", label: "Checkboxes", icon: "\u2611" },
  { type: "dropdown", label: "Dropdown", icon: "\u25BE" },
  { type: "rating", label: "Rating", icon: "\u2605" },
  { type: "likert", label: "Likert Scale", icon: "\u{1F4CA}" },
  { type: "matrix", label: "Matrix", icon: "\u29DE" },
  { type: "date", label: "Date", icon: "\u{1F4C5}" },
  { type: "signature", label: "Signature", icon: "\u270D\uFE0F" },
];

export const BUILDER_TEMPLATES: BuilderTemplate[] = [
  {
    id: "employee-satisfaction",
    name: "Employee Satisfaction",
    category: "employee",
    description: "Template umum kepuasan karyawan dengan metrik rating dan komentar prioritas perbaikan.",
    pages: [
      {
        title: "Welcome",
        elements: [
          { type: "hero", title: "Employee Satisfaction Survey", subtitle: "Feedback Anda membantu peningkatan layanan internal." },
          { type: "dropdown", title: "Business Unit", required: true, dataSource: "bu", options: ["Corporate"] },
          { type: "dropdown", title: "Department", required: true, dataSource: "department", options: ["IT"] },
        ],
      },
      {
        title: "Experience",
        elements: [
          { type: "choice", title: "Area yang Anda nilai", required: true, dataSource: "app_department", options: ["App A"] },
          { type: "rating", title: "Skor kepuasan keseluruhan", required: true, options: ["10"], displayCondition: "after_mapped_selection" },
          { type: "text", title: "Alasan skor Anda", required: false, displayCondition: "after_mapped_selection", conditionalRequiredSourceIndex: 1, conditionalRequiredThreshold: 7 },
        ],
      },
      {
        title: "Improvement Plan",
        elements: [
          { type: "checkbox", title: "Prioritas peningkatan", options: ["Stability", "Performance", "UI/UX", "Support"] },
          { type: "text", title: "Saran tambahan", required: false },
          { type: "signature", title: "Konfirmasi responden", required: false },
        ],
      },
    ],
  },
  {
    id: "post-event-feedback",
    name: "Post-Event Feedback",
    category: "event",
    description: "Template evaluasi event setelah kegiatan selesai, termasuk sesi, materi, dan fasilitator.",
    pages: [
      {
        title: "Opening",
        elements: [
          { type: "hero", title: "Post-Event Feedback Survey", subtitle: "Mohon evaluasi event yang baru Anda ikuti." },
          { type: "text", title: "Nama Event", required: true },
          { type: "date", title: "Tanggal Event", required: true },
        ],
      },
      {
        title: "Evaluation",
        elements: [
          { type: "likert", title: "Penilaian sesi", required: true, options: ["Materi relevan", "Pembicara jelas", "Durasi efektif"] },
          { type: "rating", title: "Skor event keseluruhan", required: true, options: ["10"] },
          { type: "text", title: "Saran perbaikan", required: false, conditionalRequiredSourceIndex: 1, conditionalRequiredThreshold: 8 },
        ],
      },
    ],
  },
  {
    id: "it-service-quality",
    name: "IT Service Quality",
    category: "service",
    description: "Template evaluasi kualitas layanan IT helpdesk dan aplikasi pendukung kerja.",
    pages: [
      {
        title: "Profile",
        elements: [
          { type: "dropdown", title: "Function", required: true, dataSource: "function", options: ["IT"] },
          { type: "choice", title: "Aplikasi yang dinilai", required: true, dataSource: "app_function", options: ["App X"] },
        ],
      },
      {
        title: "Service Score",
        elements: [
          { type: "matrix", title: "Penilaian detail layanan", required: true, options: ["Kecepatan", "Ketepatan Solusi", "Komunikasi"] },
          { type: "rating", title: "Skor layanan IT", required: true, options: ["10"], displayCondition: "after_mapped_selection" },
          { type: "text", title: "Masukan prioritas", displayCondition: "after_mapped_selection", conditionalRequiredSourceIndex: 1, conditionalRequiredThreshold: 7 },
        ],
      },
      {
        title: "Follow-up",
        elements: [
          { type: "choice", title: "Apakah perlu tindak lanjut tim IT?", required: true, options: ["Ya", "Tidak"] },
          { type: "date", title: "Target tindak lanjut", required: false },
        ],
      },
    ],
  },
  {
    id: "application-adoption",
    name: "Application Adoption",
    category: "service",
    description: "Template untuk mengukur adopsi dan kemudahan penggunaan aplikasi.",
    pages: [
      {
        title: "Selection",
        elements: [
          { type: "dropdown", title: "Business Unit", required: true, dataSource: "bu", options: ["Corporate"] },
          { type: "dropdown", title: "Division", required: true, dataSource: "division", options: ["IT"] },
          { type: "choice", title: "Aplikasi utama", required: true, dataSource: "app_department", options: ["App 1"] },
        ],
      },
      {
        title: "Adoption",
        elements: [
          { type: "checkbox", title: "Fitur yang sering digunakan", options: ["Dashboard", "Report", "Approval"], optionLayout: "vertical", displayCondition: "after_mapped_selection" },
          { type: "rating", title: "Kemudahan penggunaan", required: true, options: ["10"], displayCondition: "after_mapped_selection" },
          { type: "text", title: "Kendala penggunaan", displayCondition: "after_mapped_selection" },
        ],
      },
    ],
  },
  {
    id: "compliance-self-assessment",
    name: "Compliance Self Assessment",
    category: "compliance",
    description: "Template audit kepatuhan internal dengan matrix, bukti tanggal, dan approval signature.",
    pages: [
      {
        title: "Assessment",
        elements: [
          { type: "dropdown", title: "Department", required: true, dataSource: "department", options: ["Dept"] },
          { type: "matrix", title: "Checklist kepatuhan", required: true, options: ["Policy", "Process", "Evidence"] },
          { type: "date", title: "Tanggal pemeriksaan", required: true },
        ],
      },
      {
        title: "Risk Score",
        elements: [
          { type: "rating", title: "Skor kepatuhan", required: true, options: ["10"] },
          { type: "text", title: "Alasan skor", required: false, conditionalRequiredSourceIndex: 0, conditionalRequiredThreshold: 8 },
        ],
      },
      {
        title: "Evidence",
        elements: [
          { type: "text", title: "Ringkasan bukti", required: true },
          { type: "date", title: "Tanggal verifikasi evidence", required: true },
        ],
      },
      {
        title: "Acknowledgement",
        elements: [
          { type: "text", title: "Catatan temuan", required: false },
          { type: "signature", title: "Tanda tangan PIC", required: true },
        ],
      },
    ],
  },
  {
    id: "request-intake",
    name: "Request Intake",
    category: "feedback",
    description: "Template intake kebutuhan/permintaan user sebelum proyek atau enhancement dimulai.",
    pages: [
      {
        title: "Request Intake",
        elements: [
          { type: "text", title: "Nama Pemohon", required: true },
          { type: "dropdown", title: "Business Unit", required: true, dataSource: "bu", options: ["Corporate"] },
          { type: "dropdown", title: "Department", required: true, dataSource: "department", options: ["IT"] },
          { type: "text", title: "Ringkasan kebutuhan", required: true },
          { type: "checkbox", title: "Tipe kebutuhan", required: true, options: ["Bug Fix", "Enhancement", "New Feature"] },
          { type: "date", title: "Target implementasi", required: false },
          { type: "rating", title: "Urgensi request", required: true, options: ["10"] },
        ],
      },
    ],
  },
  {
    id: "research-survey",
    name: "Research Survey",
    category: "feedback",
    description: "Template riset preferensi user dengan kombinasi question kuantitatif dan kualitatif.",
    pages: [
      {
        title: "Research Profile",
        elements: [
          { type: "dropdown", title: "Function", required: true, dataSource: "function", options: ["IT"] },
          { type: "choice", title: "Aplikasi fokus riset", required: true, dataSource: "app_function", options: ["App Focus"] },
        ],
      },
      {
        title: "Research Answers",
        elements: [
          { type: "rating", title: "Skor pengalaman", required: true, options: ["10"], displayCondition: "after_mapped_selection" },
          { type: "text", title: "Insight utama", required: true, displayCondition: "after_mapped_selection" },
          { type: "checkbox", title: "Faktor prioritas", options: ["Performance", "UI/UX", "Stability"], displayCondition: "after_mapped_selection" },
        ],
      },
      {
        title: "Conclusion",
        elements: [
          { type: "likert", title: "Tingkat urgensi perbaikan", options: ["1 bulan", "3 bulan", "6 bulan"] },
          { type: "text", title: "Kesimpulan responden", required: false },
        ],
      },
    ],
  },
  {
    id: "full-evaluation",
    name: "Full Evaluation Pack",
    category: "employee",
    description: "Template lengkap untuk evaluasi menyeluruh (semua jenis elemen utama tersedia).",
    pages: [
      {
        title: "Welcome",
        elements: [
          { type: "hero", title: "Full Evaluation Survey", subtitle: "Template lengkap untuk kebutuhan evaluasi umum." },
          { type: "dropdown", title: "Business Unit", dataSource: "bu", required: true, options: ["Corporate"] },
          { type: "dropdown", title: "Department", dataSource: "department", required: true, options: ["IT"] },
        ],
      },
      {
        title: "Questions",
        elements: [
          { type: "choice", title: "Aplikasi yang dievaluasi", required: true, dataSource: "app_department", options: ["App 1"] },
          { type: "checkbox", title: "Aspek yang diprioritaskan", options: ["Reliability", "Support", "Feature"], displayCondition: "after_mapped_selection" },
          { type: "likert", title: "Evaluasi per dimensi", options: ["Usability", "Performance", "Support"], displayCondition: "after_mapped_selection" },
          { type: "rating", title: "Skor overall", required: true, options: ["10"], displayCondition: "after_mapped_selection" },
          { type: "text", title: "Komentar detail", displayCondition: "after_mapped_selection", conditionalRequiredSourceIndex: 3, conditionalRequiredThreshold: 8 },
        ],
      },
      {
        title: "Operational Notes",
        elements: [
          { type: "matrix", title: "Penilaian operasional", options: ["Availability", "Accuracy", "Response"] },
          { type: "date", title: "Tanggal evaluasi", required: true },
          { type: "text", title: "Catatan operasional", required: false },
        ],
      },
      {
        title: "Closing",
        elements: [
          { type: "choice", title: "Rekomendasi akhir", required: true, options: ["Lanjut", "Perlu perbaikan", "Tidak disarankan"] },
          { type: "signature", title: "Tanda tangan responden", required: false },
        ],
      },
    ],
  },
  {
    id: "registration-form",
    name: "Registration Form",
    category: "registration",
    description: "Template formulir pendaftaran peserta kegiatan/event — tanpa workflow approval.",
    pages: [
      {
        title: "Registrasi",
        elements: [
          { type: "hero", title: "Formulir Pendaftaran", subtitle: "Silakan lengkapi data berikut untuk mendaftar." },
          { type: "text", title: "Nama Lengkap", required: true },
          { type: "text", title: "Email", required: true },
          { type: "dropdown", title: "Business Unit", required: true, dataSource: "bu", options: ["Corporate"] },
          { type: "dropdown", title: "Department", required: true, dataSource: "department", options: ["IT"] },
          { type: "text", title: "Jabatan / Posisi", required: false },
          { type: "choice", title: "Metode Kehadiran", required: true, options: ["Onsite", "Online", "Hybrid"] },
        ],
      },
    ],
  },
  {
    id: "attendance-form",
    name: "Attendance / Absensi Form",
    category: "registration",
    description: "Template absensi kehadiran peserta event atau pelatihan — tanpa workflow approval.",
    pages: [
      {
        title: "Absensi",
        elements: [
          { type: "hero", title: "Absensi Kehadiran", subtitle: "Konfirmasi kehadiran Anda di event ini." },
          { type: "text", title: "Nama Lengkap", required: true },
          { type: "text", title: "Email", required: true },
          { type: "dropdown", title: "Business Unit", required: true, dataSource: "bu", options: ["Corporate"] },
          { type: "dropdown", title: "Department", required: true, dataSource: "department", options: ["IT"] },
          { type: "date", title: "Tanggal Kehadiran", required: true },
          { type: "signature", title: "Tanda tangan peserta", required: true },
        ],
      },
    ],
  },
];

export function hashStringToHue(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

export function getTemplatePreviewStyle(template: BuilderTemplate): CSSProperties {
  const hue = hashStringToHue(`${template.id}-${template.category}`);
  const hue2 = (hue + 35) % 360;
  const hue3 = (hue + 110) % 360;

  return {
    background: `
      radial-gradient(circle at 18% 22%, hsl(${hue} 76% 66% / 0.95) 0 24%, transparent 25%),
      radial-gradient(circle at 78% 30%, hsl(${hue2} 72% 62% / 0.9) 0 28%, transparent 29%),
      radial-gradient(circle at 55% 82%, hsl(${hue3} 68% 57% / 0.86) 0 32%, transparent 33%),
      linear-gradient(135deg, hsl(${hue} 34% 35%) 0%, hsl(${hue2} 28% 28%) 100%)
    `,
    borderColor: `hsl(${hue} 32% 48% / 0.55)`,
  };
}
