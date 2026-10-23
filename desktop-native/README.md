# AltOffice native desktop releases

AltOffice uses the open source Euro-Office editors with the Euro-Office Lite
desktop host, pinned to `41558fdbff7b5248f5f302b3b2b6a189178a447f`.
This provides local editing, opening and saving for documents, spreadsheets and
presentations on Windows x64/ARM64, macOS Intel/Apple Silicon and Linux x64/ARM64.
The hosted AltOffice collaboration service is separate from local editing.

The workflow builds the pinned upstream sources with `prepare.py` as the complete
downstream overlay, retaining licenses and upstream notices. It publishes six
installers and checksums after all six jobs finish, under `altoffice-desktop-v0.2.0`.

Upstream: https://github.com/delmarguillen/euro-office-lite/tree/41558fdbff7b5248f5f302b3b2b6a189178a447f

License: GNU AGPL-3.0. The editor submodules come from Euro-Office. The upstream
host bundles unmodified x2t converters from ONLYOFFICE under AGPL-3.0; its pinned
download scripts check SHA-256 and its README lists corresponding source tags.
Those components and their original copyright and license notices are preserved.
The Windows ARM64 app uses the upstream x64 converter through Windows emulation.

These are early access builds. Windows packages are unsigned; macOS packages are
ad-hoc signed, without an AltStack Apple Developer certificate or notarization.
Upstream currently supports English/Spanish spell checking by default and does
not yet open plain TXT/CSV through an encoding dialog. DOCX/XLSX/PPTX and common
OpenDocument formats use the local editor/converter, without a cloud upload.
