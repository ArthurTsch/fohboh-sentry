export const MAX_MULTIPART_REQUEST_BYTES = Math.floor(4.5 * 1024 * 1024);
export const MAX_EVIDENCE_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_SUPPORT_ATTACHMENT_BYTES = 2 * 1024 * 1024;
export const MAX_SUPPORT_ATTACHMENTS_BYTES = 4 * 1024 * 1024;
export const MAX_BUFFERED_MULTIPART_BYTES_PER_INSTANCE = 24 * 1024 * 1024;

type AdmissionState = { reservedBytes: number };
const globalState = globalThis as typeof globalThis & { __multipartAdmissionState?: AdmissionState };

function getAdmissionState() {
  globalState.__multipartAdmissionState ??= { reservedBytes: 0 };
  return globalState.__multipartAdmissionState;
}

export function getDeclaredRequestBytes(request: Request) {
  const value = request.headers.get("content-length")?.trim();
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function isDeclaredRequestTooLarge(request: Request) {
  const bytes = getDeclaredRequestBytes(request);
  return bytes !== null && bytes > MAX_MULTIPART_REQUEST_BYTES;
}

export function acquireMultipartAdmission(request: Request) {
  const reservedBytes = getDeclaredRequestBytes(request) ?? MAX_MULTIPART_REQUEST_BYTES;
  const state = getAdmissionState();
  if (state.reservedBytes + reservedBytes > MAX_BUFFERED_MULTIPART_BYTES_PER_INSTANCE) {
    return null;
  }
  state.reservedBytes += reservedBytes;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.reservedBytes = Math.max(0, state.reservedBytes - reservedBytes);
  };
}

export function getMultipartAdmissionSnapshot() {
  return { ...getAdmissionState() };
}
