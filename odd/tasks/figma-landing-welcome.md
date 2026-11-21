# Figma corporate welcome landing

Objective: Replace the minimal public landing at `/` with the Figma Make `Welcome` screen, preserving every Flask route, endpoint, form, DOM contract and business rule.
Branch: `figma-visual-redesign`. Delivery strategy: `single-pr` (local commits only; no push, PR or deploy). Test runner: Flask route smoke checks, structural checks, Chromium desktop/mobile checks. Forecast: approximately 450 authored changed lines.

## Specs

S1. Apply the Figma `Welcome` landing composition and its exact copy, including: "PLATAFORMA DE ADMINISTRACIÓN CREDITICIA", "KREDITMX / PORTAL CORPORATIVO", "Una visión clara.", "Mejores decisiones.", "Centraliza la gestión de tu cartera, supervisa el capital y da seguimiento a cada crédito desde un solo lugar.", "Acceder al panel", "Consultar formulario del solicitante", "Entorno de trabajo exclusivo para personal autorizado.", "VISIÓN EJECUTIVA", "Resumen de capital", "Capital disponible", "$426,800.00", "PESOS MEXICANOS · MXN", "Disponibilidad del fondo", "25%", "Solicitudes por revisar", "Clientes activos", "Cartera activa · MXN", "Información de referencia para la operación diaria.", "Control de cartera", "Gestión de clientes", "Visibilidad del capital", "KREDITMX® / USO EXCLUSIVO DE ADMINISTRACIÓN", "ACCESO ADMINISTRATIVO", "GESTIÓN CON VISIÓN."

S2. Keep both existing destinations working from the landing: "Acceder al panel" → `/login`, "Consultar formulario del solicitante" → `/registro`. Leave `app.py` `inicio()` at line 1504 unchanged (`send_from_directory(".", "index.html")`). Do not add, remove or rename any endpoint, calculation, percentage, DB column, form name or DOM ID used by scripts.

S3. Preserve the Figma scoped palette and responsive behavior: `.kw-page` tokens `#0f1b35`, `#a9e925`, `#b5f34b`, `#426d16`, `#f7f9f3`; the `@media (max-width: 900px)` and `@media (max-width: 640px)` rules from the supplied `index.css`; and `prefers-reduced-motion` handling.

S4. Verify `/` renders the landing, both CTA links resolve, desktop 1440px and mobile 390px/320px have no horizontal overflow, no console errors, and no tracked DOM ID or form name is removed.

## Tasks

- T1 — S1-S4 — route: inline (one static landing surface: `index.html`, one scoped CSS file, one theme import; no independent write unit) — status: complete — risk: none (presentation-only; no endpoint, calculation or persisted data touched) — commit: pending — verification: 4 landing tests OK, full suite 23/23 OK, Flask smoke 200 for `/`, `/login`, `/registro` and both stylesheets, zero overflow and zero clipped text at 1440/390/320px, both CTAs navigated to their expected routes in Chromium

## Log

L1 — 2026-11-21 — User request (verbatim): "Aplica la landing page, que te di en el link de figma.https://www.figma.com/make/SnDNrlG440K39P1zSG6fnG/Redise%C3%B1o-del-panel-Kreditmx?t=62wr64WSW8UdNrFZ-1"

L2 — 2026-11-21 — User selection (verbatim): "Pegar código de Make". The user then supplied the Figma Make `index.css` and `KreditExperience.tsx` in chat.

L3 — 2026-11-21 — Evidence: the supplied source defines the landing as the `Welcome` React component and the `.kw-page`, `.kw-header`, `.kw-hero`, `.kw-visual`, `.kw-ticket`, `.kw-capabilities`, `.kw-footer` CSS block, explicitly "Corporate welcome; intentionally scoped away from the operational workspace." The Figma URL itself returns HTTP 403 with a login wall in this runtime.

L4 — 2026-11-21 — Scope decision: apply only the `Welcome` landing. The dashboard, new-credit modal, and applicant form from the same source are already implemented in `odd/tasks/figma-visual-redesign.md`. All figures on the landing are Figma reference content, not live system data; `/api/sesion` and `/api/fondo` require login, so no endpoint or backend call is added.

L5 — 2026-11-21 — Implementation approach: keep `index.html` at the repository root so the existing `inicio()` route is untouched; map the Figma `onEnter`/`onClient` handlers to the existing `/login` and `/registro` anchors; drop the unused legacy `css/admin.css` link from this page only.

L6 — 2026-11-21 — RED observed first: `tests/test_landing_welcome.py` failed in `setUp` because `css/figma-welcome.css` did not exist. After implementation all 4 landing tests passed and the full suite reached 23/23 OK. One mid-implementation FAIL from a wrapped paragraph was fixed by keeping the exact Figma copy on one line, then re-run to GREEN.

L7 — 2026-11-21 — Chromium QA at 1440px, 390px and 320px: zero horizontal overflow, zero clipped text among all headings/body/ticket/capability/footer nodes, no `.kw-copy`/`.kw-visual` overlap. Computed values matched the supplied Figma source: page background `rgb(247, 249, 243)`, headline font Space Grotesk, serif emphasis Instrument Serif, emphasis color `rgb(66, 109, 22)`, primary CTA `rgb(169, 233, 37)`. Clicking the two CTAs navigated to `/login` and `/registro` respectively. Full accessibility snapshot contained the complete landing structure.

L8 — 2026-11-21 — Fix found during QA: removing the legacy `css/admin.css` link exposed the browser default 8px body margin, so `body { margin: 0; min-width: 320px; }` from the supplied Figma base rules was added to `css/figma-welcome.css` and pinned by a test assertion; header and footer then measured x=0 with full viewport width. The only browser console error is the pre-existing `favicon.ico` 404, also present on the login page before this change.
