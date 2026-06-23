/**
 * survey-sync.ts — Server synchronization logic for the survey builder.
 * Handles syncing local builder state with backend questions API.
 */

import {
  createSurveyQuestion,
  deleteSurveyQuestion,
  fetchSurveyQuestions,
  updateSurveyQuestion,
  uploadSurveyQuestionImage,
} from "@/lib/surveys";
import type { BuilderElement, BuilderPage } from "./builder-definitions";
import { dataUrlToBlob, extractQuestionId, toApiType } from "./builder-utils";

type SyncCallbacks = {
  setError: (msg: string) => void;
  setMessage: (msg: string) => void;
  setPages: (fn: (prev: BuilderPage[]) => BuilderPage[]) => void;
};

function isQuestionImmutableError(message: string): boolean {
  const value = message.toLowerCase();
  return (
    value.includes("has responses") ||
    value.includes("cannot modify question") ||
    value.includes("cannot delete question") ||
    value.includes("sudah ada data") ||
    value.includes("tidak dapat mengubah") ||
    value.includes("tidak dapat menghapus")
  );
}

function buildQuestionPayload(
  item: { pageNumber: number; pageTitle: string; displayOrder: number; element: BuilderElement },
  surveyId: string,
  idRemap: Map<string, string>,
) {
  const ratingScale = Number(item.element.options?.[0] || 10);
  const resolvedRatingScale = Number.isFinite(ratingScale)
    ? Math.min(10, Math.max(3, Math.round(ratingScale)))
    : 10;

  return {
    surveyId,
    type: toApiType(item.element.type),
    promptText: item.element.title || "",
    subtitle: item.element.subtitle || null,
    imageUrl:
      item.element.type === "hero"
        ? item.element.coverUrl?.startsWith("data:")
          ? null
          : item.element.coverUrl || null
        : null,
    isMandatory: item.element.required,
    displayOrder: item.displayOrder,
    pageNumber: item.pageNumber,
    layoutOrientation: "vertical" as const,
    options: (() => {
      const pageMeta = item.pageTitle?.trim() ? { pageTitle: item.pageTitle.trim() } : {};
      const displayCondition =
        item.element.displayCondition && item.element.displayCondition !== "always"
          ? { displayCondition: item.element.displayCondition }
          : {};
      const conditionalRequired = item.element.conditionalRequiredSourceId
        ? {
            conditionalRequired: {
              sourceElementId:
                idRemap.get(item.element.conditionalRequiredSourceId) ||
                item.element.conditionalRequiredSourceId,
              threshold: Math.min(
                10,
                Math.max(1, Math.round(Number(item.element.conditionalRequiredThreshold || 7))),
              ),
            },
          }
        : {};

      if (["choice", "checkbox", "dropdown"].includes(item.element.type)) {
        return {
          options: item.element.options,
          dataSource: item.element.dataSource || "manual",
          ...(item.element.type === "choice" || item.element.type === "checkbox"
            ? { layout: item.element.optionLayout || "vertical" }
            : {}),
          ...(item.element.type === "choice"
            ? { allowMultipleAnswers: Boolean(item.element.allowMultipleAnswers) }
            : {}),
          ...pageMeta,
          ...displayCondition,
          ...conditionalRequired,
        };
      }
      if (item.element.type === "likert") {
        return {
          variant: "likert",
          rows: item.element.options,
          ratingScale: item.element.ratingScale ?? 10,
          commentThreshold: item.element.likertCommentThreshold ?? 7,
          enableComment: item.element.likertEnableComment !== false,
          ...pageMeta,
          ...displayCondition,
          ...conditionalRequired,
        };
      }
      if (item.element.type === "matrix") {
        return { variant: "matrix", columns: item.element.options, ...pageMeta, ...displayCondition, ...conditionalRequired };
      }
      if (item.element.type === "rating") {
        return { ratingScale: resolvedRatingScale, ...pageMeta, ...displayCondition, ...conditionalRequired };
      }
      if (Object.keys(displayCondition).length > 0 || Object.keys(conditionalRequired).length > 0) {
        return { ...pageMeta, ...displayCondition, ...conditionalRequired };
      }
      return Object.keys(pageMeta).length > 0 ? pageMeta : null;
    })(),
  };
}

export async function syncQuestionsToServer(
  surveyId: string,
  pages: BuilderPage[],
  currentUserId: number,
  hasSubmittedResponses: boolean,
  callbacks: SyncCallbacks,
): Promise<boolean> {
  const { setError, setMessage, setPages } = callbacks;

  // Guard: surveyId harus valid sebelum melakukan operasi apapun ke server
  if (!surveyId || surveyId.trim() === "") {
    setError("Survey ID tidak valid");
    return false;
  }

  if (hasSubmittedResponses) {
    setMessage("Survey sudah memiliki respons. Sistem akan tetap mencoba menyimpan perubahan pertanyaan.");
  }

  if (!currentUserId) {
    setError("User login tidak valid untuk sinkronisasi draft");
    return false;
  }

  const remote = await fetchSurveyQuestions(surveyId);
  if (!remote.success) {
    setError(remote.message || "Gagal membaca pertanyaan dari server");
    return false;
  }

  const remoteById = new Map(remote.questions.map((q) => [q.QuestionId, q]));
  const keptIds = new Set<number>();
  const idRemap = new Map<string, string>();
  const uploadedCoverUrlByElementId = new Map<string, string>();

  const flat: Array<{ pageNumber: number; pageTitle: string; displayOrder: number; element: BuilderElement }> = [];
  let order = 1;
  pages.forEach((page, pageIndex) => {
    page.elements.forEach((element) => {
      flat.push({ pageNumber: pageIndex + 1, pageTitle: page.title, displayOrder: order, element });
      order += 1;
    });
  });

  for (const item of flat) {
    const questionIdRaw = extractQuestionId(item.element.id);
    const questionId = questionIdRaw ? Number(questionIdRaw) : 0;
    const hasQuestionId = Number.isInteger(questionId) && questionId > 0;
    const hasInlineHeroImage =
      item.element.type === "hero" &&
      typeof item.element.coverUrl === "string" &&
      item.element.coverUrl.startsWith("data:");
    const payload = buildQuestionPayload(item, surveyId, idRemap);

    if (hasQuestionId && remoteById.has(questionId)) {
      const updated = await updateSurveyQuestion(questionId, { ...payload, updatedBy: currentUserId });
      if (!updated.success) {
        if (isQuestionImmutableError(updated.message || "")) {
          setError("Survey sudah memiliki respons. Perubahan pertanyaan (termasuk data source) tidak dapat disimpan.");
          return false;
        }
        setError(updated.message || "Gagal memperbarui pertanyaan");
        return false;
      }
      keptIds.add(questionId);
      if (hasInlineHeroImage) {
        const imageBlob = await dataUrlToBlob(item.element.coverUrl);
        if (!imageBlob) { setError("Gagal memproses file hero cover"); return false; }
        const uploaded = await uploadSurveyQuestionImage(questionId, imageBlob, `hero-${questionId}.png`);
        if (!uploaded.success || !uploaded.imageUrl) { setError(uploaded.message || "Gagal upload hero cover"); return false; }
        uploadedCoverUrlByElementId.set(item.element.id, uploaded.imageUrl);
      }
    } else {
      const created = await createSurveyQuestion({ ...payload, createdBy: currentUserId });
      if (!created.success || !created.question) {
        if (isQuestionImmutableError(created.message || "")) {
          setError("Survey sudah memiliki respons. Perubahan pertanyaan (termasuk data source) tidak dapat disimpan.");
          return false;
        }
        setError(created.message || "Gagal menambah pertanyaan");
        return false;
      }
      keptIds.add(created.question.QuestionId);
      idRemap.set(item.element.id, `q-${created.question.QuestionId}`);
      if (hasInlineHeroImage) {
        const imageBlob = await dataUrlToBlob(item.element.coverUrl);
        if (!imageBlob) { setError("Gagal memproses file hero cover"); return false; }
        const uploaded = await uploadSurveyQuestionImage(created.question.QuestionId, imageBlob, `hero-${created.question.QuestionId}.png`);
        if (!uploaded.success || !uploaded.imageUrl) { setError(uploaded.message || "Gagal upload hero cover"); return false; }
        uploadedCoverUrlByElementId.set(item.element.id, uploaded.imageUrl);
      }
    }
  }

  // Delete pertanyaan yang sudah dihapus dari builder.
  // Partial failure di sini harus di-handle gracefully — semua delete harus dicoba,
  // jangan berhenti di error pertama agar tidak meninggalkan pertanyaan lama + baru
  // sekaligus di DB (duplicate). Log error tapi lanjutkan iterasi berikutnya.
  for (const question of remote.questions) {
    if (keptIds.has(question.QuestionId)) continue;
    try {
      const removed = await deleteSurveyQuestion(question.QuestionId);
      if (!removed.success) {
        if (isQuestionImmutableError(removed.message || "")) {
          // Pertanyaan immutable karena sudah ada respons — tidak perlu error fatal,
          // cukup log dan lanjutkan ke pertanyaan berikutnya
          console.warn(`[survey-sync] Pertanyaan ${question.QuestionId} tidak dapat dihapus (immutable):`, removed.message);
          continue;
        }
        // Delete gagal karena alasan lain — log tapi tetap lanjutkan agar tidak
        // meninggalkan state parsial di DB
        console.error(`[survey-sync] Gagal menghapus pertanyaan ${question.QuestionId}:`, removed.message);
      }
    } catch (deleteErr) {
      // Exception saat delete — log dan lanjutkan, jangan abort seluruh sync
      console.error(`[survey-sync] Exception saat menghapus pertanyaan ${question.QuestionId}:`, deleteErr);
    }
  }

  if (idRemap.size > 0 || uploadedCoverUrlByElementId.size > 0) {
    setPages((prev) =>
      prev.map((page) => ({
        ...page,
        elements: page.elements.map((element) => ({
          ...element,
          id: idRemap.get(element.id) || element.id,
          coverUrl: uploadedCoverUrlByElementId.get(element.id) || element.coverUrl,
          conditionalRequiredSourceId: element.conditionalRequiredSourceId
            ? idRemap.get(element.conditionalRequiredSourceId) || element.conditionalRequiredSourceId
            : undefined,
        })),
      })),
    );
  }

  return true;
}
