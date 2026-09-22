(function attachGeometry(root) {
  function calculateCropRegion(sourceWidth, sourceHeight, targetRatio, zoom = 1, focusX = 0.5, focusY = 0.5) {
    if (![sourceWidth, sourceHeight, targetRatio, zoom].every(value => Number.isFinite(value) && value > 0)) {
      throw new TypeError('Crop dimensions, ratio, and zoom must be positive numbers.');
    }

    const sourceRatio = sourceWidth / sourceHeight;
    let baseWidth = sourceWidth;
    let baseHeight = sourceHeight;
    if (sourceRatio > targetRatio) baseWidth = sourceHeight * targetRatio;
    if (sourceRatio < targetRatio) baseHeight = sourceWidth / targetRatio;

    const width = baseWidth / zoom;
    const height = baseHeight / zoom;
    const clampedFocusX = Math.min(1, Math.max(0, focusX));
    const clampedFocusY = Math.min(1, Math.max(0, focusY));
    const x = (sourceWidth - width) * clampedFocusX;
    const y = (sourceHeight - height) * clampedFocusY;
    return { x, y, width, height };
  }

  root.PatternGeometry = { calculateCropRegion };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PatternGeometry;
})(typeof globalThis !== 'undefined' ? globalThis : window);
