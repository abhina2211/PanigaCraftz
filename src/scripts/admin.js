/* Neha's admin panel (REQ-D5, REQ-A1..A9).
   One page, several screens chosen by the address after # so the phone's back
   button works: #/home, #/enquiries, #/enquiries/<id>, #/products, #/products/<id>, #/more.
   Every change goes straight to Supabase; the database decides whether this account
   may make it (supabase/admin.sql) and whether the values are valid. */
import { isConnected, adminClient, fromRow } from '../lib/supabase.js';
import { imgOf } from '../lib/pictures.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = cents => '$' + (cents % 100 ? (cents / 100).toFixed(2) : cents / 100);
const LOW = 2; /* "running low" means this many or fewer left */
const CHEVRON = '<svg class="adm-chev" viewBox="0 0 24 24" width="20" height="20"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* Short message at the bottom. With an undo function it shows an Undo button for 6 seconds. */
function toast(t, undo) {
  const el = $('#toast'), btn = $('#toastUndo');
  $('#toastText').textContent = t; btn.hidden = !undo;
  btn.onclick = undo ? () => { el.classList.remove('show'); undo(); } : null;
  el.classList.add('show'); clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), undo ? 6000 : 2600);
}
/* A yes/no question in a proper dialog (big buttons, works on phones). Resolves true for Yes,
   false for the other button or the phone's back/Escape. */
function ask(text, yes = 'Yes') {
  const d = $('#confirm'); $('#confirmText').textContent = text; $('#confirmYes').textContent = yes;
  return new Promise(res => {
    const done = v => { d.onclick = d.oncancel = null; if (d.open) d.close(); res(v); };
    d.onclick = e => { const b = e.target.closest('[data-close]'); if (b) done(b.value === 'yes'); };
    d.oncancel = e => { e.preventDefault(); done(false); };
    d.showModal();
  });
}

/* Database messages in plain words. */
const friendly = msg => {
  if (/stock_qty/.test(msg) && /check/.test(msg)) return 'Stock can\'t be below 0.';
  if (/personalisation_needs_limit/.test(msg)) return 'Add a word limit for personalisation.';
  if (/personalisation_word_limit/.test(msg)) return 'Word limit must be between 1 and 200.';
  if (/hamper_piece_needs_stock_count/.test(msg)) return 'Turn on stock tracking before adding it to hampers.';
  if (/price_cents/.test(msg)) return 'Price can\'t be negative.';
  if (/JWT|session/i.test(msg)) return 'Please sign in again.';
  return msg;
};
const when = iso => {
  const mins = Math.round((Date.now() - new Date(iso)) / 6e4);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};

/* ?demo on the dev server (or a build made with PUBLIC_ADMIN_DEMO=1) runs the panel on made-up data,
   without Supabase, for trying out the design. Normal builds leave it out. */
const demo = (import.meta.env.DEV || import.meta.env.PUBLIC_ADMIN_DEMO === '1') && new URLSearchParams(location.search).has('demo');
if (!isConnected && !demo) { $('#notConnected').hidden = false; throw new Error('Supabase not connected'); }
const sb = demo ? (await import('../lib/admin-demo.js')).demoClient() : adminClient();
let me = null, products = [], enquiries = [];

/* ---------- plain-language labels shared by the screens ---------- */
const stockPill = p => {
  if (!p.active) return '<span class="pill off">Hidden</span>';
  if (p.status === 'made') return '<span class="pill info">Made to order</span>';
  if (p.status === 'sold' || p.stock_qty === 0) return '<span class="pill bad">Out of stock</span>';
  if (p.stock_qty == null) return ''; /* stock not counted: say nothing rather than add noise */
  if (p.stock_qty <= LOW) return `<span class="pill warn">${p.stock_qty} left</span>`;
  return `<span class="pill good">${p.stock_qty} in stock</span>`;
};
const isOut = p => p.active && p.status !== 'made' && (p.status === 'sold' || p.stock_qty === 0);
const isLow = p => p.active && p.status !== 'made' && p.stock_qty != null && p.stock_qty > 0 && p.stock_qty <= LOW;
const STATUS = { new: ['New', 'warn'], confirmed: ['Confirmed', 'info'], fulfilled: ['Done', 'good'], cancelled: ['Cancelled', 'off'] };
const statusPill = s => `<span class="pill ${STATUS[s][1]}">${STATUS[s][0]}</span>`;
const priceOf = id => (products.find(p => p.id === id) || {}).price_cents;
function enquiryTotal(e) {
  let cents = 0, quote = false;
  e.enquiry_items.forEach(i => {
    let unit = priceOf(i.product_id);
    if (i.enquiry_hamper_items.length) unit = (unit || 0) + i.enquiry_hamper_items.reduce((s, h) => s + (priceOf(h.product_id) || 0) * h.qty, 0);
    if (unit == null) quote = true; else cents += unit * i.qty;
  });
  return money(cents) + (quote ? ' + quote' : '');
}
const thumb = p => `<div class="adm-thumb">${imgOf(fromRow(p))}</div>`;

/* ---------- loading ---------- */
async function loadAll() {
  const [p, e] = await Promise.all([
    sb.from('products').select('*').order('name'),
    /* products!enquiry_items_product_id_fkey: enquiry_items reaches products two ways (directly,
       and through hamper pieces), so the database needs to be told which one is meant. */
    sb.from('enquiries').select('*, enquiry_items(*, products!enquiry_items_product_id_fkey(name), enquiry_hamper_items(qty, product_id, products(name)))').order('created_at', { ascending: false })
  ]);
  /* Load whatever worked, so one failing list never empties the other. */
  if (p.error) toast(friendly(p.error.message)); else products = p.data;
  if (e.error) toast(friendly(e.error.message)); else enquiries = e.data;
  const fresh = enquiries.filter(x => x.status === 'new').length;
  $('#newBadge').hidden = !fresh; $('#newBadge').textContent = fresh;
}

/* ---------- screens ---------- */
const screens = {
  home() {
    const fresh = enquiries.filter(e => e.status === 'new'), out = products.filter(isOut), low = products.filter(isLow);
    const hour = new Date().getHours();
    return { title: 'Home', html: `
      <p class="adm-hello">Good ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}${me.name ? ', ' + esc(me.name) : ''}</p>
      <div class="adm-stats">
        <a class="adm-stat${fresh.length ? ' alert' : ''}" href="#/enquiries?f=new"><b>${fresh.length}</b><span>New enquiries</span></a>
        <a class="adm-stat${out.length ? ' alert' : ''}" href="#/products?f=out"><b>${out.length}</b><span>Out of stock</span></a>
        <a class="adm-stat" href="#/products?f=low"><b>${low.length}</b><span>Running low</span></a>
        <a class="adm-stat" href="#/products"><b>${products.filter(p => p.active).length}</b><span>On the website</span></a>
      </div>
      <h2 class="adm-section-title">Needs a reply <a href="#/enquiries">All enquiries</a></h2>
      ${fresh.length ? `<ul class="adm-list">${fresh.slice(0, 5).map(enquiryRow).join('')}</ul>` : '<div class="adm-card adm-empty">No new enquiries. You\'re all caught up.</div>'}
      ${low.length + out.length ? `<h2 class="adm-section-title">Restock soon <a href="#/products?f=low">See all</a></h2>
        <ul class="adm-list">${[...out, ...low].slice(0, 5).map(productRow).join('')}</ul>` : ''}` };
  },

  enquiries(_, q) {
    const f = q.get('f') || 'all';
    const list = enquiries.filter(e => f === 'all' || e.status === f);
    const chips = [['all', 'All'], ['new', 'New'], ['confirmed', 'Confirmed'], ['fulfilled', 'Done'], ['cancelled', 'Cancelled']]
      .map(([k, n]) => `<button data-filter="${k}" aria-pressed="${f === k}">${n} ${k === 'all' ? '' : `(${enquiries.filter(e => e.status === k).length})`}</button>`).join('');
    return { title: 'Enquiries', html: `<div class="adm-chips" data-for="enquiries">${chips}</div><br>
      ${list.length ? `<ul class="adm-list">${list.map(enquiryRow).join('')}</ul>` : '<div class="adm-empty">Nothing here.</div>'}` };
  },

  enquiry(id) {
    const e = enquiries.find(x => x.id === id);
    if (!e) return { title: 'Enquiry', html: '<div class="adm-empty">This enquiry wasn\'t found.</div>' };
    const phone = (e.phone || '').replace(/\s/g, ''), wa = phone.replace(/^0/, '61').replace(/^\+/, '');
    const actions = {
      new: `<button class="adm-btn primary big" data-status="confirmed">Confirm enquiry</button><button class="adm-btn big" data-status="cancelled">Cancel enquiry</button>`,
      confirmed: `<button class="adm-btn primary big" data-status="fulfilled">Mark as done (sent or collected)</button><button class="adm-btn big" data-status="cancelled">Cancel enquiry</button>`,
      fulfilled: '<p class="adm-help">This enquiry is done.</p>',
      cancelled: '<p class="adm-help">This enquiry was cancelled. Its hamper pieces went back into stock.</p>'
    }[e.status];
    return { title: e.ref, back: '#/enquiries', html: `
      <div class="adm-card">
        <div class="adm-kv"><span>Status</span>${statusPill(e.status)}</div>
        <div class="adm-kv"><span>Received</span><span>${new Date(e.created_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
        <div class="adm-kv"><span>Estimated total</span><b>${enquiryTotal(e)}</b></div>
      </div>
      <div class="adm-card"><h2>${esc(e.customer_name)}</h2>
        <p class="adm-help">${esc(e.email)}${e.phone ? ' · ' + esc(e.phone) : ''}${e.postcode ? ' · ' + esc(e.postcode) : ''}</p>
        <div class="adm-contact">
          <a class="adm-btn" href="mailto:${esc(e.email)}?subject=${encodeURIComponent('Your PanigaCraftz enquiry ' + e.ref)}">Email</a>
          ${phone ? `<a class="adm-btn" href="tel:${esc(phone)}">Call</a><a class="adm-btn" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        </div></div>
      <div class="adm-card"><h2>What they'd like</h2><ul class="adm-items">${e.enquiry_items.map(i => `<li>
        <b>${i.qty} × ${esc(i.products?.name || i.product_id)}</b>
        ${i.enquiry_hamper_items.length ? `<small>In the hamper: ${i.enquiry_hamper_items.map(h => `${h.qty} × ${esc(h.products?.name)}`).join(', ')}</small>` : ''}
        ${i.personalisation_text ? `<small>Personalise with: <i>“${esc(i.personalisation_text)}”</i></small>` : ''}
        ${i.packaging ? `<small>Packaging: ${esc(i.packaging)}</small>` : ''}
        ${i.gift_note ? `<small>Card: “${esc(i.gift_note)}”</small>` : ''}</li>`).join('')}</ul></div>
      <div class="adm-actions" data-enquiry="${e.id}">${actions}</div>` };
  },

  products(_, q) {
    const f = q.get('f') || 'all', s = (q.get('s') || '').toLowerCase();
    const tests = { all: () => true, low: p => isLow(p) || isOut(p), out: isOut, pers: p => p.personalisable, hamper: p => p.hamper_eligible, hidden: p => !p.active };
    const list = products.filter(tests[f] || tests.all).filter(p => !s || p.name.toLowerCase().includes(s) || p.category.includes(s));
    const chips = [['all', 'All'], ['low', 'Low or out'], ['out', 'Out of stock'], ['pers', 'Personalised'], ['hamper', 'Hamper pieces'], ['hidden', 'Hidden']]
      .map(([k, n]) => `<button data-filter="${k}" aria-pressed="${f === k}">${n}</button>`).join('');
    shown = list.map(p => p.id);
    return { title: selecting ? (selected.size ? `${selected.size} selected` : 'Select products') : 'Products', action: selecting ? ['Cancel', 'select-off'] : ['Select', 'select-on'], html: `
      <div class="adm-search"><input type="search" id="find" placeholder="Search products" value="${esc(q.get('s') || '')}" aria-label="Search products" enterkeyhint="search">
        <div class="adm-chips" data-for="products">${chips}</div></div>
      ${selecting ? `<p class="adm-help" style="margin:4px 4px 10px">Tap products to select them. <button class="adm-btn ghost" data-action="select-all" style="min-height:36px;padding:0 6px;color:var(--red-ink)">Select all ${list.length}</button></p>` : ''}
      ${list.length ? `<ul class="adm-list${selecting ? ' adm-selecting' : ''}">${list.map(quickCard).join('')}</ul>` : '<div class="adm-empty">No products match.</div>'}
      <p class="adm-help" style="margin-top:16px">Adding new products with photos is coming next. For now, ask Abhi.</p>` };
  },

  product(id) {
    const p = products.find(x => x.id === id);
    if (!p) return { title: 'Product', html: '<div class="adm-empty">This product wasn\'t found.</div>' };
    const tracked = p.stock_qty != null;
    const avail = p.status === 'made' ? 'made' : p.status === 'sold' ? 'sold' : 'auto';
    return { title: 'Edit product', back: '#/products', form: true, html: `
      <form id="editForm" data-id="${esc(p.id)}">
      <div class="adm-hero">${thumb(p)}<div><h2>${esc(p.name)}</h2><p class="adm-help">${esc(p.category)} · <a href="/products/${esc(p.slug)}/" target="_blank" rel="noopener">See it on the website</a></p></div></div>

      <div class="adm-card adm-form"><h2>Price</h2>
        <label class="adm-field">Price in dollars<input name="price" type="number" inputmode="decimal" min="0" step="0.01" value="${p.price_cents == null ? '' : p.price_cents / 100}" placeholder="Leave empty for 'Price on enquiry'"></label>
        ${p.is_hamper_builder ? '<p class="adm-help">For the build-your-own hamper this is the basket, wrapping and card fee. Pieces are added on top.</p>' : ''}
      </div>

      <div class="adm-card adm-form"><h2>Stock</h2>
        <label class="adm-toggle">Count stock for this product<input type="checkbox" name="tracked"${tracked ? ' checked' : ''}></label>
        <div class="adm-sub" id="stockBox"${tracked ? '' : ' hidden'}>
          <span class="adm-field">How many do you have ready?</span>
          <div class="adm-stepper"><button type="button" data-step="-1" aria-label="One fewer">−</button><input name="stock" type="number" inputmode="numeric" min="0" step="1" value="${p.stock_qty ?? 0}" aria-label="Stock"><button type="button" data-step="1" aria-label="One more">+</button></div>
        </div>
        <span class="adm-field">What customers see</span>
        <div class="adm-seg" role="radiogroup" aria-label="Availability">
          <label><input type="radio" name="avail" value="auto"${avail === 'auto' ? ' checked' : ''}>${tracked ? 'In stock / sold out by count' : 'Nothing shown'}</label>
          <label><input type="radio" name="avail" value="made"${avail === 'made' ? ' checked' : ''}>Made to order</label>
          <label><input type="radio" name="avail" value="sold"${avail === 'sold' ? ' checked' : ''}>Sold out</label>
        </div>
      </div>

      <div class="adm-card adm-form"><h2>Personalisation</h2>
        <label class="adm-toggle"><span>Customers can add a name or message</span><input type="checkbox" name="pers"${p.personalisable ? ' checked' : ''}></label>
        <div class="adm-sub" id="persBox"${p.personalisable ? '' : ' hidden'}>
          <label class="adm-field">What to ask the customer<input name="label" value="${esc(p.personalisation_label || 'Name to add')}" placeholder="e.g. Message on the bottle"></label>
          <span class="adm-field">Most words allowed</span>
          <div class="adm-stepper"><button type="button" data-step="-1" aria-label="One fewer word">−</button><input name="words" type="number" inputmode="numeric" min="1" max="200" step="1" value="${p.personalisation_word_limit ?? 5}" aria-label="Most words allowed"><button type="button" data-step="1" aria-label="One more word">+</button></div>
          <p class="adm-help">Customers can't add the piece if they write more than this.</p>
        </div>
      </div>

      <div class="adm-card adm-form"><h2>Hampers and visibility</h2>
        ${p.is_hamper_builder ? '' : `<label class="adm-toggle"><span>Can go in custom hampers<small>Only while it's in stock</small></span><input type="checkbox" name="hamper"${p.hamper_eligible ? ' checked' : ''}></label>`}
        <label class="adm-toggle"><span>Show on the website<small>Turn off to hide it without deleting</small></span><input type="checkbox" name="active"${p.active ? ' checked' : ''}></label>
      </div>
      </form>` };
  },

  more() {
    return { title: 'More', html: `
      <div class="adm-card"><h2>Signed in</h2><p class="adm-help">${esc(me.email)}</p></div>
      <div class="adm-card"><h2>Put this on your phone's home screen</h2>
        <p class="adm-help"><b>iPhone:</b> in Safari tap Share, then "Add to Home Screen".<br><b>Android:</b> in Chrome tap the ⋮ menu, then "Install app" or "Add to Home screen".</p></div>
      <div class="adm-card adm-actions">
        <a class="adm-btn big" href="/" target="_blank" rel="noopener">Open the website</a>
        <button class="adm-btn big" data-action="sign-out">Sign out</button>
      </div>` };
  }
};
const enquiryRow = e => `<li><a class="adm-row" href="#/enquiries/${e.id}"><div class="adm-row-main"><b>${esc(e.customer_name)}</b><small>${esc(e.ref)} · ${when(e.created_at)} · ${e.enquiry_items.reduce((s, i) => s + i.qty, 0)} item(s)</small></div><div class="adm-row-end">${statusPill(e.status)}<small>${enquiryTotal(e)}</small></div>${CHEVRON}</a></li>`;
/* A product card you can edit without opening it (REQ-A11). */
const quickCard = p => {
  const tracked = p.stock_qty != null, sel = selected.has(p.id);
  const head = `<div class="adm-q1">${selecting ? `<span class="adm-check" aria-hidden="true">${sel ? '✓' : ''}</span>` : ''}
    <a class="adm-qlink" href="#/products/${esc(p.id)}">${thumb(p)}<div class="adm-row-main"><b>${esc(p.name)}</b><small>${esc(p.category)} ${stockPill(p)}</small></div></a>
    ${selecting ? '' : `<button class="adm-price${p.price_cents == null ? ' none' : ''}" data-q="price" aria-label="Price of ${esc(p.name)}">${p.price_cents == null ? 'On enquiry' : money(p.price_cents)}</button>`}</div>`;
  if (selecting) return `<li class="adm-qcard${sel ? ' sel' : ''}${p.active ? '' : ' off'}" data-id="${esc(p.id)}" role="checkbox" aria-checked="${sel}" tabindex="0">${head}</li>`;
  const stock = tracked
    ? `<div class="adm-mini"><button data-q="stock" data-d="-1" aria-label="One fewer"${p.stock_qty > 0 ? '' : ' disabled'}>−</button><output>${p.stock_qty}</output><button data-q="stock" data-d="1" aria-label="One more">+</button></div>`
    : `<a class="adm-pchip off" href="#/products/${esc(p.id)}">${p.status === 'made' ? 'Made to order' : 'Not counted'}</a>`;
  return `<li class="adm-qcard${p.active ? '' : ' off'}" data-id="${esc(p.id)}">${savedFlash === p.id ? '<span class="adm-saved">✓ Saved</span>' : ''}${head}
    <div class="adm-q2"><div><span class="adm-lab">Stock</span>${stock}</div>
      <div class="end"><span class="adm-lab">Personalise</span><button class="adm-pchip${p.personalisable ? '' : ' off'}" data-q="pers">✎ ${p.personalisable ? `Up to ${p.personalisation_word_limit} words` : 'Off'}</button></div></div>
    <div class="adm-q3">
      ${p.is_hamper_builder ? '<span></span>' : `<label class="adm-sw${tracked ? '' : ' na'}">${tracked ? 'In hampers' : 'Hampers need stock'}<input type="checkbox" data-q="hamper"${p.hamper_eligible ? ' checked' : ''}${tracked ? '' : ' disabled'}></label>`}
      <label class="adm-sw">On website<input type="checkbox" data-q="active"${p.active ? ' checked' : ''}></label>
    </div></li>`;
};
const productRow = p => `<li><a class="adm-row${p.active ? '' : ' hidden-product'}" href="#/products/${esc(p.id)}">${thumb(p)}<div class="adm-row-main"><b>${esc(p.name)}</b><small>${p.price_cents == null ? 'Price on enquiry' : money(p.price_cents)}${p.personalisable ? ` · up to ${p.personalisation_word_limit} words` : ''}</small></div><div class="adm-row-end">${stockPill(p)}</div>${CHEVRON}</a></li>`;

/* ---------- router ---------- */
let current = null, dirty = false, lastHash = location.hash;
let selecting = false, selected = new Set(), shown = [], savedFlash = null;
/* Redraw the current screen in place (keeps the scroll position). */
const refresh = () => route(true);
function route(keepScroll = false) {
  const [path, query = ''] = (location.hash.slice(1) || '/home').split('?');
  const [, section = 'home', id] = path.split('/');
  const q = new URLSearchParams(query);
  const name = id ? { enquiries: 'enquiry', products: 'product' }[section] : section;
  const view = (screens[name] || screens.home)(id && decodeURIComponent(id), q);
  current = { section, name, id, q, view };
  if (section !== 'products' || id) { selecting = false; selected.clear(); }
  $('#title').textContent = view.title;
  $('#topAction').hidden = !view.action;
  if (view.action) { $('#topAction').textContent = view.action[0]; $('#topAction').dataset.action = view.action[1]; }
  $('#bulkBar').hidden = !selecting; $('.adm-tabs').hidden = selecting; $('#app').classList.toggle('bulk-on', selecting);
  $('#bulkCount').textContent = `${selected.size} selected`;
  $$('#bulkBar button').forEach(b => { b.disabled = !selected.size; });
  $('#back').hidden = !view.back;
  $('#screen').innerHTML = view.html;
  document.querySelectorAll('.adm-tabs a').forEach(a => { if (a.dataset.tab === section) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  lastHash = location.hash;
  setDirty(false);
  if (!id && !keepScroll) window.scrollTo(0, 0);
  const find = $('#find');
  if (find && q.get('s') && !keepScroll) { find.focus(); find.setSelectionRange(find.value.length, find.value.length); }
}
function setDirty(v) { dirty = v; $('#saveBar').hidden = !v; }
window.addEventListener('hashchange', async () => {
  /* Unsaved changes: ask first. "Keep it" puts the address back without leaving the screen. */
  if (dirty && !(await ask('You have unsaved changes. Leave without saving?', 'Leave'))) { history.replaceState(null, '', lastHash || '#/home'); return; }
  route();
});
window.addEventListener('beforeunload', e => { if (dirty) e.preventDefault(); });
$('#back').onclick = () => { location.hash = current.view.back; };
const setQuery = (k, v) => { const q = new URLSearchParams(current.q); if (v && v !== 'all') q.set(k, v); else q.delete(k); history.replaceState(null, '', `#/${current.section}${q.toString() ? '?' + q : ''}`); route(); };

/* ---------- interactions ---------- */
document.addEventListener('click', async e => {
  const card = selecting && e.target.closest('.adm-qcard');
  if (card) { e.preventDefault(); const id = card.dataset.id; selected.has(id) ? selected.delete(id) : selected.add(id); refresh(); return; }
  const t = e.target.closest('button,a'); if (!t) return;
  if (t.dataset.filter) { setQuery('f', t.dataset.filter); return; }
  if (t.dataset.q) { e.preventDefault(); quickAction(t.dataset.q, t.closest('[data-id]').dataset.id, t); return; }
  if (t.dataset.bulk) { bulkAction(t.dataset.bulk); return; }
  if (t.dataset.sheet === 'cancel') { $('#sheet').close(); return; }
  if (t.dataset.action === 'select-on') { selecting = true; selected.clear(); refresh(); return; }
  if (t.dataset.action === 'select-off') { selecting = false; selected.clear(); refresh(); return; }
  if (t.dataset.action === 'select-all') { shown.forEach(id => selected.add(id)); refresh(); return; }
  if (t.dataset.step) {
    const input = t.parentElement.querySelector('input');
    const min = Number(input.min || 0), max = Number(input.max || 9999);
    input.value = Math.min(max, Math.max(min, (Number(input.value) || 0) + Number(t.dataset.step)));
    input.dispatchEvent(new Event('input', { bubbles: true })); return;
  }
  if (t.dataset.status) return changeStatus(t.closest('[data-enquiry]').dataset.enquiry, t.dataset.status);
  if (t.dataset.action === 'sign-out') { await sb.auth.signOut(); location.hash = ''; enter(); return; }
  if (t.dataset.action === 'discard') { setDirty(false); route(); return; }
  if (t.dataset.action === 'save') return saveProduct();
});
document.addEventListener('change', e => {
  const q = e.target.dataset.q; if (!q) return;
  quickAction(q, e.target.closest('[data-id]').dataset.id, e.target);
});
let findTimer;
document.addEventListener('input', e => {
  if (e.target.id === 'find') { clearTimeout(findTimer); findTimer = setTimeout(() => setQuery('s', e.target.value.trim()), 250); return; }
  if (e.target.closest('#editForm')) {
    const f = $('#editForm').elements;
    $('#stockBox').hidden = !f.tracked.checked;
    $('#persBox').hidden = !f.pers.checked;
    if (f.hamper && f.hamper.checked && !f.tracked.checked) { f.tracked.checked = true; $('#stockBox').hidden = false; toast('Stock counting turned on: hamper pieces need a count'); }
    setDirty(true);
  }
});

async function saveProduct() {
  const form = $('#editForm'), f = form.elements;
  const num = (v, scale = 1) => v === '' ? null : Math.round(Number(v) * scale);
  const change = {
    price_cents: num(f.price.value, 100),
    stock_qty: f.tracked.checked ? Math.max(0, num(f.stock.value) ?? 0) : null,
    status: f.avail.value === 'auto' ? null : f.avail.value,
    personalisable: f.pers.checked,
    personalisation_label: f.pers.checked ? (f.label.value.trim() || 'Name to add') : null,
    personalisation_word_limit: f.pers.checked ? num(f.words.value) : null,
    hamper_eligible: f.hamper ? f.hamper.checked : false,
    active: f.active.checked
  };
  const btn = document.querySelector('[data-action="save"]'); btn.disabled = true; btn.textContent = 'Saving';
  const { data, error } = await sb.from('products').update(change).eq('id', form.dataset.id).select();
  btn.disabled = false; btn.textContent = 'Save';
  if (error || !data.length) { toast(error ? friendly(error.message) : 'Not saved: this account can\'t make changes.'); return; }
  products = products.map(p => p.id === data[0].id ? data[0] : p);
  setDirty(false); toast('Saved. The website shows it now.'); route();
}

async function changeStatus(id, status) {
  const words = { confirmed: ['Confirm this enquiry?', 'Confirm'], fulfilled: ['Mark this enquiry as done?', 'Mark done'], cancelled: ['Cancel this enquiry? Its hamper pieces go back into stock. This can\'t be undone.', 'Cancel it'] }[status];
  if (!(await ask(...words))) return;
  const { error } = await sb.from('enquiries').update({ status }).eq('id', id);
  if (error) { toast(friendly(error.message)); return; }
  await loadAll(); toast(`Marked as ${STATUS[status][0].toLowerCase()}`); route();
}

/* ---------- quick edits from the list (REQ-A11..A13) ---------- */
/* Save straight away, show the change and offer Undo. `before` holds each product as it
   was, so Undo can put back exactly the fields that changed. */
const pick = (row, keys) => Object.fromEntries(keys.map(k => [k, row[k]]));
async function commit(ids, changeFor, message, before) {
  before = before || Object.fromEntries(ids.map(id => [id, { ...products.find(p => p.id === id) }]));
  const changes = ids.map(id => [id, changeFor(products.find(p => p.id === id))]).filter(([, c]) => c);
  if (!changes.length) return;
  products = products.map(p => { const c = changes.find(([id]) => id === p.id); return c ? { ...p, ...c[1] } : p; });
  savedFlash = changes.length === 1 ? changes[0][0] : null; refresh();
  const results = await Promise.all(changes.map(([id, c]) => sb.from('products').update(c).eq('id', id).select()));
  const failed = results.map((r, i) => (r.error || !r.data?.length) ? [changes[i][0], r.error] : null).filter(Boolean);
  results.forEach(r => { if (r.data?.[0]) products = products.map(p => p.id === r.data[0].id ? r.data[0] : p); });
  if (failed.length) {
    products = products.map(p => { const f = failed.find(([id]) => id === p.id); return f ? before[p.id] : p; });
    refresh(); toast(failed[0][1] ? friendly(failed[0][1].message) : 'Not saved: this account can\'t make changes.'); return;
  }
  refresh(); setTimeout(() => { if (savedFlash) { savedFlash = null; refresh(); } }, 1500);
  const keys = [...new Set(changes.flatMap(([, c]) => Object.keys(c)))];
  toast(message, () => commit(changes.map(([id]) => id), p => pick(before[p.id], keys), 'Undone'));
}

/* Stock taps are gathered for a moment, so tapping + three times saves once ("8 → 11"). */
const pendingStock = {};
function stockTap(id, d) {
  const p = products.find(x => x.id === id);
  const pend = pendingStock[id] ||= { before: { ...p } };
  const next = Math.max(0, p.stock_qty + d);
  products = products.map(x => x.id === id ? { ...x, stock_qty: next } : x); refresh();
  clearTimeout(pend.timer);
  pend.timer = setTimeout(() => {
    delete pendingStock[id];
    if (pend.before.stock_qty === next) return;
    commit([id], () => ({ stock_qty: next }), `${p.name} stock: ${pend.before.stock_qty} → ${next}`, { [id]: pend.before });
  }, 700);
}

function quickAction(kind, id, el) {
  const p = products.find(x => x.id === id);
  if (kind === 'stock') return stockTap(id, Number(el.dataset.d));
  if (kind === 'active') return commit([id], () => ({ active: el.checked }), `${p.name} ${el.checked ? 'is on the website' : 'is hidden from the website'}`);
  if (kind === 'hamper') return commit([id], () => ({ hamper_eligible: el.checked }), `${p.name} ${el.checked ? 'can go in hampers' : 'is out of hampers'}`);
  if (kind === 'price') return priceSheet([id], `${p.name}`, p.price_cents);
  if (kind === 'pers') return persSheet([id], p.name, p);
}

/* ---------- bottom sheets ---------- */
function openSheet(html, onDone) {
  const d = $('#sheet');
  $('#sheetBody').innerHTML = html;
  $('#sheetForm').onsubmit = e => { e.preventDefault(); const r = onDone($('#sheetForm').elements); if (r !== false) d.close(); };
  d.showModal();
  const first = d.querySelector('input[type=number],input[type=text]'); if (first) setTimeout(() => first.focus(), 50);
}
function priceSheet(ids, title, cents) {
  openSheet(`<h3 id="sheetTitle">Price</h3><p class="sub">${esc(title)}</p>
    <label class="f">Price in dollars<input name="price" type="number" inputmode="decimal" min="0" step="0.01" value="${cents == null ? '' : cents / 100}" placeholder="Empty = 'Price on enquiry'"></label>`,
  f => {
    const v = f.price.value.trim();
    if (v !== '' && !(Number(v) >= 0)) { toast('Enter a price of 0 or more'); return false; }
    const price_cents = v === '' ? null : Math.round(Number(v) * 100);
    commit(ids, () => ({ price_cents }), `${ids.length > 1 ? ids.length + ' products' : title}: price ${price_cents == null ? 'on enquiry' : money(price_cents)}`);
  });
}
function persSheet(ids, title, p) {
  const on = p ? p.personalisable : true, words = (p && p.personalisation_word_limit) || 5;
  openSheet(`<h3 id="sheetTitle">Personalisation</h3><p class="sub">${esc(title)}</p>
    <label class="adm-sw" style="margin-bottom:12px;font-size:16px">Customers can add a name or message<input type="checkbox" name="on"${on ? ' checked' : ''}></label>
    <div id="persFields"${on ? '' : ' hidden'}>
      <label class="f">What to ask the customer<input type="text" name="label" value="${esc((p && p.personalisation_label) || 'Name to add')}"></label>
      <span class="adm-lab" style="font-size:14px">Most words allowed</span>
      <div class="adm-presets">${[5, 15, 30, 50].map(n => `<button type="button" data-words="${n}" aria-pressed="${n === words}">${n}</button>`).join('')}</div>
      <div class="adm-stepper"><button type="button" data-step="-1" aria-label="One fewer word">−</button><input name="words" type="number" inputmode="numeric" min="1" max="200" value="${words}" aria-label="Most words allowed"><button type="button" data-step="1" aria-label="One more word">+</button></div>
    </div>`,
  f => {
    const words = Number(f.words.value);
    if (f.on.checked && !(words >= 1 && words <= 200)) { toast('Word limit must be between 1 and 200'); return false; }
    const change = f.on.checked
      ? { personalisable: true, personalisation_label: f.label.value.trim() || 'Name to add', personalisation_word_limit: words }
      : { personalisable: false, personalisation_label: null, personalisation_word_limit: null };
    commit(ids, () => change, `${ids.length > 1 ? ids.length + ' products' : title}: personalising ${f.on.checked ? `on, up to ${words} words` : 'off'}`);
  });
}
$('#sheet').addEventListener('click', e => {
  const w = e.target.closest('[data-words]');
  if (w) { $('#sheet [name=words]').value = w.dataset.words; $$('#sheet [data-words]').forEach(b => b.setAttribute('aria-pressed', b === w)); }
  if (e.target === $('#sheet')) $('#sheet').close(); /* tap outside closes */
});
$('#sheet').addEventListener('change', e => { if (e.target.name === 'on') $('#persFields').hidden = !e.target.checked; });
$('#sheet').addEventListener('input', e => { if (e.target.name === 'words') $$('#sheet [data-words]').forEach(b => b.setAttribute('aria-pressed', b.dataset.words === e.target.value)); });

/* ---------- several products at once (REQ-A13) ---------- */
function bulkAction(kind) {
  const ids = [...selected]; if (!ids.length) return;
  const n = `${ids.length} product${ids.length === 1 ? '' : 's'}`;
  if (kind === 'hide') return commit(ids, () => ({ active: false }), `${n} hidden from the website`);
  if (kind === 'show') return commit(ids, () => ({ active: true }), `${n} shown on the website`);
  if (kind === 'hamper-off') return commit(ids, p => p.is_hamper_builder ? null : { hamper_eligible: false }, `${n} out of hampers`);
  if (kind === 'hamper-on') {
    const ok = ids.filter(id => { const p = products.find(x => x.id === id); return p.stock_qty != null && !p.is_hamper_builder; });
    const skipped = ids.length - ok.length;
    if (!ok.length) { toast('Set a stock count first: hamper pieces need one'); return; }
    return commit(ok, () => ({ hamper_eligible: true }), `${ok.length} added to hampers${skipped ? ` (${skipped} skipped: no stock count)` : ''}`);
  }
  if (kind === 'price') return priceSheet(ids, n, null);
  if (kind === 'pers') return persSheet(ids, n, null);
  if (kind === 'stock') return openSheet(`<h3 id="sheetTitle">Set stock</h3><p class="sub">${n}. Each one gets this many.</p>
      <div class="adm-stepper"><button type="button" data-step="-1" aria-label="One fewer">−</button><input name="stock" type="number" inputmode="numeric" min="0" step="1" value="1" aria-label="Stock"><button type="button" data-step="1" aria-label="One more">+</button></div>`,
    f => { const v = Number(f.stock.value); if (!(v >= 0 && Number.isInteger(v))) { toast('Enter a whole number, 0 or more'); return false; }
      commit(ids, () => ({ stock_qty: v }), `${n}: stock set to ${v}`); });
}

/* ---------- sign in ---------- */
const gate = id => ['#signIn', '#noAccess', '#app'].forEach(s => { $(s).hidden = s !== id; });
async function enter() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { gate('#signIn'); return; }
  const { data: admin } = await sb.rpc('is_admin');
  if (!admin) { gate('#noAccess'); return; }
  me = { email: session.user.email, name: session.user.user_metadata?.name || '' };
  gate('#app');
  await loadAll(); route();
}
$('#signInForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target.elements, err = $('#signInErr'), btn = e.target.querySelector('button');
  btn.disabled = true; btn.textContent = 'Signing in';
  const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
  btn.disabled = false; btn.textContent = 'Sign in';
  err.hidden = !error; err.textContent = error ? 'That email or password isn\'t right. Try again.' : '';
  if (!error) { f.password.value = ''; enter(); }
});
/* Refresh when Neha comes back to the app, so new enquiries show up. */
document.addEventListener('visibilitychange', async () => { if (!document.hidden && me && !dirty) { await loadAll(); route(); } });

enter();
