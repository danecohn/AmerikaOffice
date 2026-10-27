# Cohnsoft Office Companion interface

Cohnsoft's original editor presentation and command workflow, applied at build time to pinned Euro-Office sources. The web editor and native offline host consume the same `companion.css` and `companion.js` files. Mobile Framework7 surfaces use `companion-mobile.css`.

Changes include neutral glass-style header and toolbar surfaces, clear blue action emphasis, pill-shaped editing tabs, quieter inspectors, rounded native-style menus and dialogs, system typography, scalable mobile inputs, and reduced-motion support. Document canvas geometry, file conversion, co-editing, permissions, save behavior and upstream notices remain controlled by the existing editor.

Actions opens from the header or Command/Control–Option/Alt–K (the existing page-number shortcut remains available). It searches currently available editor controls and dispatches to the existing controls; unavailable commands are omitted. It never reads document contents or makes network requests. Escape closes the dialog, focus returns to the editor, and arrow keys/Enter navigate results.

`prepare-theme.mjs` fails when expected entrypoints or pinned build integration points change. Re-run the source preparation and production build after upstream updates; verify an actual document, spreadsheet and presentation in both viewing and editing modes before claiming full UI acceptance.
