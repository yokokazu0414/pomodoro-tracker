/** LINE / Instagram 等のアプリ内 WebView かどうかの簡易判定（誤検知あり得る） */
export function isLikelyInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Line\/|Instagram|FBAN|FBAV|KAKAOTALK|Twitter|Micromessenger|WeChat/i.test(ua);
}
