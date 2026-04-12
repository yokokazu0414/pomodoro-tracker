# Pomodoro Tracker

個人向けポモドーロタイマー。セッションは **Firebase Authentication（Google）** と **Cloud Firestore** に保存し、ダッシュボードと CSV のエクスポート／インポートで振り返り・バックアップができる。

## 技術スタック

| 項目 | 内容 |
|------|------|
| ビルド | Vite 6 + React 19 + TypeScript |
| UI | Tailwind CSS 4、Base UI（shadcn 風コンポーネント） |
| データ | Firebase Auth、Firestore（`users/{uid}/sessions/{sessionId}`） |
| グラフ | Recharts |

当初の検討では **IndexedDB（Dexie）＋オフライン** を想定していたが、実装では **Firebase に変更**した。ローカル専用の `lib/db.ts`（Dexie）は削除済みである。

## Firebase 設定（秘密はコミットしない）

1. `.env.example` をコピーして **`.env.local`** を作成する。
2. [Firebase Console](https://console.firebase.google.com/) → **プロジェクトの設定** → **マイアプリ** → Web の設定から、各 `VITE_*` に値を入れる。
3. **`VITE_FIRESTORE_DATABASE_ID`** は、Firestore の「データベース ID」（AI Studio 連携などでは名前付き ID になることがある）。デフォルト DB なら通常 `(default)`。

ビルド・開発サーバーは Vite が `.env.local` を読み込む。

**API キーがリポジトリに含まれていた場合**は [SECURITY.md](./SECURITY.md) に従い **キーをローテーション**すること。

### Firebase Console で「Authentication（認証）」メニューが見つからない場合

新しいコンソール UI では、左サイドバーに **Authentication** が常時表示されないことがある。

1. **プロジェクトを確認**  
   画面上部のプロジェクト名が **このアプリの Firebase プロジェクト**（`.env` の `VITE_FIREBASE_PROJECT_ID` と同じ）か確認する。「My First Project」など別プロジェクトを開いていると、メニューも設定も別になる。

2. **検索**  
   画面上部の **検索バー**（虫眼鏡）で **`認証`** または **`Authentication`** と入力し、**Authentication** を選ぶ。

3. **直リンク（確実）**  
   ブラウザのアドレス欄に次を開く（`<プロジェクトID>` を自分の ID に置き換え）:

   `https://console.firebase.google.com/project/<プロジェクトID>/authentication/users`

   例: プロジェクト ID が `abstract-botany-438907-v2` なら  
   `https://console.firebase.google.com/project/abstract-botany-438907-v2/authentication/users`

4. **まだ無い場合**  
   初回のみ **Authentication を有効化**する必要がある。左の **構築（Build）** や **プロダクトのカテゴリ** を開き、**Authentication / 認証** を追加するか、Firebase の「始める」ウィザードから **Authentication** をオンにする。

「設定」タブ（歯車）→ **承認済みドメイン** は、上記の Authentication 画面の **設定** から開く。

### Cloud Run / 独自ドメインでログインできない場合

スクリーンショットのような **`*.run.app`** や独自ドメインでホストしているとき、**ログイン用ウィンドウがすぐ閉じる**ことがある。次を両方満たすこと。

1. **Firebase Console** → **Authentication** → **設定** → **承認済みドメイン**  
   に、アプリの **ホスト名のみ**（例: `pomodoro-tracker-267724445152.us-west1.run.app`）を追加する。`https://` は付けない。

2. **Google Cloud Console** → **API とサービス** → **認証情報** → **OAuth 2.0 クライアント ID**（Web のクライアント）→ **承認済みの JavaScript 生成元**  
   に **`https://` 付きのオリジン**（例: `https://pomodoro-tracker-267724445152.us-west1.run.app`）を追加する。

保存後、数分待ってから再試行する。

### 承認済みドメインは元から入っているのに、ウィンドウがすぐ閉じる場合

Firebase（Identity Platform）の **承認済みドメイン** と、Google Cloud の **OAuth / API キー** の設定は **別物**である。ドメインが揃っていても、次が不足していると同じ症状になる。

1. **OAuth 2.0 クライアント（ウェブ）の「承認済みの JavaScript 生成元」**  
   [Google Cloud Console](https://console.cloud.google.com/) → **API とサービス** → **認証情報** → 種別が **ウェブ クライアント** の OAuth クライアントを開き、  
   `https://pomodoro-tracker-267724445152.us-west1.run.app`  
   が **JavaScript 生成元** に含まれているか確認する（Firebase のドメイン一覧だけでは足りない）。

2. **ブラウザ用 API キーの「アプリケーションの制限」**  
   キーをローテーションしたあと、**HTTP リファラー（ウェブサイト）** に次の **両方** を含める（どちらか一方だけだとログイン途中で落ちる）。  
   - アプリの URL: `https://pomodoro-tracker-267724445152.us-west1.run.app/*`（実際の Cloud Run URL に合わせる）  
   - **Firebase の auth ドメイン**（Google ログインのリダイレクト先）: `https://<VITE_FIREBASE_AUTH_DOMAIN>/*`（例: `https://my-project-id.firebaseapp.com/*`）  
   Cloud Run だけ許可して `*.firebaseapp.com` を入れていないと、Safari でもアドレスバーが `…firebaseapp.com` の白画面に **「The requested action is invalid」** だけ出ることがある。

3. **ブラウザの開発者ツール（F12）→ Console / Network**  
   ログイン直後に `400` / `403` / `API key not valid` / `idpiframe` などが出ていないか確認する。表示されたエラー文が次の手掛かりになる。

### スマホで「The requested action is invalid」

**アドレスバーが `（プロジェクトID）.firebaseapp.com` の白い画面だけ**のときは、まず **API キーの HTTP リファラー** を疑う。Google ログインは OAuth 処理の途中で必ずこのホストに一度戻るため、リファラーを Cloud Run だけに絞ると **本物の Safari でも** このエラーになる。  
[Google Cloud Console](https://console.cloud.google.com/) → **API とサービス** → **認証情報** → ブラウザ用 **API キー** → **アプリケーションの制限** → **HTTP リファラー** に  
`https://<VITE_FIREBASE_AUTH_DOMAIN と同じホスト>/*`（例: `https://my-project-id.firebaseapp.com/*`）を追加する。

上記を直したあとでも、次が当てはまる場合がある。

- **handler の URL に付いている `apiKey=` が、Google Cloud の「API キー」一覧に存在しない**（ローテーション後も古いビルドが Cloud Run に残っている）→ `.env.local` の `VITE_FIREBASE_API_KEY` を現在のキーに合わせ、**イメージを再ビルドして再デプロイ**する。
- **LINE・Instagram・X 等のアプリ内ブラウザ** から開いている（埋め込み WebView では Google が拒否することがある）→ Safari / Chrome で URL を直接開く。
- **OAuth 同意画面がテストモード**で、自分の Google アカウントが **テストユーザー** に入っていない（Google Cloud Console → OAuth 同意画面）。

## 前提

- Node.js 18+（推奨: 20 系）
- Firebase プロジェクトと上記 `.env.local`
- Firestore のセキュリティルールは `firestore.rules` をデプロイすること（ユーザー本人のみ read/write 可）

## セットアップ

```bash
cd apps/08_pomodoro-tracker
npm install
cp .env.example .env.local
# .env.local を編集して Firebase の値を設定
```

## 開発

```bash
npm run dev
```

ブラウザで `http://localhost:3000`（`--host=0.0.0.0` のため LAN からも可）。

## ビルド

```bash
npm run build
npm run preview
```

## Lint（型チェック）

```bash
npm run lint
```

## Cloud Run へデプロイ

本リポジトリの **Vite ビルド＋nginx** をソースからビルドしてデプロイする（AI Studio の古いコンテナを置き換えるときに使う）。

前提: `gcloud` ログイン済み、プロジェクト `abstract-botany-438907-v2`、`.env.local` に `VITE_*` と `VITE_FIRESTORE_DATABASE_ID` が入っている。

スクリプトは **ローカルで `npm run build`**（`.env.local` を Vite が読む）してから `dist` を含めて Cloud Build が nginx イメージを作る。Cloud 上で Vite を回す方式より `VITE_*` の取り違えが起きにくい。

**注意:** デフォルトでは `.gitignore` の `dist/` のせいで `gcloud run deploy --source` が `dist` をアップロードしない。本リポジトリでは **`.gcloudignore`** で `dist` を除外していない。

```bash
./scripts/deploy-cloud-run.sh
```

初回は Cloud Build API の有効化が必要になることがある:

```bash
gcloud services enable cloudbuild.googleapis.com artifactregistry.googleapis.com --project=abstract-botany-438907-v2
```

## データ仕様（概要）

- セッション保存時: `task` は **1〜200 文字**、振り返り `reflection` も **1〜200 文字**（Firestore ルールと UI で一致）。
- CSV: エクスポートは列順固定。インポートは同一 `session_id` を **マージ（上書き）**。CSV 内で `session_id` が重複する場合は **最後の行**を採用。500 件単位でバッチ書き込みする。

## 注意

- スマホの LINE 等のアプリ内ブラウザでは Google ログインが失敗することがある。**Safari / Chrome** で開くこと（アプリ内の案内文と同じ）。

## 関連ドキュメント

同ディレクトリ内の `要求定義.md`・`要件定義.md`・`技術定義.md` 等を参照。
