# Alternative storefront design: "Studio journal"

Branch `feature/alt-design`, taken from `development` on 27 Nov 2026. It started as a trial to compare with the original design. **Abhi chose it on 27 Nov 2026**, and it is now the shop design on `development` (REQ-S9, v1.17).

## How to compare

| | Current design | Alternative |
|---|---|---|
| Branch | `development` | `feature/alt-design` |
| Shop styles | `src/styles/global.css` | `src/styles/shop.css` |

Run `npm run dev` on each branch and look at the home page and a product page, on a phone and a computer. Try the quick view, the enquiry list, the hamper builder and the custom order form; they work the same on both. Add `#preview` to the address to switch festivals.

The admin panel isn't part of the trial. It still uses `global.css` on both branches, so Neha's panel looks the same whichever design is chosen.

## What it is based on

- **Who buys:** mostly women aged 35 to 44 in Sydney, buying gifts. Planters and hampers lead (Instagram audit, Nov 2026).
- **What the research found:** clean product photos do better than covers with text on them, and posts showing Neha making things reach more people than product-only posts. Visitors couldn't tell how to order.
- **Brand:** the logo's ring red, maroon and blush stay (`docs/brand-guidelines.md` on `feature/brand-contrast`). Ring red is still the colour for actions.

## What changes

| Area | Current | Alternative |
|---|---|---|
| Background | White and blush pink | Warm paper (`#fbf7f1`) and linen (`#f4ece2`), so the photos stand out |
| Type | Lora + Nunito Sans | Fraunces (soft serif) + Figtree, with Caveat for short handwritten labels ("Our signature", "Meet the maker") |
| Photo shape | Circles with a thick red ring | Arched "jar window" frames, with a thin maroon outline in the hero |
| Buttons | Pills | Squarer (6 px corners); product cards use outlined "Add" buttons |
| Hero | Circle photo, dots | Arch photo on a blush half-circle, line-style slide markers |
| How ordering works | Near the bottom of the page | Straight after the hero, labelled "No payment online yet" |
| Categories | Seven equal tiles | Planters shown big, hampers as a wide panel, the rest as arches |
| Product cards | Boxed cards, square photos | No box, taller 4:5 photos, category in small capitals, price in serif |
| Shop filters | Pill chips | Category tabs with a red underline; occasions stay as pills |
| About | Centred logo and text | "Meet the maker": two arched product photos, Neha's story, signed "Neha" |
| Section order | Hero, recent, categories, year-end, shop, Instagram, how to order, build, custom, about | Hero, how to order, categories, new pieces, year-end, shop, build, custom, meet the maker, Instagram |

Nothing the scripts rely on was renamed, and there are no changes to the scripts, rules, data or database.

## Checked

- `npm run build` and `npm test` (30 pass, 0 fail).
- Screenshots at 1440 px and 390 px, in light and dark mode, of the home page and a product page.
- Text contrast is at least 4.5:1 for every text colour on every background. The lowest is the grey tagline on paper, at 4.91.

## Open points

- A photo of Neha at work would make "Meet the maker" much stronger. It uses two planter photos for now.
- If this design is chosen, the shop rules left in `global.css` can be removed in a follow-up, and `docs/brand-guidelines.md` updated with the new background colours and fonts.
