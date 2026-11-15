ARG BASE_IMAGE=limix-managed-base:beta
FROM node:24-bookworm-slim AS runtime-assets
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates unzip && rm -rf /var/lib/apt/lists/*
COPY server/drivers/antigravity-release.ts /tmp/antigravity-release.ts
COPY deploy/managed-beta/install-antigravity.mjs /tmp/install-antigravity.mjs
RUN node /tmp/install-antigravity.mjs

FROM ${BASE_IMAGE}
COPY --from=runtime-assets /opt/limix-antigravity/ /opt/limix-antigravity/
ENV PATH="/opt/limix-antigravity:${PATH}"
