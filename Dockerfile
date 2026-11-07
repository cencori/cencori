# Production image for Brimble: built and pushed by .github/workflows/deploy.yml
# (from deploy/app/Dockerfile), then pinned here by commit. Brimble builds this
# file, which only pulls the image (brimble.toml build.dockerfile). Roll back by
# pointing this at an older tag.
FROM ghcr.io/cencori/cencori:d93280d666630c25b5b93add657d0b3bc1b4520d
