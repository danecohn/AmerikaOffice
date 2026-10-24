# AltOffice editor service

Build this directory as the AmerikaDocs service. It wraps Euro-Office Document Server 9.3.1 without changing editor branding or application code.

Mount `/var/lib/euro-office/documentserver` persistently, set the shared JWT secret, keep JWT enabled, disable the unauthenticated example and WOPI, and use public HTTPS file endpoints. The wrapper retains runtime keys inside the same cache volume and removes Debian's conflicting default nginx virtual host before upstream starts.

Railway health check: `/healthcheck`; container port: `80`; at least 4 GB RAM. Use one replica. The document portal lives in the repository root and uses a separate volume at `/data`.
