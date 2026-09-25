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
const maximumArtworkBytes = 100 * 1024 * 1024;
document.querySelector('#startProject').addEventListener('click', () => dialog.showModal());
document.querySelector('.new-project').addEventListener('click', () => dialog.showModal());
input.addEventListener('change', () => {
  const file = input.files[0];
  if (file && file.size > maximumArtworkBytes) {
    document.querySelector('#fileName').textContent = 'Import failed: This file is larger than the 100 MB limit.';
    continueBtn.disabled = true;
    return;
  }
  document.querySelector('#fileName').textContent = file ? `✓ ${file.name} selected` : '';
  continueBtn.disabled = !file;
  if (file && !document.querySelector('#setupView').hidden) importArtwork(file);
});
let selectedImage = null;
let sourceAsset = null;
let aspectRatio = 3 / 4;
let generatedPattern = null;
let imageAnalysis = null;
let recommendedDimensions = null;
let recommendationTiers = [];
let recommendationTierIndex = 1;
let backgroundSelection = null;
let selectingBackground = false;
let editorTool = 'paint';
let editorPaletteIndex = 0;
let editorUndoStack = [];
let editorRedoStack = [];
let activeEditTransaction = null;

function resolvedSamplingMode() {
  const choice = document.querySelector('#artworkSampling').value;
  if (choice !== 'automatic') return choice;
  return sourceAsset?.artworkType === 'illustration' ? 'crisp' : 'smooth';
}

function updateSamplingHelp() {
  const choice = document.querySelector('#artworkSampling').value;
  const detected = sourceAsset?.artworkType === 'illustration' ? 'crisp' : 'smooth';
  const applied = choice === 'automatic' ? detected : choice;
  document.querySelector('#samplingHelp').textContent = choice === 'automatic'
    ? `Automatic detected ${detected} artwork and will use ${applied} sampling. Override this if the preview does not match the source.`
    : `${applied === 'smooth' ? 'Smooth sampling blends source pixels while resizing.' : 'Crisp sampling keeps hard pixel edges while resizing.'} Regenerate the pattern to apply this choice.`;
}

async function importArtwork(file) {
  const status = document.querySelector('#fileName');
  continueBtn.disabled = true;
  status.textContent = `Checking ${file.name}…`;
  const formData = new FormData();
  formData.append('artwork', file);
  try {
    const response = await fetch('/api/artwork/inspect', { method: 'POST', body: formData });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'The artwork could not be imported.');
    sourceAsset = result;
    recommendationTierIndex = 1;
    backgroundSelection = null;
    selectingBackground = false;
    document.querySelector('#sourceFrame').classList.remove('background-pick-active');
    document.querySelector('#backgroundSelectionStatus').textContent = 'Click the background in the artwork preview.';
    selectedImage = new Image();
    await new Promise((resolve, reject) => {
      selectedImage.onload = resolve;
      selectedImage.onerror = () => reject(new Error('The validated preview could not be loaded.'));
      selectedImage.src = result.previewUrl;
    });
    aspectRatio = result.width / result.height;
    document.querySelector('#sourceFrame').style.aspectRatio = `${result.width} / ${result.height}`;
    document.querySelector('#sourcePreview').src = result.previewUrl;
    updateCropPreview();
    document.querySelector('#sourceName').textContent = result.fileName;
    document.querySelector('#sourceDimensions').textContent = `${result.width} × ${result.height} px`;
    document.querySelector('#sourceFormat').textContent = result.format;
    const frameNote = result.frameCount > 1 ? ` · Using page 1 of ${result.frameCount}` : '';
    const typeLabel = result.artworkType === 'illustration' ? 'Illustration detected' : 'Photo detected';
    document.querySelector('#sourceMeta').textContent = `${(result.fileSize / 1024 / 1024).toFixed(2)} MB · Validated and staged locally · ${typeLabel}${frameNote}`;
    document.querySelector('#targetHeight').value = (30 / aspectRatio).toFixed(1);
    imageAnalysis = analyzeImage(selectedImage);
    imageAnalysis.hasTransparency = result.hasTransparency;
    imageAnalysis.sourceWidth = result.width;
    imageAnalysis.sourceHeight = result.height;
    document.querySelector('#transparencyOptions').hidden = !result.hasTransparency;
    if (result.hasTransparency) document.querySelector('#sourceMeta').textContent += ' · Transparency detected';
    updateSamplingHelp();
    updateRecommendation();
    applyRecommendedSize();
    status.textContent = `✓ ${result.fileName} imported`;
    continueBtn.disabled = false;
    document.querySelector('#dashboardView').hidden = true;
    document.querySelector('#setupView').hidden = false;
    document.querySelector('header').hidden = true;
    dialog.close();
  } catch (error) {
    sourceAsset = null;
    selectedImage = null;
    status.textContent = `Import failed: ${error.message}`;
    status.style.height = 'auto';
    continueBtn.disabled = false;
  }
}

function analyzeImage(image) {
  const analysisCanvas = document.createElement('canvas');
  const longestSide = 160;
  const scale = Math.min(1, longestSide / Math.max(image.width, image.height));
  analysisCanvas.width = Math.max(2, Math.round(image.width * scale));
  analysisCanvas.height = Math.max(2, Math.round(image.height * scale));
  const context = analysisCanvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = document.querySelector('#backgroundColor').value;
  context.fillRect(0, 0, analysisCanvas.width, analysisCanvas.height);
  context.drawImage(image, 0, 0, analysisCanvas.width, analysisCanvas.height);
  const data = context.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height).data;
  const transparencyCanvas = document.createElement('canvas');
  transparencyCanvas.width = analysisCanvas.width;
  transparencyCanvas.height = analysisCanvas.height;
  const transparencyContext = transparencyCanvas.getContext('2d', { willReadFrequently: true });
  transparencyContext.drawImage(image, 0, 0, transparencyCanvas.width, transparencyCanvas.height);
  const alphaData = transparencyContext.getImageData(0, 0, transparencyCanvas.width, transparencyCanvas.height).data;
  let hasTransparency = false;
  for (let index = 3; index < alphaData.length; index += 4) {
    if (alphaData[index] < 250) { hasTransparency = true; break; }
  }
  const colors = new Set();
  let edgeTotal = 0;
  let edgeSamples = 0;
  const luminance = index => data[index] * .2126 + data[index + 1] * .7152 + data[index + 2] * .0722;
  for (let y = 0; y < analysisCanvas.height; y += 1) {
    for (let x = 0; x < analysisCanvas.width; x += 1) {
      const index = (y * analysisCanvas.width + x) * 4;
      colors.add(`${data[index] >> 5},${data[index + 1] >> 5},${data[index + 2] >> 5}`);
      if (x && y) {
        edgeTotal += Math.abs(luminance(index) - luminance(index - 4));
        edgeTotal += Math.abs(luminance(index) - luminance(index - analysisCanvas.width * 4));
        edgeSamples += 2;
      }
    }
  }
  const edgeScore = Math.min(1, edgeTotal / Math.max(1, edgeSamples) / 32);
  const colorScore = Math.min(1, colors.size / 220);
  const score = edgeScore * .65 + colorScore * .35;
  const level = score > .58 ? 'High detail' : score > .34 ? 'Moderate detail' : 'Simple detail';
  const detailCells = score > .58 ? 170 : score > .34 ? 130 : 90;
  const sourceShortSide = Math.min(image.width, image.height);
  const shortestCells = Math.max(40, Math.min(detailCells, sourceShortSide));
  const resolutionLimited = sourceShortSide < detailCells;
  return { level, shortestCells, colorGroups: colors.size, resolutionLimited, hasTransparency, sourceWidth: image.width, sourceHeight: image.height };
}

function cropRegion() {
  const zoom = Number(document.querySelector('#cropZoom').value) / 100;
  const focusX = Number(document.querySelector('#cropX').value) / 100;
  const focusY = Number(document.querySelector('#cropY').value) / 100;
  const width = Math.max(1, Number(document.querySelector('#targetWidth').value) || 1);
  const height = Math.max(1, Number(document.querySelector('#targetHeight').value) || 1);
  return PatternGeometry.calculateCropRegion(selectedImage.width, selectedImage.height, width / height, zoom, focusX, focusY);
}

function updateCropPreview() {
  if (!selectedImage) return;
  const zoom = Number(document.querySelector('#cropZoom').value);
  const x = Number(document.querySelector('#cropX').value);
  const y = Number(document.querySelector('#cropY').value);
  const color = document.querySelector('#backgroundColor').value;
  const preview = document.querySelector('#sourcePreview');
  const crop = cropRegion();
  const targetRatio = crop.width / crop.height;
  const retainedPercent = crop.width * crop.height / (selectedImage.width * selectedImage.height) * 100;
  preview.style.transform = `scale(${zoom / 100})`;
  preview.style.transformOrigin = `${x}% ${y}%`;
  preview.style.objectPosition = `${x}% ${y}%`;
  const frame = document.querySelector('#sourceFrame');
  frame.style.background = color;
  frame.style.aspectRatio = `${targetRatio}`;
  frame.style.maxWidth = targetRatio < 1 ? `${560 * targetRatio}px` : '100%';
  document.querySelector('#cropZoomValue').textContent = `${zoom}%`;
  document.querySelector('#backgroundValue').textContent = color.toUpperCase();
  document.querySelector('#cropSummary').textContent = retainedPercent > 99.5
    ? 'The full artwork fits the selected pattern ratio.'
    : `${retainedPercent.toFixed(0)}% of the artwork is inside the crop. Adjust the focus controls to reposition it.`;
  document.querySelector('#patternResult').hidden = true;
}

function updateBackgroundTreatmentControls() {
  const mode = document.querySelector('#backgroundTreatment').value;
  document.querySelector('#backgroundSelectionControls').hidden = mode === 'preserve';
  document.querySelector('#simplifyControls').hidden = mode !== 'simplify';
  document.querySelector('#solidBackgroundControl').hidden = mode !== 'solid';
  document.querySelector('#manualShadeColors').hidden = document.querySelector('#backgroundShadeSource').value !== 'manual';
  if (generatedPattern) document.querySelector('#patternResult').hidden = true;
}

function sampleSelectedBackground(event) {
  if (!selectingBackground || !selectedImage) return;
  const frame = document.querySelector('#sourceFrame');
  const bounds = frame.getBoundingClientRect();
  const u = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
  const v = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
  const crop = cropRegion();
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = 1; sampleCanvas.height = 1;
  const sampleContext = sampleCanvas.getContext('2d');
  sampleContext.drawImage(selectedImage, crop.x + crop.width * u, crop.y + crop.height * v, 1, 1, 0, 0, 1, 1);
  const color = [...sampleContext.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  backgroundSelection = { u, v, color };
  selectingBackground = false;
  frame.classList.remove('background-pick-active');
  document.querySelector('#backgroundSelectionStatus').textContent = `Background selected at ${Math.round(u * 100)}%, ${Math.round(v * 100)}% · RGB ${color.join(', ')}`;
  if (generatedPattern) document.querySelector('#patternResult').hidden = true;
}

function updateRecommendation() {
  if (!imageAnalysis || !selectedImage) return;
  const [, pitchValue] = document.querySelector('#drillProfile').value.split(':');
  const pitch = Number(pitchValue);
  recommendationTiers = PatternGeometry.calculateSizeTiers(imageAnalysis.shortestCells, aspectRatio, pitch);
  const selectedTier = recommendationTiers[recommendationTierIndex];
  const { columns, rows, widthCm: width, heightCm: height } = selectedTier;
  recommendedDimensions = { width, height };
  const printWidth = Math.ceil(width / 2.54);
  const printHeight = Math.ceil(height / 2.54);
  const tierLabels = ['Smaller', 'Recommended', 'Larger'];
  const sizeTier = document.querySelector('#sizeTier');
  sizeTier.innerHTML = recommendationTiers.map((tier, index) => `<option value="${index}">${tierLabels[index]} — ${tier.widthCm.toFixed(1)} × ${tier.heightCm.toFixed(1)} cm (${tier.columns} × ${tier.rows} drills)</option>`).join('');
  sizeTier.value = String(recommendationTierIndex);
  sizeTier.disabled = false;
  document.querySelector('#recommendedSize').textContent = `Selected: ${width.toFixed(1)} × ${height.toFixed(1)} cm`;
  const resolutionNote = imageAnalysis.resolutionLimited ? ' · limited by source resolution' : '';
  document.querySelector('#recommendationReason').textContent = `${tierLabels[recommendationTierIndex]} detail · ${columns} × ${rows} drills · fits a ${printWidth} × ${printHeight} in print file${resolutionNote}`;
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
  const layout = PatternGeometry.calculatePrintLayout(width, height, pitch, {
    roundingMode: document.querySelector('#roundingMode').value,
  });
  const { columns, rows, exactWidthCm: actualWidth, exactHeightCm: actualHeight } = layout;
  const signed = value => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
  document.querySelector('#gridDimensions').textContent = `${columns} × ${rows} cells`;
  document.querySelector('#actualSize').textContent = `${actualWidth.toFixed(2)} × ${actualHeight.toFixed(2)} cm`;
  document.querySelector('#actualSizeInches').textContent = `${layout.exactWidthIn.toFixed(2)} × ${layout.exactHeightIn.toFixed(2)} in`;
  document.querySelector('#recommendedPrintSize').textContent = `${layout.recommendedWidthIn} × ${layout.recommendedHeightIn} in`;
  document.querySelector('#sizeDifference').textContent = `${signed(actualWidth - width)} × ${signed(actualHeight - height)} cm`;
  document.querySelector('#setupWarning').textContent = `ⓘ Do not round the diamond area. Use a ${layout.recommendedWidthIn} × ${layout.recommendedHeightIn} in print file; the extra space becomes centered margins.`;
  if (generatedPattern) document.querySelector('#preflightPanel').hidden = true;
  if (selectedImage) updateCropPreview();
  return layout;
}

function cleanPatternCells(sourceCells, columns, rows, strength) {
  if (strength === 'off') return { cells: sourceCells, changed: 0 };
  const settings = {
    light: { passes: 1, majority: 6 },
    balanced: { passes: 1, majority: 5 },
    strong: { passes: 2, majority: 4 },
  }[strength];
  let cells = [...sourceCells];
  let changed = 0;
  for (let pass = 0; pass < settings.passes; pass += 1) {
    const next = [...cells];
    for (let y = 1; y < rows - 1; y += 1) {
      for (let x = 1; x < columns - 1; x += 1) {
        const index = y * columns + x;
        if (cells[index] === -1) continue;
        const neighbors = [];
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (offsetX || offsetY) {
              const neighbor = cells[(y + offsetY) * columns + x + offsetX];
              if (neighbor !== -1) neighbors.push(neighbor);
            }
          }
        }
        if (!neighbors.length) continue;
        const frequencies = new Map();
        neighbors.forEach(color => frequencies.set(color, (frequencies.get(color) || 0) + 1));
        const [majorityColor, majorityCount] = [...frequencies.entries()].sort((a, b) => b[1] - a[1])[0];
        const matchingNeighbors = frequencies.get(cells[index]) || 0;
        if (majorityColor !== cells[index] && majorityCount >= settings.majority && matchingNeighbors <= 1) {
          next[index] = majorityColor;
          changed += 1;
        }
      }
    }
    cells = next;
  }
  return { cells, changed };
}

continueBtn.addEventListener('click', async (event) => {
  event.preventDefault();
  if (!input.files.length) return;
  await importArtwork(input.files[0]);
});

document.querySelectorAll('#targetWidth, #targetHeight').forEach(field => field.addEventListener('input', () => updateGridMath(field)));
document.querySelectorAll('#drillProfile, #roundingMode, #lockRatio').forEach(field => field.addEventListener('change', () => updateGridMath()));
document.querySelector('#drillProfile').addEventListener('change', () => {
  updateRecommendation();
  applyRecommendedSize();
});
function applyRecommendedSize() {
  if (!recommendedDimensions) return;
  document.querySelector('#targetWidth').value = recommendedDimensions.width.toFixed(1);
  document.querySelector('#targetHeight').value = recommendedDimensions.height.toFixed(1);
  updateGridMath();
}
document.querySelector('#sizeTier').addEventListener('change', event => {
  recommendationTierIndex = Number(event.target.value);
  updateRecommendation();
  applyRecommendedSize();
});
document.querySelectorAll('#cropZoom, #cropX, #cropY').forEach(control => control.addEventListener('input', updateCropPreview));
document.querySelector('#backgroundColor').addEventListener('input', () => {
  updateCropPreview();
  if (selectedImage) {
    imageAnalysis = analyzeImage(selectedImage);
    updateRecommendation();
  }
});
document.querySelector('#resetCrop').addEventListener('click', () => {
  document.querySelector('#cropZoom').value = 100;
  document.querySelector('#cropX').value = 50;
  document.querySelector('#cropY').value = 50;
  updateCropPreview();
});
document.querySelector('#backgroundTreatment').addEventListener('change', updateBackgroundTreatmentControls);
document.querySelector('#backgroundShadeSource').addEventListener('change', updateBackgroundTreatmentControls);
document.querySelector('#selectBackground').addEventListener('click', () => {
  selectingBackground = true;
  document.querySelector('#sourceFrame').classList.add('background-pick-active');
  document.querySelector('#backgroundSelectionStatus').textContent = 'Click the intended background in the artwork preview.';
});
document.querySelector('#sourceFrame').addEventListener('click', sampleSelectedBackground);
document.querySelector('#backgroundTolerance').addEventListener('input', event => {
  document.querySelector('#backgroundToleranceValue').textContent = event.target.value;
  if (generatedPattern) document.querySelector('#patternResult').hidden = true;
});
document.querySelector('#artworkSampling').addEventListener('change', () => {
  updateSamplingHelp();
  if (generatedPattern) document.querySelector('#patternResult').hidden = true;
});
document.querySelectorAll('#backgroundShadeCount, #backgroundDarkColor, #backgroundLightColor, #solidBackgroundColor, #solidBackgroundStyle').forEach(control => control.addEventListener('input', () => {
  if (generatedPattern) document.querySelector('#patternResult').hidden = true;
}));
document.querySelectorAll('input[name="transparencyMode"]').forEach(control => control.addEventListener('change', event => {
  document.querySelector('#opacityControl').hidden = event.target.value === 'fill';
  if (generatedPattern) document.querySelector('#patternResult').hidden = true;
}));
document.querySelector('#opacityThreshold').addEventListener('input', event => {
  document.querySelector('#opacityValue').textContent = `${event.target.value}%`;
  if (generatedPattern) document.querySelector('#patternResult').hidden = true;
});
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
document.querySelector('#generatePattern').addEventListener('click', async () => {
  if (!selectedImage) return;
  document.querySelector('#editorPanel').hidden = true;
  document.querySelector('#preflightPanel').hidden = true;
  editorUndoStack = [];
  editorRedoStack = [];
  const vendors = [...document.querySelectorAll('.vendor-choice:checked')].map(choice => choice.value);
  const vendorError = document.querySelector('#vendorError');
  vendorError.hidden = vendors.length > 0;
  if (!vendors.length) return;
  const printLayout = updateGridMath();
  const { columns, rows } = printLayout;
  const [drillShape] = document.querySelector('#drillProfile').value.split(':');
  const sample = document.createElement('canvas');
  sample.width = columns;
  sample.height = rows;
  const sampleContext = sample.getContext('2d');
  const samplingMode = resolvedSamplingMode();
  const illustrationMode = samplingMode === 'crisp';
  sampleContext.imageSmoothingEnabled = !illustrationMode;
  if (!illustrationMode) sampleContext.imageSmoothingQuality = 'high';
  const transparencyMode = document.querySelector('input[name="transparencyMode"]:checked').value;
  if (transparencyMode === 'fill') {
    sampleContext.fillStyle = document.querySelector('#backgroundColor').value;
    sampleContext.fillRect(0, 0, sample.width, sample.height);
  }
  const crop = cropRegion();
  sampleContext.drawImage(selectedImage, crop.x, crop.y, crop.width, crop.height, 0, 0, sample.width, sample.height);
  const pixels = sample.getContext('2d').getImageData(0, 0, columns, rows).data;
  const opacityThreshold = Number(document.querySelector('#opacityThreshold').value) / 100 * 255;
  const isOccupied = index => transparencyMode === 'fill' || pixels[index + 3] >= opacityThreshold;
  const artworkCleanup = document.querySelector('#artworkColorCleanup').value;
  const useFlatColorCleanup = artworkCleanup === 'flat' || (artworkCleanup === 'automatic' && illustrationMode);
  const flatColorCleanup = useFlatColorCleanup
    ? PatternConversion.flattenSimilarColors(pixels, isOccupied, 7)
    : { colorsBefore: 0, colorsAfter: 0, changedCells: 0 };
  const backgroundMode = document.querySelector('#backgroundTreatment').value;
  if (backgroundMode !== 'preserve' && !backgroundSelection) {
    document.querySelector('#backgroundSelectionStatus').textContent = 'Select the background on the artwork before generating.';
    document.querySelector('#sourceFrame').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const generateButton = document.querySelector('#generatePattern');
  const originalButtonText = generateButton.innerHTML;
  generateButton.disabled = true;
  generateButton.textContent = 'Generating…';
  document.querySelector('#setupWarning').textContent = 'Matching artwork to the DMC drill palette…';
  await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  try {
  let backgroundMask = null;
  if (backgroundMode !== 'preserve') {
    backgroundMask = PatternConversion.selectConnectedBackground(
      pixels,
      columns,
      rows,
      backgroundSelection.u * (columns - 1),
      backgroundSelection.v * (rows - 1),
      Number(document.querySelector('#backgroundTolerance').value),
    );
    PatternConversion.applyBackgroundTreatment(pixels, backgroundMask, {
      mode: backgroundMode,
      shadeCount: Number(document.querySelector('#backgroundShadeCount').value),
      shadeSource: document.querySelector('#backgroundShadeSource').value,
      darkColor: document.querySelector('#backgroundDarkColor').value,
      lightColor: document.querySelector('#backgroundLightColor').value,
      solidColor: document.querySelector('#solidBackgroundColor').value,
      solidStyle: document.querySelector('#solidBackgroundStyle').value,
    });
  }
  const maximumColors = document.querySelector('#maxColors').value;
  const limit = maximumColors === 'all' ? Infinity : Number(maximumColors);
  const dmcReference = globalThis.DmcPalette;
  if (!Array.isArray(dmcReference) || dmcReference.length !== 447) {
    throw new Error('The DMC color reference did not load. Refresh the page and try again.');
  }
  let dmcAssignments = PatternConversion.buildReferencePalette(pixels, isOccupied, limit, dmcReference);
  let palette = dmcAssignments.map(color => color.rgb);
  const mappedCells = [];
  for (let index = 0; index < pixels.length; index += 4) {
    if (!isOccupied(index)) { mappedCells.push(-1); continue; }
    let closest = 0;
    let distance = Infinity;
    palette.forEach((color, paletteIndex) => {
      const candidate = (pixels[index] - color[0]) ** 2 + (pixels[index + 1] - color[1]) ** 2 + (pixels[index + 2] - color[2]) ** 2;
      if (candidate < distance) { distance = candidate; closest = paletteIndex; }
    });
    mappedCells.push(closest);
  }
  const cleanupStrength = document.querySelector('#cleanupStrength').value;
  const cleanup = cleanPatternCells(mappedCells, columns, rows, cleanupStrength);
  const consolidation = PatternConversion.consolidateRareColors(dmcAssignments, cleanup.cells, 11);
  dmcAssignments = consolidation.assignments;
  palette = dmcAssignments.map(color => color.rgb);
  const cells = consolidation.cells;
  const counts = consolidation.counts;
  const occupiedCells = cells.filter(color => color !== -1).length;
  const treatedBackgroundCells = backgroundMask ? backgroundMask.reduce((total, selected) => total + selected, 0) : 0;
  generatedPattern = { columns, rows, palette, dmcAssignments, cells, counts, vendors, drillShape, printLayout, cleanupStrength, cleanedCells: cleanup.changed, rareColorsMerged: consolidation.removedColors, flatColorsMerged: Math.max(0, flatColorCleanup.colorsBefore - flatColorCleanup.colorsAfter), transparencyMode, occupiedCells, artworkType: sourceAsset?.artworkType || 'photo', samplingMode, backgroundMode, treatedBackgroundCells };
  renderPattern();
  document.querySelector('#patternStats').innerHTML = `<strong>${columns} × ${rows}</strong><span data-stat="occupied">${occupiedCells.toLocaleString()} drills</span><span data-stat="empty" ${occupiedCells === columns * rows ? 'hidden' : ''}>${(columns * rows - occupiedCells).toLocaleString()} blank cells</span><span>${palette.length} colors</span><span>${cleanup.changed.toLocaleString()} cells cleaned</span>${flatColorCleanup.changedCells ? `<span>${flatColorCleanup.changedCells.toLocaleString()} flat-color cells cleaned</span>` : ''}${consolidation.removedColors ? `<span>${consolidation.removedColors.toLocaleString()} rare colors merged</span>` : ''}${backgroundMode !== 'preserve' ? `<span>${treatedBackgroundCells.toLocaleString()} background cells treated</span>` : ''}<span>${illustrationMode ? 'Crisp illustration' : 'Smooth photo'} sampling</span><span>${drillShape === 'round' ? 'Round' : 'Square'} drills</span>`;
  document.querySelector('#patternVendors').innerHTML = `<small>VENDORS</small>${vendors.map(vendor => `<span>${vendor}</span>`).join('')}`;
  document.querySelector('#patternPalette').innerHTML = dmcAssignments.map((color, index) => `<span title="DMC ${color.code} · ${color.name} · ${counts[index].toLocaleString()} drills"><i style="--swatch:rgb(${color.rgb.join(',')})"></i><b>${color.code}</b><small>${counts[index].toLocaleString()}</small></span>`).join('');
  const result = document.querySelector('#patternResult');
  result.hidden = false;
  result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.querySelector('#setupWarning').textContent = `ⓘ Keep the ${printLayout.exactWidthIn.toFixed(2)} × ${printLayout.exactHeightIn.toFixed(2)} in diamond area exact; use a ${printLayout.recommendedWidthIn} × ${printLayout.recommendedHeightIn} in print file.`;
  } catch (error) {
    console.error('Pattern generation failed:', error);
    document.querySelector('#setupWarning').textContent = `⚠ Pattern generation failed: ${error.message}`;
    document.querySelector('#setupWarning').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } finally {
    generateButton.disabled = false;
    generateButton.innerHTML = originalButtonText;
  }
});

document.querySelectorAll('.vendor-choice').forEach(choice => choice.addEventListener('change', () => {
  const hasVendor = document.querySelectorAll('.vendor-choice:checked').length > 0;
  document.querySelector('#vendorError').hidden = hasVendor;
  if (generatedPattern) document.querySelector('#patternResult').hidden = true;
}));
document.querySelectorAll('#maxColors, #cleanupStrength').forEach(control => control.addEventListener('change', () => {
  if (generatedPattern) document.querySelector('#patternResult').hidden = true;
}));

function drawGridCoordinates(context, { columns, rows, cellWidth, cellHeight, offsetX, offsetY, fontSize = 8, columnPrefix = '', rowPrefix = '', showTicks = false, columnInterval, rowInterval }) {
  columnInterval ||= PatternGeometry.calculateLabelInterval(cellWidth, fontSize * 2.4);
  rowInterval ||= PatternGeometry.calculateLabelInterval(cellHeight, fontSize * 1.7);
  context.save();
  context.fillStyle = '#33254a';
  context.font = `700 ${fontSize}px "DM Sans", sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (let column = 0; column < columns; column += columnInterval) {
    const x = offsetX + (column + .5) * cellWidth;
    context.fillText(`${columnPrefix}${column + 1}`, x, offsetY - fontSize * .9);
    if (showTicks) context.fillRect(Math.round(x), offsetY - 4, 1, 4);
  }
  context.textAlign = 'right';
  for (let row = 0; row < rows; row += rowInterval) {
    const y = offsetY + (row + .5) * cellHeight;
    context.fillText(`${rowPrefix}${row + 1}`, offsetX - fontSize * .65, y);
    if (showTicks) context.fillRect(offsetX - 4, Math.round(y), 4, 1);
  }
  context.restore();
}

function renderPattern() {
  if (!generatedPattern) return;
  const { columns, rows, palette, cells, drillShape, transparencyMode } = generatedPattern;
  const cellSize = Number(document.querySelector('#previewZoom').value);
  const showCoordinates = document.querySelector('#showCoordinates').checked;
  const labelGutter = showCoordinates ? 44 : 0;
  const showGrid = document.querySelector('#showGrid').checked && cellSize >= 4;
  const output = document.querySelector('#patternCanvas');
  output.width = columns * cellSize + labelGutter;
  output.height = rows * cellSize + labelGutter;
  const context = output.getContext('2d');
  context.clearRect(0, 0, output.width, output.height);
  if (showCoordinates) {
    context.fillStyle = '#f1eaf8';
    context.fillRect(0, 0, output.width, labelGutter);
    context.fillRect(0, labelGutter, labelGutter, output.height - labelGutter);
    context.fillStyle = '#6e548a';
    context.font = '700 8px "DM Sans", sans-serif';
    context.textAlign = 'center';
    context.fillText('C / R', labelGutter / 2, labelGutter / 2 + 3);
  }
  if (transparencyMode === 'fill') {
    context.fillStyle = drillShape === 'round' ? '#eeeaf0' : '#ffffff';
    context.fillRect(labelGutter, labelGutter, columns * cellSize, rows * cellSize);
  }
  cells.forEach((paletteIndex, index) => {
    if (paletteIndex === -1) return;
    const color = palette[paletteIndex];
    const x = labelGutter + (index % columns) * cellSize;
    const y = labelGutter + Math.floor(index / columns) * cellSize;
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
  context.strokeStyle = '#766b80';
  context.lineWidth = 1;
  context.strokeRect(labelGutter + .5, labelGutter + .5, columns * cellSize - 1, rows * cellSize - 1);
  if (showCoordinates) drawGridCoordinates(context, { columns, rows, cellWidth: cellSize, cellHeight: cellSize, offsetX: labelGutter, offsetY: labelGutter, fontSize: 9, columnPrefix: 'C', rowPrefix: 'R', showTicks: true });
}

function refreshPatternCounts() {
  if (!generatedPattern) return;
  const summary = PatternEditor.countCells(generatedPattern.cells, generatedPattern.palette.length);
  generatedPattern.counts = summary.counts;
  generatedPattern.occupiedCells = summary.occupied;
  document.querySelector('#editorOccupied').textContent = summary.occupied.toLocaleString();
  document.querySelector('#editorEmpty').textContent = summary.empty.toLocaleString();
  const occupiedStat = document.querySelector('[data-stat="occupied"]');
  const emptyStat = document.querySelector('[data-stat="empty"]');
  if (occupiedStat) occupiedStat.textContent = `${summary.occupied.toLocaleString()} drills`;
  if (emptyStat) {
    emptyStat.textContent = `${summary.empty.toLocaleString()} blank cells`;
    emptyStat.hidden = summary.empty === 0;
  }
  document.querySelector('#patternPalette').innerHTML = generatedPattern.dmcAssignments.map((color, index) => `<span title="DMC ${color.code} · ${color.name} · ${summary.counts[index].toLocaleString()} drills"><i style="--swatch:rgb(${color.rgb.join(',')})"></i><b>${color.code}</b><small>${summary.counts[index].toLocaleString()}</small></span>`).join('');
}

function renderEditorPalette() {
  if (!generatedPattern) return;
  const palette = document.querySelector('#editorPalette');
  palette.innerHTML = generatedPattern.dmcAssignments.map((color, index) => `<button type="button" role="option" aria-selected="${index === editorPaletteIndex}" class="${index === editorPaletteIndex ? 'selected' : ''}" data-palette-index="${index}"><i style="--swatch:rgb(${color.rgb.join(',')})"></i><span><b>DMC ${color.code}</b><small>${color.name} · ${generatedPattern.counts[index].toLocaleString()}</small></span></button>`).join('');
  palette.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    editorPaletteIndex = Number(button.dataset.paletteIndex);
    editorTool = 'paint';
    document.querySelectorAll('.editor-tool').forEach(tool => tool.classList.toggle('active', tool.dataset.tool === 'paint'));
    renderEditorPalette();
  }));
}

function renderEditor() {
  if (!generatedPattern) return;
  const { columns, rows, palette, cells, drillShape } = generatedPattern;
  const cellSize = Number(document.querySelector('#editorZoom').value);
  const gutter = 44;
  const canvas = document.querySelector('#editorCanvas');
  canvas.width = columns * cellSize + gutter;
  canvas.height = rows * cellSize + gutter;
  const context = canvas.getContext('2d');
  context.fillStyle = '#f1eaf8';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#fff';
  context.fillRect(gutter, gutter, columns * cellSize, rows * cellSize);
  cells.forEach((paletteIndex, index) => {
    if (paletteIndex < 0) return;
    const x = gutter + (index % columns) * cellSize;
    const y = gutter + Math.floor(index / columns) * cellSize;
    context.fillStyle = `rgb(${palette[paletteIndex].join(',')})`;
    if (drillShape === 'round') {
      context.beginPath();
      context.arc(x + cellSize / 2, y + cellSize / 2, cellSize * .42, 0, Math.PI * 2);
      context.fill();
    } else context.fillRect(x, y, cellSize, cellSize);
    context.strokeStyle = 'rgba(35,30,45,.18)';
    context.strokeRect(x + .5, y + .5, cellSize - 1, cellSize - 1);
  });
  context.beginPath();
  context.strokeStyle = 'rgba(35,30,45,.12)';
  context.lineWidth = 1;
  for (let column = 0; column <= columns; column += 1) {
    const x = gutter + column * cellSize + .5;
    context.moveTo(x, gutter);
    context.lineTo(x, gutter + rows * cellSize);
  }
  for (let row = 0; row <= rows; row += 1) {
    const y = gutter + row * cellSize + .5;
    context.moveTo(gutter, y);
    context.lineTo(gutter + columns * cellSize, y);
  }
  context.stroke();
  context.strokeStyle = '#766b80';
  context.strokeRect(gutter + .5, gutter + .5, columns * cellSize - 1, rows * cellSize - 1);
  drawGridCoordinates(context, { columns, rows, cellWidth: cellSize, cellHeight: cellSize, offsetX: gutter, offsetY: gutter, fontSize: 9, columnPrefix: 'C', rowPrefix: 'R', showTicks: true });
}

function updateEditorHistoryButtons() {
  document.querySelector('#undoEdit').disabled = editorUndoStack.length === 0;
  document.querySelector('#redoEdit').disabled = editorRedoStack.length === 0;
}

function finishEditTransaction() {
  if (!activeEditTransaction) return;
  const changes = activeEditTransaction.filter(change => change.previousValue !== change.nextValue);
  activeEditTransaction = null;
  if (!changes.length) return;
  editorUndoStack.push(changes);
  editorRedoStack = [];
  refreshPatternCounts();
  renderEditorPalette();
  renderPattern();
  updateEditorHistoryButtons();
}

function editorCellFromPointer(event) {
  const canvas = document.querySelector('#editorCanvas');
  const bounds = canvas.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * canvas.width / bounds.width - 44;
  const y = (event.clientY - bounds.top) * canvas.height / bounds.height - 44;
  const cellSize = Number(document.querySelector('#editorZoom').value);
  const column = Math.floor(x / cellSize);
  const row = Math.floor(y / cellSize);
  if (column < 0 || row < 0 || column >= generatedPattern.columns || row >= generatedPattern.rows) return -1;
  return row * generatedPattern.columns + column;
}

function editCellAtPointer(event) {
  const index = editorCellFromPointer(event);
  if (index < 0) return;
  if (editorTool === 'pick') {
    const picked = generatedPattern.cells[index];
    if (picked >= 0) {
      editorPaletteIndex = picked;
      editorTool = 'paint';
      activeEditTransaction = null;
      document.querySelectorAll('.editor-tool').forEach(tool => tool.classList.toggle('active', tool.dataset.tool === 'paint'));
      renderEditorPalette();
    }
    return;
  }
  PatternEditor.changeCell(generatedPattern.cells, index, editorTool === 'erase' ? -1 : editorPaletteIndex, activeEditTransaction);
  renderEditor();
}

document.querySelector('#openEditor').addEventListener('click', () => {
  editorPaletteIndex = Math.max(0, generatedPattern.counts.indexOf(Math.max(...generatedPattern.counts)));
  refreshPatternCounts();
  renderEditorPalette();
  renderEditor();
  updateEditorHistoryButtons();
  document.querySelector('#preflightPanel').hidden = true;
  const panel = document.querySelector('#editorPanel');
  panel.hidden = false;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.querySelector('#editorZoom').addEventListener('input', renderEditor);
document.querySelectorAll('.editor-tool').forEach(button => button.addEventListener('click', () => {
  editorTool = button.dataset.tool;
  document.querySelectorAll('.editor-tool').forEach(tool => tool.classList.toggle('active', tool === button));
}));
const editorCanvas = document.querySelector('#editorCanvas');
editorCanvas.addEventListener('pointerdown', event => {
  activeEditTransaction = [];
  editorCanvas.setPointerCapture(event.pointerId);
  editCellAtPointer(event);
});
editorCanvas.addEventListener('pointermove', event => {
  if (!activeEditTransaction || editorTool === 'pick') return;
  editCellAtPointer(event);
});
editorCanvas.addEventListener('pointerup', finishEditTransaction);
editorCanvas.addEventListener('pointercancel', finishEditTransaction);
document.querySelector('#undoEdit').addEventListener('click', () => {
  const transaction = editorUndoStack.pop();
  if (!transaction) return;
  PatternEditor.applyTransaction(generatedPattern.cells, transaction, 'undo');
  editorRedoStack.push(transaction);
  refreshPatternCounts(); renderEditorPalette(); renderEditor(); renderPattern(); updateEditorHistoryButtons();
});
document.querySelector('#redoEdit').addEventListener('click', () => {
  const transaction = editorRedoStack.pop();
  if (!transaction) return;
  PatternEditor.applyTransaction(generatedPattern.cells, transaction, 'redo');
  editorUndoStack.push(transaction);
  refreshPatternCounts(); renderEditorPalette(); renderEditor(); renderPattern(); updateEditorHistoryButtons();
});

document.querySelector('#previewZoom').addEventListener('input', renderPattern);
document.querySelector('#showGrid').addEventListener('change', renderPattern);
document.querySelector('#showCoordinates').addEventListener('change', renderPattern);
document.querySelector('#downloadPreview').addEventListener('click', () => {
  if (!generatedPattern) return;
  const link = document.createElement('a');
  link.download = 'diamond-pattern-preview.png';
  link.href = document.querySelector('#patternCanvas').toDataURL('image/png');
  link.click();
});

function currentPrintLayout() {
  if (!generatedPattern) return null;
  const { requestedWidthCm, requestedHeightCm, pitchMm } = generatedPattern.printLayout;
  try {
    return PatternGeometry.calculatePrintLayout(requestedWidthCm, requestedHeightCm, pitchMm, {
      roundingMode: document.querySelector('#roundingMode').value,
      printWidthIn: Number(document.querySelector('#printWidth').value),
      printHeightIn: Number(document.querySelector('#printHeight').value),
      dpi: Number(document.querySelector('#exportDpi').value),
    });
  } catch (_error) {
    return null;
  }
}

function updatePreflight() {
  if (!generatedPattern) return;
  const layout = currentPrintLayout();
  if (!layout) {
    const error = document.querySelector('#printError');
    error.hidden = false;
    error.textContent = 'Enter positive print dimensions and an export resolution.';
    document.querySelector('#downloadPrint').disabled = true;
    document.querySelector('#scalingStatus').textContent = '⚠ CHECK PRINT SETTINGS';
    document.querySelector('#scalingStatus').classList.add('invalid');
    return;
  }
  document.querySelector('#diamondAreaSummary').textContent = `${layout.exactWidthCm.toFixed(2)} × ${layout.exactHeightCm.toFixed(2)} cm`;
  document.querySelector('#diamondInchesSummary').textContent = `${layout.exactWidthMm.toFixed(1)} × ${layout.exactHeightMm.toFixed(1)} mm · ${layout.exactWidthIn.toFixed(3)} × ${layout.exactHeightIn.toFixed(3)} in`;
  document.querySelector('#drillGridSummary').textContent = `${layout.columns} × ${layout.rows} drills`;
  document.querySelector('#pitchSummary').textContent = `${layout.pitchMm.toFixed(1)} mm pitch`;
  document.querySelector('#printFileSummary').textContent = `${layout.printWidthIn} × ${layout.printHeightIn} in · ${layout.dpi} DPI`;
  document.querySelector('#pixelSummary').textContent = `${layout.canvasWidthPx.toLocaleString()} × ${layout.canvasHeightPx.toLocaleString()} px`;
  document.querySelector('#marginSummary').textContent = `${Math.max(0, layout.marginXIn).toFixed(4)} in horizontal · ${Math.max(0, layout.marginYIn).toFixed(4)} in vertical`;
  if (layout.compatible) {
    const labels = PatternGeometry.calculatePrintLabelMetrics(layout.dpi, layout.marginXIn, layout.marginYIn, layout.activeWidthPx / layout.columns, layout.activeHeightPx / layout.rows);
    document.querySelector('#coordinateSummary').textContent = `C/R labels every ${labels.columnInterval} column${labels.columnInterval === 1 ? '' : 's'} and ${labels.rowInterval} row${labels.rowInterval === 1 ? '' : 's'} · ${labels.fontSizePt.toFixed(1)} pt`;
  } else document.querySelector('#coordinateSummary').textContent = 'Increase the print canvas to make room for labels.';
  const error = document.querySelector('#printError');
  error.hidden = layout.compatible;
  error.textContent = layout.compatible ? '' : `Print size is too small. Use at least ${layout.recommendedWidthIn} × ${layout.recommendedHeightIn} inches.`;
  document.querySelector('#downloadPrint').disabled = !layout.compatible;
  const status = document.querySelector('#scalingStatus');
  status.textContent = layout.compatible ? '✓ GRID SCALING LOCKED · 100%' : '⚠ PRINT AREA TOO SMALL';
  status.classList.toggle('invalid', !layout.compatible);
}

document.querySelector('#continuePreflight').addEventListener('click', () => {
  const layout = generatedPattern.printLayout;
  document.querySelector('#printWidth').value = layout.recommendedWidthIn;
  document.querySelector('#printHeight').value = layout.recommendedHeightIn;
  const panel = document.querySelector('#preflightPanel');
  panel.hidden = false;
  updatePreflight();
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.querySelectorAll('#printWidth, #printHeight, #exportDpi').forEach(control => control.addEventListener('input', updatePreflight));
document.querySelector('#useRecommendedPrint').addEventListener('click', () => {
  const layout = generatedPattern.printLayout;
  document.querySelector('#printWidth').value = layout.recommendedWidthIn;
  document.querySelector('#printHeight').value = layout.recommendedHeightIn;
  updatePreflight();
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function pngWithDpi(blob, dpi) {
  const png = new Uint8Array(await blob.arrayBuffer());
  const pixelsPerMeter = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4);
  view.setUint32(8, pixelsPerMeter);
  view.setUint32(12, pixelsPerMeter);
  chunk[16] = 1;
  view.setUint32(17, crc32(chunk.slice(4, 17)));
  const output = new Uint8Array(png.length + chunk.length);
  output.set(png.slice(0, 33), 0);
  output.set(chunk, 33);
  output.set(png.slice(33), 54);
  return new Blob([output], { type: 'image/png' });
}

document.querySelector('#downloadPrint').addEventListener('click', async () => {
  const layout = currentPrintLayout();
  if (!layout?.compatible) return;
  const button = document.querySelector('#downloadPrint');
  button.disabled = true;
  button.textContent = 'Preparing print file…';
  await new Promise(resolve => requestAnimationFrame(resolve));
  try {
    const output = document.createElement('canvas');
    output.width = layout.canvasWidthPx;
    output.height = layout.canvasHeightPx;
    const context = output.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, output.width, output.height);
    const offsetX = Math.round((output.width - layout.activeWidthPx) / 2);
    const offsetY = Math.round((output.height - layout.activeHeightPx) / 2);
    const { columns, rows, palette, cells, drillShape } = generatedPattern;
    cells.forEach((paletteIndex, index) => {
      if (paletteIndex === -1) return;
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x1 = offsetX + Math.round(column * layout.activeWidthPx / columns);
      const x2 = offsetX + Math.round((column + 1) * layout.activeWidthPx / columns);
      const y1 = offsetY + Math.round(row * layout.activeHeightPx / rows);
      const y2 = offsetY + Math.round((row + 1) * layout.activeHeightPx / rows);
      context.fillStyle = `rgb(${palette[paletteIndex].join(',')})`;
      if (drillShape === 'round') {
        context.beginPath();
        context.ellipse((x1 + x2) / 2, (y1 + y2) / 2, (x2 - x1) * .44, (y2 - y1) * .44, 0, 0, Math.PI * 2);
        context.fill();
      } else context.fillRect(x1, y1, x2 - x1, y2 - y1);
    });
    const cellWidth = layout.activeWidthPx / columns;
    const cellHeight = layout.activeHeightPx / rows;
    const coordinateMetrics = PatternGeometry.calculatePrintLabelMetrics(layout.dpi, layout.marginXIn, layout.marginYIn, layout.activeWidthPx / columns, layout.activeHeightPx / rows);
    context.strokeStyle = '#51475d';
    context.lineWidth = Math.max(1, layout.dpi / 300);
    context.strokeRect(offsetX, offsetY, layout.activeWidthPx, layout.activeHeightPx);
    drawGridCoordinates(context, { columns, rows, cellWidth, cellHeight, offsetX, offsetY, fontSize: coordinateMetrics.fontSize, columnPrefix: 'C', rowPrefix: 'R', showTicks: true, columnInterval: coordinateMetrics.columnInterval, rowInterval: coordinateMetrics.rowInterval });
    const blob = await new Promise(resolve => output.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The browser could not create the requested print file.');
    const exactScaleBlob = await pngWithDpi(blob, layout.dpi);
    const link = document.createElement('a');
    link.download = `diamond-pattern-${layout.printWidthIn}x${layout.printHeightIn}in-${layout.dpi}dpi.png`;
    link.href = URL.createObjectURL(exactScaleBlob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } catch (error) {
    const message = document.querySelector('#printError');
    message.hidden = false;
    message.textContent = `Export failed: ${error.message}`;
  } finally {
    button.disabled = false;
    button.innerHTML = 'Download exact-scale PNG <span>↓</span>';
  }
});

document.querySelectorAll('.project-card').forEach(card => card.addEventListener('click', () => {
  card.animate([{ transform: 'translateY(-3px)' }, { transform: 'translateY(-3px) scale(.99)' }, { transform: 'translateY(-3px)' }], { duration: 240 });
}));
