# セキュリティ

## GitHub が検知した秘密（`firebase-applet-config.json`）と、その後おかしくなった理由

### 何が起きたか

- コミット `73321c42` 時点で **`firebase-applet-config.json` に Google API キーが平文コミット**されていた（GitHub Secret scanning が検知）。
- 対応として **キーのローテーション / 削除** と **`.gitignore` 追加**（`60582f5`）が行われた。
- ローテーション後に認証やリファラーまわりが不安定になりやすいのは、**「新しいキーを GCP で作ったが、アプリに埋め込む値と Firebase コンソールの公式な値が一致していない」** パターンが典型である。

### ローテーションで壊れやすいポイント（ここを揃える）

1. **単一の正本は Firebase Console の Web アプリ設定**  
   [Firebase Console](https://console.firebase.google.com/) → **プロジェクトの設定** → **マイアプリ** → 対象の **Web アプリ** → **SDK の設定と構成** に表示される **`apiKey`** が、ブラウザに埋め込むべき値である。  
   **GCP で別名のキーを新規作成しただけ**では、この表示が自動で付け替わらないことがある。`.env.local` の `VITE_FIREBASE_API_KEY` は **必ずこの表示と同じ文字列**にする。

2. **埋め込んだキーと、GCP の「そのキー」の制限がセット**  
   ビルドに使う `VITE_FIREBASE_API_KEY` に対応する **1 本のブラウザ用 API キー**について、**HTTP リファラー**に少なくとも次の両方を含める（どちらか欠けると `*.firebaseapp.com` や `*.run.app` で途中失敗しやすい）。  
   - アプリ本体のオリジン（例: Cloud Run の `https://….run.app/*`）  
   - Firebase Auth のホスト（例: `https://<プロジェクトID>.firebaseapp.com/*`）  
   **別のキー**にだけリファラーを入れていると、症状が出る。

3. **古いビルド**  
   Vite はビルド時に `VITE_*` をバンドルに焼き込む。**キー変更後は必ず `npm run build` し直し、Cloud Run 等へ再デプロイ**する。古いイメージが残ると、**既に無効化したキー**を叩き続ける。

4. **Git 履歴**  
   公開リポジトリでは **履歴上のキー文字列は「漏洩済み」扱い**。ローテーションが実害防止の本体対策である。履歴から消すには `git filter-repo` 等（運用コスト大）。

### インシデント当時のコミット（参照用）

- 漏洩ファイル: `firebase-applet-config.json`（**現在は `.gitignore` で追跡禁止**）。
- 修正コミット: `60582f5`（環境変数 `VITE_*` に移行）。

### キーのローテーション手順（再発時）

1. [Google Cloud Console](https://console.cloud.google.com/) → **API とサービス** → **認証情報** で対象キーを特定する。
2. **Firebase Console** の Web アプリに表示されている `apiKey` と **同じキー**について制限・ローテーションを行う（別キーを勝手に増やして `.env` だけ差し替えると不整合になりやすい）。
3. ローテーション後、**Firebase の SDK 表示**と **`.env.local`** を一致させ、`npm run build` → 本番へ再デプロイ。
4. 旧キーは **削除**または**使用不可**にする。

### ローカル設定

秘密は **`.env.local`** のみ。`.env.example` は変数名のプレースホルダのみとする。
