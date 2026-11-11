# Production image for Brimble: built and pushed by .github/workflows/deploy.yml
# (from deploy/app/Dockerfile), then pinned here by commit. Brimble builds this
# file, which only pulls the image (brimble.toml build.dockerfile). Roll back by
# pointing this at an older tag. Edit a comment to redeploy the same image.
# Redeploy: 2026-11-08 (db72b287 did not roll out).
FROM ghcr.io/cencori/cencori:62f69b3055684bb2a4af1d7b45be530c1311ed48
# redeploy 2026-11-09T03:00Z
