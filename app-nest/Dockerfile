# Image NestJS untuk S6. Dibangun dari hasil build (folder dist), jadi jalankan `npx nest build` lebih dulu.
FROM node:24-slim AS pasang
WORKDIR /app
COPY package.json package-lock.json ./
# npm 12 dipakai karena lockfile proyek dibuat dengannya. Hanya dependency saat berjalan yang dipasang.
RUN npm install -g npm@12 && npm ci --omit=dev

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=pasang /app/node_modules ./node_modules
COPY package.json ./
COPY dist ./dist
# Image node sudah punya pengguna "node" (uid 1000). Aplikasi tidak berjalan sebagai root.
RUN mkdir -p /app/ekspor-keluar && chown node:node /app/ekspor-keluar
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
