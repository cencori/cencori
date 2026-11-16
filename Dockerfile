# Production image for Brimble: built and pushed by .github/workflows/deploy.yml
# (from deploy/app/Dockerfile), then pinned here by commit. Brimble builds this
# file, which only pulls the image (brimble.toml build.dockerfile). Roll back by
# pointing this at an older tag. Edit a comment to redeploy the same image.
# Redeploy: 2026-11-08 (db72b287 did not roll out).
FROM ghcr.io/cencori/cencori:3890051fcfc8285601169c0c8d77063bbc37058e
# redeploy 2026-11-15T12:08Z
