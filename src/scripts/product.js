/* Product page behaviour: quantity, personalisation with the product's own word
   limit (REQ-P1..P4) and adding to the enquiry list. The rest of the page is plain
   HTML made by Astro from src/pages/products/[slug].astro. */
import { $, byId, rules, packOptions, currentPackaging, on, addToBag, trackInterest, start } from './core.js';

const root = $('#product');
const p = byId(root.dataset.id);
let qty = 1;

const pc = rules.persOf(p);
const buyable = !!$('#pAdd'); /* the build-your-own hamper page links to the builder instead */
function persInput() {
  if (!pc) return true;
  const text = $('#pPersText').value, r = rules.checkPers(p, text);
  $('#pPersCount').textContent = r.words ? `${r.words} / ${pc.words} words` : `(optional, up to ${pc.words} word${pc.words === 1 ? '' : 's'})`;
  $('#pPersErr').textContent = r.msg || ''; $('#pPersErr').hidden = r.ok;
  $('#pPersText').classList.toggle('field-error', !r.ok); $('#pPersText').setAttribute('aria-invalid', !r.ok);
  $('#pPersPreview').textContent = text;
  if (p.status !== 'sold') $('#pAdd').disabled = !r.ok;
  return r.ok;
}
if (pc) {
  $('#pPersText').oninput = persInput;
  $('#pNote').oninput = e => { $('#pNoteCount').textContent = `${e.target.value.length} / 150`; };
  on('festival', () => { $('#pPack').innerHTML = packOptions(currentPackaging()); });
}

if (buyable) {
  $('#pMinus').onclick = () => { qty = Math.max(1, qty - 1); $('#pQty').textContent = qty; };
  $('#pPlus').onclick = () => { qty = Math.min(500, qty + 1); $('#pQty').textContent = qty; };
  $('#pAdd').onclick = () => {
    const opts = pc ? { text: $('#pPersText').value.trim().replace(/\s+/g, ' '), packaging: $('#pPack').value, note: $('#pNote').value.trim() } : {};
    if (addToBag(p.id, qty, opts) && pc) { $('#pPersText').value = ''; $('#pNote').value = ''; persInput(); }
  };
}

start();
persInput();
trackInterest(p.id, 'product_page');
