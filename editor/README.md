# Vigil Office editor service

This builds the actual document editor, independently from the Vigil Office portal. It uses Euro-Office DocumentServer 9.3.6, pinned by image digest, and rebuilds its matching web interface with the upstream-supported `altoffice` theme.

The supplied VigilTech logo and Vigil Office title replace product branding. About retains Euro-Office and Ascensio copyrights, history, AGPL notice, warranty disclaimer, licence links and build commits, and adds the downstream source link. ONLYOFFICE remains in historical and legal notices.

## Reproducible inputs

- Runtime OCI index: `ghcr.io/euro-office/documentserver@sha256:091a4cb09764d49d52eb634698d92f759345c2dba75773d7621475129ea99045`
- [DocumentServer source](https://github.com/Euro-Office/DocumentServer/tree/aeaab98db46218d78a82f3561204f4639835c1c0)
- [Web interface source](https://github.com/Euro-Office/web-apps/tree/ce0ba49545810a56a3878081ab762c6a7ae8dd4e)
- [SDK source](https://github.com/Euro-Office/sdkjs/tree/40d9b7780f11a5cadc259f9b9815a364de8caa96)
- [Server source](https://github.com/Euro-Office/server/tree/044184a530ef3a113e9bb5470825b6e7b939d2d7)

The image's OCI provenance lists its other component revisions. Dockerfile, prepare-theme.mjs and build-web.mjs contain the downstream build changes. The build wrapper serializes upstream phases to reduce peak memory while retaining upstream verification gates. Existing SDK and server binaries come from the pinned official image.

## Railway

Build context repository root, Dockerfile `editor/Dockerfile`, start command `/usr/local/bin/altoffice-start`, health check `/healthcheck`, port 80, one replica, 4 GB RAM and 2 CPUs. Mount a new persistent volume at `/data`. Set `JWT_SECRET` to the portal's existing JWT secret through a Railway variable reference. Keep JWT enabled, JWT_IN_BODY true, and disable examples, admin panel and WOPI. Never generate or log a replacement JWT secret during this migration.

The startup wrapper preserves the embedded database, editor cache and service secrets on that volume. Documents remain in the portal's separate volume. Start the replacement alongside the old editor; verify a real edit, save, reopen and two-user collaboration before changing the portal's DOCS_URL. Keep the old service available until existing editing sessions have completed.
