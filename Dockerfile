# Production image for Brimble: built and pushed by .github/workflows/deploy.yml
# (from deploy/app/Dockerfile), then pinned here by commit. Brimble builds this
# file, which only pulls the image (brimble.toml build.dockerfile). Roll back by
# pointing this at an older tag.
FROM ghcr.io/cencori/cencori:fb77cf88ad9bd1a039f0d6cc0f7ad94cd80ce6c2
