
import JSZip from 'jszip';
import { InfographicData, Manifest, NarrativeSection } from '../types';

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
}

function sanitizeForPath(name: string): string {
  return name.replace(/[^a-z0-9._-]/gi, '_');
}

export async function packageInfographic(data: InfographicData, html: string): Promise<Blob> {
  console.log("Starting ZIP packaging for:", data.title);
  const zip = new JSZip();
  const assetsFolder = zip.folder("assets");
  const candidatesFolder = assetsFolder?.folder("candidates");
  const summariesFolder = zip.folder("summaries");
  const dataFolder = zip.folder("data");

  // index.html
  zip.file("index.html", html);

  // Stylesheet
  const styles = `
    /* The Economist Editorial Style Guide (Infographic Machine) */
    :root {
      --accent: #E3120B;
      --accent-muted: #FCA5A5;
      --bg: #FDFCFB;
      --text: #1B1B1B;
      --divider: #E2E8F0;
      --muted: #64748B;
      --font-serif: 'Georgia', 'Times New Roman', serif;
      --font-sans: 'Inter', system-ui, sans-serif;
    }
    
    body { 
      font-family: var(--font-sans); 
      background: var(--bg); 
      color: var(--text); 
      padding: 60px; 
      line-height: 1.6; 
      max-width: 1200px; 
      margin: 0 auto; 
    }

    h1 { font-family: var(--font-serif); font-size: 3.5rem; font-weight: 800; margin-bottom: 1rem; }
    .summary { font-size: 1.25rem; font-weight: 300; color: var(--muted); margin-bottom: 2rem; }

    /* Semantic Narrative Tokens */
    .token-metric { color: var(--accent); font-weight: 700; border-bottom: 1px solid var(--accent-muted); }
    .token-dataset { color: #004F71; font-weight: 600; font-family: var(--font-sans); font-size: 0.9em; text-transform: uppercase; }
    .token-benchmark { color: #111827; font-weight: 800; font-style: italic; }
    .token-rank { background: #F3F4F6; padding: 1px 4px; border-radius: 2px; font-weight: 700; font-size: 0.9em; }
    .token-parameter { font-family: 'Courier New', monospace; color: #4B5563; background: #F9FAFB; padding: 0 2px; }
    .token-figure-ref { color: var(--accent); text-decoration: none; font-weight: 700; font-size: 0.8em; vertical-align: super; }

    /* Layout Components */
    .card { border-bottom: 1px solid var(--divider); padding: 24px 0; margin-bottom: 24px; }
    .card-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; color: var(--accent); margin-bottom: 8px; border-bottom: 1px solid var(--accent); display: inline-block; }
    .card-content { font-family: var(--font-serif); font-size: 1.1rem; }

    .visual-box { border: 1px solid var(--divider); padding: 20px; background: white; margin-bottom: 40px; }
    .visual-label { font-size: 9px; font-weight: 800; color: var(--muted); text-transform: uppercase; margin-bottom: 10px; }
    .asset-image { max-width: 100%; height: auto; display: block; margin: 0 auto; }
    
    .grid-layout { display: grid; grid-template-columns: repeat(12, 1fr); gap: 40px; }
    .col-8 { grid-column: span 8; }
    .col-4 { grid-column: span 4; }
    
    @media (max-width: 800px) {
      .grid-layout { display: block; }
    }
  `;
  zip.file("styles.css", styles);

  // Narrative Summaries
  try {
    zip.file("summaries/overview.txt", data.summary || "No summary available.");
    if (data.narrativeLayers) {
      Object.entries(data.narrativeLayers).forEach(([key, layer]) => {
        if (!layer) return;
        const section = layer as NarrativeSection;
        const tokens = Array.isArray(section.tokens) ? section.tokens : [];
        const content = tokens.map(t => t.value).join('') || "";
        zip.file(`summaries/${key}.txt`, `${section.title || key}\n\n${content}`);
      });
    }
  } catch (e) {
    console.error("Error adding narrative to ZIP", e);
  }

  // Selected Assets
  const manifestAssets: any[] = [];
  try {
    for (const asset of data.assets) {
      if (!asset) continue;
      let fileName = "";
      if (asset.svgContent) {
        fileName = `assets/${asset.id}.svg`;
        assetsFolder?.file(`${asset.id}.svg`, asset.svgContent);
      } else if (asset.pngData) {
        fileName = `assets/${sanitizeForPath(asset.id)}.png`;
        // Ensure we only pass the clean base64 string
        const cleanBase64 = asset.pngData.includes(',') 
          ? asset.pngData.split(',')[1].replace(/\s/g, "") 
          : asset.pngData.replace(/\s/g, "");
        assetsFolder?.file(`${sanitizeForPath(asset.id)}.png`, cleanBase64, { base64: true });
      }

      if (asset.csvData) {
        dataFolder?.file(`${sanitizeForPath(asset.id)}.csv`, asset.csvData);
      }

      manifestAssets.push({
        id: asset.id,
        isSelected: true,
        type: asset.assetType,
        page: asset.page,
        caption: asset.caption,
        status: asset.reconstructionStatus,
        fileName
      });
    }
  } catch (e) {
    console.error("Error adding assets to ZIP", e);
  }

  // Candidate Assets (Excluded/Considered)
  if (data.candidateAssets) {
    try {
      for (const asset of data.candidateAssets) {
        if (!asset) continue;
        if (data.assets.find(a => a.id === asset.id)) continue; // Already added as selected
        
        let fileName = "";
        if (asset.svgContent) {
          fileName = `assets/candidates/${sanitizeForPath(asset.id)}.svg`;
          candidatesFolder?.file(`${sanitizeForPath(asset.id)}.svg`, asset.svgContent);
        } else if (asset.pngData) {
          fileName = `assets/candidates/${sanitizeForPath(asset.id)}.png`;
          const cleanBase64 = asset.pngData.includes(',') 
            ? asset.pngData.split(',')[1].replace(/\s/g, "") 
            : asset.pngData.replace(/\s/g, "");
          candidatesFolder?.file(`${sanitizeForPath(asset.id)}.png`, cleanBase64, { base64: true });
        }

        manifestAssets.push({
          id: asset.id,
          isSelected: false,
          type: asset.assetType,
          page: asset.page,
          caption: asset.caption,
          status: asset.reconstructionStatus,
          fileName,
          rationale: asset.rationale,
          rankingScore: asset.rankingScore
        });
      }
    } catch (e) {
      console.error("Error adding candidates to ZIP", e);
    }
  }

  // Manifest
  const manifest: any = {
    metadata: {
      title: data.title,
      generatedAt: new Date().toISOString(),
      debug_summary: data.debug_summary || ""
    },
    narrative: {
      summary: data.summary,
      researchQuestion: data.researchQuestion,
      layers: data.narrativeLayers
    },
    assets: manifestAssets,
    citations: data.citations || []
  };
  
  try {
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  } catch (e) {
    console.error("Failed to stringify manifest", e);
    // Add simplified manifest if full one fails
    zip.file("manifest.json", JSON.stringify({ title: data.title, error: "Detailed manifest stringification failed" }));
  }

  return await zip.generateAsync({ 
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });
}
