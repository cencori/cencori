# Production image for Brimble: built and pushed by .github/workflows/deploy.yml
# (from deploy/app/Dockerfile), then pinned here by commit. Brimble builds this
# file, which only pulls the image (brimble.toml build.dockerfile). Roll back by
# pointing this at an older tag. Edit a comment to redeploy the same image.
# Redeploy: 2026-11-08 (db72b287 did not roll out).
FROM ghcr.io/cencori/cencori:2a997462090d603e0deb1758a246511e8a3595ce
# redeploy 2026-11-09T03:00Z
