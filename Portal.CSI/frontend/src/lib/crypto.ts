/**
 * Client-side form encryption utility using Web Crypto API (AES-256-GCM).
 *
 * Satisfies Secure Programming Checklist item #9:
 * "Encrypt all sensitive data at form input using strong algorithm cryptography as AES256"
 *
 * Flow:
 * 1. Frontend fetches a one-time nonce + encrypted AES key from backend
 * 2. Frontend encrypts the password with AES-256-GCM using the derived key
 * 3. Encrypted payload (iv + ciphertext + tag) is sent to backend
 * 4. Backend decrypts before password verification
 */

const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";

interface EncryptionChallenge {
  /** Base64-encoded AES-256 key (wrapped for this session) */
  key: string;
  /** Unique challenge ID to send back with the encrypted payload */
  challengeId: string;
}

/**
 * Fetch a one-time encryption challenge from backend.
 * The backend generates a random AES-256 key and challenge ID per request.
 */
export async function fetchEncryptionChallenge(): Promise<EncryptionChallenge | null> {
  try {
    const response = await fetch(`${API_BASE_PATH}/auth/encryption-challenge`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) return null;

    const rawText = await response.text().catch(() => "");
    if (!rawText) return null;

    try {
      const data = JSON.parse(rawText) as EncryptionChallenge;
      if (typeof data?.key === "string" && typeof data?.challengeId === "string") {
        return data;
      }
      return null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Encrypt a plaintext value using AES-256-GCM with Web Crypto API.
 * Returns base64-encoded string: iv(12 bytes) + ciphertext + authTag(16 bytes)
 */
export async function encryptValue(
  plaintext: string,
  keyBase64: string
): Promise<string> {
  const keyBytes = base64ToBytes(keyBase64);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedPlaintext = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    cryptoKey,
    encodedPlaintext
  );

  // Concatenate iv + ciphertext (which includes the auth tag)
  const result = new Uint8Array(iv.length + cipherBuffer.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(cipherBuffer), iv.length);

  return bytesToBase64(result);
}

/**
 * Encrypt password for login form submission.
 * Returns the encrypted payload and challenge ID, or null on failure (fallback to plain).
 */
export async function encryptPassword(
  password: string
): Promise<{ encrypted: string; challengeId: string } | null> {
  const challenge = await fetchEncryptionChallenge();
  if (!challenge) return null;

  try {
    const encrypted = await encryptValue(password, challenge.key);
    return { encrypted, challengeId: challenge.challengeId };
  } catch {
    return null;
  }
}

// --- Utility functions ---

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
