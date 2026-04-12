# dist はデプロイ前にローカル（または CI）で `npm run build` 済みであること。
# Cloud Build 上の Vite に VITE_* を渡すより、.env.local を使ったビルド成果物を焼く方が確実。
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist /usr/share/nginx/html
EXPOSE 8080
