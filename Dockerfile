# Multi-stage production build for linux/amd64 and linux/arm64.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
# No lockfile was available in the original project; npm install resolves the build tools.
RUN npm install --no-audit --no-fund
COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
COPY scripts ./scripts
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
EXPOSE 8080
