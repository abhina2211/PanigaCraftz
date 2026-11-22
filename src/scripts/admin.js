/* Admin page: sign in, edit products and stock, review enquiries (REQ-D5).
   Every change goes straight to Supabase; the database decides whether this
   account may make it (supabase/admin.sql) and whether the values are valid. */
import { isConnected, adminClient } from '../lib/supabase.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2600); }
const show = id => ['#signIn', '#noAccess', '#panel'].forEach(s => { $(s).hidden = s !== id; });

/* Database messages in plain words. */
const friendly = msg => {
  if (/stock_qty/.test(msg) && /check/.test(msg)) return 'Stock can\'t be below 0.';
  if (/personalisation_needs_limit/.test(msg)) return 'Give a word limit when the product can be personalised.';
  if (/personalisation_word_limit/.test(msg)) return 'Word limit must be between 1 and 200.';
  if (/hamper_piece_needs_stock_count/.test(msg)) return 'A hamper piece needs a stock count.';
  if (/price_cents/.test(msg)) return 'Price can\'t be negative.';
  return msg;
};

if (!isConnected) { $('#notConnected').hidden = false; throw new Error('Supabase not connected'); }
const sb = adminClient();

/* ---------- sign in ---------- */
async function enter() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { show('#signIn'); $('#signOut').hidden = true; $('#who').textContent = ''; return; }
  $('#who').textContent = session.user.email; $('#signOut').hidden = false;
  const { data: admin } = await sb.rpc('is_admin');
  if (!admin) { show('#noAccess'); return; }
  show('#panel');
  await Promise.all([loadProducts(), loadEnquiries()]);
}
$('#signInForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target.elements;
  const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
  $('#signInErr').hidden = !error; $('#signInErr').textContent = error ? 'Email or password is wrong.' : '';
  if (!error) { f.password.value = ''; enter(); }
});
$('#signOut').onclick = async () => { await sb.auth.signOut(); enter(); };

/* ---------- products and stock ---------- */
let products = [];
async function loadProducts() {
  const { data, error } = await sb.from('products').select('*').order('category').order('name');
  if (error) { toast(error.message); return; }
  products = data; renderProducts();
}
const statusOptions = s => [['', 'Follow stock'], ['in', 'In stock'], ['made', 'Made to order'], ['sold', 'Sold out']]
  .map(([v, n]) => `<option value="${v}"${(s || '') === v ? ' selected' : ''}>${n}</option>`).join('');
function renderProducts() {
  const q = $('#find').value.trim().toLowerCase();
  $('#products tbody').innerHTML = products.filter(p => !q || p.name.toLowerCase().includes(q) || p.category.includes(q)).map(p => `
    <tr data-id="${esc(p.id)}"${p.active ? '' : ' class="off"'}>
      <td><a href="/products/${esc(p.slug)}/" target="_blank" rel="noopener">${esc(p.name)}</a><small>${esc(p.category)}${p.is_hamper_builder ? ' · hamper builder fee' : ''}</small></td>
      <td><input data-f="price" type="number" min="0" step="0.01" value="${p.price_cents == null ? '' : p.price_cents / 100}" placeholder="On enquiry" aria-label="Price"></td>
      <td><input data-f="stock" type="number" min="0" step="1" value="${p.stock_qty ?? ''}" placeholder="Not counted" aria-label="Stock"></td>
      <td><select data-f="status" aria-label="Status">${statusOptions(p.status)}</select></td>
      <td><input data-f="pers" type="checkbox"${p.personalisable ? ' checked' : ''} aria-label="Can be personalised"></td>
      <td><input data-f="label" value="${esc(p.personalisation_label)}" placeholder="Name to add" aria-label="Field label"></td>
      <td><input data-f="words" type="number" min="1" max="200" step="1" value="${p.personalisation_word_limit ?? ''}" aria-label="Word limit"></td>
      <td><input data-f="hamper" type="checkbox"${p.hamper_eligible ? ' checked' : ''} aria-label="Hamper piece"></td>
      <td><input data-f="active" type="checkbox"${p.active ? ' checked' : ''} aria-label="On site"></td>
      <td><button class="btn" data-save disabled>Save</button></td>
    </tr>`).join('');
}
$('#find').oninput = renderProducts;
$('#products').addEventListener('input', e => { const tr = e.target.closest('tr'); if (tr) tr.querySelector('[data-save]').disabled = false; });
$('#products').addEventListener('click', async e => {
  const btn = e.target.closest('[data-save]'); if (!btn) return;
  const tr = btn.closest('tr'), v = f => tr.querySelector(`[data-f="${f}"]`);
  const num = (el, scale = 1) => el.value === '' ? null : Math.round(Number(el.value) * scale);
  const pers = v('pers').checked;
  const change = {
    price_cents: num(v('price'), 100),
    stock_qty: num(v('stock')),
    status: v('status').value || null,
    personalisable: pers,
    personalisation_label: v('label').value.trim() || (pers ? 'Name to add' : null),
    personalisation_word_limit: num(v('words')),
    hamper_eligible: v('hamper').checked,
    active: v('active').checked
  };
  btn.disabled = true; btn.textContent = 'Saving';
  const { data, error } = await sb.from('products').update(change).eq('id', tr.dataset.id).select();
  btn.textContent = 'Save';
  if (error || !data.length) { btn.disabled = false; toast(error ? friendly(error.message) : 'Not saved: no permission.'); return; }
  products = products.map(p => p.id === data[0].id ? data[0] : p);
  tr.classList.toggle('off', !data[0].active);
  toast(`Saved ${data[0].name}`);
});

/* ---------- enquiries ---------- */
const STATUSES = ['new', 'confirmed', 'cancelled', 'fulfilled'];
async function loadEnquiries() {
  const { data, error } = await sb.from('enquiries')
    .select('*, enquiry_items(*, products(name), enquiry_hamper_items(qty, products(name)))')
    .order('created_at', { ascending: false });
  if (error) { toast(error.message); return; }
  $('#newCount').textContent = data.filter(e => e.status === 'new').length || '';
  $('#enquiries').innerHTML = data.length ? data.map(e => `
    <article class="enq" data-id="${e.id}">
      <header><b>${esc(e.ref)}</b><span>${new Date(e.created_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</span>
        <label>Status <select data-status${e.status === 'cancelled' ? ' disabled' : ''}>${STATUSES.map(s => `<option${s === e.status ? ' selected' : ''}>${s}</option>`).join('')}</select></label></header>
      <p>${esc(e.customer_name)} · <a href="mailto:${esc(e.email)}">${esc(e.email)}</a>${e.phone ? ` · ${esc(e.phone)}` : ''}${e.postcode ? ` · ${esc(e.postcode)}` : ''}</p>
      <ul>${e.enquiry_items.map(i => `<li>${i.qty} x ${esc(i.products?.name || i.product_id)}
        ${i.enquiry_hamper_items.length ? `<small>Contains: ${i.enquiry_hamper_items.map(h => `${h.qty} x ${esc(h.products?.name)}`).join(', ')}</small>` : ''}
        ${i.personalisation_text ? `<small>Personalisation: <i>${esc(i.personalisation_text)}</i></small>` : ''}
        ${i.packaging ? `<small>Packaging: ${esc(i.packaging)}</small>` : ''}${i.gift_note ? `<small>Card: “${esc(i.gift_note)}”</small>` : ''}</li>`).join('')}</ul>
    </article>`).join('') : '<p>No enquiries yet.</p>';
}
$('#enquiries').addEventListener('change', async e => {
  if (!e.target.matches('[data-status]')) return;
  const id = e.target.closest('.enq').dataset.id, status = e.target.value;
  if (status === 'cancelled' && !confirm('Cancel this enquiry? Its hamper pieces go back into stock. This can\'t be undone.')) { loadEnquiries(); return; }
  const { error } = await sb.from('enquiries').update({ status }).eq('id', id);
  toast(error ? error.message : `Marked ${status}`);
  await Promise.all([loadEnquiries(), loadProducts()]);
});

/* ---------- tabs ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tab]'); if (!t) return;
  $$('[data-tab]').forEach(b => b.setAttribute('aria-pressed', b === t));
  $('#tab-products').hidden = t.dataset.tab !== 'products';
  $('#tab-enquiries').hidden = t.dataset.tab !== 'enquiries';
});

enter();
