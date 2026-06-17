# Design System — Moveable MVP

Extracted from the Healthcare Mobile App Prototype (Figma Make). Use this as the reference when building UI.

---

## Colors

### Primary (Blue)
| Token | Hex | Usage |
|---|---|---|
| `primary-500` | `#1E88E5` | Primary actions, links, active states |
| `primary-600` | `#1565C0` | Hover / pressed states |
| `primary-100` | `#E3F2FD` | Light tinted backgrounds, accent fills |

### Secondary & Semantic
| Token | Hex | Usage |
|---|---|---|
| `teal-500` | `#00897B` | Secondary actions |
| `success` | `#2E7D32` | Success states |
| `warning` | `#ED6C02` | Warning states |
| `error` | `#D32F2F` | Error / destructive states |

### Neutrals
| Token | Hex | Usage |
|---|---|---|
| `neutral-900` | `#111827` | Primary text |
| `neutral-700` | `#374151` | Secondary text |
| `neutral-500` | `#6B7280` | Muted / placeholder text |
| `neutral-200` | `#E5E7EB` | Borders |
| `neutral-100` | `#F3F4F6` | Light backgrounds |
| `white` | `#FFFFFF` | Pure white |

### Backgrounds
| Token | Hex | Usage |
|---|---|---|
| `app-background` | `#F9FAFB` | Page / screen background |
| `card-background` | `#FFFFFF` | Card surfaces |

---

## Typography

**Font family:** Inter (weights: 400, 500, 600) — Google Fonts  
**Fallback stack:** `-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif`  
**Base size:** 16px  
**Rendering:** antialiased

| Style | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| `h1` | 24px | 600 | 32px | Page titles, major headings |
| `h2` | 20px | 600 | 28px | Section headings, card titles |
| `body` | 16px | 400 | 24px | Body text, main content |
| `body-small` | 14px | 400 | 20px | Supporting text, descriptions |
| `caption` | 12px | 500 | 16px | Labels, metadata, badges |
| `button` | 16px | 500 | 24px | Button text |

---

## Spacing

8pt grid system.

| Token | Value | Usage |
|---|---|---|
| `spacing-4` | 4px | Tight gaps |
| `spacing-8` | 8px | Small gaps |
| `spacing-16` | 16px | Card padding, medium gaps |
| `spacing-24` | 24px | Large gaps |
| `spacing-32` | 32px | X-large gaps |
| `spacing-40` | 40px | XX-large gaps |
| `spacing-48` | 48px | Section spacing |

**Layout constants:**
- Screen horizontal margins: `20px`
- Card internal padding: `16px`
- Standard button height: `48px`
- Minimum touch target: `44px` (WCAG AA)

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `radius-small` | 8px | Small elements, chips |
| `radius-card` | 12px | Cards, inputs |
| `radius-button` | 24px | Buttons (pill shape) |

---

## Shadows

| Name | Value | Usage |
|---|---|---|
| `shadow-card` | `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)` | Default card elevation |
| `shadow-elevated` | `0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)` | Modals, popovers |
| `shadow-overlay` | `0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)` | Drawers, overlays |

---

## Components

### Button
Three variants, all pill-shaped (`border-radius: 24px`), height `48px` (default) or `56px` (large).

| Variant | Background | Text | Usage |
|---|---|---|---|
| `primary` | `#1E88E5` | white | Main CTA |
| `secondary` | `#00897B` | white | Secondary actions |
| `text` | transparent | `#1E88E5` | Tertiary / inline actions |

States: hover (darker background), pressed (scale 0.95), disabled (50% opacity, non-interactive).

### VideoCard
Displays exercise videos. Three states:
- **assigned** — white background, default
- **completed** — blue-tinted (`primary-100` background)
- **locked** — gray, non-interactive

Features: thumbnail with play overlay, duration badge, title, sets/reps info.

### ProgressBar
Three variants:
- **linear** — standard 0–100% bar
- **phase** — multi-step phase indicator
- **streak** — gamified streak badge with fire icon

### BottomTabBar
Fixed bottom navigation, 4 items, role-aware (`therapist` | `patient`). Active item highlighted with primary color. Includes safe-area padding for notched devices.

---

## Layout & Responsive

- **Mobile-first**, optimized for iOS, scalable to Android
- **Max-width container:** 512px (`lg`), centered on larger screens
- **Safe area utilities:** `.safe-area-top`, `.safe-area-bottom` for notches / home indicators
- Scrollbars hidden on mobile via `.hide-scrollbar`

---

## Accessibility

- Minimum touch target: **44×44px**
- Focus ring: `2px solid #1E88E5`, offset `2px`
- Minimum body text: **16px**
- Color contrast meets **WCAG AA**
- Semantic HTML, proper heading hierarchy, ARIA labels on icon-only buttons

---

## CSS Variable Reference

All tokens are defined as CSS custom properties and wired into Tailwind via `@theme inline`. The override file is `src/styles/theme.css`; the shadcn baseline is `default_shadcn_theme.css`.

Key mappings for Tailwind usage:
```
bg-primary        → #1E88E5
bg-secondary      → #00897B
bg-background     → #F9FAFB
bg-card           → #FFFFFF
bg-muted          → #F3F4F6
bg-accent         → #E3F2FD
text-foreground   → #111827
text-muted-foreground → #6B7280
border-border     → #E5E7EB
bg-destructive    → #D32F2F
```
