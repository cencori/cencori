# Production image for Brimble: built and pushed by .github/workflows/deploy.yml
# (from deploy/app/Dockerfile), then pinned here by commit. Brimble builds this
# file, which only pulls the image (brimble.toml build.dockerfile). Roll back by
# pointing this at an older tag. Edit a comment to redeploy the same image.
FROM ghcr.io/cencori/cencori:759c9ec8aa0fb40a4a65df085e7e01ad3f9059cb
