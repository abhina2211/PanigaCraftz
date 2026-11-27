# PanigaCraftz brand guidelines

The colours and type come from the logo (`public/images/logo.png`): a red ring, maroon lettering, blush paper leaves on white, and the tagline "Be Crafty".

The colours live in code in `src/styles/global.css` (`:root`). This page records what they mean. If you change a colour, change it there and update this page.

## Voice

Warm, handmade and about giving gifts: a small studio's shop window. The look is decoupage, with paper leaves layered on glass, wax and wood, like the leaf sprig in the logo.

## Core colours

These don't change between light and dark mode, except grey.

| Name | CSS variable | Hex | Where it comes from | Used for |
|------|--------------|-----|---------------------|----------|
| Ring red | `--red` | `#c0403a` | Logo ring | Main buttons, focus ring, active carousel dot, bag count, progress bars, checked options, browser `theme-color` |
| Maroon | `--maroon` | `#6e1f24` | Logo lettering | Top announcement bar, text on light buttons, warm shadows |
| Blush | `--blush` | `#e8c4c6` | Logo leaves | Inactive carousel dots, highlighted words in the maroon bar |
| Grey | `--grey` | `#736a6c` (dark mode `#8a8183`) | Logo tagline, darkened for readability | "Be Crafty" tagline under the logo, admin chevrons |
| White | — | `#ffffff` | Logo background | Background, text on red and maroon |

## Colours for each theme

These are written as `light-dark(light, dark)`, so each one has a value for light mode and one for dark mode.

| Role | CSS variable | Light | Dark |
|------|--------------|-------|------|
| Page background | `--bg` | `#ffffff` | `#1b1213` |
| Soft panel (hero, hover, image wells) | `--soft` | `#fbefee` | `#271a1b` |
| Card | `--card` | `#ffffff` | `#2a1c1e` |
| Text | `--ink` | `#2b1b1c` | `#f6ecea` |
| Muted text | `--mute` | `#6d5a5b` | `#c9b6b5` |
| Lines and borders | `--line` | `#f0dcdb` | `#3d2a2c` |
| Red text and links | `--red-ink` | `#a8323a` | `#f08f88` |
| Blush background | `--blushbg` | `#f8e4e4` | `#33211f` |

Use `--red-ink`, not `--red`, for red text, because it stays readable in dark mode.

## Status colours

These are used for stock labels and errors in the shop and the admin panel.

| Meaning | Text | Background |
|---------|------|------------|
| In stock | `#22663d` | `#e6f2ea` |
| Made to order | `#8a5200` | `#fdf0dc` |
| Sold out | `#5f5f5f` | `#eeeeee` |
| Error | `#b3261e` | (page background) |

## Category picture colours

Category pictures without a photo use a background and a drawing colour (`catPic` in `src/pages/index.astro`).

| Category | Background | Drawing |
|----------|------------|---------|
| Candles, vases, hampers | `#f8e4e4` blush | red or maroon |
| Tealights, jars | `#f3e6dc` warm beige | maroon or red |
| Decor | `#e3eaf5` pale blue-grey | red |

## Type

- **Headings:** Lora, weights 500 and 600. It's a serif close to the logo's lettering.
- **Body and buttons:** Nunito Sans, weights 400, 600 and 800.
- Both are loaded from Google Fonts in `src/layouts/Base.astro`.

## Contrast check

These are WCAG contrast ratios, checked on 27 Nov 2026. Normal-size text needs 4.5 or more.

| Pair | Ratio | Result |
|------|-------|--------|
| White on ring red (buttons) | 5.20 | Pass |
| Red text on white | 6.60 | Pass |
| Text on white | 16.45 | Pass |
| Muted text on soft panel | 5.72 | Pass |
| White on maroon (bar) | 11.14 | Pass |
| Blush on maroon | 6.97 | Pass |
| Dark mode: red text on background | 7.87 | Pass |
| Dark mode: muted text on background | 9.49 | Pass |
| In stock / made to order labels | 6.01 / 5.68 | Pass |
| Grey tagline on white (13px) | 5.24 | Pass (was 3.78 with `#8a8183`) |
| Dark mode: grey tagline on background | 4.86 | Pass |
| Sold out label (12px) | 5.50 | Pass (was 3.86 with `#777777`) |

## Rules

- Don't introduce new reds or pinks. Use the variables above.
- Write colours as CSS variables, not hex values in the markup. Exceptions today: `theme-color` in `Base.astro` and `catPic` in `index.astro`.
- Ring red is for actions and highlights. Large blocks of colour use maroon (the bar) or soft blush (panels).
