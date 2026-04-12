/** Firebase Auth のエラーから、Cloud Run / 独自ドメイン向けの手順テキストを生成 */

export function getAuthErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    return String((err as { code: string }).code);
  }
  return '';
}

export function formatFirebaseAuthHelp(err: unknown): string {
  const code = getAuthErrorCode(err);
  const message = err instanceof Error ? err.message : String(err);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  const lines: string[] = [`${message}`, '', `（Firebase コード: ${code || '不明'}）`];

  if (
    code === 'auth/unauthorized-domain' ||
    code === 'auth/operation-not-allowed' ||
    message.includes('not authorized') ||
    message.includes('unauthorized')
  ) {
    lines.push('', '【対処・Cloud Run / 独自URL の場合】');
    lines.push('1) Firebase Console → Authentication → 設定 → 承認済みドメイン');
    lines.push(`   に次の「ホスト名だけ」を追加: ${host}`);
    lines.push('');
    lines.push('2) Google Cloud Console → API とサービス → 認証情報');
    lines.push('   →「OAuth 2.0 クライアント ID」で Web クライアントを開く');
    lines.push(`   →「承認済みの JavaScript 生成元」に追加: ${origin}`);
    lines.push('');
    lines.push('3) 保存後、数分待ってからブラウザを再読み込みして再試行。');
  }

  return lines.join('\n');
}
