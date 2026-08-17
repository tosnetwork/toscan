FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG VITE_TOS_NETWORK=mainnet
ENV VITE_TOS_NETWORK=${VITE_TOS_NETWORK} \
    VITE_TOS_RPC_URL=/tos-rpc \
    VITE_TOS_RPC_TRANSPORT=rest \
    VITE_TOS_SERVICE_API_URL=/tos-service-api \
    VITE_ENABLE_PREVIEW=false
RUN pnpm build

FROM nginx:1.27-alpine
ENV TOS_RPC_UPSTREAM=http://host.docker.internal:8011 \
    TOS_SERVICE_UPSTREAM=http://host.docker.internal:8080
COPY deploy/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
