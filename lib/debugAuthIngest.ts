/** Debug mode: NDJSON ingest (no secrets / no PII) */
export function debugAuthIngest(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
): void {
  // #region agent log
  fetch('http://127.0.0.1:7539/ingest/daee6513-eaa3-4a7e-8ba7-79eb2a809b14', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': 'e5af57',
    },
    body: JSON.stringify({
      sessionId: 'e5af57',
      location,
      message,
      data,
      timestamp: Date.now(),
      hypothesisId,
    }),
  }).catch(() => {});
  // #endregion
}

export function debugAuthErr(err: unknown): { code: string; message: string } {
  if (err && typeof err === 'object' && 'code' in err) {
    return {
      code: String((err as { code: string }).code),
      message: err instanceof Error ? err.message : String(err),
    };
  }
  return { code: 'unknown', message: err instanceof Error ? err.message : String(err) };
}
