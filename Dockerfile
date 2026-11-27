# Production image for Brimble: built and pushed by .github/workflows/deploy.yml
# (from deploy/app/Dockerfile), then pinned here by commit. Brimble builds this
# file, which only pulls the image (brimble.toml build.dockerfile). Roll back by
# pointing this at an older tag. Edit a comment to redeploy the same image.
# Redeploy: 2026-11-08 (db72b287 did not roll out).
FROM ghcr.io/cencori/cencori:9d9ac16096fb0344ec75bef95fecf2437fbbd7d7
# redeploy 2026-11-15T12:08Z
