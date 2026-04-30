
import { ChartSpec, InfographicAsset } from '../types';

export function renderChartSVG(spec: ChartSpec): string {
  const width = 800;
  const height = 500;
  const margin = { top: 60, right: 40, bottom: 80, left: 100 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const series = spec.series || [];
  if (series.length === 0) {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background: white; border-radius: 8px;"><text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="14" fill="#9CA3AF">No data available for chart</text></svg>`;
  }

  const allValues = series.flatMap(s => (s.data || []).map(d => d.y));
  const maxValue = allValues.length > 0 ? Math.max(...allValues, 0) * 1.1 : 100;
  const minValue = allValues.length > 0 ? Math.min(...allValues, 0) : 0;
  const range = maxValue - minValue;

  const xLabels = (series[0]?.data || []).map(d => String(d.x));
  const xStep = innerWidth / (xLabels.length || 1);

  let elements = '';

  // Title
  elements += `<text x="${width / 2}" y="30" text-anchor="middle" font-size="18" font-weight="bold" fill="#111827">${spec.title || 'Untitled Chart'}</text>`;
  if (spec.subtitle) {
    elements += `<text x="${width / 2}" y="50" text-anchor="middle" font-size="12" fill="#6B7280">${spec.subtitle}</text>`;
  }

  // Axes
  elements += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + innerHeight}" stroke="#E5E7EB" stroke-width="2" />`;
  elements += `<line x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${margin.left + innerWidth}" y2="${margin.top + innerHeight}" stroke="#E5E7EB" stroke-width="2" />`;

  // X-axis labels
  xLabels.forEach((label, i) => {
    const x = margin.left + i * xStep + xStep / 2;
    elements += `<text x="${x}" y="${margin.top + innerHeight + 25}" text-anchor="middle" font-size="10" fill="#9CA3AF" transform="rotate(45, ${x}, ${margin.top + innerHeight + 25})">${label.length > 15 ? label.substring(0, 12) + '...' : label}</text>`;
  });

  // Y-axis ticks and grid lines
  const tickCount = 5;
  for (let i = 0; i <= tickCount; i++) {
    const val = minValue + (range / tickCount) * i;
    const y = margin.top + innerHeight - (val / (maxValue || 1)) * innerHeight;
    elements += `
      <g>
        <line x1="${margin.left}" y1="${y}" x2="${margin.left + innerWidth}" y2="${y}" stroke="#F3F4F6" stroke-dasharray="4" />
        <line x1="${margin.left - 5}" y1="${y}" x2="${margin.left}" y2="${y}" stroke="#E5E7EB" />
        <text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" font-size="10" font-family="Inter, sans-serif" fill="#9CA3AF">${val.toFixed(1)}</text>
      </g>
    `;
  }

  // Data
  const colors = ['#E3120B', '#004F71', '#4B5563', '#9CA3AF', '#D1D5DB'];
  series.forEach((s, sIdx) => {
    const color = colors[sIdx % colors.length];
    const data = s.data || [];
    if (spec.chartType === 'bar') {
      const barWidth = (xStep * 0.7) / series.length;
      data.forEach((d, i) => {
        const x = margin.left + i * xStep + (xStep * 0.15) + sIdx * barWidth;
        const barH = (d.y / (maxValue || 1)) * innerHeight;
        elements += `
          <g>
            <rect x="${x}" y="${margin.top + innerHeight - barH}" width="${barWidth}" height="${barH}" fill="${color}" rx="1" />
          </g>
        `;
      });
    } else if (spec.chartType === 'line') {
      let path = '';
      data.forEach((d, i) => {
        const x = margin.left + i * xStep + xStep / 2;
        const y = margin.top + innerHeight - (d.y / (maxValue || 1)) * innerHeight;
        path += (i === 0 ? 'M' : 'L') + `${x},${y}`;
        elements += `<circle cx="${x}" cy="${y}" r="3" fill="${color}" />`;
      });
      elements += `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="square" />`;
    }
  });

  // Legend
  if (series.length > 1) {
    series.forEach((s, i) => {
      const x = margin.left + i * 140;
      const y = height - 20;
      elements += `
        <rect x="${x}" y="${y - 8}" width="8" height="8" fill="${colors[i % colors.length]}" />
        <text x="${x + 14}" y="${y}" font-size="11" font-family="Inter, sans-serif" font-weight="700" fill="#111827" text-transform="uppercase">${s.label}</text>
      `;
    });
  }

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background: #f8fafc; border: 1px solid #e5e7eb;">${elements}</svg>`;
}
