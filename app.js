(() => {
  'use strict';

  const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
  const money = value => gbp.format(Number.isFinite(value) ? value : 0);
  const byId = id => document.getElementById(id);
  const num = id => Number(byId(id)?.value || 0);
  const text = id => (byId(id)?.value || '').trim();
  const checked = id => Boolean(byId(id)?.checked);
  const safeDivide = (a, b) => b > 0 ? a / b : 0;
  const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));

  const inputIds = [
    'productName', 'productRef', 'productNotes', 'includeLabour', 'hourlyWage', 'labourMinutes', 'labourNotes',
    'toggle3d', 'toggleExtras', 'toggleEngraving', 'toggleApparel',
    'filamentType', 'rollWeight', 'rollCost', 'filamentUsed', 'printHours', 'printerWatts', 'electricityRate', 'wastePercent',
    'engravingName', 'engravingMinutes', 'engravingSetupMinutes', 'laserRate', 'engravingBuffer',
    'garmentCode', 'garmentName', 'garmentCost',
    'includePostage', 'postageCost', 'includeVat', 'vatRate', 'feePercent', 'fixedFee', 'customMarkup'
  ];

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    addExtraRow({ name: 'Packaging', packCost: 0, packQty: 1, qtyUsed: 1 });
    addPrintRow({ name: 'Front print', cost: 0 });

    inputIds.forEach(id => {
      const el = byId(id);
      if (!el) return;
      el.addEventListener('input', update);
      el.addEventListener('change', update);
    });

    byId('addExtra')?.addEventListener('click', () => addExtraRow());
    byId('addPrint')?.addEventListener('click', () => addPrintRow());
    byId('calculateBtn')?.addEventListener('click', update);
    byId('printBtn')?.addEventListener('click', () => {
      update();
      window.print();
    });
    byId('resetBtn')?.addEventListener('click', () => {
      document.querySelectorAll('input[type="text"], textarea').forEach(input => input.value = '');
      document.querySelectorAll('input[type="number"]').forEach(input => input.value = input.defaultValue || 0);
      byId('toggle3d').checked = true;
      byId('toggleExtras').checked = true;
      byId('toggleEngraving').checked = false;
      byId('toggleApparel').checked = false;
      byId('includeLabour').checked = true;
      byId('includePostage').checked = false;
      byId('includeVat').checked = false;
      byId('extrasRows').innerHTML = '';
      byId('printRows').innerHTML = '';
      addExtraRow({ name: 'Packaging', packCost: 0, packQty: 1, qtyUsed: 1 });
      addPrintRow({ name: 'Front print', cost: 0 });
      update();
    });

    update();
  }

  function addExtraRow(data = {}) {
    const row = document.createElement('div');
    row.className = 'line-row extra-row';
    row.innerHTML = `
      <label>Item
        <input class="extra-name" type="text" value="${escapeHtml(data.name || '')}" placeholder="Cork insert, rubber feet..." />
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
    byId('extrasRows').appendChild(row);
    row.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', update);
      input.addEventListener('change', update);
    });
    row.querySelector('.remove-button').addEventListener('click', () => {
      row.remove();
      update();
    });
    update();
  }

  function addPrintRow(data = {}) {
    const row = document.createElement('div');
    row.className = 'line-row print-row';
    row.innerHTML = `
      <label>Print name / location
        <input class="print-name" type="text" value="${escapeHtml(data.name || '')}" placeholder="Front chest, back print, sleeve..." />
      </label>
      <label>Print method
        <input class="print-method" type="text" value="${escapeHtml(data.method || '')}" placeholder="DTF, DTV, transfer..." />
      </label>
      <label>Print cost (£)
        <input class="print-cost" type="number" min="0" step="0.01" value="${data.cost ?? 0}" />
      </label>
      <button type="button" class="remove-button">Remove</button>
    `;
    byId('printRows').appendChild(row);
    row.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', update);
      input.addEventListener('change', update);
    });
    row.querySelector('.remove-button').addEventListener('click', () => {
      row.remove();
      update();
    });
    update();
  }

  function update() {
    toggleSection('section3d', checked('toggle3d'));
    toggleSection('sectionExtras', checked('toggleExtras'));
    toggleSection('sectionEngraving', checked('toggleEngraving'));
    toggleSection('sectionApparel', checked('toggleApparel'));
    toggleSection('labourInputs', checked('includeLabour'));

    const result = calculate();
    render(result);
  }

  function toggleSection(id, show) {
    const el = byId(id);
    if (el) el.classList.toggle('hidden', !show);
  }

  function calculate() {
    const enabled3d = checked('toggle3d');
    const enabledExtras = checked('toggleExtras');
    const enabledLabour = checked('includeLabour');
    const enabledEngraving = checked('toggleEngraving');
    const enabledApparel = checked('toggleApparel');

    const filamentPerGram = safeDivide(num('rollCost'), num('rollWeight'));
    const filamentCost = enabled3d ? filamentPerGram * num('filamentUsed') : 0;
    const electricityCost = enabled3d ? (num('printerWatts') / 1000) * num('printHours') * num('electricityRate') : 0;
    const printBeforeWaste = filamentCost + electricityCost;
    const wasteCost = enabled3d ? printBeforeWaste * (num('wastePercent') / 100) : 0;
    const printCost = printBeforeWaste + wasteCost;

    const extras = enabledExtras ? getExtraRows() : [];
    const extrasCost = extras.reduce((total, row) => total + row.cost, 0);

    const labourCost = enabledLabour ? num('hourlyWage') * (num('labourMinutes') / 60) : 0;

    const engravingMachine = enabledEngraving ? (num('engravingMinutes') / 60) * num('laserRate') : 0;
    const engravingLabour = enabledEngraving ? (num('engravingSetupMinutes') / 60) * num('hourlyWage') : 0;
    const engravingBeforeBuffer = engravingMachine + engravingLabour;
    const engravingBufferCost = enabledEngraving ? engravingBeforeBuffer * (num('engravingBuffer') / 100) : 0;
    const engravingCost = engravingBeforeBuffer + engravingBufferCost;

    const prints = enabledApparel ? getPrintRows() : [];
    const apparelPrintCost = prints.reduce((total, row) => total + row.cost, 0);
    const apparelCost = enabledApparel ? num('garmentCost') + apparelPrintCost : 0;

    const baseCost = printCost + extrasCost + labourCost + engravingCost + apparelCost;
    const postage = checked('includePostage') ? num('postageCost') : 0;
    const costBasis = baseCost + postage;

    const markupRates = [30, 50, 70, num('customMarkup')]
      .map(rate => Number.isFinite(rate) ? rate : 0)
      .filter((rate, index, arr) => arr.findIndex(item => item.toFixed(2) === rate.toFixed(2)) === index);

    const prices = markupRates.map(markup => {
      const subtotal = costBasis * (1 + markup / 100);
      const feeEstimate = subtotal * (num('feePercent') / 100) + num('fixedFee');
      const priceBeforeVat = subtotal + feeEstimate;
      const vat = checked('includeVat') ? priceBeforeVat * (num('vatRate') / 100) : 0;
      const salePrice = priceBeforeVat + vat;
      return {
        markup,
        salePrice,
        feeEstimate,
        vat,
        profitBeforeVat: salePrice - vat - feeEstimate - costBasis
      };
    });

    const customPrice = prices[prices.length - 1] || { feeEstimate: 0, vat: 0 };

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
      costBasis,
      feeEstimate: customPrice.feeEstimate,
      vat: customPrice.vat,
      prices
    };
  }

  function getExtraRows() {
    return [...document.querySelectorAll('#extrasRows .extra-row')].map(row => {
      const name = row.querySelector('.extra-name').value.trim() || 'Unnamed extra';
      const packCost = Number(row.querySelector('.extra-pack-cost').value || 0);
      const packQty = Number(row.querySelector('.extra-pack-qty').value || 0);
      const qtyUsed = Number(row.querySelector('.extra-used').value || 0);
      const unitCost = safeDivide(packCost, packQty);
      return { name, packCost, packQty, qtyUsed, unitCost, cost: unitCost * qtyUsed };
    });
  }

  function getPrintRows() {
    return [...document.querySelectorAll('#printRows .print-row')].map(row => {
      const name = row.querySelector('.print-name').value.trim() || 'Unnamed print';
      const method = row.querySelector('.print-method').value.trim();
      const cost = Number(row.querySelector('.print-cost').value || 0);
      return { name, method, cost };
    });
  }

  function render(result) {
    byId('reportTitle').textContent = text('productName') || 'Untitled product';
    byId('reportRef').textContent = text('productRef') ? `Reference: ${text('productRef')}` : '';
    byId('reportNotes').textContent = text('productNotes') || 'No notes added.';

    byId('totalCost').textContent = money(result.baseCost);
    byId('trueCostNote').textContent = checked('includePostage')
      ? `Product cost is ${money(result.baseCost)}. Postage of ${money(result.postage)} is included when calculating sale prices.`
      : 'Before optional postage, fees and VAT.';

    setText('sum3d', money(result.printCost));
    setText('sumExtras', money(result.extrasCost));
    setText('sumLabour', money(result.labourCost));
    setText('sumEngraving', money(result.engravingCost));
    setText('sumApparel', money(result.apparelCost));
    setText('sumPostage', money(result.postage));
    setText('sumFees', money(result.feeEstimate));
    setText('sumVat', money(result.vat));

    byId('priceTable').innerHTML = result.prices.map(row => `
      <div class="price-row">
        <div>
          <span>${escapeHtml(row.markup)}% markup</span>
          <strong>${money(row.salePrice)}</strong>
          <span>Profit before VAT: ${money(row.profitBeforeVat)}</span>
        </div>
        <strong>${money(row.salePrice)}</strong>
      </div>
    `).join('');

    const lines = [];
    if (checked('toggle3d')) {
      lines.push(['Filament type', text('filamentType') || 'Not specified']);
      lines.push(['Filament cost', `${money(result.filamentCost)} (${money(result.filamentPerGram)} per g)`]);
      lines.push(['Printer electricity', money(result.electricityCost)]);
      lines.push(['3D print waste buffer', money(result.wasteCost)]);
    }

    if (checked('toggleExtras')) {
      result.extras.forEach(extra => {
        lines.push([`Extra: ${extra.name}`, `${money(extra.cost)} (${extra.qtyUsed} × ${money(extra.unitCost)})`]);
      });
    }

    if (checked('includeLabour')) {
      lines.push([`Manual labour${text('labourNotes') ? `: ${text('labourNotes')}` : ''}`, money(result.labourCost)]);
    }

    if (checked('toggleEngraving')) {
      lines.push([`Engraving machine time${text('engravingName') ? `: ${text('engravingName')}` : ''}`, money(result.engravingMachine)]);
      lines.push(['Engraving setup/cleaning labour', money(result.engravingLabour)]);
      lines.push(['Engraving buffer', money(result.engravingBufferCost)]);
    }

    if (checked('toggleApparel')) {
      const garmentLabel = [text('garmentCode'), text('garmentName')].filter(Boolean).join(' — ') || 'Garment';
      lines.push([garmentLabel, money(num('garmentCost'))]);
      result.prints.forEach(print => {
        const label = print.method ? `${print.name} (${print.method})` : print.name;
        lines.push([`Apparel print: ${label}`, money(print.cost)]);
      });
    }

    if (checked('includePostage')) lines.push(['Postage included in sale price calculations', money(result.postage)]);

    byId('breakdown').innerHTML = lines.length
      ? lines.map(([label, value]) => `<div class="breakdown-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')
      : '<p class="muted">Turn on at least one costing section to see a breakdown.</p>';
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value;
  }
})();
