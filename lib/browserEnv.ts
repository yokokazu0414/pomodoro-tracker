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
 * iOS の「純粋な Safari」（CriOS/FxiOS 等でない）。
 * この環境では signInWithRedirect が Google 画面に行かず戻る報告が多く、ポップアップ優先にする。
 */
export function isIOSWebKitSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (!/iPhone|iPad|iPod/i.test(ua)) return false;
  if (/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)) return false;
  return true;
}

/**
 * モバイル系では signInWithPopup が不安定なためリダイレクトを優先する。
 * 例外は {@link isIOSWebKitSafariBrowser}（ポップアップ優先は firebase.ts 側）。
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
