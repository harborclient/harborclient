# syntax=docker/dockerfile:1
#
# Build from the monorepo root:
#   docker build -f packages/team-hub/Dockerfile -t team-hub:latest .

FROM node:24-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/team-hub/package.json ./packages/team-hub/

RUN pnpm install --frozen-lockfile --filter @harborclient/team-hub...

COPY packages/team-hub ./packages/team-hub

RUN pnpm --filter @harborclient/team-hub build
RUN pnpm --filter @harborclient/team-hub deploy --prod --legacy /deploy

ARG DOCS_INDEX_URL=https://raw.githubusercontent.com/harborclient/harborclient/main/resources/docsSearchIndex.json
RUN mkdir -p /deploy/data \
  && curl -fsSL -o /deploy/data/docsSearchIndex.json "${DOCS_INDEX_URL}"

FROM node:24-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    gettext-base \
    nano \
    nginx \
    postgresql \
    postgresql-contrib \
    redis-server \
    supervisor \
  && rm -rf /var/lib/apt/lists/* \
  && rm -f /etc/nginx/sites-enabled/default

ENV PORT=8080 \
  NGINX_SERVER_NAME=_ \
  TEAM_HUB_PORT=8787 \
  TEAM_HUB_HOST=127.0.0.1 \
  TEAM_HUB_CONFIG=/etc/team-hub/server.yaml \
  TEAM_HUB_START_POSTGRES=true \
  TEAM_HUB_START_REDIS=true \
  TEAM_HUB_DB_DRIVER=postgres \
  TEAM_HUB_DB_HOST=127.0.0.1 \
  TEAM_HUB_DB_PORT=5432 \
  TEAM_HUB_DB_USER=harbor \
  TEAM_HUB_DB_PASSWORD=harbor \
  TEAM_HUB_DB_DATABASE=harbor \
  TEAM_HUB_REDIS_HOST=127.0.0.1 \
  TEAM_HUB_REDIS_PORT=6379 \
  TEAM_HUB_LOGGING_LEVEL=info \
  TEAM_HUB_LOGGING_FILE=/var/log/team-hub/team-hub.log \
  TEAM_HUB_LOGGING_CONSOLE=true \
  PGDATA=/var/lib/postgresql/data

COPY --from=builder /deploy/ ./
COPY --from=builder /deploy/data/docsSearchIndex.json /app/data/docsSearchIndex.json

COPY packages/team-hub/docker/entrypoint.sh /docker/entrypoint.sh
COPY packages/team-hub/docker/start-team-hub.sh /docker/start-team-hub.sh
COPY packages/team-hub/docker/restart-team-hub.sh /docker/restart-team-hub.sh
COPY packages/team-hub/docker/server.yaml.template /docker/server.yaml.template
COPY packages/team-hub/docker/nginx.conf.template /docker/nginx.conf.template

RUN chmod +x /docker/entrypoint.sh /docker/start-team-hub.sh /docker/restart-team-hub.sh \
  && ln -sf /docker/restart-team-hub.sh /usr/local/bin/restart-team-hub \
  && mkdir -p /etc/team-hub /var/lib/postgresql/data /var/log/team-hub /var/run/team-hub /app/data \
  && chown -R postgres:postgres /var/lib/postgresql/data

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

STOPSIGNAL SIGTERM

ENTRYPOINT ["/docker/entrypoint.sh"]
