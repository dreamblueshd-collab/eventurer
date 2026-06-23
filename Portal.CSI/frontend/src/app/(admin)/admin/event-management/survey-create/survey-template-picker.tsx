"use client";

import type { BuilderTemplate, ElementType } from "./builder-definitions";
import styles from "./survey-modals.module.css";

interface SurveyTemplatePickerProps {
  elementIconMap: Record<ElementType, string>;
  filteredTemplates: BuilderTemplate[];
  getTemplatePreviewStyle: (template: BuilderTemplate) => React.CSSProperties;
  onApplySelectedTemplate: () => void;
  onClose: () => void;
  onConfirmReplace: () => void;
  onSelectBlank?: () => void;
  onSelectTemplate: (templateId: string) => void;
  selectedTemplate: BuilderTemplate | null;
  selectedTemplateId: string;
  setShowTemplateConfirm: (value: boolean) => void;
  setTemplateCategory: (value: "all" | BuilderTemplate["category"]) => void;
  setTemplateSearch: (value: string) => void;
  showBlankOption?: boolean;
  showTemplateConfirm: boolean;
  templateCategory: "all" | BuilderTemplate["category"];
  templateSearch: string;
}

const TEMPLATE_CATEGORIES: Array<{ id: "all" | BuilderTemplate["category"]; label: string }> = [
  { id: "all", label: "📋 Semua" },
  { id: "feedback", label: "💬 Feedback" },
  { id: "employee", label: "👤 Employee" },
  { id: "service", label: "🛠️ Service" },
  { id: "compliance", label: "✅ Compliance" },
  { id: "event", label: "🎯 Event" },
  { id: "registration", label: "📝 Registration" },
];

export default function SurveyTemplatePicker({
  elementIconMap,
  filteredTemplates,
  getTemplatePreviewStyle,
  onApplySelectedTemplate,
  onClose,
  onConfirmReplace,
  onSelectBlank,
  onSelectTemplate,
  selectedTemplate,
  selectedTemplateId,
  setShowTemplateConfirm,
  setTemplateCategory,
  setTemplateSearch,
  showBlankOption = false,
  showTemplateConfirm,
  templateCategory,
  templateSearch,
}: SurveyTemplatePickerProps) {
  return (
    <div className={styles.overlay}>
      <div className={`${styles.modal} ${styles.templateModal}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2>📂 Pilih Template</h2>
          <button className={styles.inlineButton} type="button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.templateToolbar}>
            <input
              className={styles.templateSearch}
              id="tpl-picker-search"
              name="tpl-picker-search"
              placeholder="🔍 Cari template..."
              aria-label="Cari template"
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
            />
            <div className={styles.templateCategories}>
              {TEMPLATE_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`${styles.templateChip} ${templateCategory === category.id ? styles.templateChipActive : ""}`}
                  onClick={() => setTemplateCategory(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.templateGrid}>
            {showBlankOption && onSelectBlank && (
              <button
                type="button"
                className={`${styles.templateCard} ${styles.templateCardBlank}`}
                onClick={onSelectBlank}
              >
                <div className={styles.templateThumb} style={{ background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)", borderColor: "rgba(148,163,184,0.4)" }}>
                  <div className={styles.templateThumbBlankIcon}>+</div>
                </div>
                <div className={styles.templateName}>Blank Form</div>
                <div className={styles.templateDesc}>Mulai dari awal tanpa template — buat form sesuai kebutuhan Anda.</div>
                <div className={styles.templateMeta}>
                  <span>📄 1 halaman</span>
                  <span>🧩 0 elemen</span>
                </div>
              </button>
            )}
            {filteredTemplates.length === 0 ? (
              <div className={styles.templateEmpty}>Tidak ada template yang cocok dengan pencarian/filter.</div>
            ) : (
              filteredTemplates.map((template) => {
                const elementCount = template.pages.reduce((sum, page) => sum + page.elements.length, 0);
                const templateElementTypes = Array.from(
                  new Set(template.pages.flatMap((page) => page.elements.map((element) => element.type))),
                ).slice(0, 5);

                return (
                  <button
                    key={template.id}
                    type="button"
                    className={`${styles.templateCard} ${selectedTemplateId === template.id ? styles.templateCardActive : ""}`}
                    onClick={() => onSelectTemplate(template.id)}
                  >
                    <div className={styles.templateThumb} style={getTemplatePreviewStyle(template)}>
                      <div className={styles.templateThumbHeader}>
                        <span className={styles.templateThumbBadge}>{template.category}</span>
                      </div>
                      <div className={styles.templateThumbOverlay}>
                        <div className={styles.templateThumbTitleLine}>
                          {template.name.toLowerCase()}
                        </div>
                        <div className={styles.templateThumbSubLine}>
                          {template.description.slice(0, 44)}
                        </div>
                      </div>
                      <div className={styles.templateThumbBars}>
                        {template.pages.map((page, index) => {
                          const type = templateElementTypes[index % Math.max(templateElementTypes.length, 1)];
                          const icon = type ? elementIconMap[type] : "•";
                          return (
                            <span
                              key={`${template.id}-bar-${index + 1}`}
                              className={styles.templateThumbBar}
                              style={{ width: `${Math.max(28, Math.min(100, page.elements.length * 16))}%` }}
                            >
                              <span className={styles.templateThumbBarIcon}>{icon}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className={styles.templateName}>{template.name}</div>
                    <div className={styles.templateDesc}>{template.description}</div>
                    <div className={styles.templateMeta}>
                      <span>📄 {template.pages.length} halaman</span>
                      <span>🧩 {elementCount} elemen</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className={styles.templateActions}>
            <button type="button" className={styles.sideAction} onClick={onClose}>
              Batal
            </button>
            <button type="button" className={styles.sideActionPrimary} disabled={!selectedTemplate} onClick={onApplySelectedTemplate}>
              ✨ Terapkan Template
            </button>
          </div>

          {showTemplateConfirm && selectedTemplate ? (
            <div className={styles.overlay}>
              <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="template-confirm-title">
                <div className={styles.modalHead}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0, color: "#f59e0b" }}>
                    <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <h2 id="template-confirm-title">Ganti konten builder saat ini?</h2>
                  <button className={styles.modalClose} type="button" onClick={() => setShowTemplateConfirm(false)} aria-label="Close">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M11 3L3 11M3 3l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
                <div className={styles.modalBody}>
                  <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, margin: 0 }}>
                    Halaman dan elemen yang ada akan diganti dengan template <strong>{selectedTemplate.name}</strong>.
                    Gunakan Save Draft setelah apply agar tersimpan ke server.
                  </p>
                </div>
                <div className={styles.modalFooter}>
                  <button className={styles.modalBtnSecondary} type="button" onClick={() => setShowTemplateConfirm(false)}>
                    Kembali
                  </button>
                  <button className={styles.modalBtnPrimary} type="button" onClick={onConfirmReplace}>
                    🔄 Ya, Ganti
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
