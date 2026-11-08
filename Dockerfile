# Production image for Brimble: built and pushed by .github/workflows/deploy.yml
# (from deploy/app/Dockerfile), then pinned here by commit. Brimble builds this
# file, which only pulls the image (brimble.toml build.dockerfile). Roll back by
# pointing this at an older tag. Edit a comment to redeploy the same image.
FROM ghcr.io/cencori/cencori:d5ce5f325c39c2c0192817a716c049e70c41b2e0
