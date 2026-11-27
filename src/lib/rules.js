/* PanigaCraftz business rules, shared by every screen that takes an order.
   Kept free of page code: Astro pages, browser scripts and the tests in tests/
   all import this file, and the rules match the database checks in supabase/schema.sql.

   REQ-P1..P4  per-product personalisation flag and word limit
   REQ-H1..H5  custom hampers may only contain pieces that are in stock
   REQ-H6      hamper sizes: the number of pieces picks Small, Medium or Large
   REQ-H12     chocolates and condiments are only sold inside hampers
   (see docs/requirements.md) */
import { PRODUCTS, BASES, PERS_DEFAULT, HAMPER_BUILDER, CATEGORIES } from '../data/catalogue.js';

export const byId = id => PRODUCTS.find(p => p.id === id);

/* Products in a hamper-only category (REQ-H12) never show in the shop and can't be
   ordered on their own. */
export const hamperOnly = p => !!(p && CATEGORIES.some(c => c.id === p.cat && c.hamperOnly));
export const onShop = p => !!p && !hamperOnly(p);

/* Words are runs of non-space characters, so "Ms Lee" is 2 and "Happy-Diwali!" is 1.
   The database uses the same rule (pc_word_count). */
export const wordCount = s => { const t = String(s ?? '').trim(); return t ? t.split(/\s+/).length : 0; };

/* Personalisation settings for a product, or null when it can't be personalised.
   pers: true uses the default; pers: { label, words } sets them per product. */
export const persOf = p => {
  if (!p || !p.pers) return null;
  return Object.assign({}, PERS_DEFAULT, p.pers === true ? {} : p.pers);
};

/* Check personalisation text against the product's word limit. Empty text is allowed
   (personalisation is optional). */
export function checkPers(p, text) {
  const cfg = persOf(p), words = wordCount(text);
  if (!words) return { ok: true, words, limit: cfg ? cfg.words : 0 };
  if (!cfg) return { ok: false, words, limit: 0, msg: `${p ? p.name : 'This piece'} can't be personalised.` };
  if (words > cfg.words) return { ok: false, words, limit: cfg.words, msg: `Please keep it to ${cfg.words} word${cfg.words === 1 ? '' : 's'} (you have ${words}).` };
  return { ok: true, words, limit: cfg.words };
}

/* ---------- custom hampers and inventory ---------- */
/* A piece can go in a custom hamper when it is marked hamper: true and has something to
   count: ready-made stock, or a blank base it can be made on (REQ-H1, REQ-B4). */
export const hamperEligible = p => !!(p && p.hamper && (typeof p.stock === 'number' || p.base) && p.price != null);
const baseOf = p => p && p.base ? BASES.find(b => b.id === p.base) : null;
/* Pieces inside a ready-made hamper (REQ-H8), or none. */
export const piecesOf = p => (p && !p.builder && Array.isArray(p.pieces) ? p.pieces : []);
/* A piece limits a hamper only when its stock is counted or it is made on a base. */
const counted = p => !!(p && (typeof p.stock === 'number' || baseOf(p)));

/* What is left after the hamper lines in the enquiry list (other than excludeKey) take
   their pieces: ready-made pieces first, then blanks from the piece's base, the same
   order the database uses. Ready-made hampers take the pieces they list (REQ-H8). Lines
   for single pieces are not counted: those are enquiries Neha confirms herself (REQ-H7). Returns { ready: {productId: n}, blanks: {baseId: n} }. */
export function stockLeft(bag, excludeKey) {
  const ready = {}, blanks = {};
  PRODUCTS.forEach(p => { if (typeof p.stock === 'number') ready[p.id] = p.stock; });
  BASES.forEach(b => { blanks[b.id] = b.stock; });
  (bag || []).forEach(l => {
    if (l.key === excludeKey) return;
    const items = l.opts && Array.isArray(l.opts.items) ? l.opts.items : piecesOf(byId(l.id));
    items.forEach(it => { if (counted(byId(it.id))) take(it.id, it.qty * l.qty, ready, blanks); });
  });
  return { ready, blanks };
}
/* Take n units of a piece from what is left; returns how many could not be found. */
function take(id, n, ready, blanks) {
  const p = byId(id);
  const fromReady = Math.min(ready[id] || 0, n);
  ready[id] = (ready[id] || 0) - fromReady;
  let short = n - fromReady;
  const b = baseOf(p);
  if (short > 0 && b) { const fromBase = Math.min(blanks[b.id] || 0, short); blanks[b.id] -= fromBase; short -= fromBase; }
  return short;
}

/* How many more units of a piece can go into hampers: ready-made plus blanks on its base. */
export const available = (id, bag, excludeKey) => {
  const p = byId(id);
  if (!hamperEligible(p)) return 0;
  const { ready, blanks } = stockLeft(bag, excludeKey);
  const b = baseOf(p);
  return Math.max(0, (ready[id] || 0) + (b ? blanks[b.id] || 0 : 0));
};

/* ---------- hamper sizes (REQ-H6) ---------- */
/* Sizes from smallest to largest; the live list comes from the hamper_sizes table. */
const sizes = () => [...HAMPER_BUILDER.sizes].sort((a, b) => a.min - b.min);
/* Fewest and most pieces any size takes. */
export const hamperLimits = () => { const s = sizes(); return { min: s[0].min, max: Math.max(...s.map(x => x.max)) }; };
/* The size a hamper with this many pieces is, or null when no size takes that many. */
export const hamperSize = pieces => sizes().find(s => pieces >= s.min && pieces <= s.max) || null;
/* The next size up from this many pieces, or null at the largest. */
export const nextHamperSize = pieces => sizes().find(s => s.min > pieces) || null;
/* Wrapping and card, the same for every size: the builder product's price. */
export const wrapFee = () => PRODUCTS.find(p => p.builder)?.price ?? 0;
/* Basket plus wrapping for a hamper with this many pieces. Below the smallest size it
   shows the smallest basket, since that is where the customer is heading. */
export const hamperFee = pieces => wrapFee() + (hamperSize(pieces) || sizes()[0]).basket;
/* Lowest fee, shown as the builder's "From" price (pieces are added on top). The server
   product page passes its own live wrap fee and sizes, since it doesn't change the shared lists. */
export const hamperFromPrice = (wrap = wrapFee(), list = HAMPER_BUILDER.sizes) => wrap + Math.min(...list.map(s => s.basket));
const pieceCount = items => (items || []).reduce((s, it) => s + (it && it.qty > 0 ? it.qty : 0), 0);

/* Check a hamper (items = [{id, qty}]) ordered hamperQty times, against stock and the
   other hamper lines already in the enquiry list. Designs sharing a base share its blanks. */
export function checkHamper(items, hamperQty, bag, excludeKey, note) {
  const errors = [];
  const list = (items || []).filter(it => it && it.qty > 0);
  const pieces = pieceCount(list);
  const { min, max } = hamperLimits();
  if (pieces < min) errors.push(`Choose at least ${min} pieces.`);
  else if (pieces > max) errors.push(`A hamper holds up to ${max} pieces.`);
  else if (!hamperSize(pieces)) errors.push(`No hamper size holds ${pieces} pieces.`);
  const { ready, blanks } = stockLeft(bag, excludeKey);
  list.forEach(it => {
    const p = byId(it.id);
    if (!Number.isInteger(it.qty)) errors.push('Quantities must be whole numbers.');
    else if (!p) errors.push('A piece in this hamper is no longer sold.');
    else if (!hamperEligible(p)) errors.push(`${p.name} can't go in a custom hamper.`);
    else {
      const b = baseOf(p);
      const left = (ready[it.id] || 0) + (b ? blanks[b.id] || 0 : 0);
      if (take(it.id, it.qty * hamperQty, ready, blanks) > 0) errors.push(left ? `Only ${left} ${p.name} left.` : `${p.name} is out of stock.`);
    }
  });
  const nw = wordCount(note);
  if (nw > HAMPER_BUILDER.noteWords) errors.push(`Keep the card message to ${HAMPER_BUILDER.noteWords} words (you have ${nw}).`);
  return { ok: !errors.length, errors, pieces, size: hamperSize(pieces) };
}

/* Check a ready-made hamper ordered qty times: every counted piece inside must still be
   available after the other hamper lines in the enquiry list (REQ-H8). */
export function checkReadyHamper(p, qty, bag, excludeKey) {
  const { ready, blanks } = stockLeft(bag, excludeKey);
  for (const it of piecesOf(p)) {
    const q = byId(it.id);
    if (!q) return { ok: false, msg: `${p.name} is not available right now.` };
    if (counted(q) && take(it.id, it.qty * qty, ready, blanks) > 0) return { ok: false, msg: `${p.name}: not enough ${q.name} left.` };
  }
  return { ok: true };
}

/* Price of one custom hamper: its size's basket, wrapping and card, plus its pieces. */
export const hamperPrice = items => hamperFee(pieceCount(items)) + (items || []).reduce((s, it) => s + (byId(it.id)?.price || 0) * it.qty, 0);

/* Check one enquiry-list line against every rule. Used when a saved list is loaded,
   because stock and limits can change between visits. */
export function checkLine(line, bag) {
  const p = byId(line.id), o = line.opts || {};
  if (!p) return { ok: false, msg: 'A piece in your list is no longer sold.' };
  if (hamperOnly(p)) return { ok: false, msg: `${p.name} is only sold inside a hamper.` };
  if (p.builder) {
    const r = checkHamper(o.items, line.qty, bag, line.key, o.note);
    return r.ok ? { ok: true } : { ok: false, msg: r.errors[0] };
  }
  const r = checkPers(p, o.text);
  if (!r.ok) return { ok: false, msg: `${p.name}: ${r.msg}` };
  return piecesOf(p).length ? checkReadyHamper(p, line.qty, bag, line.key) : { ok: true };
}

