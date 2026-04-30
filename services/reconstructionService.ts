
import { DiagramSpec } from '../types';

export function renderDiagramSVG(spec: DiagramSpec): string {
  const width = 800;
  const height = 600;
  const nodeWidth = 120;
  const nodeHeight = 50;

  let elements = '';

  // Title
  elements += `<text x="${width / 2}" y="30" text-anchor="middle" font-size="18" font-weight="bold" fill="#111827">${spec.title}</text>`;

  // Simple layout: circular or grid-based if no coordinates provided
  // For now, let's do a simple grid
  const cols = 3;
  const padding = 50;
  const nodes = spec.nodes || [];
  const edges = spec.edges || [];

  const nodesWithPos = nodes.map((node, i) => ({
    ...node,
    x: padding + (i % cols) * (nodeWidth + padding * 2),
    y: 100 + Math.floor(i / cols) * (nodeHeight + padding * 2)
  }));

  // Edges
  edges.forEach(edge => {
    const from = nodesWithPos.find(n => n.id === edge.from);
    const to = nodesWithPos.find(n => n.id === edge.to);
    if (from && to) {
      const x1 = from.x + nodeWidth / 2;
      const y1 = from.y + nodeHeight / 2;
      const x2 = to.x + nodeWidth / 2;
      const y2 = to.y + nodeHeight / 2;
      
      elements += `
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#004F71" stroke-width="1.5" marker-end="url(#arrowhead)" stroke-dasharray="${edge.label ? '4 2' : 'none'}" />
        ${edge.label ? `
          <rect x="${(x1 + x2) / 2 - 30}" y="${(y1 + y2) / 2 - 10}" width="60" height="20" fill="white" stroke="#E5E7EB" rx="0" />
          <text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 + 4}" text-anchor="middle" font-size="9" font-family="Inter, sans-serif" fill="#4B5563" font-weight="700" text-transform="uppercase">${edge.label}</text>
        ` : ''}
      `;
    }
  });

  // Nodes
  nodesWithPos.forEach(node => {
    elements += `
      <g class="node-group">
        <rect x="${node.x}" y="${node.y}" width="${nodeWidth}" height="${nodeHeight}" fill="white" stroke="#004F71" stroke-width="1.5" rx="0" />
        <rect x="${node.x}" y="${node.y}" width="4" height="${nodeHeight}" fill="#E3120B" />
        <text x="${node.x + nodeWidth / 2 + 2}" y="${node.y + nodeHeight / 2 + 4}" text-anchor="middle" font-size="11" font-family="Inter, sans-serif" font-weight="700" fill="#111827" text-transform="uppercase">${node.label.length > 20 ? node.label.substring(0, 17) + '...' : node.label}</text>
      </g>
    `;
  });

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background: #FDFCFB; border: 1px solid #E5E7EB;">
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <path d="M0 0 L10 3.5 L0 7" fill="#004F71" />
        </marker>
      </defs>
      ${elements}
    </svg>
  `;
}
