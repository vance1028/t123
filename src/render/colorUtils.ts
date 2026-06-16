export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return { r, g, b };
}

export function elevationColor(
  height: number,
  minHeight: number,
  maxHeight: number
): { r: number; g: number; b: number } {
  if (maxHeight === minHeight) {
    return { r: 0.5, g: 0.7, b: 0.5 };
  }

  const t = (height - minHeight) / (maxHeight - minHeight);
  const h = (1 - t) * 0.65 + 0;
  return hslToRgb(h, 0.6, 0.55);
}

export function cutFillColor(
  diff: number,
  maxDiff: number
): { r: number; g: number; b: number } {
  if (maxDiff === 0) {
    return { r: 0.8, g: 0.8, b: 0.8 };
  }

  const t = Math.min(1, Math.abs(diff) / maxDiff);

  if (diff > 0) {
    const intensity = 0.3 + t * 0.7;
    return { r: intensity, g: 0.2 + (1 - t) * 0.3, b: 0.2 + (1 - t) * 0.3 };
  } else if (diff < 0) {
    const intensity = 0.3 + t * 0.7;
    return { r: 0.2 + (1 - t) * 0.3, g: 0.3 + (1 - t) * 0.4, b: intensity };
  } else {
    return { r: 0.95, g: 0.95, b: 0.95 };
  }
}

export function lerpColor(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number },
  t: number
): { r: number; g: number; b: number } {
  return {
    r: c1.r + (c2.r - c1.r) * t,
    g: c1.g + (c2.g - c1.g) * t,
    b: c1.b + (c2.b - c1.b) * t
  };
}
