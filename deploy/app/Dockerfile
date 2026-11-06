# The cencori.com app, built on GitHub Actions and run on Brimble.
#
# Brimble's builder can't hold `next build` (it needs ~12GB; Brimble kills it),
# so .github/workflows/deploy.yml builds this image on a GitHub runner, pushes
# it to ghcr.io and asks Brimble to run it. Build from the repo root:
#
#   docker build -f deploy/app/Dockerfile --secret id=buildenv,src=build.env .
#
# build.env holds only NEXT_PUBLIC_* values (scripts/ci/brimble-build-env.mjs).
# Server secrets never enter the image: Brimble injects them at start.

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NODE_ENV=production \
    BRIMBLE_BUILD=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    # Keep puppeteer's Chromium inside /app so it ships to the runtime stage.
    PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

COPY package.json package-lock.json .npmrc ./
RUN npm ci --include=dev --no-audit --no-fund

COPY . .
# The runner has 16GB; give the compile room instead of the 3GB Brimble cap.
# lib/supabaseAdmin.ts and lib/github.ts throw on import when their variables
# are missing, and `next build` imports every route. The placeholders only get
# past that import; nothing real is built from them (the runner can't reach the
# private database anyway, as Brimble's builder couldn't), and the container
# gets the real values from Brimble at start.
RUN --mount=type=secret,id=buildenv,required=true \
    set -a && . /run/secrets/buildenv && set +a && \
    SUPABASE_SERVICE_ROLE_KEY=build-placeholder \
    GITHUB_APP_PRIVATE_KEY=build-placeholder \
    GITHUB_APP_CLIENT_ID=build-placeholder \
    GITHUB_APP_CLIENT_SECRET=build-placeholder \
    NODE_OPTIONS=--max-old-space-size=8192 npx next build --webpack

RUN npm prune --omit=dev --ignore-scripts && rm -rf .next/cache


FROM node:22-bookworm-slim AS runtime
WORKDIR /app
# Chromium's libraries for puppeteer (pitch PDF export, web browsing tools):
# the same list Railpack installed on Brimble's own builds.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation libasound2 libatk1.0-0 libatomic1 libc6 libcairo2 \
      libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libgdk-pixbuf-2.0-0 \
      libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 \
      libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 \
      libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils xvfb \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PUPPETEER_CACHE_DIR=/app/.cache/puppeteer \
    PORT=3000

COPY --from=build /app /app

EXPOSE 3000
# The project's pre-start command (node scripts/brimble-apply-sql.mjs) runs in
# its own container before each deploy. Brimble sets PORT.
CMD ["sh", "-c", "exec node_modules/.bin/next start -H 0.0.0.0 -p \"${PORT:-3000}\""]
