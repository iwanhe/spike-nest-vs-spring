# Image NestJS untuk S6. Dibangun dari hasil build (folder dist), jadi jalankan `npx nest build` lebih dulu.
# Base image dikunci ke digest supaya build bisa diulang persis; Dependabot membuka PR bila ada digest baru.
FROM node:26-slim@sha256:5adad64f9a1fca2d51972caa65983634c8a774eb300d72b20f7f2a0f60368072 AS pasang
WORKDIR /app
COPY package.json package-lock.json ./
# npm 12 dipakai karena lockfile proyek dibuat dengannya. Hanya dependency saat berjalan yang dipasang.
RUN npm install -g npm@12 && npm ci --omit=dev

FROM node:26-slim@sha256:5adad64f9a1fca2d51972caa65983634c8a774eb300d72b20f7f2a0f60368072
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
