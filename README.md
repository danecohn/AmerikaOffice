# AltStack Office

**AltStack LLC · An alternative stack for everyone.**


AltOffice is the AltStack LLC fork/integration of **Euro-Office** for
AltStack Desktop. Its document, spreadsheet and presentation apps are Paper, Digits and
Slides. The desktop upstream is pinned in `upstream/euro-office.lock.json`;
`scripts/checkout-euro-office.py` checks out that source and applies the downstream
company/product build branding. It does not fetch ONLYOFFICE as the direct upstream.
Euro-Office's upstream copyright, attribution and AGPL notices remain intact.

The installed ARM64 preview currently uses Euro-Office Desktop Editors 9.3.5-2
with launch integration; a complete new native source build has not yet been
validated. Run the checkout script with a new destination and `--with-submodules`
to prepare a source build. Do not describe the existing Electron hosted-service
client as the native offline editor.

The hosted editor Dockerfile now selects Euro-Office Document Server 9.3.1.
Migrating an existing service requires backing up its documents, runtime secrets
and volumes, and testing callbacks and reopening before deployment. This source
change does not migrate a running service or its old volume layout.

---


AltStack LLC’s self-hosted workspace for documents, spreadsheets and presentations. The charcoal-and-crimson portal uses Euro-Office Document Server and retains the editor’s branding and legal notices.

## What works

- Public sign-in and account creation through Amerika Social’s browser approval flow. Office immediately revokes the temporary Social token and maintains its own seven-day session. Social passwords and access tokens are not stored in Office.
- Private DOCX, XLSX and PPTX creation, document uploads, download, rename and deletion.
- Expiring seven-day invitation links with view or edit access. Accepted membership persists until the owner revokes sharing. Revocation stops future opens; it does not close already-open editors or recall downloaded copies.
- Live co-editing through a self-hosted Euro-Office Document Server instance, signed editor configs and callbacks, persistent file storage, saved version downloads, and explicit storage limits.

## Run

Install Bun 1.4.3 or later, then:

```sh
bun test
bun run build
export OFFICE_SECRET="$(openssl rand -hex 32)"
export JWT_SECRET="the same long random secret configured on the document server"
export PUBLIC_ORIGIN="http://localhost:3000"
export DOCS_URL="https://your-document-server.example"
bun start
```

`DATA_DIR` defaults to `./data`. Deploy the included Dockerfile to Railway with one persistent volume at `/data`. The health check is `/healthz`. Keep exactly one replica: this release uses SQLite and local persistent files. The Docker container runs as root to initialize Railway’s root-owned mounted volume.

Use the official `ghcr.io/euro-office/documentserver:9.3.1` image for a separate editor service, with JWT enabled and the matching `JWT_SECRET`. Set `JWT_IN_BODY=true`, `EXAMPLE_ENABLED=false`, `ALLOW_PRIVATE_IP_ADDRESS=false`, and `ALLOW_META_IP_ADDRESS=false`. Mount editor cache persistently at `/var/lib/euro-office/documentserver`, use two nginx workers with 1024 connections, and provision at least 4 GB RAM. Public HTTPS origins are used for file transfer. `/healthcheck` should return `true` and unsigned conversion requests should be rejected. If the image does not publish the exact tag for your platform, pin a verified image digest from the deployed release.

### Configuration

| Variable | Purpose |
| --- | --- |
| `PUBLIC_ORIGIN` | Exact HTTPS origin; required for cookies, CSRF checks, callbacks and download links |
| `DOCS_URL` | Public HTTPS origin of your own ONLYOFFICE Docs service |
| `OFFICE_SECRET` | Independent random secret of at least 32 characters for scoped file/callback grants |
| `JWT_SECRET` | Editor signature secret shared with ONLYOFFICE Docs |
| `DATA_DIR` | Persistent directory, `/data` on Railway |
| `SOCIAL_ORIGIN` | Defaults to `https://www.amerika.social` |
| `MAX_FILE_BYTES` | Default 25 MiB per file |
| `USER_QUOTA_BYTES` | Default 100 MiB per account, including retained versions |
| `TOTAL_QUOTA_BYTES` | Default 4 GiB for the whole service |

Only native OOXML files are opened for editing in this first release. Other accepted formats open for viewing and download. Version snapshots are taken on editor save callbacks; they do not promise every keystroke. Deletion removes all versions from active storage. Office does not silently create off-site backups: configure and test volume backups through Railway before relying on the service for irreplaceable work.

## Security and operations

Same-origin changes, HttpOnly/Secure cookies on HTTPS, account and file authorization, HMAC-signed editor configuration, signed callback verification, exact editor-origin download allowlisting, bounded uploads, and storage limits are implemented and tested. Public registration inherits Amerika Social’s CAPTCHA and account rules. Its current browser pairing API applies upstream rate limits to the Office server’s outbound IP; large-scale sign-in traffic needs a dedicated OAuth integration.

Do not change either signing secret casually while editors are open. Do not scale replicas above one or change storage backends without adapting locking and storage. Configure a custom domain by setting `PUBLIC_ORIGIN` to its exact HTTPS origin and attaching its DNS record in Railway.

## License and attribution

Portal source: AGPL-3.0-only. See `LICENSE`. ONLYOFFICE is a separate unmodified service with its own AGPL license and notices; its editor branding is retained. Full editor white-labeling requires the appropriate commercial license from ONLYOFFICE. Inter: SIL Open Font License (`public/Inter-OFL.txt`). Templates are original empty files generated for AltStack LLC by `scripts/create-templates.py`.
