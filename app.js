const canvas = document.querySelector('#gemCanvas');
const ctx = canvas.getContext('2d');
const colors = ['#76529d', '#8d68b1', '#aa85c5', '#c4a4d8', '#e0c7eb', '#f0ddf6'];

function drawGem() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const size = 13;
  const pattern = [
    '0000000000111111110000000000',
    '0000000111223333221110000000',
    '0000011223445555443221100000',
    '0001123455555555555432110000',
    '0011234555555555555543211000',
    '0112345555555555555554321100',
    '1123455555555555555555432110',
    '1234555555555555555555543211',
    '0123455555555555555555432100',
    '0012345555555555555554321000',
    '0001234555555555555543210000',
    '0000123455555555555432100000',
    '0000012345555555554321000000',
    '0000001234555555543210000000',
    '0000000123455555432100000000',
    '0000000012345554321000000000',
    '0000000001234543210000000000',
    '0000000000123432100000000000',
  ];
  const offsetX = 95, offsetY = 18;
  pattern.forEach((row, y) => [...row].forEach((value, x) => {
    if (value === '0') return;
    const px = offsetX + x * size, py = offsetY + y * size;
    ctx.fillStyle = colors[Number(value)];
    ctx.beginPath();
    ctx.moveTo(px + size / 2, py); ctx.lineTo(px + size, py + size / 2);
    ctx.lineTo(px + size / 2, py + size); ctx.lineTo(px, py + size / 2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.stroke();
  }));
}

drawGem();

const dialog = document.querySelector('#projectDialog');
const input = document.querySelector('#artwork');
const continueBtn = document.querySelector('#continueBtn');
document.querySelector('#startProject').addEventListener('click', () => dialog.showModal());
document.querySelector('.new-project').addEventListener('click', () => dialog.showModal());
input.addEventListener('change', () => {
  const file = input.files[0];
  document.querySelector('#fileName').textContent = file ? `✓ ${file.name} selected` : '';
  continueBtn.disabled = !file;
  if (file && !document.querySelector('#setupView').hidden) showSetup(file);
});
let selectedImage = null;
let aspectRatio = 3 / 4;
let generatedPattern = null;

function showSetup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    selectedImage = new Image();
    selectedImage.onload = () => {
      aspectRatio = selectedImage.width / selectedImage.height;
      document.querySelector('#sourceFrame').style.aspectRatio = `${selectedImage.width} / ${selectedImage.height}`;
      document.querySelector('#sourcePreview').src = reader.result;
      document.querySelector('#sourceName').textContent = file.name;
      document.querySelector('#sourceDimensions').textContent = `${selectedImage.width} × ${selectedImage.height} px`;
      document.querySelector('#sourceFormat').textContent = (file.type.split('/')[1] || 'image').toUpperCase();
      document.querySelector('#sourceMeta').textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB · Original preserved locally`;
      document.querySelector('#targetHeight').value = (12 / aspectRatio).toFixed(1);
      updateGridMath();
    };
    selectedImage.src = reader.result;
  };
  reader.readAsDataURL(file);
  document.querySelector('#dashboardView').hidden = true;
  document.querySelector('#setupView').hidden = false;
  document.querySelector('header').hidden = true;
}

function updateGridMath(changedField) {
  const widthInput = document.querySelector('#targetWidth');
  const heightInput = document.querySelector('#targetHeight');
  if (document.querySelector('#lockRatio').checked && selectedImage) {
    if (changedField === widthInput) heightInput.value = (Number(widthInput.value) / aspectRatio).toFixed(1);
    if (changedField === heightInput) widthInput.value = (Number(heightInput.value) * aspectRatio).toFixed(1);
  }
  const width = Math.max(1, Number(widthInput.value) || 1);
  const height = Math.max(1, Number(heightInput.value) || 1);
  const [, pitchValue] = document.querySelector('#drillProfile').value.split(':');
  const pitch = Number(pitchValue);
  const rounder = Math[document.querySelector('#roundingMode').value];
  const columns = Math.max(1, rounder(width * 25.4 / pitch));
  const rows = Math.max(1, rounder(height * 25.4 / pitch));
  const actualWidth = columns * pitch / 25.4;
  const actualHeight = rows * pitch / 25.4;
  const signed = value => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
  document.querySelector('#gridDimensions').textContent = `${columns} × ${rows} cells`;
  document.querySelector('#actualSize').textContent = `${actualWidth.toFixed(2)} × ${actualHeight.toFixed(2)} in`;
  document.querySelector('#sizeDifference').textContent = `${signed(actualWidth - width)} × ${signed(actualHeight - height)} in`;
  return { columns, rows };
}

continueBtn.addEventListener('click', (event) => {
  event.preventDefault();
  if (!input.files.length) return;
  dialog.close();
  showSetup(input.files[0]);
});

document.querySelectorAll('#targetWidth, #targetHeight').forEach(field => field.addEventListener('input', () => updateGridMath(field)));
document.querySelectorAll('#drillProfile, #roundingMode, #lockRatio').forEach(field => field.addEventListener('change', () => updateGridMath()));
document.querySelector('#roundingMode').addEventListener('change', event => {
  const explanations = {
    round: 'Uses the closest whole number of drills, so the finished size changes as little as possible.',
    floor: 'Uses fewer cells when necessary, so the finished design will never exceed the requested dimensions.',
    ceil: 'Uses extra cells when necessary, so the finished design will never be smaller than the requested dimensions.',
  };
  document.querySelector('#roundingHelp').textContent = explanations[event.target.value];
});
document.querySelector('#replaceArtwork').addEventListener('click', () => input.click());
document.querySelector('#backToProjects').addEventListener('click', () => {
  document.querySelector('#setupView').hidden = true;
  document.querySelector('#dashboardView').hidden = false;
  document.querySelector('header').hidden = false;
});
document.querySelector('#generatePattern').addEventListener('click', () => {
  if (!selectedImage) return;
  const vendors = [...document.querySelectorAll('.vendor-choice:checked')].map(choice => choice.value);
  const vendorError = document.querySelector('#vendorError');
  vendorError.hidden = vendors.length > 0;
  if (!vendors.length) return;
  const { columns, rows } = updateGridMath();
  const [drillShape] = document.querySelector('#drillProfile').value.split(':');
  const sample = document.createElement('canvas');
  sample.width = columns;
  sample.height = rows;
  sample.getContext('2d').drawImage(selectedImage, 0, 0, sample.width, sample.height);
  const pixels = sample.getContext('2d').getImageData(0, 0, columns, rows).data;
  const maximumColors = document.querySelector('#maxColors').value;
  const buckets = new Map();
  for (let index = 0; index < pixels.length; index += 4) {
    const color = [pixels[index], pixels[index + 1], pixels[index + 2]];
    const key = color.map(channel => Math.min(255, Math.round(channel / 32) * 32)).join(',');
    const entry = buckets.get(key) || { color, count: 0 };
    entry.count += 1;
    buckets.set(key, entry);
  }
  const availableColors = [...buckets.values()].sort((a, b) => b.count - a.count);
  const limit = maximumColors === 'all' ? availableColors.length : Number(maximumColors);
  const palette = availableColors.slice(0, limit).map(entry => entry.color);
  const cells = [];
  const counts = new Array(palette.length).fill(0);
  for (let index = 0; index < pixels.length; index += 4) {
    let closest = 0;
    let distance = Infinity;
    palette.forEach((color, paletteIndex) => {
      const candidate = (pixels[index] - color[0]) ** 2 + (pixels[index + 1] - color[1]) ** 2 + (pixels[index + 2] - color[2]) ** 2;
      if (candidate < distance) { distance = candidate; closest = paletteIndex; }
    });
    cells.push(closest);
    counts[closest] += 1;
  }
  generatedPattern = { columns, rows, palette, cells, counts, vendors, drillShape };
  renderPattern();
  document.querySelector('#patternStats').innerHTML = `<strong>${columns} × ${rows}</strong><span>${(columns * rows).toLocaleString()} drills</span><span>${palette.length} colors</span><span>${drillShape === 'round' ? 'Round' : 'Square'} drills</span>`;
  document.querySelector('#patternVendors').innerHTML = `<small>VENDORS</small>${vendors.map(vendor => `<span>${vendor}</span>`).join('')}`;
  document.querySelector('#patternPalette').innerHTML = palette.map((color, index) => `<span title="Color ${index + 1}: ${counts[index].toLocaleString()} drills" style="--swatch:rgb(${color.join(',')})"></span>`).join('');
  const result = document.querySelector('#patternResult');
  result.hidden = false;
  result.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.querySelectorAll('.vendor-choice').forEach(choice => choice.addEventListener('change', () => {
  const hasVendor = document.querySelectorAll('.vendor-choice:checked').length > 0;
  document.querySelector('#vendorError').hidden = hasVendor;
  if (generatedPattern) document.querySelector('#patternResult').hidden = true;
}));

function renderPattern() {
  if (!generatedPattern) return;
  const { columns, rows, palette, cells, drillShape } = generatedPattern;
  const cellSize = Number(document.querySelector('#previewZoom').value);
  const showGrid = document.querySelector('#showGrid').checked && cellSize >= 4;
  const output = document.querySelector('#patternCanvas');
  output.width = columns * cellSize;
  output.height = rows * cellSize;
  const context = output.getContext('2d');
  context.fillStyle = drillShape === 'round' ? '#eeeaf0' : '#ffffff';
  context.fillRect(0, 0, output.width, output.height);
  cells.forEach((paletteIndex, index) => {
    const color = palette[paletteIndex];
    const x = (index % columns) * cellSize;
    const y = Math.floor(index / columns) * cellSize;
    context.fillStyle = `rgb(${color.join(',')})`;
    if (drillShape === 'round') {
      context.beginPath();
      context.arc(x + cellSize / 2, y + cellSize / 2, Math.max(.75, cellSize * .44), 0, Math.PI * 2);
      context.fill();
      if (showGrid) {
        context.strokeStyle = 'rgba(35,30,45,.22)';
        context.lineWidth = 1;
        context.stroke();
      }
    } else {
      context.fillRect(x, y, cellSize, cellSize);
    }
    if (showGrid && drillShape === 'square') {
      context.strokeStyle = 'rgba(35,30,45,.18)';
      context.lineWidth = 1;
      context.strokeRect(x + .5, y + .5, cellSize - 1, cellSize - 1);
    }
  });
}

document.querySelector('#previewZoom').addEventListener('input', renderPattern);
document.querySelector('#showGrid').addEventListener('change', renderPattern);
document.querySelector('#downloadPreview').addEventListener('click', () => {
  if (!generatedPattern) return;
  const link = document.createElement('a');
  link.download = 'diamond-pattern-preview.png';
  link.href = document.querySelector('#patternCanvas').toDataURL('image/png');
  link.click();
});

document.querySelectorAll('.project-card').forEach(card => card.addEventListener('click', () => {
  card.animate([{ transform: 'translateY(-3px)' }, { transform: 'translateY(-3px) scale(.99)' }, { transform: 'translateY(-3px)' }], { duration: 240 });
}));
