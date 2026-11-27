/* Drawn placeholder pictures for products without photos. No browser code here,
   so Astro can use it at build time and the browser scripts can use it too. */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const LEAF = 'M0 0C9-11 25-11 34 0C25 11 9 11 0 0z';
const deco = c => `<g fill="${c}"><path d="${LEAF}" transform="translate(-30 -6) rotate(-30)"/><path d="${LEAF}" transform="translate(-4 8) rotate(20)" opacity=".6"/><circle cx="18" cy="-10" r="6" fill="#e8a7ab"/><circle cx="-24" cy="18" r="4" fill="#6e1f24"/></g>`;
const shapes = {
  candles: a => `<path d="M60 60h80v90a6 6 0 0 1-6 6H66a6 6 0 0 1-6-6z" fill="#fffaf8" stroke="#ead6d4"/><ellipse cx="100" cy="60" rx="40" ry="8" fill="#f5e8e6"/><path d="M100 52v-12" stroke="#5a3a3a" stroke-width="2"/><path d="M100 22c6 8 6 14 0 18c-6-4-6-10 0-18z" fill="#f0a040"/><g transform="translate(100 108)">${deco(a)}</g>`,
  tealights: a => `<path d="M68 80h64l-6 66H74z" fill="#ffffff" fill-opacity=".85" stroke="#dcc8c6"/><ellipse cx="100" cy="80" rx="32" ry="6" fill="#f5e8e6"/><path d="M100 60c5 7 5 12 0 16c-5-4-5-9 0-16z" fill="#f0a040"/><g transform="translate(100 115) scale(.85)">${deco(a)}</g>`,
  vases: a => `<path d="M88 34h24v14c18 10 26 30 22 56c-3 24-14 42-34 42s-31-18-34-42c-4-26 4-46 22-56z" fill="#fffaf8" stroke="#e1cfcd"/><path d="M80 70l10 8M118 92l10-6M86 120l8 6" stroke="#cdb6b3"/><g transform="translate(100 98)">${deco(a)}</g>`,
  jars: a => `<rect x="62" y="40" width="76" height="16" rx="5" fill="#c9a07b"/><path d="M58 58h84v84a12 12 0 0 1-12 12H70a12 12 0 0 1-12-12z" fill="#fffaf8" stroke="#e1cfcd"/><g transform="translate(100 104)">${deco(a)}</g>`,
  planters: a => `<path d="M84 64c-14-20-6-34 10-36c-2 14 2 24 6 36zM116 64c14-20 6-34-10-36c2 14-2 24-6 36z" fill="#5f7d55"/><rect x="56" y="62" width="88" height="14" rx="4" fill="#ecdcd8"/><path d="M62 76h76l-10 74H72z" fill="#fffaf8" stroke="#e1cfcd"/><g transform="translate(100 112)">${deco(a)}</g>`,
  decor: a => `<rect x="40" y="128" width="120" height="14" rx="5" fill="#ecdcd8"/><path d="M56 70h28v58H56z" fill="#fffaf8" stroke="#e1cfcd"/><rect x="62" y="58" width="16" height="12" fill="#c9a07b"/><path d="M66 58v-10h14" stroke="#c9a07b" stroke-width="4" fill="none"/><path d="M96 84h28l-4 44h-20z" fill="#fffaf8" stroke="#e1cfcd"/><g transform="translate(70 100) scale(.55)">${deco(a)}</g><g transform="translate(110 108) scale(.5)">${deco(a)}</g><ellipse cx="142" cy="126" rx="14" ry="4" fill="${a}"/>`,
  /* chocolates and condiments (REQ-H12): a gift box with a bow */
  treats: a => `<rect x="52" y="78" width="96" height="66" rx="6" fill="#fffaf8" stroke="#e1cfcd"/><rect x="46" y="64" width="108" height="20" rx="5" fill="#8a5a3c"/><rect x="92" y="64" width="16" height="80" fill="${a}"/><path d="M100 64c-14-20-34-8-20 0zM100 64c14-20 34-8 20 0z" fill="${a}"/><circle cx="72" cy="112" r="7" fill="#8a5a3c"/><circle cx="128" cy="112" r="7" fill="#8a5a3c"/>`,
  hampers: a => `<path d="M60 60c0-40 80-40 80 0" fill="none" stroke="#a87b52" stroke-width="6"/><rect x="74" y="54" width="20" height="30" rx="3" fill="#fffaf8" stroke="#e1cfcd"/><rect x="100" y="48" width="24" height="36" rx="4" fill="#fffaf8" stroke="#e1cfcd"/><path d="M44 80h112l-12 70H56z" fill="#d1a678"/><path d="M50 100h100M53 120h94M55 138h90" stroke="#a87b52" stroke-width="3"/><path d="M90 84l10 14 10-14" fill="${a}"/><circle cx="100" cy="86" r="5" fill="${a}"/>`
};
/* Photo addresses and colours come from the database (set in the admin panel), so they
   are checked before going into HTML: a photo must be a site path (/images/...) or an
   https:// address, and a colour must be a #hex value. Anything else falls back. */
export const safeImg = u => (typeof u === 'string' && (/^\/(?!\/)/.test(u) || /^https:\/\//i.test(u)) ? u : null);
const safeCol = (c, d) => (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : d);
/* An unknown category (one added later) gets the jar drawing rather than breaking the page. */
export const pic = (cat, bg, a, label) => `<svg viewBox="0 0 200 180" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(label || 'Illustration of ' + cat)}"><rect width="200" height="180" fill="${safeCol(bg, '#fbefee')}"/>${(shapes[cat] || shapes.decor)(safeCol(a, '#c0403a'))}</svg>`;
export const imgOf = (p, lazy = true) => safeImg(p.img) ? `<img src="${esc(safeImg(p.img))}" alt="${esc(p.name)}"${lazy ? ' loading="lazy"' : ''}>` : pic(p.cat, ...(Array.isArray(p.col) ? p.col : []), p.name);
