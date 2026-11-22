/* Browser code shared by every page: helpers, festival bar, menus, the enquiry
   list (drawer) and toasts. Page-specific code lives in home.js and product.js.
   Lines marked BACKEND HOOK are where Supabase calls go in phase 3. */
import { IG, CATEGORIES, HAMPER_TYPES, OCCASIONS, FESTIVALS, PACKAGING_DEFAULT, SHIPPING } from '../data/catalogue.js';
import * as rules from '../lib/rules.js';

export { rules };
export const byId = rules.byId;
export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const aud = n => '$' + (Number.isInteger(n) ? n : n.toFixed(2));
export const catName = id => (CATEGORIES.find(c => c.id === id) || {}).name || '';
export const occName = id => (OCCASIONS.find(o => o.id === id) || {}).name || id;
export const htName = id => (HAMPER_TYPES.find(h => h.id === id) || {}).name || '';
export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export const daysUntil = iso => Math.max(0, Math.ceil((new Date(iso + 'T00:00:00') - today()) / 864e5));
export const priceText = p => p.price == null ? 'Price on enquiry' : (p.priceFrom ? 'From ' : '') + aud(p.price);
export const igPost = (id, kind = 'p') => `https://www.instagram.com/${kind}/${id}/`;
export const productUrl = p => `/products/${p.slug}/`;
export const IG_DM = `https://ig.me/m/${IG}`;

/* BACKEND HOOK: log interest (planned table interest_events: product_id, source, created_at). */
export const trackInterest = (productId, source) => { console.info('[PanigaCraftz] interest', { productId, source, at: new Date().toISOString() }); };

import { LEAF, pic, imgOf } from '../lib/pictures.js';
export { LEAF, pic, imgOf };

export const statusHtml = p => p.status ? `<span class="status ${p.status}">${{ in: 'In stock', made: 'Made to order', sold: 'Sold out' }[p.status]}</span>` : '';
export const packOptions = sel => [PACKAGING_DEFAULT, ...Object.values(FESTIVALS).map(f => f.packaging)].map(o => `<option${o === sel ? ' selected' : ''}>${esc(o)}</option>`).join('');

/* ---------- tiny event hub so pages can react to shared changes ---------- */
const listeners = { festival: [], bag: [] };
export const on = (name, fn) => listeners[name].push(fn);
const emit = name => listeners[name].forEach(fn => fn());

/* ---------- festival bar ---------- */
const nextFestival = () => Object.entries(FESTIVALS).map(([id, f]) => ({ id, ...f }))
  .filter(f => new Date(f.date + 'T00:00:00') >= today())
  .sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null;
export const state = { fest: null, festId: 'auto' };
export const currentPackaging = () => state.fest ? state.fest.packaging : PACKAGING_DEFAULT;
export function applyFestival(id) {
  state.festId = id;
  state.fest = id === 'auto' ? nextFestival() : (FESTIVALS[id] ? { id, ...FESTIVALS[id] } : null);
  const f = state.fest, bar = $('#bar');
  if (f) {
    bar.style.background = f.accent;
    $('#announce').textContent = f.announcement;
    const d = daysUntil(f.orderBy);
    $('#countdown').hidden = false;
    $('#countdown').textContent = d === 0 ? 'Last day to order' : `${d} day${d === 1 ? '' : 's'} to order`;
  } else { bar.style.background = ''; $('#countdown').hidden = true; $('#announce').textContent = 'Handmade in Sydney. Australia-wide shipping.'; }
  emit('festival');
}

/* ---------- toast, copy, menus ---------- */
export function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2000); }
export const copy = async t => { try { await navigator.clipboard.writeText(t); toast('Copied. Paste it into an Instagram DM'); } catch (e) { toast('Copy blocked. Select the text to copy it'); } };
const closeDrops = except => $$('[data-drop]').forEach(b => { if (b !== except) { b.setAttribute('aria-expanded', 'false'); $('#' + b.getAttribute('aria-controls')).classList.remove('open'); } });
export function closeMenu() { closeDrops(); $('#menu').classList.remove('open'); $('#burger').setAttribute('aria-expanded', 'false'); }

/* ---------- enquiry list (cart): same product + same personalisation = one line ---------- */
export let bag = [];
const dropped = [];
const lineKey = (id, opts) => id + '|' + JSON.stringify(opts);
try {
  /* v2 lists stored the personalisation as opts.name; it is now opts.text. */
  const raw = JSON.parse(localStorage.getItem('pc-bag-v3') || 'null') ?? JSON.parse(localStorage.getItem('pc-bag-v2') || '[]').map(i => {
    const o = Object.assign({}, i.opts); if ('name' in o) { o.text = o.name; delete o.name; }
    return { id: i.id, qty: i.qty, opts: o, key: lineKey(i.id, o) };
  });
  /* Stock and limits may have changed since the last visit: re-check every line (REQ-P4, REQ-H4). */
  raw.forEach(l => { const r = rules.checkLine(l, bag); if (r.ok) bag.push(l); else dropped.push(r.msg); });
} catch (e) { bag = []; }
const saveBag = () => { try { localStorage.setItem('pc-bag-v3', JSON.stringify(bag)); } catch (e) {} };

/* Every add goes through the rules, whichever page it comes from. Returns false if refused. */
export function addToBag(id, qty = 1, opts = {}) {
  const key = lineKey(id, opts);
  const line = bag.find(i => i.key === key);
  const next = { key, id, qty: Math.min(500, (line ? line.qty : 0) + qty), opts };
  const r = rules.checkLine(next, bag);
  if (!r.ok) { toast(r.msg); return false; }
  if (line) line.qty = next.qty; else bag.push(next);
  saveBag(); renderBag(); trackInterest(id, 'add_to_enquiry');
  toast(`${qty} added to your enquiry list`);
  return true;
}
const unitPrice = i => { const p = byId(i.id); return p.builder ? rules.hamperPrice(i.opts.items) : p.price; };
const unitText = i => byId(i.id).builder ? aud(unitPrice(i)) : priceText(byId(i.id));
const persText = i => { const pc = rules.persOf(byId(i.id)); return pc ? pc.label : 'Personalisation'; };
const itemsText = i => (i.opts.items || []).map(it => `${it.qty} x ${byId(it.id).name}`).join(', ');
const totals = () => {
  const priced = bag.filter(i => unitPrice(i) != null);
  const sub = priced.reduce((s, i) => s + unitPrice(i) * i.qty, 0);
  const ship = sub === 0 || sub >= SHIPPING.freeOver ? 0 : SHIPPING.flat;
  return { sub, ship, total: sub + ship, unpriced: bag.length - priced.length, count: bag.reduce((s, i) => s + i.qty, 0) };
};
export function renderBag() {
  const t = totals();
  $('#bagCount').textContent = t.count;
  $('#bagFoot').hidden = !bag.length;
  $('#bagList').innerHTML = bag.length ? bag.map(i => {
    const p = byId(i.id), o = i.opts || {};
    return `<li><div class="thumb">${imgOf(p)}</div><div class="li-main"><b><a href="${productUrl(p)}">${esc(p.name)}</a></b><small>${unitText(i)}${unitPrice(i) != null ? ' each' : ''}</small>
      ${o.items ? `<small>Contains: ${esc(itemsText(i))}</small>` : ''}${o.text ? `<small>${esc(persText(i))}: <i>${esc(o.text)}</i></small>` : ''}${o.packaging ? `<small>Packaging: ${esc(o.packaging)}</small>` : ''}${o.note ? `<small>Card: “${esc(o.note)}”</small>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px"><span class="qty"><button data-dec="${esc(i.key)}" aria-label="One fewer">−</button><span>${i.qty}</span><button data-inc="${esc(i.key)}" aria-label="One more">+</button></span><button class="remove" data-remove="${esc(i.key)}">Remove</button></div></div></li>`;
  }).join('') : '<li>Your list is empty. Add a few pieces to get started.</li>';
  $('#bagSub').textContent = aud(t.sub) + (t.unpriced ? ' + quote' : '');
  $('#bagShip').textContent = t.sub === 0 ? 'To confirm' : t.ship ? aud(t.ship) : 'Free';
  $('#bagTotal').textContent = aud(t.total) + (t.unpriced ? ' + quote' : '');
  const left = Math.max(0, SHIPPING.freeOver - t.sub);
  $('#shipMsg').textContent = left > 0 ? `${aud(left)} away from free Australia-wide shipping (estimate).` : 'Free Australia-wide shipping unlocked (estimate).';
  $('#shipBar').style.width = Math.min(100, t.sub / SHIPPING.freeOver * 100) + '%';
  emit('bag'); /* e.g. the hamper builder: stock held by hampers in the list changes */
}
const bagMsg = () => {
  if (!bag.length) return '';
  const t = totals();
  const lines = bag.map(i => { const p = byId(i.id), o = i.opts || {}; return `- ${i.qty} x ${p.name} (${unitText(i)}${unitPrice(i) != null ? ' each' : ''})` + (o.items ? `\n   Contains: ${itemsText(i)}` : '') + (o.text ? `\n   ${persText(i)}: ${o.text}` : '') + (o.packaging ? `\n   Packaging: ${o.packaging}` : '') + (o.note ? `\n   Card: "${o.note}"` : ''); });
  return `Hi Neha! I'd like to order:\n${lines.join('\n')}\nEstimated total: ${aud(t.total)}${t.unpriced ? ' plus items to quote' : ''}\nPlease confirm availability, delivery and the final price. Thank you!`;
};

/* ---------- clicks shared by every page ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('button,a');
  if (!t) { if (!e.target.closest('.menu')) closeDrops(); return; }
  const d = t.dataset;
  if ('drop' in d) { const open = t.getAttribute('aria-expanded') !== 'true'; closeDrops(t); t.setAttribute('aria-expanded', open); $('#' + t.getAttribute('aria-controls')).classList.toggle('open', open); return; }
  if (t.id === 'burger') { const o = !$('#menu').classList.contains('open'); $('#menu').classList.toggle('open', o); t.setAttribute('aria-expanded', o); return; }
  if (d.inc) { const l = bag.find(i => i.key === d.inc); if (l) { const q = Math.min(500, l.qty + 1), r = rules.checkLine({ ...l, qty: q }, bag); if (!r.ok) toast(r.msg); else { l.qty = q; saveBag(); renderBag(); } } }
  else if (d.dec) { const l = bag.find(i => i.key === d.dec); if (l) { l.qty--; if (l.qty <= 0) bag = bag.filter(i => i !== l); saveBag(); renderBag(); } }
  else if (d.remove) { bag = bag.filter(i => i.key !== d.remove); saveBag(); renderBag(); }
  else if (t.id === 'openBag') { e.preventDefault(); closeMenu(); $('#drawer').classList.add('open'); $('#closeBag').focus(); }
  else if (t.id === 'closeBag') { $('#drawer').classList.remove('open'); }
  else if (t.id === 'copyBag') { const m = bagMsg(); if (m) { copy(m); bag.forEach(i => trackInterest(i.id, 'enquire_instagram')); } else toast('Add a piece first'); }
  else if (t.closest('.menu') && t.tagName === 'A' && !('cat' in d) && !('ht' in d) && !('build' in d)) closeMenu();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDrops(); $('#drawer').classList.remove('open'); } });

/* Call once per page, after the page has registered its listeners. */
export function start() {
  applyFestival('auto');
  renderBag();
  if (dropped.length) { saveBag(); setTimeout(() => toast(`Removed from your list. ${dropped[0]}`), 300); }
}
