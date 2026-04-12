# Firebase / Google ログイン障害 — 事後検証と再発防止（2026-04 前後）

本書は、Pomodoro Tracker（Vite + Firebase Auth + Cloud Run）で発生した一連の事象を、**何が起きたか**と**なぜ長引いたか**に分解し、**再発防止**に落とし込んだものである。

---

## 1. 何が起きたか（事象の地図）

複数の独立した問題が **同時に・連鎖して** 現れた。見かけ上は「スマホでログインできない」「Loading のまま」など一つの症状に見えたが、実体は次のレイヤの混在である。

| レイヤ | 典型症状 | 代表的原因 |
|--------|----------|------------|
| **秘密管理** | GitHub から「Secrets detected」メール | リポジトリに API キー等を平文コミット |
| **キーローテーション後** | PC で `auth/requests-from-referer-...-are-blocked`、モバイルで途中失敗 | 新キーに **HTTP リファラー**が再現されていない（ポート別 localhost 含む） |
| **Firebase と GCP の「別物」** | 承認済みドメインは入っているのに失敗 | **OAuth 2.0 Web クライアントの JavaScript 生成元** や **ブラウザ API キーのリファラー** が未設定 |
| **OAuth フロー上のホスト** | `*.firebaseapp.com` で白画面・プログレスバーのまま、`The requested action is invalid` | リファラーに **`https://<project>.firebaseapp.com/*`** が無い、または **埋め込みブラウザ** で Google が拒否 |
| **クライアント実装** | iOS Safari で Google 画面に行かない／リダイレクトが無言で戻る | `async` 経由で **ユーザージェスチャーが切れる**、**リダイレクト vs ポップアップ**の適性差 |
| **ビルド・配信** | 「コードを変えたのに挙動が変わらない」 | **古い `index.html` のキャッシュ**、**Cloud Run 未再デプロイ**、バンドルに **古い `VITE_FIREBASE_API_KEY`** が残る |

最終的に通ったのは、**設定の整合（キー・リファラー・OAuth・正本の apiKey）** と **nginx で index のキャッシュ抑止**、**デプロイスクリプトでビルド ID 埋め込み**、**再デプロイ** が揃った結果と考えられる（単一のコミットだけが魔法の修正ではない）。

---

## 2. タイムライン（論理的な因果）

1. **初期**: `firebase-applet-config.json` に **Google API キーを Git に含めた** → GitHub Secret scanning が検知。
2. **対応**: キー削除・ローテーション、`.gitignore`、環境変数化。ここで **GCP 上にブラウザ用キーが複数**になりやすく、**Firebase Console に表示される `apiKey` と `.env` の 1 本化**を誤ると、その後ずっと不整合が続く。
3. **PC ローカル**: `localhost:3001` など **別ポート** だけリファラーに入っていない → `requests-from-referer-...-blocked`。
4. **本番・モバイル**: Cloud Run のオリジンだけ許可し **`*.firebaseapp.com` を許可していない** → OAuth 途中のホストで Identity Toolkit / Google 側が拒否しやすい。
5. **実装側の試行**: Loading 対策、`signInWithRedirect` の同期的呼び出し、iOS Safari はポップアップ優先、など。**設定が歪んだまま**だとクライアントだけでは限界がある。
6. **「変わらない」期間**: ブラウザ・CDN・中間キャッシュで **古い HTML/JS** が残り、**再ビルド・再デプロイ**とセットでないと改善が見えない。
7. **収束**: 正しいキーで再ビルド、**index.html をキャッシュさせない nginx**、`VITE_BUILD_TAG` で **本番が最新か検証可能**にしたうえで **再デプロイ** → ログイン成功。

---

## 3. 根本原因の整理（なぜ再発しうるか）

### 3.1 秘密を Git に置いた

- **影響**: キーは漏洩扱いになり **ローテーション必須**。ローテーションは **GCP・Firebase・各環境の `.env`・全デプロイ先** の整合を一度揺らす。

### 3.2 「Firebase の設定」と「Google Cloud の認証情報」は別ダッシュボード

少なくとも次は **別々に**揃える必要がある。

- **Firebase Authentication → 承認済みドメイン**（ホスト名のみ）
- **OAuth 2.0 クライアント ID（Web）→ 承認済みの JavaScript 生成元**（`https://` 付きオリジン）
- **ブラウザ用 API キー → HTTP リファラー**（`https://app.run.app/*` と `https://project.firebaseapp.com/*` など）

どれか1つだけ直しても、**別レイヤで落ちる**。

### 3.3 正本は Firebase Console の Web `apiKey`

- ローテーションで **GCP で新規キーを作っただけ**では、Firebase の Web アプリに表示される **`apiKey` と一致しない**ことがある。
- Vite は **`VITE_FIREBASE_API_KEY` をビルド時に埋め込む**ため、`.env` と Firebase の表示がずれると **実行時まで気づきにくい**。

### 3.4 モバイルブラウザの差

- **iOS Safari** と **iOS Chrome（CriOS）** では UA・ジェスチャー・リダイレクトの扱いが違う。同一コードでも **経路の最適解が異なる**。
- **アプリ内ブラウザ（LINE 等）** は Google が OAuth を拒否しやすく、**本体 Safari で開き直す**必要がある。

### 3.5 デプロイとキャッシュ

- **静的ホスト**では `index.html` がキャッシュされると、**新しいハッシュ付き JS を指さない**ままになることがある。
- **対策**: `index.html` に `Cache-Control: no-store`、アセットはハッシュ付きで長期キャッシュ（本リポジトリの `nginx.conf`）。

---

## 4. 再発防止 — 運用チェックリスト

### 4.1 秘密・リポジトリ

- [ ] API キー・トークンは **`.env.local` のみ**（`.env*` は `.gitignore`、例は `.env.example` のみ）
- [ ] **平文 JSON で Firebase 設定をコミットしない**（過去に `firebase-applet-config.json` で検知）
- [ ] キーローテーション後は **GitHub の履歴上のキーは無効化済み**とみなし、**新キーだけ**を運用

### 4.2 キーローテーション直後（必須の 3 点セット）

1. [ ] **Firebase Console** → Project settings → Web アプリの **`apiKey`** と **`VITE_FIREBASE_API_KEY` が完全一致**
2. [ ] **その API キー（ブラウザキー）** の HTTP リファラーに  
   - 本番: `https://<Cloud Run ホスト>/*`  
   - OAuth 中間: `https://<authDomain>/*`（例 `firebaseapp.com`）  
   - ローカル: 使うポートごと `http://localhost:PORT/*`（必要なら `127.0.0.1` も）
3. [ ] **OAuth 2.0 Web クライアント** の **承認済み JavaScript 生成元** に本番オリジンと `https://<authDomain>`（必要に応じ）

### 4.3 デプロイ手順

- [ ] `./scripts/deploy-cloud-run.sh` は **`.env.local` を読んでから `npm run build`** する（本リポジトリの前提）
- [ ] キーまたは認証まわりを変えたら **必ず再デプロイ**（ローカルビルドだけでは本番は変わらない）
- [ ] 本番画面の **`build=`**（`VITE_BUILD_TAG`）で **新しいビルドが配信されているか**確認できる（本リポジトリのログイン画面）

### 4.4 モバイルで失敗するときの切り分け

- [ ] **埋め込みブラウザ** でないか（LINE 等 → Safari / Chrome で URL を直接開く）
- [ ] **API キー** と **OAuth** と **承認済みドメイン** のどれかが欠けていないか（README / SECURITY 参照）
- [ ] 端末側: プライベートリレー・VPN・コンテンツブロッカー・別 Wi‑Fi で再試行

---

## 5. 参考ドキュメント（リポジトリ内）

- [SECURITY.md](../SECURITY.md) — 漏洩・ローテーション・正本の apiKey
- [README.md](../README.md) — Cloud Run / 承認済みドメイン / OAuth / API キー

---

## 6. まとめ

今回の本質は、**「Git への秘密混入」→「キー回転」→「複数 GCP 設定の整合」→「静的配信のキャッシュ」** が重なり、**単一の原因・単一のパッチ**では説明できない状態だったことである。再発防止の中心は、**正本（Firebase の Web API キー表示）を 1 つに決めること**と、**Firebase / OAuth / API キー制限の 3 系統をセットで確認すること**、そして **デプロイとキャッシュを前提にした検証（ビルドタグ・index の no-cache）** に置くことである。
