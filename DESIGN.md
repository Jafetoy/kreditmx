---
name: Kreditmx
description: Editorial financial operations built around clear credit decisions and organized client portfolios.
colors:
  ink: "#17182b"
  paper: "#f1f0e9"
  surface: "#faf9f4"
  acid: "#d8ff36"
  orange: "#ff6b35"
  line: "#cccbc3"
  muted: "#565661"
  success: "#187448"
  warning: "#885e00"
  danger: "#a82e0e"
typography:
  display:
    fontFamily: "Instrument Serif, serif"
    fontSize: "clamp(3rem, 7vw, 7rem)"
    fontWeight: 400
    lineHeight: 0.88
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Instrument Serif, serif"
    fontSize: "clamp(2rem, 4vw, 4rem)"
    fontWeight: 400
    lineHeight: 0.95
  body:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "DM Mono, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0.06em"
rounded:
  none: "0"
  round: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "32px"
  xl: "60px"
components:
  button-primary:
    backgroundColor: "{colors.acid}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "14px 22px"
  button-secondary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "14px 22px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "12px 14px"
    height: "46px"
---

# Design System: Kreditmx

## Overview

**Creative North Star: "Capital in Motion"**

Kreditmx treats financial administration as a living operational ledger: disciplined, immediate, and always moving toward the next sound credit decision. The visual system pairs editorial scale with compact financial metadata so the administrator can identify the primary action, scan portfolio state, and move between clients, loans, payments, and funds without losing context.

The atmosphere is confident rather than corporate. Ink and paper establish trust; acid green signals action and live momentum; orange marks focus, warning, and decisive moments. Density is welcome when it is organized by rules, alignment, and type hierarchy. Decoration never competes with financial information.

**Key Characteristics:**

- Editorial headlines over structured operational grids.
- Flat, square surfaces separated by fine rules.
- Compact monospace labels for metadata and state.
- Acid green reserved for primary action and active navigation.
- Orange reserved for focus, urgency, and intentional emphasis.

## Colors

The palette combines deep ink and warm paper with two high-energy accents that remain rare enough to carry meaning.

### Primary

- **Live Acid**: The primary action color for issuing credit, active navigation, and selected operational states.

### Secondary

- **Decision Orange**: Focus rings, warning emphasis, and high-attention decision points.

### Neutral

- **Ledger Ink**: Primary text, rails, and high-contrast controls.
- **Warm Paper**: The application canvas and main resting surface.
- **Clean Sheet**: Elevated form and table surfaces.
- **Graphite Rule**: Borders, dividers, and structural grid lines.
- **Operational Gray**: Secondary text and supporting metadata.

### Named Rules

**The Signal Rarity Rule.** Acid green marks the strongest action or active state; do not spread it across passive decoration.

**The Two-Accent Rule.** Acid green communicates momentum, while orange communicates attention. Never use them interchangeably.

## Typography

**Display Font:** Instrument Serif (with serif fallback)

**Body Font:** Space Grotesk (with sans-serif fallback)

**Label/Mono Font:** DM Mono (with monospace fallback)

**Character:** Instrument Serif gives financial operations an editorial, human voice. Space Grotesk carries dense interface content, while DM Mono makes labels, identifiers, dates, and compact status information feel precise.

### Hierarchy

- **Display** (400, responsive 3rem–7rem, 0.88): Hero statements and major workflow entry points only.
- **Headline** (400, responsive 2rem–4rem, 0.95): Section openings and authentication titles.
- **Body** (400, 1rem, 1.6): Explanations, instructions, and form content; keep long text near 70 characters per line.
- **Label** (500, 0.6875rem, 0.06em): Short metadata, status, navigation, and table labels. Uppercase is reserved for brief labels, never paragraphs.

### Named Rules

**The Three-Voice Rule.** Serif speaks direction, sans-serif carries work, and monospace reports state.

## Layout

Desktop administration uses a fixed 104px ink rail and a fluid content field with a sticky top bar. The primary credit action appears before portfolio summaries and module navigation. Operational panels use aligned grids, strong column rhythm, and 20–32px internal spacing.

At 900px and below, the rail becomes a compact bottom navigation bar and desktop grids collapse progressively. At 680px, content uses a single-column flow with reduced edge padding. The system supports a minimum width of 320px and must not introduce horizontal page overflow.

**The Action-First Rule.** New credit creation is visually and spatially prior to secondary administration tasks.

## Elevation & Depth

The system is flat by default. Fine borders, ink blocks, color contrast, and spacing establish hierarchy. A single ambient shadow is permitted on isolated authentication or modal surfaces where separation from the canvas is necessary; operational cards and panels stay shadowless.

### Shadow Vocabulary

- **Ambient Overlay** (`0 24px 60px rgba(23, 24, 43, 0.12)`): Authentication cards and isolated overlay surfaces only.

### Named Rules

**The Flat Ledger Rule.** Operational surfaces remain flat at rest; state is expressed through color, borders, and typography rather than decorative elevation.

## Shapes

The form language is rectilinear. Panels, fields, tables, and buttons use square corners, reinforcing the precision of a financial ledger. Fully round geometry is reserved for status dots, avatars, and genuinely circular controls. Borders are one-pixel structural rules, not ornamental outlines.

## Components

### Buttons

- **Shape:** Square and compact, with a minimum 46–48px interactive height.
- **Primary:** Live Acid with Ledger Ink text; use for issuing a new credit or confirming the dominant action.
- **Secondary:** Ledger Ink with Warm Paper text for strong supporting actions.
- **Hover / Focus:** Swap foreground/background with a short 180–200ms transition; focus uses a 2px Decision Orange outline with 3px offset.

### Cards / Containers

- **Corner Style:** Square.
- **Background:** Warm Paper for the canvas; Clean Sheet for contained data and forms.
- **Shadow Strategy:** None on operational surfaces.
- **Border:** One-pixel Graphite Rule.
- **Internal Padding:** 20–32px, reduced only on compact mobile layouts.

### Inputs / Fields

- **Style:** Square, light surface, and a strong bottom rule rather than a rounded control shell.
- **Focus:** Bottom border shifts to Decision Orange with a matching inset rule.
- **Error / Disabled:** Use the semantic danger or muted role without changing layout.

### Navigation

The desktop navigation is an ink rail with concise monospace marks and revealed labels. The active or focused destination uses Live Acid. On mobile, navigation becomes a fixed bottom bar with accessible abbreviated marks and persistent text alternatives.

### Status Metadata

Status uses compact monospace text, semantic color, and thin borders. It must remain readable without relying on color alone.

## Do's and Don'ts

### Do:

- **Do** make the next credit action obvious before secondary portfolio operations.
- **Do** use thin rules and alignment to organize dense financial information.
- **Do** preserve readable contrast and visible keyboard focus on every interactive control.
- **Do** keep mobile navigation compact while retaining accessible names.

### Don't:

- **Don't** add rounded dashboard cards, decorative side tabs, or glowing halos.
- **Don't** use uppercase for sentences or long explanatory text.
- **Don't** use acid green as passive decoration or orange as a substitute for success.
- **Don't** change DOM contracts, field names, calculations, percentages, or workflow behavior to achieve a visual effect.
