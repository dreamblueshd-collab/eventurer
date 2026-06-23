"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchEventDetail, deleteSurveyById, type EventDetail, type EventDetailSurvey, type EventDetailDoorprize } from "@/lib/survey-events";
import { deleteDoorprizeEvent } from "@/lib/doorprize-api";
import { getEventStatusLabel } from "@/lib/event-status";
import { getCurrentUser } from "@/lib/auth";
import type { UserRole } from "@/types/auth";
import s from "../event-management.module.css";

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.surveyId as string;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRole] = useState<UserRole | null>(() => getCurrentUser()?.role ?? null);
  const [deleteTarget, setDeleteTarget] = useState<EventDetailSurvey | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteDpTarget, setDeleteDpTarget] = useState<EventDetailDoorprize | null>(null);
  const [deletingDp, setDeletingDp] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadEvent = async () => {
    setLoading(true);
    setError(null);
    const result = await fetchEventDetail(eventId);
    if (result.success && result.event) {
      setEvent(result.event);
    } else {
      setError(result.message || "Gagal memuat event");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function handleDeleteSurvey() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteSurveyById(deleteTarget.SurveyId);
      setDeleteTarget(null);
      if (result.success) {
        await loadEvent();
      } else {
        alert(result.message || "Gagal menghapus form");
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteDoorprize() {
    if (!deleteDpTarget) return;
    setDeletingDp(true);
    try {
      const result = await deleteDoorprizeEvent(deleteDpTarget.DoorprizeEventId);
      setDeleteDpTarget(null);
      if (result.success) {
        await loadEvent();
      } else {
        alert(result.message || "Gagal menghapus doorprize");
      }
    } finally {
      setDeletingDp(false);
    }
  }

  if (loading) {
    return (
      <div className={s.detailContainer}>
        <div className={s.detailLoading}>
          <div className={s.detailLoadingSpinner} />
          <span>Memuat detail event...</span>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className={s.detailContainer}>
        <div className={s.detailErrorCard}>
          <div className={s.detailErrorIcon}>⚠️</div>
          <p className={s.detailErrorMsg}>{error || "Event tidak ditemukan"}</p>
          <Link href="/admin/event-management" className={s.detailBackBtn}>
            ← Kembali ke Event Management
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={s.detailContainer}>
      {/* Header */}
      <div className={s.detailHeader}>
        <div className={s.detailTitleRow}>
          <div className={s.detailTitleInfo}>
            <h1 className={s.detailTitle}>{event.Title}</h1>
            {event.Description && (
              <p className={s.detailDescription}>{event.Description}</p>
            )}
          </div>
          <div className={s.detailMetaBadges}>
            <span className={`${s.detailStatusBadge} ${s[`detailStatus-${event.Status?.toLowerCase()}`] || ""}`}>
              {getEventStatusLabel(event.Status)}
            </span>
          </div>
        </div>
        <div className={s.detailMetaRow}>
          {event.AssignedAdminName && (
            <div className={s.detailMetaChip}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              <span>{event.AssignedAdminName}</span>
            </div>
          )}
          {event.Surveys.length > 0 && (
            <div className={s.detailMetaChip}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 8h6M5 5.5h6M5 10.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
              <span>{event.Surveys.length} survey</span>
            </div>
          )}
        </div>
      </div>

      {/* Survey Section */}
      <div className={s.detailSurveySection}>
        <div className={s.detailSurveySectionHeader}>
          <h2 className={s.detailSurveySectionTitle}>📋 Form</h2>
          {currentRole !== "SuperAdmin" && (
            <button
              type="button"
              className={s.detailCreateBtn}
              onClick={() => setShowAddModal(true)}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              Add Event
            </button>
          )}
        </div>

        {event.Surveys.length === 0 ? (
          <div className={s.detailEmptyState}>
            <div className={s.detailEmptyIcon}>📋</div>
            <p className={s.detailEmptyTitle}>Belum ada form</p>
            <p className={s.detailEmptyDesc}>Buat form pertama untuk event ini</p>
            {currentRole !== "SuperAdmin" && (
              <Link
                href={`/admin/event-management/survey-create?eventId=${eventId}`}
                className={s.detailCreateBtn}
              >
                + Buat Form Pertama
              </Link>
            )}
          </div>
        ) : (
          <div className={s.detailSurveyList}>
            {event.Surveys.map((survey: EventDetailSurvey) => (
              <div key={survey.SurveyId} className={s.detailSurveyItem}>
                <div className={s.detailSurveyItemTop}>
                  <div className={s.detailSurveyItemInfo}>
                    <h3 className={s.detailSurveyItemTitle}>{survey.Title}</h3>
                    {survey.Description && (
                      <p className={s.detailSurveyItemDesc}>{survey.Description}</p>
                    )}
                  </div>
                  <span className={`${s.detailStatusBadge} ${s[`detailStatus-${survey.Status?.toLowerCase()}`] || ""}`}>
                    {getEventStatusLabel(survey.Status)}
                  </span>
                </div>
                <div className={s.detailSurveyItemStats}>
                  <div className={s.detailStatChip}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span>{survey.QuestionCount} pertanyaan</span>
                  </div>
                  <div className={s.detailStatChip}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2a6 6 0 100 12A6 6 0 008 2z" stroke="currentColor" strokeWidth="1.5"/><path d="M5.5 8.5l2 2 3-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span>{survey.RespondentCount} responden</span>
                  </div>
                  {survey.TargetRespondents != null && (
                    <div className={s.detailStatChip}>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5l3.5-.5L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
                      <span>Target: {survey.TargetRespondents}</span>
                    </div>
                  )}
                </div>
                {currentRole !== "SuperAdmin" && (
                  <div className={s.detailSurveyItemActions}>
                    <Link
                      href={`/admin/event-management/survey-create?surveyId=${survey.SurveyId}`}
                      className={s.detailBtnDesign}
                    >
                      🎨 Design Survey
                    </Link>
                    <Link
                      href={`/admin/event-management/${survey.SurveyId}/operations`}
                      className={s.detailBtnOps}
                    >
                      ⚙️ Operations
                    </Link>
                    <button
                      type="button"
                      className={s.detailBtnDelete}
                      onClick={() => setDeleteTarget(survey)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Doorprize Section */}
      {event.Doorprizes && event.Doorprizes.length > 0 && (
        <div className={s.detailSurveySection}>
          <div className={s.detailSurveySectionHeader}>
            <h2 className={s.detailSurveySectionTitle}>🎁 Doorprize</h2>
          </div>
          <div className={s.detailSurveyList}>
            {event.Doorprizes.map((dp: EventDetailDoorprize) => (
              <div key={dp.DoorprizeEventId} className={s.detailSurveyItem}>
                <div className={s.detailSurveyItemTop}>
                  <div className={s.detailSurveyItemInfo}>
                    <h3 className={s.detailSurveyItemTitle}>{dp.Name}</h3>
                  </div>
                  <span className={`${s.detailStatusBadge} ${s[`detailStatus-${dp.Status?.toLowerCase()}`] || ""}`}>
                    {dp.Status}
                  </span>
                </div>
                <div className={s.detailSurveyItemStats}>
                  <div className={s.detailStatChip}>
                    <span>🎁 {dp.GiftCount} hadiah</span>
                  </div>
                  <div className={s.detailStatChip}>
                    <span>👥 {dp.ParticipantCount} peserta</span>
                  </div>
                </div>
                {currentRole !== "SuperAdmin" && (
                  <div className={s.detailSurveyItemActions}>
                    <Link
                      href={`/admin/doorprize/${dp.DoorprizeEventId}`}
                      className={s.detailBtnDesign}
                    >
                      🎯 Kelola Doorprize
                    </Link>
                    <Link
                      href={`/admin/doorprize/${dp.DoorprizeEventId}/draw`}
                      className={s.detailBtnOps}
                    >
                      🎰 Undian
                    </Link>
                    <button
                      type="button"
                      className={s.detailBtnDelete}
                      onClick={() => setDeleteDpTarget(dp)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showAddModal && (
        <div className={s.detailDeleteOverlay} onClick={() => setShowAddModal(false)}>
          <div className={s.detailAddEventModal} onClick={(e) => e.stopPropagation()}>
            <div className={s.detailAddEventHeader}>
              <h3 className={s.detailAddEventTitle}>Tambah Sub-Event</h3>
              <button type="button" className={s.detailAddEventClose} onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <p className={s.detailAddEventSubtitle}>Pilih tipe event yang ingin ditambahkan:</p>
            <div className={s.detailAddEventOptions}>
              <Link
                href={`/admin/event-management/survey-create?eventId=${eventId}`}
                className={s.detailAddEventOption}
                onClick={() => setShowAddModal(false)}
              >
                <span className={s.detailAddEventIcon}>📋</span>
                <span className={s.detailAddEventLabel}>Form / Survey</span>
                <span className={s.detailAddEventDesc}>Buat form survey atau kuesioner</span>
              </Link>
              <Link
                href={`/admin/doorprize/create?parentEventId=${eventId}`}
                className={s.detailAddEventOption}
                onClick={() => setShowAddModal(false)}
              >
                <span className={s.detailAddEventIcon}>🎁</span>
                <span className={s.detailAddEventLabel}>Doorprize</span>
                <span className={s.detailAddEventDesc}>Buat undian hadiah untuk peserta</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className={s.detailDeleteOverlay} onClick={() => !deleting && setDeleteTarget(null)}>
          <div className={s.detailDeleteModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={s.detailDeleteTitle}>Hapus Form</h3>
            <p className={s.detailDeleteText}>
              Apakah Anda yakin ingin menghapus <strong>{deleteTarget.Title}</strong>?
            </p>
            <p className={s.detailDeleteWarning}>
              Form yang sudah memiliki response tidak dapat dihapus.
            </p>
            <div className={s.detailDeleteActions}>
              <button
                type="button"
                className={s.detailDeleteCancel}
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Batal
              </button>
              <button
                type="button"
                className={s.detailDeleteConfirm}
                onClick={handleDeleteSurvey}
                disabled={deleting}
              >
                {deleting ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Doorprize Confirmation Modal */}
      {deleteDpTarget && (
        <div className={s.detailDeleteOverlay} onClick={() => !deletingDp && setDeleteDpTarget(null)}>
          <div className={s.detailDeleteModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={s.detailDeleteTitle}>Hapus Doorprize</h3>
            <p className={s.detailDeleteText}>
              Apakah Anda yakin ingin menghapus <strong>{deleteDpTarget.Name}</strong>?
            </p>
            <p className={s.detailDeleteWarning}>
              Doorprize yang sudah memiliki pemenang tidak dapat dihapus.
            </p>
            <div className={s.detailDeleteActions}>
              <button
                type="button"
                className={s.detailDeleteCancel}
                onClick={() => setDeleteDpTarget(null)}
                disabled={deletingDp}
              >
                Batal
              </button>
              <button
                type="button"
                className={s.detailDeleteConfirm}
                onClick={handleDeleteDoorprize}
                disabled={deletingDp}
              >
                {deletingDp ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
