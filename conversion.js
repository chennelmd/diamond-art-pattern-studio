(function attachConversion(root) {
  function colorHistogram(pixelData, isOccupied) {
    const histogram = new Map();
    for (let offset = 0, cell = 0; offset < pixelData.length; offset += 4, cell += 1) {
      if (!isOccupied(offset)) continue;
      const color = [pixelData[offset], pixelData[offset + 1], pixelData[offset + 2]];
      const key = color.join(',');
      const entry = histogram.get(key) || { color, count: 0 };
      entry.count += 1;
      histogram.set(key, entry);
    }
    return [...histogram.values()];
  }

  function boxDetails(colors) {
    const minimum = [255, 255, 255];
    const maximum = [0, 0, 0];
    let population = 0;
    colors.forEach(entry => {
      population += entry.count;
      entry.color.forEach((channel, index) => {
        minimum[index] = Math.min(minimum[index], channel);
        maximum[index] = Math.max(maximum[index], channel);
      });
    });
    const ranges = maximum.map((channel, index) => channel - minimum[index]);
    return { colors, population, ranges, score: Math.max(...ranges) * population };
  }

  function splitBox(box) {
    const channel = box.ranges.indexOf(Math.max(...box.ranges));
    if (box.colors.length < 2 || box.ranges[channel] === 0) return null;
    const sorted = [...box.colors].sort((left, right) => left.color[channel] - right.color[channel]);
    const midpoint = box.population / 2;
    let running = 0;
    let splitIndex = 1;
    for (; splitIndex < sorted.length; splitIndex += 1) {
      running += sorted[splitIndex - 1].count;
      if (running >= midpoint) break;
    }
    return [boxDetails(sorted.slice(0, splitIndex)), boxDetails(sorted.slice(splitIndex))];
  }

  function averageBox(box) {
    const totals = [0, 0, 0];
    box.colors.forEach(entry => entry.color.forEach((channel, index) => {
      totals[index] += channel * entry.count;
    }));
    return totals.map(total => Math.round(total / box.population));
  }

  function buildAdaptivePalette(pixelData, isOccupied, maximumColors) {
    const colors = colorHistogram(pixelData, isOccupied);
    if (!colors.length) return [];
    if (!Number.isFinite(maximumColors) || colors.length <= maximumColors) {
      return colors.sort((left, right) => right.count - left.count).map(entry => entry.color);
    }
    const sortedColors = colors.sort((left, right) => right.count - left.count);
    const totalPopulation = sortedColors.reduce((total, entry) => total + entry.count, 0);
    const protectedThreshold = Math.max(2, Math.ceil(totalPopulation * .002));
    const protectedColors = sortedColors.filter(entry => entry.count >= protectedThreshold).slice(0, maximumColors);
    if (protectedColors.length >= maximumColors) return protectedColors.map(entry => entry.color);

    const protectedSet = new Set(protectedColors);
    const remainingColors = sortedColors.filter(entry => !protectedSet.has(entry));
    if (!remainingColors.length) return protectedColors.map(entry => entry.color);
    const remainingSlots = maximumColors - protectedColors.length;
    const boxes = [boxDetails(remainingColors)];
    while (boxes.length < remainingSlots) {
      boxes.sort((left, right) => right.score - left.score);
      const index = boxes.findIndex(box => box.colors.length > 1 && Math.max(...box.ranges) > 0);
      if (index === -1) break;
      const [box] = boxes.splice(index, 1);
      const split = splitBox(box);
      if (!split) { boxes.push(box); break; }
      boxes.push(...split);
    }
    return [
      ...protectedColors.map(entry => entry.color),
      ...boxes.sort((left, right) => right.population - left.population).map(averageBox),
    ];
  }

  function colorDistance(left, right) {
    return Math.sqrt((left[0] - right[0]) ** 2 + (left[1] - right[1]) ** 2 + (left[2] - right[2]) ** 2);
  }

  function selectConnectedBackground(pixelData, width, height, seedX, seedY, tolerance) {
    const mask = new Uint8Array(width * height);
    const startX = Math.max(0, Math.min(width - 1, Math.round(seedX)));
    const startY = Math.max(0, Math.min(height - 1, Math.round(seedY)));
    const startIndex = startY * width + startX;
    const seedOffset = startIndex * 4;
    const seedColor = [pixelData[seedOffset], pixelData[seedOffset + 1], pixelData[seedOffset + 2]];
    const localLimit = Math.max(6, tolerance * 1.35);
    const globalLimit = Math.max(18, tolerance * 4.5);
    const queue = [startIndex];
    mask[startIndex] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      const x = index % width;
      const y = Math.floor(index / width);
      const offset = index * 4;
      const current = [pixelData[offset], pixelData[offset + 1], pixelData[offset + 2]];
      const neighbors = [];
      if (x > 0) neighbors.push(index - 1);
      if (x < width - 1) neighbors.push(index + 1);
      if (y > 0) neighbors.push(index - width);
      if (y < height - 1) neighbors.push(index + width);
      neighbors.forEach(neighbor => {
        if (mask[neighbor]) return;
        const neighborOffset = neighbor * 4;
        const color = [pixelData[neighborOffset], pixelData[neighborOffset + 1], pixelData[neighborOffset + 2]];
        if (colorDistance(color, current) <= localLimit && colorDistance(color, seedColor) <= globalLimit) {
          mask[neighbor] = 1;
          queue.push(neighbor);
        }
      });
    }
    return mask;
  }

  function hexToRgb(hex) {
    const value = hex.replace('#', '');
    return [0, 2, 4].map(index => Number.parseInt(value.slice(index, index + 2), 16));
  }

  function interpolateShades(darkHex, lightHex, count) {
    const dark = hexToRgb(darkHex);
    const light = hexToRgb(lightHex);
    return Array.from({ length: count }, (_, index) => {
      const amount = count === 1 ? 0 : index / (count - 1);
      return dark.map((channel, channelIndex) => Math.round(channel + (light[channelIndex] - channel) * amount));
    });
  }

  function applyBackgroundTreatment(pixelData, mask, options) {
    if (options.mode === 'preserve') return;
    const shadeCount = Number(options.shadeCount) || 4;
    const backgroundOffsets = [];
    mask.forEach((selected, index) => { if (selected) backgroundOffsets.push(index * 4); });
    if (!backgroundOffsets.length) return;
    let shades;
    if (options.mode === 'solid') {
      shades = [hexToRgb(options.solidColor)];
    } else if (options.shadeSource === 'manual') {
      shades = interpolateShades(options.darkColor, options.lightColor, shadeCount);
    } else {
      const selectedOffsets = new Set(backgroundOffsets);
      shades = buildAdaptivePalette(pixelData, offset => selectedOffsets.has(offset), shadeCount);
    }
    shades.sort((left, right) =>
      (left[0] * .2126 + left[1] * .7152 + left[2] * .0722)
      - (right[0] * .2126 + right[1] * .7152 + right[2] * .0722));
    const luminances = backgroundOffsets.map(offset => pixelData[offset] * .2126 + pixelData[offset + 1] * .7152 + pixelData[offset + 2] * .0722);
    const minimum = Math.min(...luminances);
    const maximum = Math.max(...luminances);
    backgroundOffsets.forEach((offset, position) => {
      let shade;
      if (shades.length === 1) shade = shades[0];
      else {
        const normalized = (luminances[position] - minimum) / Math.max(1, maximum - minimum);
        shade = shades[Math.min(shades.length - 1, Math.round(normalized * (shades.length - 1)))];
      }
      pixelData[offset] = shade[0]; pixelData[offset + 1] = shade[1]; pixelData[offset + 2] = shade[2];
    });
  }

  root.PatternConversion = { applyBackgroundTreatment, buildAdaptivePalette, interpolateShades, selectConnectedBackground };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PatternConversion;
})(typeof globalThis !== 'undefined' ? globalThis : window);
