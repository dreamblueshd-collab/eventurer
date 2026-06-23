export type SurveyImageType = "hero" | "logo" | "background";

type ImageUploadPolicy = {
  maxFileSizeBytes: number;
  maxWidth: number;
  maxHeight: number;
  outputMimeType: "image/webp" | "image/jpeg" | "image/png";
  quality: number;
};

const MB = 1024 * 1024;

const BASE_POLICY: Record<SurveyImageType, ImageUploadPolicy> = {
  hero: {
    maxFileSizeBytes: 6 * MB,
    maxWidth: 1920,
    maxHeight: 1080,
    outputMimeType: "image/webp",
    quality: 0.86,
  },
  background: {
    maxFileSizeBytes: 8 * MB,
    maxWidth: 2560,
    maxHeight: 1440,
    outputMimeType: "image/webp",
    quality: 0.84,
  },
  logo: {
    maxFileSizeBytes: 3 * MB,
    maxWidth: 1024,
    maxHeight: 1024,
    outputMimeType: "image/webp",
    quality: 0.9,
  },
};

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function ensureImageFileAllowed(file: File, policy: ImageUploadPolicy): string | null {
  const extension = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return "Format file tidak didukung. Gunakan JPG, PNG, atau WebP.";
  }
  if (!ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
    return "Tipe file tidak valid. Gunakan JPG, PNG, atau WebP.";
  }
  if (file.size > policy.maxFileSizeBytes) {
    const maxMb = Math.round((policy.maxFileSizeBytes / MB) * 10) / 10;
    return `Ukuran file terlalu besar. Maksimal ${maxMb} MB.`;
  }
  return null;
}

function createImageBitmapFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Gagal membaca file gambar"));
    };
    image.src = objectUrl;
  });
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Gagal memproses gambar"));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

function calcSizeFit(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }
  const ratio = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.floor(width * ratio)),
    height: Math.max(1, Math.floor(height * ratio)),
  };
}

export async function normalizeSurveyImageUpload(
  file: File,
  imageType: SurveyImageType,
): Promise<{ ok: true; file: File } | { ok: false; message: string }> {
  const policy = BASE_POLICY[imageType];
  const validationError = ensureImageFileAllowed(file, policy);
  if (validationError) {
    return { ok: false, message: validationError };
  }

  if (typeof window === "undefined") {
    return { ok: true, file };
  }

  try {
    const img = await createImageBitmapFromFile(file);
    const targetSize = calcSizeFit(img.naturalWidth, img.naturalHeight, policy.maxWidth, policy.maxHeight);

    const canvas = document.createElement("canvas");
    canvas.width = targetSize.width;
    canvas.height = targetSize.height;
    const context = canvas.getContext("2d");
    if (!context) {
      return { ok: true, file };
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(img, 0, 0, targetSize.width, targetSize.height);

    const outputBlob = await canvasToBlob(canvas, policy.outputMimeType, policy.quality);
    const outputExtension = policy.outputMimeType === "image/jpeg" ? "jpg" : "webp";
    const safeBaseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 60) || "image";
    const outputFile = new File([outputBlob], `${safeBaseName}.${outputExtension}`, {
      type: policy.outputMimeType,
      lastModified: Date.now(),
    });

    if (outputFile.size > policy.maxFileSizeBytes) {
      return {
        ok: false,
        message: "Ukuran gambar setelah kompres masih terlalu besar. Mohon gunakan gambar dengan resolusi lebih kecil.",
      };
    }

    return { ok: true, file: outputFile };
  } catch {
    return { ok: false, message: "File gambar tidak valid atau rusak." };
  }
}
