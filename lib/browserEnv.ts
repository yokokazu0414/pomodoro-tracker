/** LINE / Instagram 等のアプリ内 WebView かどうかの簡易判定（誤検知あり得る） */
export function isLikelyInAppBrowser(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  // ホーム画面追加 PWA / スタンドアロンは通常ブラウザ相当で OAuth 可能に近い
  if (window.matchMedia?.('(display-mode: standalone)')?.matches) return false;
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return false;

  const ua = navigator.userAgent || '';
  // Android System WebView（; wv)）はアプリ内表示が多い
  if (/; wv\)/i.test(ua)) return true;
  return /Line\/|Instagram|FBAN|FBAV|KAKAOTALK|Twitter|Micromessenger|WeChat|Snapchat|LinkedInApp|Slack|Discord|Pinterest|TikTok|musical_ly|GSA\/|NAVER|Daum|KAKAOTALK/i.test(
    ua,
  );
}

/**
 * モバイル系では signInWithPopup が不安定なためリダイレクトを優先する。
 * iOS の Chrome / Edge / Firefox もすべて WebKit ベースで Safari と同様の制約を受ける（別ブラウザでも挙動は揃いやすい）。
 */
export function shouldPreferGoogleRedirectAuth(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (
    /iPhone|iPad|iPod|Android|CriOS|FxiOS|EdgiOS|OPiOS|SamsungBrowser|Mobile Safari/i.test(
      ua,
    )
  ) {
    return true;
  }
  if (navigator.maxTouchPoints > 0 && /Macintosh|Windows NT/i.test(ua)) {
    return true;
  }
  return false;
}
