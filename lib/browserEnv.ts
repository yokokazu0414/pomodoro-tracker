/** LINE / Instagram 等のアプリ内 WebView かどうかの簡易判定（誤検知あり得る） */
export function isLikelyInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Line\/|Instagram|FBAN|FBAV|KAKAOTALK|Twitter|Micromessenger|WeChat/i.test(ua);
}

/**
 * モバイル系ブラウザでは signInWithPopup が不安定なため、Google ログインはリダイレクトを優先する。
 * iPadOS の「デスクトップ向けサイト」は Macintosh になり得るが、タッチ端末も広めに拾う。
 */
export function shouldPreferGoogleRedirectAuth(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
  if (navigator.maxTouchPoints > 1 && /Macintosh|Windows NT/i.test(ua)) return true;
  return false;
}
