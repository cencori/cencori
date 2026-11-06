# Production image for Brimble: built and pushed by .github/workflows/deploy.yml
# (from deploy/app/Dockerfile), then pinned here by commit. Brimble builds this
# file, which only pulls the image. Roll back by pointing this at an older tag.
FROM ghcr.io/cencori/cencori:68510b4e9201a3012beff5229327790f802efb8d
