# Figma Solicitudes + notification bell

Objective: add a notification bell to the admin header and a "Solicitudes" sidebar item plus a dedicated screen showing newly arrived clients, using the Figma styles already implemented in the repository. Branch: `figma-visual-redesign`. Delivery: one local work-unit commit; no push. Test runner: `.venv/Scripts/python.exe -m unittest discover -s tests -v`.

## Specs

S1. The admin header must show a notification bell icon with a count badge driven by `pendientes + en_revision` from `/api/admin/resumen`; activating it opens the Solicitudes module. The bell must remain visible at desktop and mobile widths.

S2. The admin sidebar must contain a new button labeled exactly "Solicitudes", with a bell/document SVG icon and `aria-label="Solicitudes"`, wired to `mostrarModulo('solicitudes')`. It must be placed near the top so new arrivals are reachable quickly.

S3. Add a new `<section id="modulo-solicitudes" class="panel modulo-panel" data-modulo="solicitudes">` screen with a Figma-styled list of clients whose `estado` is `PENDIENTE` or `EN_REVISION`, sorted newest first, each row exposing name, status, arrival time, document hints, and a direct action to `/cliente?id=<id>`. Include a counter and an explicit empty state.

S4. Render and count that list from the already-fetched `/api/clientes` and `/api/admin/resumen` payloads in `js/admin.js`; reuse existing helpers (`kxEscapar`, `kxIniciales`, `kxTiempoRelativo`, `kxNumero`). Do not add backend routes, schema changes, stored-data changes, or new dependencies. Preserve every existing DOM ID, form name, module, and route.

S5. Verify with structural unit tests plus a browser DOM check of `/admin` (session permitting) at desktop and mobile widths: the bell and badge render, the sidebar item and panel exist, the panel lists only pending/in-review clients, and no existing module or console behavior regresses.

## Tasks

- T1 — S1-S3 — route: inline — status: pending — commit: pending
- T2 — S4-S5 — route: inline — status: pending — commit: pending

Route evidence: no Writer trigger (one bounded feature, no independent parallel units); parent works inline following this logbook. No high-risk item: no data, security, contract, concurrency, or delivery change is introduced.

## Log

L1 — 2026-11-21 — User request (verbatim): "https://www.figma.com/make/SnDNrlG440K39P1zSG6fnG/Redise%C3%B1o-del-panel-Kreditmx?p=f&t=62wr64WSW8UdNrFZ-0 (que aparezca tambien el logo de notificaciones y agrega una nueva pantalla y un nuevo elemento a la barra lateral que diga solicitudes para poder ver quienes nuevos clientes han llegado y poder visualizarlo mas rapido y de mejor manera."

L2 — 2026-11-21 — The Figma Make link returns HTTP 403 (login wall), as in earlier sessions. User chose "Usar estilos Figma del repo": implement with the Figma tokens, components, and patterns already present in `css/figma-*.css`.

L3 — 2026-11-21 — Explored the admin shell: `templates/admin.html` has `.kx-admin-rail` buttons calling `mostrarModulo(...)` and seven `section.modulo-panel` panels; `js/admin.js` `cargarDatosMariaDB()` already fetches `/api/admin/resumen`, `/api/prestamos/activos`, and `/api/clientes`, and `renderizarDecisiones()` already filters `PENDIENTE`/`EN_REVISION` for the dashboard. The new screen reuses that payload and those helpers; no backend change is needed.

L4 — 2026-11-21 — Workspace contains unrelated uncommitted user work in `templates/admin.html`, `js/admin.js`, `css/figma-responsive.css`, and others. Only the hunks for this feature will be staged, using partial patches where a file is already modified.
