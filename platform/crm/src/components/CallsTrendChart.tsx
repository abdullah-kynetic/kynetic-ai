function buildPath(points: (number | null)[], x: (i: number) => number, y: (v: number) => number) {
  const pts = points.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean) as number[][];
  if (pts.length < 2) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
}

function dots(points: (number | null)[], x: (i: number) => number, y: (v: number) => number, color: string) {
  return points
    .map((v, i) => (v == null ? "" : `<circle cx="${x(i)}" cy="${y(v)}" r="3.2" fill="${color}"/>`))
    .join("");
}

export default function CallsTrendChart({ afterRate, liveWeek = 2 }: { afterRate: number; liveWeek?: number }) {
  const weeks = 8;
  const before: (number | null)[] = [];
  const after: (number | null)[] = [];
  const beforeBase = Math.max(30, afterRate - 40);
  for (let i = 0; i < weeks; i++) {
    if (i < liveWeek) {
      const wobble = (i % 2 === 0 ? 1 : -1) * 2.5;
      before.push(beforeBase + wobble);
      after.push(i === liveWeek - 1 ? beforeBase : null);
    } else if (i === liveWeek) {
      before.push(null);
      after.push(beforeBase + (afterRate - beforeBase) * 0.4);
    } else {
      before.push(null);
      const progress = (i - liveWeek) / (weeks - 1 - liveWeek);
      after.push(beforeBase + (afterRate - beforeBase) * Math.min(1, 0.4 + progress * 0.6));
    }
  }

  const W = 720, H = 220, padL = 40, padR = 16, padT = 16, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const x = (i: number) => padL + (i / (weeks - 1)) * plotW;
  const y = (v: number) => padT + plotH - (v / 100) * plotH;

  const gridY = [0, 25, 50, 75, 100];
  const grid = gridY
    .map(
      (v) =>
        `<line x1="${padL}" y1="${y(v)}" x2="${W - padR}" y2="${y(v)}" stroke="var(--border)" stroke-width="1"/>` +
        `<text x="${padL - 8}" y="${y(v) + 3}" text-anchor="end" font-size="10" fill="var(--ink-faint)">${v}%</text>`
    )
    .join("");

  const labels = Array.from({ length: weeks }, (_, i) => {
    const label = i === liveWeek ? `W${i + 1}✓` : `W${i + 1}`;
    return `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="var(--ink-faint)">${label}</text>`;
  }).join("");

  const svg = `
    ${grid}
    <line x1="${x(liveWeek)}" y1="${padT}" x2="${x(liveWeek)}" y2="${H - padB}" stroke="var(--accent)" stroke-width="1" stroke-dasharray="3 3" opacity="0.5"/>
    <text x="${x(liveWeek)}" y="${padT - 4}" text-anchor="middle" font-size="10" fill="var(--accent-ink)" font-weight="700">Kynetic live</text>
    <path d="${buildPath(before, x, y)}" fill="none" stroke="var(--ink-faint)" stroke-width="2.5" stroke-dasharray="4 4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${buildPath(after, x, y)}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots(before, x, y, "var(--ink-faint)")}
    ${dots(after, x, y, "var(--accent)")}
    ${labels}
  `;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={220} role="img" aria-label="Answer rate climbing after Kynetic went live" dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
