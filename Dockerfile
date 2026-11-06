# Production image for Brimble: built and pushed by .github/workflows/deploy.yml
# (from deploy/app/Dockerfile), then pinned here by commit. Brimble builds this
# file, which only pulls the image (brimble.toml build.dockerfile). Roll back by
# pointing this at an older tag.
FROM ghcr.io/cencori/cencori:fe4ff790e0a93934bcd70291ef19107bc36b2f98
