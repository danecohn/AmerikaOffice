# Rebuild Euro-Office's web interface from the source used by the pinned image.
FROM node:22-bookworm AS web-build
RUN apt-get update && apt-get install -y --no-install-recommends python3 openjdk-17-jre-headless brotli bzip2 zip ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git init && git remote add origin https://github.com/Euro-Office/web-apps.git && git fetch --depth=1 origin ce0ba49545810a56a3878081ab762c6a7ae8dd4e && git checkout --detach FETCH_HEAD
WORKDIR /src/build
RUN npm ci
COPY editor/prepare-theme.mjs /tmp/prepare-theme.mjs
COPY editor/build-web.mjs /tmp/build-web.mjs
COPY editor/finalize-interface.mjs /tmp/finalize-interface.mjs
COPY editor/brand /tmp/brand
RUN node /tmp/prepare-theme.mjs /src
WORKDIR /src/translation
RUN python3 merge_and_check.py
WORKDIR /src/build
ENV THEME=altoffice PRODUCT_VERSION=9.3.6 BUILD_ROOT=/out BUILD_NUMBER=0
ENV BUILD_COMMITS="DocumentServer=aeaab98db46218d78a82f3561204f4639835c1c0 web-apps=ce0ba49545810a56a3878081ab762c6a7ae8dd4e"
RUN NODE_OPTIONS=--max-old-space-size=3072 node /tmp/build-web.mjs

FROM ghcr.io/euro-office/documentserver@sha256:091a4cb09764d49d52eb634698d92f759345c2dba75773d7621475129ea99045
USER root
COPY --from=web-build /out/web-apps/ /var/www/euro-office/documentserver/web-apps/
COPY editor/start.sh /usr/local/bin/altoffice-start
RUN chmod 755 /usr/local/bin/altoffice-start
LABEL org.opencontainers.image.title="AltOffice Editor" org.opencontainers.image.source="https://github.com/danecohn/AmerikaOffice" org.opencontainers.image.licenses="AGPL-3.0-only"
ENV JWT_ENABLED=true JWT_IN_BODY=true EXAMPLE_ENABLED=false ADMINPANEL_ENABLED=false WOPI_ENABLED=false ALLOW_PRIVATE_IP_ADDRESS=false ALLOW_META_IP_ADDRESS=false NGINX_WORKER_PROCESSES=2 NGINX_WORKER_CONNECTIONS=1024
ENTRYPOINT ["/usr/local/bin/altoffice-start"]
