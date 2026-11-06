# Site + painel + API do Cemita num serviço só (Railway, Render, Fly ou qualquer servidor com Docker).
# 1) compila o site e o painel  2) instala só o necessário da API  3) imagem final enxuta.

# ---------- 1. site e painel ----------
FROM node:22-alpine AS site
WORKDIR /build
# a API fica no mesmo endereço do site
ENV VITE_API_URL=/api/v1
# endereço público do site (prévia no WhatsApp, Google, sitemap). Vem da variável do serviço.
ARG VITE_SITE_URL=""
ENV VITE_SITE_URL=${VITE_SITE_URL}
COPY package*.json ./
RUN npm install --include=dev --no-audit --no-fund
COPY index.html vite.config.ts seo.plugin.ts tsconfig.json ./
COPY admin ./admin
COPY public ./public
COPY src ./src
RUN npm run build

# ---------- 2. dependências da API ----------
FROM node:22-alpine AS api-deps
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# ---------- 3. imagem final ----------
FROM node:22-alpine
ENV NODE_ENV=production
ENV SITE_DIR=/app/dist
WORKDIR /app/server
COPY --from=api-deps /app/server/node_modules ./node_modules
COPY server/package.json ./
COPY server/src ./src
COPY server/scripts ./scripts
COPY --from=site /build/dist /app/dist
USER node
EXPOSE 3333
# a cada publicação: prepara o banco (migrations, cardápio inicial, 1ª conta) e só então sobe.
# Se a preparação falhar, o serviço novo não sobe e a hospedagem mantém a versão anterior no ar.
CMD ["sh", "-c", "node scripts/deploy.js && exec node src/server.js"]
