# Solid.Drive landing page as a self-contained Docker image.
#
# Build it the same way the GitHub Pages workflow does — strip the empty
# Jekyll front matter, then encrypt the pages listed in
# gh-page/_protected_pages.txt with PageCrypt — and serve the result with
# nginx. Build from the repository root:
#
#   docker build -f gh-page/Dockerfile -t wseresearch/solid.drive-webpage .
#   docker run -p 8080:80 wseresearch/solid.drive-webpage

# ---- Build + encrypt the static site -------------------------------------
FROM node:20-alpine AS build
WORKDIR /site
COPY gh-page/ ./gh-page/
RUN set -eu; \
    mkdir -p _site; \
    cp -r gh-page/assets _site/; \
    # Jekyll strips the leading empty front matter (the first two '---' lines).
    tail -n +3 gh-page/index.html > _site/index.html; \
    # Encrypt each page listed in the manifest, mirroring pages.yml.
    if [ -f gh-page/_protected_pages.txt ]; then \
      while IFS= read -r line || [ -n "$line" ]; do \
        case "$line" in ''|\#*) continue ;; esac; \
        file=$(printf '%s\n' "$line" | awk '{print $1}'); \
        password=$(printf '%s\n' "$line" | cut -d' ' -f2-); \
        npx --yes pagecrypt "_site/$file" "_site/$file" "$password"; \
      done < gh-page/_protected_pages.txt; \
    fi

# ---- Serve -----------------------------------------------------------------
FROM nginx:alpine
COPY --from=build /site/_site /usr/share/nginx/html
# Serve under the /Solid.Drive/ prefix to match the WSE reverse proxy
# (https://wse-research.org/Solid.Drive) so the relative asset paths resolve.
COPY gh-page/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
