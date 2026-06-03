const £ = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const num = (id) => Number(document.getElementById(id)?.value || 0);
const text = (id) => (document.getElementById(id)?.value || '').trim();
const checked = (id) => document.getElementById(id)?.checked || false;
const money = (value) => £.format(Number.isFinite(value) ? value : 0);

const state = {
  extras: [],
  prints: []
};

const ids = [
  'productName','productRef','productNotes','toggle3d','toggleEngraving','toggleExtras','toggleApparel','toggleLabour',
  'filamentType','rollWeight','rollCost','filamentUsed','printHours','printerWatts','electricityRate','wastePercent',
  'hourlyWage','labourMinutes','labourNotes','engravingName','engravingMinutes','engravingSetupMinutes','laserRate','engravingBuffer',
  'garmentCode','garmentName','garmentCost','vatRate','includeVat','includePostage','postageCost','feePercent','fixedFee','customMarkup'
];

document.addEventListener('DOMContentLoaded', () => {
  addExtraRow({ name: 'Packaging', packCost: 0, packQty: 1, qtyUsed: 1 });
  addPrintRow({ name: 'Front print', cost: 0 });

  ids.forEach(id => document.getElementById(id)?.addEventListener('input', update));
  ids.forEach(id => document.getElementById(id)?.addEventListener('change', update));

  document.getElementById('addExtra').addEventListener('click', () => addExtraRow());
  document.getElementById('addPrint').addEventListener('click', () => addPrintRow());
  document.getElementById('calculateBtn').addEventListener('click', update);
  document.getElementById('printBtn').addEventListener('click', () => {
    update();
    window.print();
  });
  document.getElementById('resetBtn').addEventListener('click', () => location.reload());

  update();
});

function addExtraRow(data = {}) {
  const rowId = crypto.randomUUID();
  state.extras.push(rowId);
  const wrap = document.createElement('div');
  wrap.className = 'line-row';
  wrap.dataset.rowId = rowId;
  wrap.innerHTML = `
    <label>Item
      <input class="extra-name" type="text" value="${escapeAttr(data.name || '')}" placeholder="Cork insert, rubber feet..." />
    </label>
    <label>Pack cost (£)
      <input class="extra-pack-cost" type="number" min="0" step="0.01" value="${data.packCost ?? 0}" />
    </label>
    <label>Pack quantity
      <input class="extra-pack-qty" type="number" min="0" step="1" value="${data.packQty ?? 1}" />
    </label>
    <label>Used
      <input class="extra-used" type="number" min="0" step="0.01" value="${data.qtyUsed ?? 1}" />
    </label>
    <button type="button" class="remove-button">Remove</button>
  `;
  document.getElementById('extrasRows').appendChild(wrap);
  wrap.querySelectorAll('input').forEach(input => input.addEventListener('input', update));
  wrap.querySelector('.remove-button').addEventListener('click', () => { wrap.remove(); update(); });
  update();
}

function addPrintRow(data = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'line-row print-row';
  wrap.innerHTML = `
    <label>Print name / location
      <input class="print-name" type="text" value="${escapeAttr(data.name || '')}" placeholder="Front chest, back print..." />
    </label>
    <label>Print cost (£)
      <input class="print-cost" type="number" min="0" step="0.01" value="${data.cost ?? 0}" />
    </label>
    <button type="button" class="remove-button">Remove</button>
  `;
  document.getElementById('printRows').appendChild(wrap);
  wrap.querySelectorAll('input').forEach(input => input.addEventListener('input', update));
  wrap.querySelector('.remove-button').addEventListener('click', () => { wrap.remove(); update(); });
  update();
}

function update() {
  toggleSection('section3d', checked('toggle3d'));
  toggleSection('sectionEngraving', checked('toggleEngraving'));
  toggleSection('sectionExtras', checked('toggleExtras'));
  toggleSection('sectionApparel', checked('toggleApparel'));
  toggleSection('sectionLabour', checked('toggleLabour'));

  const result = calculate();
  render(result);
}

function toggleSection(id, show) {
  document.getElementById(id).classList.toggle('hidden', !show);
}

function calculate() {
  const enabled3d = checked('toggle3d');
  const enabledExtras = checked('toggleExtras');
  const enabledLabour = checked('toggleLabour');
  const enabledEngraving = checked('toggleEngraving');
  const enabledApparel = checked('toggleApparel');

  const filamentPerGram = safeDivide(num('rollCost'), num('rollWeight'));
  const filamentCost = enabled3d ? filamentPerGram * num('filamentUsed') : 0;
  const electricityCost = enabled3d ? (num('printerWatts') / 1000) * num('printHours') * num('electricityRate') : 0;
  const printBeforeWaste = filamentCost + electricityCost;
  const wasteCost = enabled3d ? printBeforeWaste * (num('wastePercent') / 100) : 0;
  const printCost = printBeforeWaste + wasteCost;

  const extras = enabledExtras ? getExtraRows() : [];
  const extrasCost = extras.reduce((sum, row) => sum + row.cost, 0);

  const labourCost = enabledLabour ? num('hourlyWage') * (num('labourMinutes') / 60) : 0;

  const engravingMachine = enabledEngraving ? (num('engravingMinutes') / 60) * num('laserRate') : 0;
  const engravingLabour = enabledEngraving ? (num('engravingSetupMinutes') / 60) * num('hourlyWage') : 0;
  const engravingBeforeBuffer = engravingMachine + engravingLabour;
  const engravingBufferCost = enabledEngraving ? engravingBeforeBuffer * (num('engravingBuffer') / 100) : 0;
  const engravingCost = engravingBeforeBuffer + engravingBufferCost;

  const prints = enabledApparel ? getPrintRows() : [];
  const printApplicationCost = prints.reduce((sum, row) => sum + row.cost, 0);
  const apparelCost = enabledApparel ? num('garmentCost') + printApplicationCost : 0;

  const baseCost = printCost + extrasCost + labourCost + engravingCost + apparelCost;
  const postage = checked('includePostage') ? num('postageCost') : 0;
  const costWithPostage = baseCost + postage;

  const markupRates = [30, 50, 70, num('customMarkup')];
  const uniqueMarkups = [...new Set(markupRates.map(rate => Number(rate.toFixed(2))))];
  const prices = uniqueMarkups.map(markup => {
    const beforeFeesVat = costWithPostage * (1 + markup / 100);
    const feeEstimate = beforeFeesVat * (num('feePercent') / 100) + num('fixedFee');
    const priceBeforeVat = beforeFeesVat + feeEstimate;
    const vat = checked('includeVat') ? priceBeforeVat * (num('vatRate') / 100) : 0;
    const salePrice = priceBeforeVat + vat;
    return {
      markup,
      salePrice,
      profitBeforeVat: salePrice - vat - feeEstimate - costWithPostage,
      feeEstimate,
      vat
    };
  });

  const custom = prices[prices.length - 1] || { feeEstimate: 0, vat: 0 };

  return {
    filamentPerGram,
    filamentCost,
    electricityCost,
    wasteCost,
    printCost,
    extras,
    extrasCost,
    labourCost,
    engravingMachine,
    engravingLabour,
    engravingBufferCost,
    engravingCost,
    prints,
    apparelCost,
    postage,
    baseCost,
    costWithPostage,
    feeEstimate: custom.feeEstimate,
    vat: custom.vat,
    prices
  };
}

function getExtraRows() {
  return [...document.querySelectorAll('#extrasRows .line-row')].map(row => {
    const name = row.querySelector('.extra-name').value.trim() || 'Unnamed extra';
    const packCost = Number(row.querySelector('.extra-pack-cost').value || 0);
    const packQty = Number(row.querySelector('.extra-pack-qty').value || 0);
    const qtyUsed = Number(row.querySelector('.extra-used').value || 0);
    const unitCost = safeDivide(packCost, packQty);
    return { name, packCost, packQty, qtyUsed, unitCost, cost: unitCost * qtyUsed };
  });
}

function getPrintRows() {
  return [...document.querySelectorAll('#printRows .line-row')].map(row => {
    const name = row.querySelector('.print-name').value.trim() || 'Unnamed print';
    const cost = Number(row.querySelector('.print-cost').value || 0);
    return { name, cost };
  });
}

function render(result) {
  document.getElementById('reportTitle').textContent = text('productName') || 'Untitled product';
  document.getElementById('reportRef').textContent = text('productRef') ? `Reference: ${text('productRef')}` : '';
  document.getElementById('reportNotes').textContent = text('productNotes') || 'No notes added.';

  document.getElementById('totalCost').textContent = money(result.baseCost);
  document.getElementById('trueCostNote').textContent = checked('includePostage')
    ? `Base cost plus ${money(result.postage)} postage before markup.`
    : 'Before optional postage, fees and VAT.';

  setText('sum3d', money(result.printCost));
  setText('sumExtras', money(result.extrasCost));
  setText('sumLabour', money(result.labourCost));
  setText('sumEngraving', money(result.engravingCost));
  setText('sumApparel', money(result.apparelCost));
  setText('sumPostage', money(result.postage));
  setText('sumFees', money(result.feeEstimate));
  setText('sumVat', money(result.vat));

  const priceTable = document.getElementById('priceTable');
  priceTable.innerHTML = result.prices.map(row => `
    <div class="price-row">
      <div>
        <span>${row.markup}% markup</span>
        <strong>${money(row.salePrice)}</strong>
        <span>Profit before VAT: ${money(row.profitBeforeVat)}</span>
      </div>
      <strong>${money(row.salePrice)}</strong>
    </div>
  `).join('');

  const lines = [];
  if (checked('toggle3d')) {
    lines.push(['Filament cost', `${money(result.filamentCost)} (${money(result.filamentPerGram)} per g)`]);
    lines.push(['Electricity cost', money(result.electricityCost)]);
    lines.push(['3D print waste buffer', money(result.wasteCost)]);
  }
  if (checked('toggleExtras')) result.extras.forEach(extra => lines.push([`Extra: ${extra.name}`, `${money(extra.cost)} (${extra.qtyUsed} × ${money(extra.unitCost)})`]));
  if (checked('toggleLabour')) lines.push([`Manual labour${text('labourNotes') ? `: ${text('labourNotes')}` : ''}`, money(result.labourCost)]);
  if (checked('toggleEngraving')) {
    lines.push([`Engraving machine time${text('engravingName') ? `: ${text('engravingName')}` : ''}`, money(result.engravingMachine)]);
    lines.push(['Engraving setup/cleaning labour', money(result.engravingLabour)]);
    lines.push(['Engraving buffer', money(result.engravingBufferCost)]);
  }
  if (checked('toggleApparel')) {
    lines.push([`Garment${text('garmentCode') ? `: ${text('garmentCode')}` : ''}${text('garmentName') ? ` ${text('garmentName')}` : ''}`, money(num('garmentCost'))]);
    result.prints.forEach(print => lines.push([`Apparel print: ${print.name}`, money(print.cost)]));
  }
  if (checked('includePostage')) lines.push(['Postage included in price', money(result.postage)]);

  document.getElementById('breakdown').innerHTML = lines.length ? lines.map(([label, value]) => `
    <div class="breakdown-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
  `).join('') : '<p class="muted">Turn on at least one costing section to see a breakdown.</p>';
}

function safeDivide(a, b) { return b > 0 ? a / b : 0; }
function setText(id, value) { document.getElementById(id).textContent = value; }
function escapeHtml(str) {
  return String(str).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}
function escapeAttr(str) { return escapeHtml(str); }
