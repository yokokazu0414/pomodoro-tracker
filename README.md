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

## データ仕様（概要）

- セッション保存時: `task` は **1〜200 文字**、振り返り `reflection` も **1〜200 文字**（Firestore ルールと UI で一致）。
- CSV: エクスポートは列順固定。インポートは同一 `session_id` を **マージ（上書き）**。CSV 内で `session_id` が重複する場合は **最後の行**を採用。500 件単位でバッチ書き込みする。

## 注意

- スマホの LINE 等のアプリ内ブラウザでは Google ログインが失敗することがある。**Safari / Chrome** で開くこと（アプリ内の案内文と同じ）。

## 関連ドキュメント

同ディレクトリ内の `要求定義.md`・`要件定義.md`・`技術定義.md` 等を参照。
