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
    const boxes = [boxDetails(colors)];
    while (boxes.length < maximumColors) {
      boxes.sort((left, right) => right.score - left.score);
      const index = boxes.findIndex(box => box.colors.length > 1 && Math.max(...box.ranges) > 0);
      if (index === -1) break;
      const [box] = boxes.splice(index, 1);
      const split = splitBox(box);
      if (!split) { boxes.push(box); break; }
      boxes.push(...split);
    }
    return boxes.sort((left, right) => right.population - left.population).map(averageBox);
  }

  root.PatternConversion = { buildAdaptivePalette };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PatternConversion;
})(typeof globalThis !== 'undefined' ? globalThis : window);
