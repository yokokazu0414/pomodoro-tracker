/** Firebase Auth のエラーから、Cloud Run / 独自ドメイン向けの手順テキストを生成 */

export function getAuthErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    return String((err as { code: string }).code);
  }
  return '';
}

function messageLooksLikeGoogleBlockedInWebView(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('requested action is invalid') ||
    m.includes('the requested action is invalid') ||
    m.includes('disallowed_useragent') ||
    m.includes('403:') && m.includes('blocked')
  );
}

export function formatFirebaseAuthHelp(err: unknown): string {
  const code = getAuthErrorCode(err);
  const message = err instanceof Error ? err.message : String(err);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  const lines: string[] = [`${message}`, '', `（Firebase コード: ${code || '不明'}）`];

  if (messageLooksLikeGoogleBlockedInWebView(message)) {
    lines.push('', '【スマホで「The requested action is invalid」が出る場合】');
    lines.push('Google は LINE・Instagram・X 等の「アプリ内ブラウザ」でのログインを拒否することがあります。');
    lines.push('① 画面右上の「…」から「Safari で開く」「Chrome で開く」を選ぶ');
    lines.push('② または URL をコピーし、Safari / Chrome を直接起動して貼り付け');
    lines.push('③ それでもダメなら、OAuth 同意画面の「テストユーザー」に自分の Gmail を入れているか確認（テストモード時）');
    lines.push('');
  }

  if (
    code === 'auth/unauthorized-domain' ||
    code === 'auth/operation-not-allowed' ||
    message.includes('not authorized') ||
    message.includes('unauthorized')
  ) {
    lines.push('', '【対処・Cloud Run / 独自URL の場合】');
    lines.push('1) Firebase の承認済みドメインに既に入っている場合でも、次は別設定。');
    lines.push('');
    lines.push('2) Google Cloud Console → API とサービス → 認証情報');
    lines.push('   →「OAuth 2.0 クライアント ID」で Web クライアントを開く');
    lines.push(`   →「承認済みの JavaScript 生成元」に追加: ${origin}`);
    lines.push('');
    lines.push('3) 同じ「認証情報」の「API キー」でブラウザキーを開き、');
    lines.push(`   リファラー制限に ${origin}/* が含まれるか確認（キー再生成後に漏れがち）。`);
    lines.push('');
    lines.push('4) 保存後、数分待ってからブラウザを再読み込みして再試行。');
  }

  return lines.join('\n');
}
