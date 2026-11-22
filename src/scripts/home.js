/* Home page behaviour: hero carousel, recent products, shop filters, quick view,
   build-your-own hamper and the custom order form. Menus, footer, categories and
   the Instagram strip are already in the HTML, made by Astro at build time. */
import { CATEGORIES, HAMPER_TYPES, OCCASIONS, HAMPER_BUILDER, PRODUCTS } from '../data/catalogue.js';
import { $, $$, esc, aud, byId, rules, catName, htName, occName, reduce, today, priceText, igPost, productUrl,
  pic, imgOf, statusHtml, packOptions, LEAF, state, currentPackaging, on, applyFestival, addToBag, bag,
  toast, copy, closeMenu, trackInterest, start } from './core.js';

/* ---------- hero carousel (slide 1 follows the active festival) ---------- */
let cur = 0, timer = null, SLIDES = [];
const LEAVES = `<svg class="leaves" viewBox="0 0 400 400" aria-hidden="true"><defs><path id="lf" d="${LEAF}"/></defs><g fill="#e8c4c6" stroke="#c0403a" stroke-width="1.2"><use href="#lf" transform="translate(14 96) rotate(-35) scale(1.5)"/><use href="#lf" transform="translate(326 34) rotate(40) scale(1.3)"/><use href="#lf" transform="translate(356 300) rotate(110) scale(1.2)"/><use href="#lf" transform="translate(40 318) rotate(-80) scale(1.2)"/></g><g fill="#c0403a"><circle cx="72" cy="58" r="8"/><circle cx="372" cy="190" r="6"/></g></svg>`;
function buildSlides() {
  const fest = state.fest;
  SLIDES = [];
  if (fest) SLIDES.push({ badge: fest.name, accent: fest.accent, eye: fest.eyebrow, h: fest.headline, t: fest.sub, cta: [fest.cta, 'occ:' + fest.occ], art: `<img src="${fest.img}" alt="">` });
  SLIDES.push({ eye: 'Our signature', h: 'Decoupage planters, layered and sealed by hand', t: 'From our first best-seller, the Blue Tile Planter, to statement tripod pots. Each one is a one-off.', cta: ['Shop planters', 'cat:planters'], art: `<img src="/images/planters/CLDJx4NBfqU.jpg" alt="Blue tile decoupage planter on a timber stand">` });
  SLIDES.push({ eye: 'Hampers for every occasion', h: 'Festive, personal and corporate hampers', t: 'Christmas, Diwali, baby showers, birthdays and client thank-yous, each with a handmade piece inside.', cta: ['Explore hampers', 'cat:hampers'], art: pic('hampers', '#fbefee', '#c0403a', 'Illustration of a gift hamper') });
  if (!fest) SLIDES.unshift({ eye: 'Handmade in Sydney', h: 'Decoupaged gifts, made by hand and made personal', t: 'Plain candles, jars, vases and planters, given colour one piece at a time.', cta: ['Shop teacher gifts', 'occ:teacher'], art: `<img src="/images/products/candle-1.jpg" alt="Decoupage candle, gift-boxed with ribbon">` });
  $('#slides').innerHTML = SLIDES.map((s, i) => `<div class="slide${i ? '' : ' on'}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${SLIDES.length}"><div>${s.badge ? `<span class="fest-badge" style="background:${s.accent}">${esc(s.badge)}</span>` : ''}<p class="eyebrow">${esc(s.eye)}</p>${i ? `<h2 style="font-size:clamp(32px,4.8vw,50px)">${esc(s.h)}</h2>` : `<h1>${esc(s.h)}</h1>`}<p class="lead">${esc(s.t)}</p><div class="cta"><button class="btn" data-go="${s.cta[1]}">${esc(s.cta[0])}</button><a class="btn ghost" href="#recent">See what's new</a></div></div><div class="art"><div class="photo">${s.art}</div>${LEAVES}</div></div>`).join('');
  $('#dots').innerHTML = SLIDES.map((s, i) => `<button aria-label="Show slide ${i + 1}" aria-current="${!i}" data-slide="${i}"></button>`).join('');
  cur = 0; auto();
}
const show = i => { cur = (i + SLIDES.length) % SLIDES.length; $$('.slide').forEach((s, k) => s.classList.toggle('on', k === cur)); $$('#dots button').forEach((d, k) => d.setAttribute('aria-current', k === cur)); };
const auto = () => { clearInterval(timer); if (!reduce) timer = setInterval(() => show(cur + 1), 6000); };
$('#prev').onclick = () => { show(cur - 1); auto(); };
$('#next').onclick = () => { show(cur + 1); auto(); };
$('.hero').addEventListener('mouseenter', () => clearInterval(timer));
$('.hero').addEventListener('mouseleave', auto);
on('festival', () => {
  buildSlides();
  $$('#fbuttons .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.fprev === state.festId));
  $('#hbPack').innerHTML = packOptions(currentPackaging());
});

/* ---------- product cards ---------- */
let recentIds = [];
const renderRail = () => { recentIds = [...PRODUCTS].sort((a, b) => b.added - a.added).slice(0, 6).map(p => p.id); $('#rail').innerHTML = recentIds.map(id => card(byId(id))).join(''); };
const card = p => `<article class="p"><div class="img">${imgOf(p)}${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : recentIds.includes(p.id) ? '<span class="badge new">New</span>' : ''}<button class="qv" data-quick="${p.id}" aria-label="Quick view: ${esc(p.name)}">Quick view</button></div>
 <div class="body"><span class="cat-l">${p.ht ? htName(p.ht) : catName(p.cat)}</span><h3><a class="plink" href="${productUrl(p)}">${esc(p.name)}</a></h3>${p.size || p.status ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${statusHtml(p)}${p.size ? `<span class="size">${esc(p.size)}</span>` : ''}</div>` : ''}<p>${esc(p.d.split('. ')[0].replace(/\.$/, ''))}.</p>
 <div class="row"><span class="price"${p.price == null ? ' style="font-size:16px"' : ''}>${priceText(p)}</span>${p.builder ? `<button class="btn" data-build>Build</button>` : `<button class="btn" data-add="${p.id}"${p.status === 'sold' ? ' disabled' : ''}>Add</button>`}</div></div></article>`;
renderRail();

/* ---------- shop: filters, price band, sort, shareable hash links ---------- */
let filter = 'all', ht = null, occ = null, list = [];
function render() {
  const band = $('#priceBand').value, sort = $('#sort').value;
  list = PRODUCTS.filter(p => (filter === 'all' || p.cat === filter) && (!ht || p.ht === ht) && (!occ || p.occ.includes(occ)));
  if (band) { const [lo, hi] = band.split('-').map(Number); list = list.filter(p => p.price != null && p.price >= lo && p.price < hi); }
  if (sort === 'new') list.sort((a, b) => b.added - a.added);
  if (sort === 'low') list.sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
  if (sort === 'high') list.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
  $('#shopTitle').textContent = occ ? occName(occ) + ' gifts' : ht ? htName(ht) : filter === 'all' ? 'All handmade pieces' : catName(filter);
  $('#shopLead').textContent = occ ? `${list.length} pieces suited to this occasion.` : ht ? HAMPER_TYPES.find(h => h.id === ht).blurb + '.' : filter === 'all' ? `${list.length} handmade pieces. Pick a category or occasion to narrow it down.` : CATEGORIES.find(c => c.id === filter).blurb + '.';
  $('#grid').innerHTML = list.map(card).join('') || '<p>Nothing here yet. Ask us about a custom order.</p>';
  $('#filter').innerHTML = [{ id: 'all', name: 'All' }, ...CATEGORIES].map(c => `<button class="chip" data-f="${c.id}" aria-pressed="${filter === c.id && !occ}">${c.name}</button>`).join('');
  $('#subfilter').innerHTML = filter === 'hampers'
    ? [{ id: '', name: 'All hampers' }, ...HAMPER_TYPES].map(h => `<button class="chip" data-hf="${h.id}" aria-pressed="${(ht || '') === h.id}">${h.name}</button>`).join('')
    : OCCASIONS.map(o => `<button class="chip" data-occ="${o.id}" aria-pressed="${occ === o.id}">${o.name}</button>`).join('');
}
$('#priceBand').onchange = render; $('#sort').onchange = render;
const setHash = h => { try { history.replaceState(null, '', h ? '#' + h : location.pathname); } catch (e) {} };
const goShop = () => { closeMenu(); $('#shop').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); };
/* Shareable links for Instagram posts and bio: /#planters, /#hampers-festive, /#gifts-teacher */
function fromHash() {
  const h = location.hash.slice(1);
  if (h === 'preview') { $('#fpreview').classList.add('on'); return false; }
  let m;
  if (CATEGORIES.some(c => c.id === h)) { filter = h; ht = null; occ = null; }
  else if ((m = h.match(/^hampers-(\w+)$/)) && HAMPER_TYPES.some(x => x.id === m[1])) { filter = 'hampers'; ht = m[1]; occ = null; }
  else if ((m = h.match(/^gifts-(\w+)$/)) && OCCASIONS.some(o => o.id === m[1])) { filter = 'all'; ht = null; occ = m[1]; }
  else return false;
  render(); return true;
}

/* ---------- quick view with personalisation ---------- */
const dlg = $('#qview'); let qid = null, qq = 1, qset = [];
function openQuick(id, set) {
  qset = set && set.length ? set : PRODUCTS.map(p => p.id); qid = id; qq = 1; fillQuick();
  if (!dlg.open) { try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); } }
  trackInterest(id, 'quick_view');
}
function fillQuick() {
  const p = byId(qid);
  $('#qImg').innerHTML = imgOf(p, false);
  $('#qCat').textContent = p.ht ? htName(p.ht) : catName(p.cat);
  $('#qName').textContent = p.name; $('#qPrice').textContent = priceText(p);
  $('#qStatus').innerHTML = statusHtml(p); $('#qSize').textContent = p.size || '';
  $('#qDesc').textContent = p.d;
  const pc = rules.persOf(p);
  $('#qPers').hidden = !pc;
  if (pc) { $('#qPersLabel').textContent = pc.label; $('#qPersText').placeholder = pc.words <= 5 ? 'e.g. Ms Lee' : 'Your message'; }
  $('#qPersText').value = ''; $('#qNote').value = ''; $('#qNoteCount').textContent = '0 / 150';
  $('#qPack').innerHTML = packOptions(currentPackaging());
  $('#qTags').innerHTML = p.occ.map(o => `<span>${esc(occName(o))}</span>`).join('');
  $('#qQty').textContent = qq;
  $('#qAdd').disabled = p.status === 'sold'; $('#qAdd').textContent = p.status === 'sold' ? 'Sold out' : p.builder ? 'Start building' : 'Add to enquiry';
  $('#qPage').href = productUrl(p);
  const ig = $('#qIg'); ig.hidden = !p.ig; if (p.ig) ig.href = igPost(p.ig);
  $('#qPrev').hidden = $('#qNext').hidden = qset.length < 2;
  persInput();
}
const stepQuick = d => { const i = qset.indexOf(qid); qid = qset[(i + d + qset.length) % qset.length]; qq = 1; fillQuick(); };
$('#qClose').onclick = () => dlg.close();
$('#qPrev').onclick = () => stepQuick(-1); $('#qNext').onclick = () => stepQuick(1);
$('#qMinus').onclick = () => { qq = Math.max(1, qq - 1); $('#qQty').textContent = qq; };
$('#qPlus').onclick = () => { qq = Math.min(500, qq + 1); $('#qQty').textContent = qq; };
/* REQ-P3: live word count; Add is blocked while the text is over the product's limit. */
function persInput() {
  const p = byId(qid), pc = rules.persOf(p), text = $('#qPersText').value;
  if (!pc) return true;
  const r = rules.checkPers(p, text);
  $('#qPersCount').textContent = r.words ? `${r.words} / ${pc.words} words` : `(optional, up to ${pc.words} word${pc.words === 1 ? '' : 's'})`;
  $('#qPersErr').textContent = r.msg || ''; $('#qPersErr').hidden = r.ok;
  $('#qPersText').classList.toggle('field-error', !r.ok); $('#qPersText').setAttribute('aria-invalid', !r.ok);
  $('#qPersPreview').textContent = text;
  if (p.status !== 'sold') $('#qAdd').disabled = !r.ok;
  return r.ok;
}
$('#qPersText').oninput = persInput;
$('#qNote').oninput = e => { $('#qNoteCount').textContent = `${e.target.value.length} / 150`; };
$('#qAdd').onclick = () => {
  const p = byId(qid);
  if (p.builder) { dlg.close(); goBuild(); return; }
  const opts = p.pers ? { text: $('#qPersText').value.trim().replace(/\s+/g, ' '), packaging: $('#qPack').value, note: $('#qNote').value.trim() } : {};
  if (addToBag(qid, qq, opts)) dlg.close();
};
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
dlg.addEventListener('keydown', e => { if (e.target.matches('input,textarea,select')) return; if (e.key === 'ArrowRight') stepQuick(1); if (e.key === 'ArrowLeft') stepQuick(-1); });

/* ---------- build-your-own hamper: only pieces in stock (REQ-H1..H5) ---------- */
/* BACKEND HOOK: read stock from the products table; submit through the submit_enquiry
   function, which re-checks and holds the stock in one transaction (supabase/schema.sql). */
const builderId = () => (PRODUCTS.find(p => p.builder) || {}).id;
let hb = {}; /* product id -> quantity in the hamper being built */
const hbItems = () => Object.entries(hb).map(([id, qty]) => ({ id, qty }));
function renderBuilder() {
  /* Trim anything that went out of stock while building. */
  Object.keys(hb).forEach(id => { const left = rules.available(id, bag); if (hb[id] > left) hb[id] = left; if (!hb[id]) delete hb[id]; });
  const pieces = hbItems().reduce((s, it) => s + it.qty, 0);
  const full = pieces >= HAMPER_BUILDER.maxItems;
  const eligible = PRODUCTS.filter(p => p.hamper && !p.builder);
  eligible.sort((a, b) => (rules.available(b.id, bag) > 0) - (rules.available(a.id, bag) > 0));
  $('#hbItems').innerHTML = eligible.map(p => {
    const left = rules.available(p.id, bag), n = hb[p.id] || 0, ok = left > 0;
    return `<li class="${ok ? '' : 'out'}"><div class="thumb">${imgOf(p)}</div><div class="info"><b>${esc(p.name)}</b><small>${priceText(p)}</small><small>${ok ? `${left} available` : 'Out of stock'}</small></div>
      <span class="qty"><button data-hb-dec="${p.id}" aria-label="One fewer ${esc(p.name)}"${n ? '' : ' disabled'}>−</button><span>${n}</span><button data-hb-inc="${p.id}" aria-label="One more ${esc(p.name)}"${ok && n < left && !full ? '' : ' disabled'}>+</button></span></li>`;
  }).join('');
  $('#hbChosen').innerHTML = pieces ? hbItems().map(it => `<li>${it.qty} x ${esc(byId(it.id).name)}</li>`).join('') : `<li>Add at least ${HAMPER_BUILDER.minItems} pieces.</li>`;
  $('#hbPieces').textContent = `${pieces} of ${HAMPER_BUILDER.maxItems}`;
  $('#hbBase').textContent = aud(HAMPER_BUILDER.base);
  $('#hbTotal').textContent = aud(rules.hamperPrice(hbItems()));
  const nw = rules.wordCount($('#hbNote').value);
  $('#hbNoteCount').textContent = `${nw} / ${HAMPER_BUILDER.noteWords} words`;
  const r = rules.checkHamper(hbItems(), 1, bag, null, $('#hbNote').value);
  const shown = pieces ? r.errors : r.errors.filter(m => !m.startsWith('Choose at least'));
  $('#hbErr').textContent = shown.join(' '); $('#hbErr').hidden = !shown.length;
  $('#hbNote').classList.toggle('field-error', nw > HAMPER_BUILDER.noteWords);
  $('#hbAdd').disabled = !r.ok;
}
on('bag', renderBuilder);
const goBuild = () => { closeMenu(); setHash('build'); $('#build').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); };
$('#hbNote').oninput = renderBuilder;
$('#hbAdd').onclick = () => {
  const BUILDER_ID = builderId(); if (!BUILDER_ID) return;
  const items = hbItems().sort((a, b) => a.id.localeCompare(b.id));
  if (addToBag(BUILDER_ID, 1, { items, packaging: $('#hbPack').value, note: $('#hbNote').value.trim() })) { hb = {}; $('#hbNote').value = ''; renderBuilder(); }
};

/* ---------- custom order: 3 steps with validation ---------- */
let coStep = 1;
const coForm = $('#coForm');
function showStep(n) {
  coStep = n;
  $$('.co-step').forEach(s => { s.hidden = +s.dataset.step !== n; });
  $$('.prog b').forEach((b, i) => { b.style.width = i < n ? '100%' : '0'; });
  $('#stepLabel').textContent = `Step ${n} of 3: ${['What you need', 'The details', 'Your contact details'][n - 1]}`;
  $('#coBack').style.visibility = n === 1 ? 'hidden' : 'visible';
  $('#coNext').textContent = n === 3 ? 'Create my request' : 'Continue';
}
const setErr = (name, bad) => {
  const e = $(`#coForm .err[data-for="${name}"]`); if (e) e.hidden = !bad;
  const f = coForm.elements[name];
  if (f && f.type !== 'checkbox' && !(f instanceof RadioNodeList)) { f.classList.toggle('field-error', bad); f.setAttribute('aria-invalid', bad); }
  return !bad;
};
function validate(n) {
  const f = coForm.elements; let ok = true;
  if (n === 1) { ok = setErr('type', !f.type.value) && ok; const q = +f.qty.value; ok = setErr('qty', !(q >= 1 && q <= 500)) && ok; ok = setErr('budget', !f.budget.value) && ok; }
  if (n === 2) { ok = setErr('details', f.details.value.trim().length < 15) && ok; const min = today(); min.setDate(min.getDate() + 7); const d = f.date.value ? new Date(f.date.value + 'T00:00:00') : null; ok = setErr('date', !d || d < min) && ok; }
  if (n === 3) {
    ok = setErr('name', f.name.value.trim().length < 2) && ok;
    ok = setErr('email', !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim())) && ok;
    const ph = f.phone.value.replace(/[\s-]/g, ''); ok = setErr('phone', ph !== '' && !/^(\+?61|0)4\d{8}$/.test(ph)) && ok;
    ok = setErr('postcode', !/^\d{4}$/.test(f.postcode.value.trim())) && ok;
    ok = setErr('consent', !f.consent.checked) && ok;
  }
  return ok;
}
coForm.addEventListener('submit', e => {
  e.preventDefault();
  if (!validate(coStep)) { const first = $('#coForm .co-step:not([hidden]) .err:not([hidden])'); first && first.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); return; }
  if (coStep < 3) { showStep(coStep + 1); return; }
  const payload = Object.fromEntries(new FormData(coForm).entries());
  payload.ref = 'PC-' + Date.now().toString(36).toUpperCase().slice(-6);
  payload.submittedAt = new Date().toISOString();
  /* BACKEND HOOK: insert payload into the planned enquiries table (Supabase) and email Neha. */
  console.info('[PanigaCraftz] custom order enquiry', payload);
  const when = new Date(payload.date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  $('#customOut').textContent = `Hi Neha! Custom order request ${payload.ref}\nType: ${payload.type}\nOccasion: ${payload.occasion}\nQuantity: ${payload.qty}\nBudget per item: ${payload.budget}\nNeeded by: ${when}\nDetails: ${payload.details}\nName: ${payload.name}\nEmail: ${payload.email}${payload.phone ? `\nMobile: ${payload.phone}` : ''}\nPostcode: ${payload.postcode}`;
  $('#coRef').textContent = 'Reference ' + payload.ref;
  coForm.hidden = true; $('.prog').hidden = true; $('#stepLabel').hidden = true; $('#coDone').hidden = false;
});
$('#coBack').onclick = () => showStep(Math.max(1, coStep - 1));
$('#coRestart').onclick = () => { coForm.reset(); $$('#coForm .err').forEach(e => { e.hidden = true; }); $$('.field-error').forEach(e => e.classList.remove('field-error')); coForm.hidden = false; $('.prog').hidden = false; $('#stepLabel').hidden = false; $('#coDone').hidden = true; showStep(1); };
{ const min = today(); min.setDate(min.getDate() + 7); coForm.elements.date.min = min.toISOString().slice(0, 10); }

/* ---------- home page clicks (menus and bag clicks are handled in core.js) ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('button,a');
  if (!t) return;
  const d = t.dataset;
  if (d.quick) { openQuick(d.quick, t.closest('#rail') ? recentIds : t.closest('#grid') ? list.map(p => p.id) : null); return; }
  if (d.slide) { show(+d.slide); auto(); return; }
  if (d.fprev) { applyFestival(d.fprev); return; }
  if (d.cat) { e.preventDefault(); filter = d.cat; ht = null; occ = null; render(); setHash(d.cat === 'all' ? 'shop' : d.cat); goShop(); }
  else if (d.ht) { e.preventDefault(); filter = 'hampers'; ht = d.ht; occ = null; render(); setHash('hampers-' + d.ht); goShop(); }
  else if (d.go) { const [k, v] = d.go.split(':'); if (k === 'cat') { filter = v; ht = null; occ = null; setHash(v); } else { filter = 'all'; ht = null; occ = v; setHash('gifts-' + v); } render(); goShop(); }
  else if (d.f) { filter = d.f; ht = null; occ = null; render(); }
  else if (d.hf !== undefined) { ht = d.hf || null; render(); }
  else if (d.occ) { const was = occ === d.occ; occ = was ? null : d.occ; filter = 'all'; ht = null; render(); if (!was) setHash('gifts-' + d.occ); if (!t.closest('#subfilter')) goShop(); }
  else if ('build' in d) { e.preventDefault(); goBuild(); }
  else if (d.hbInc || d.hbDec) { const id = d.hbInc || d.hbDec; hb[id] = Math.max(0, (hb[id] || 0) + (d.hbInc ? 1 : -1)); if (!hb[id]) delete hb[id]; renderBuilder(); }
  else if (d.add) { addToBag(d.add, 1, byId(d.add).pers ? { packaging: currentPackaging() } : {}); }
  else if (t.id === 'copyCustom') { copy($('#customOut').textContent); }
});
on('catalogue', () => { renderRail(); render(); renderBuilder(); });
window.addEventListener('hashchange', () => { if (fromHash()) $('#shop').scrollIntoView(); });

/* ---------- start ---------- */
showStep(1);
render();
start();
if (fromHash()) setTimeout(() => $('#shop').scrollIntoView(), 50);
