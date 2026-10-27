# Vigil Office editor verification

The portal deployment bdfe3e40 uses Vigil Office branding, but the separate AltOfficeEditor service still deployed 7a5354b3 (Cohnsoft). A real newly created verification document loaded the live Euro-Office editor and exposed “Open Cohnsoft Office Actions”. This PR updates the editor-specific branch from the already-reviewed portal branch's VigilTech overlay; root railway.json remains the editor configuration.

No API, editor SDK, document storage, auth, app/bundle identifiers, filenames or update feeds change. Owned presentation selectors use vt- / --vt-editor-. Legacy inline overlay IDs are removed before reinjection. VigilTech CSS and font bytes remain unchanged; provenance tests check all copied assets. Upstream AGPL and source notices remain.

Portal source bdfe3e40: 22 Bun tests, 323 assertions, production bundle and six-entrypoint/compressed-output test passed locally. Real authenticated Office created a verification document and loaded the editor. The initial live portal text contrast audit checked 85 elements with no computed solid-background failures; this does not yet certify both appearances, gradients or every interaction state.

Previous editor deployment for rollback: c69e85de-7e8f-4015-a0b7-76efe979bd36. Previous portal deployment: e7c09a0f-cb68-45ad-9021-381f5a6f2dcf. The older portal fallback remains 5add1841-3c25-4703-bf5f-9f171f9942f3.

AmerikaDocs is a separate legacy service, not the iframe used by this real Office document. Its failed build stopped at image metadata without a diagnostic error. The pinned upstream image is publicly available (HTTP 200). Its /editor root context and /app/ds/amerika-start.sh command do not match the current root-context editor Dockerfile and /usr/local/bin/altoffice-start. Its existing volume and settings are preserved; no blind redeploy or data migration was performed.
