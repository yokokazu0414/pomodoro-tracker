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
    const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
    lines.push('', '【「The requested action is invalid」・firebaseapp.com で白画面のまま止まる場合】');
    lines.push(
      '① 画面下に「コンパス（Safari で開く）」や専用ツールバーがあるときは、本体 Safari ではなく埋め込みブラウザです。Google はこの環境でのログインを拒否することがあります。',
    );
    lines.push(
      '   → コンパスをタップして Safari で開き直すか、URL をコピーして Safari のアドレス欄に貼り、もう一度ログインしてください。',
    );
    lines.push('');
    lines.push('② Google Cloud Console → API とサービス → 認証情報 → OAuth 2.0 クライアント ID（種別: ウェブアプリケーション）');
    lines.push('   「承認済みの JavaScript 生成元」に次を含める:');
    if (authDomain) {
      lines.push(`   - https://${authDomain}`);
    }
    lines.push(`   - ${origin}`);
    lines.push('');
    lines.push('③ 同じプロジェクトのブラウザ用 API キー → HTTP リファラーに、OAuth 途中の Firebase ドメインも含める（例）:');
    if (authDomain) {
      lines.push(`   - https://${authDomain}/*`);
    }
    lines.push(`   - ${origin}/*`);
    lines.push('');
    lines.push('④ LINE / Instagram / X 等の内蔵ブラウザではなく、トップレベルの Safari / Chrome で開いてください。');
    lines.push('⑤ OAuth 同意画面が「テスト」のときは、テストユーザーに自分の Google アカウントを追加してください。');
    lines.push('');
  }

  if (
    code.includes('requests-from-referer') ||
    message.includes('requests-from-referer') ||
    message.includes('are-blocked.') && message.includes('referer')
  ) {
    lines.push('', '【auth/requests-from-referer … are-blocked（ローカル / 別ポート）】');
    lines.push(
      'ブラウザ用 API キーの「HTTP リファラー」に、今アプリを開いている URL のオリジンが入っていません。',
    );
    lines.push('1) Google Cloud Console → API とサービス → 認証情報');
    lines.push('2) Firebase の「ウェブ API キー」と同じキー（Browser key）を開く');
    lines.push('3) アプリケーションの制限 → HTTP リファラー（ウェブサイト）');
    lines.push(`4) 次を追加して保存: ${origin}/*`);
    lines.push('   別ポートで試すたびに、そのオリジンごとに 1 行必要（例: http://localhost:3000/* と http://localhost:3001/* は別）。');
    lines.push('5) 保存後、数分待ってからページを再読み込みして再試行。');
    lines.push('');
    lines.push('※ Firebase Console → Authentication → 設定 → 承認済みドメイン に localhost があることは別要件（こちらは満たしていても API キー側でブロックされます）。');
    lines.push('');
  }

  if (code === 'auth/network-request-failed') {
    lines.push('', '【auth/network-request-failed（通信失敗）】');
    lines.push(
      'Firebase 認証サーバー（identitytoolkit.googleapis.com 等）への HTTPS が届いていません。',
    );
    lines.push('① 電波・Wi‑Fi を確認し、機内モードのオンオフを試す');
    lines.push('② VPN・広告ブロック・企業フィルタ・iCloud プライベートリレーを一時オフ');
    lines.push('③ iPhone: 設定 → モバイル通信 → 低データモード / 省データをオフにする');
    lines.push('④ Safari でダメなら Chrome を試す（LINE 等の内蔵ブラウザではなくトップレベルで）');
    lines.push('⑤ しばらく待ってから「Sign in with Google」を再度押す');
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
    lines.push(`   リファラー制限に ${origin}/* と、Firebase の auth 用 https://<authDomain>/* の両方があるか確認。`);
    lines.push('   auth ドメインは Firebase Console → プロジェクトの設定 → 全般 の「ウェブ API キー」付近のドメインと一致させる。');
    lines.push('');
    lines.push('4) 保存後、数分待ってからブラウザを再読み込みして再試行。');
  }

  return lines.join('\n');
}
