/* Neha's admin panel (REQ-D5, REQ-A1..A9).
   One page, several screens chosen by the address after # so the phone's back
   button works: #/home, #/enquiries, #/enquiries/<id>, #/products, #/products/<id>, #/more.
   Every change goes straight to Supabase; the database decides whether this account
   may make it (supabase/admin.sql) and whether the values are valid. */
import { isConnected, adminClient, fromRow } from '../lib/supabase.js';
import { imgOf } from '../lib/pictures.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = cents => '$' + (cents % 100 ? (cents / 100).toFixed(2) : cents / 100);
const LOW = 2; /* "running low" means this many or fewer left */
const CHEVRON = '<svg class="adm-chev" viewBox="0 0 24 24" width="20" height="20"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2600); }
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
    sb.from('enquiries').select('*, enquiry_items(*, products(name), enquiry_hamper_items(qty, product_id, products(name)))').order('created_at', { ascending: false })
  ]);
  if (p.error || e.error) { toast(friendly((p.error || e.error).message)); return; }
  products = p.data; enquiries = e.data;
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
    return { title: 'Products', html: `
      <div class="adm-search"><input type="search" id="find" placeholder="Search products" value="${esc(q.get('s') || '')}" aria-label="Search products" enterkeyhint="search">
        <div class="adm-chips" data-for="products">${chips}</div></div>
      ${list.length ? `<ul class="adm-list">${list.map(productRow).join('')}</ul>` : '<div class="adm-empty">No products match.</div>'}
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
const productRow = p => `<li><a class="adm-row${p.active ? '' : ' hidden-product'}" href="#/products/${esc(p.id)}">${thumb(p)}<div class="adm-row-main"><b>${esc(p.name)}</b><small>${p.price_cents == null ? 'Price on enquiry' : money(p.price_cents)}${p.personalisable ? ` · up to ${p.personalisation_word_limit} words` : ''}</small></div><div class="adm-row-end">${stockPill(p)}</div>${CHEVRON}</a></li>`;

/* ---------- router ---------- */
let current = null, dirty = false, lastHash = location.hash;
function route() {
  const [path, query = ''] = (location.hash.slice(1) || '/home').split('?');
  const [, section = 'home', id] = path.split('/');
  const q = new URLSearchParams(query);
  const name = id ? { enquiries: 'enquiry', products: 'product' }[section] : section;
  const view = (screens[name] || screens.home)(id && decodeURIComponent(id), q);
  current = { section, name, id, q, view };
  $('#title').textContent = view.title;
  $('#back').hidden = !view.back;
  $('#screen').innerHTML = view.html;
  document.querySelectorAll('.adm-tabs a').forEach(a => { if (a.dataset.tab === section) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  lastHash = location.hash;
  setDirty(false);
  if (!id) window.scrollTo(0, 0);
  const find = $('#find');
  if (find && q.get('s')) { find.focus(); find.setSelectionRange(find.value.length, find.value.length); }
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
  const t = e.target.closest('button,a'); if (!t) return;
  if (t.dataset.filter) { setQuery('f', t.dataset.filter); return; }
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
