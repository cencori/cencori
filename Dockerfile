# Production image for Brimble: built and pushed by .github/workflows/deploy.yml
# (from deploy/app/Dockerfile), then pinned here by commit. Brimble builds this
# file, which only pulls the image (brimble.toml build.dockerfile). Roll back by
# pointing this at an older tag.
FROM ghcr.io/cencori/cencori:0cdf95f2dd0d624badf08f0d7c13d59f44af0a0f
