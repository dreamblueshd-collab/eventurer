"use client";

import type { AdminEventUser } from "@/lib/users";
import styles from "../page-mockup.module.css";

export interface CreateEventFormErrors {
  draftName?: string;
  selectedAdminEvents?: string;
}

interface CreateEventModalProps {
  adminEventInput: string;
  adminEventSuggestions: AdminEventUser[];
  applyAdminSelection: (user: AdminEventUser) => void;
  closeModal: () => void;
  draftDescription: string;
  draftName: string;
  errors?: CreateEventFormErrors;
  eventType: "survey" | null;
  handleCreateDraft: () => Promise<void>;
  removeAdminSelection: (userId: number) => void;
  selectedAdminEvents: AdminEventUser[];
  setAdminEventInput: (value: string) => void;
  setDraftDescription: (value: string) => void;
  setDraftName: (value: string) => void;
  setEventType: (value: "survey") => void;
  setShowAdminSuggestion: (value: boolean) => void;
  showAdminSuggestion: boolean;
  showCreateModal: boolean;
  submitting: boolean;
  submitLabel?: string;
  title?: string;
  isSuperAdmin?: boolean;
  isParentEventEditMode?: boolean;
}

export default function CreateEventModal(props: CreateEventModalProps) {
  const {
    adminEventInput,
    adminEventSuggestions,
    applyAdminSelection,
    closeModal,
    draftDescription,
    draftName,
    errors = {},
    eventType,
    handleCreateDraft,
    removeAdminSelection,
    selectedAdminEvents,
    setAdminEventInput,
    setDraftDescription,
    setDraftName,
    setEventType,
    setShowAdminSuggestion,
    showAdminSuggestion,
    showCreateModal,
    submitting,
    submitLabel,
    title,
    isSuperAdmin = false,
    isParentEventEditMode = false,
  } = props;

  if (!showCreateModal) return null;

  return (
    <div className={styles.modalOverlay} role="presentation">
      <div className={styles.modalCard} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Create Event">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {title || (eventType ? (isSuperAdmin ? "Create Parent Event" : "Create Survey Event") : "Select Event Type")}
          </h2>
          <button className={styles.modalClose} onClick={closeModal} type="button" aria-label="Close">
            x
          </button>
        </div>
        <div className={styles.modalBody}>
          {!eventType ? (
            <div className={styles.eventTypeGroup}>
              <p className={styles.eventTypeHint}>Pilih tipe event yang akan dibuat:</p>
              <button
                type="button"
                onClick={() => setEventType("survey")}
                className={styles.eventTypeBtn}
              >
                <div className={styles.eventTypeBtnTitle}>Forms / Survey</div>
                <div className={styles.eventTypeBtnDesc}>Buat event survey untuk mengumpulkan feedback dari responden</div>
              </button>
              <button
                type="button"
                disabled
                className={styles.eventTypeBtnDisabled}
              >
                <div className={styles.eventTypeBtnTitle}>Other Event Types</div>
                <div className={styles.eventTypeBtnDesc}>Coming soon...</div>
              </button>
            </div>
          ) : (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="surveyName">
                  {isSuperAdmin ? "Parent Event Name *" : "Survey Name *"}
                </label>
                <input
                  id="surveyName"
                  name="surveyName"
                  className={`${styles.input} ${errors.draftName ? styles.inputError : ""}`}
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder={isSuperAdmin ? "Masukkan nama event" : "Masukkan nama survey"}
                  type="text"
                />
                {errors.draftName && <span className={styles.errorMsg}>{errors.draftName}</span>}
              </div>
              {isParentEventEditMode ? (
                <div className={styles.readOnlyHint}>
                  Edit parent event hanya mengubah nama. Admin target, deskripsi, dan status tetap dipertahankan.
                </div>
              ) : (
                <>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="surveyAdminEvent">Admin Event Target *</label>
                    <div className={`${styles.chipInputWrap} ${errors.selectedAdminEvents ? styles.inputError : ""}`}>
                      {selectedAdminEvents.map((user) => (
                        <span key={user.UserId} className={styles.chip}>
                          {user.DisplayName}
                          <button className={styles.chipRemove} onClick={() => removeAdminSelection(user.UserId)} type="button" aria-label={`Remove ${user.DisplayName}`}>
                            x
                          </button>
                        </span>
                      ))}
                      <input
                        id="surveyAdminEvent"
                        name="surveyAdminEvent"
                        className={styles.chipInput}
                        value={adminEventInput}
                        onChange={(event) => {
                          setAdminEventInput(event.target.value);
                          setShowAdminSuggestion(true);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && adminEventSuggestions.length > 0) {
                            event.preventDefault();
                            const first = adminEventSuggestions[0];
                            if (!selectedAdminEvents.some((u) => u.UserId === first.UserId)) {
                              applyAdminSelection(first);
                            }
                          }
                          if (
                            event.key === "Backspace" &&
                            adminEventInput.length === 0 &&
                            selectedAdminEvents.length > 0
                          ) {
                            const last = selectedAdminEvents[selectedAdminEvents.length - 1];
                            removeAdminSelection(last.UserId);
                          }
                        }}
                        onFocus={() => setShowAdminSuggestion(true)}
                        onBlur={() => {
                          setTimeout(() => setShowAdminSuggestion(false), 200);
                        }}
                        placeholder={selectedAdminEvents.length === 0 ? "Cari Admin Event" : "Tambah Admin Event"}
                        type="text"
                        autoComplete="off"
                      />
                    </div>
                    {showAdminSuggestion && adminEventSuggestions.length > 0 ? (
                      <div className={styles.suggestionMenu}>
                        {adminEventSuggestions.map((user) => (
                          <button key={user.UserId} className={styles.suggestionItem} onClick={() => applyAdminSelection(user)} type="button">
                            <span>{user.DisplayName}</span>
                            <span className={styles.suggestionMeta}>{user.Email}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {errors.selectedAdminEvents && <span className={styles.errorMsg}>{errors.selectedAdminEvents}</span>}
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="surveyDesc">
                      {isSuperAdmin ? "Event Description" : "Description"}
                    </label>
                    <textarea
                      id="surveyDesc"
                      name="surveyDesc"
                      className={styles.textarea}
                      value={draftDescription}
                      onChange={(event) => setDraftDescription(event.target.value)}
                      placeholder={isSuperAdmin ? "Jelaskan tujuan event secara singkat" : "Jelaskan tujuan survey secara singkat"}
                      rows={3}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={closeModal} type="button">Cancel</button>
          {eventType ? (
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void handleCreateDraft()} disabled={submitting} type="button">
              {submitting ? "Saving..." : (submitLabel || "Create")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
