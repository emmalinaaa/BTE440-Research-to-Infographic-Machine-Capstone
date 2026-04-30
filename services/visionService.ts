
import { GoogleGenAI, Type } from "@google/genai";
import { BoundingBox, InfographicAsset } from "../types";
import { renderPageToImage, cropRegionToImage } from "./pdfService";

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("Gemini API Key not found. Please check your environment variables.");
  }

  return new GoogleGenAI({ apiKey });
}

function cleanJsonResponse(text: string): string {
  if (!text) return "";
  return text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
}

export async function detectFiguresOnPage(file: File, pageNumber: number, providedAI?: any): Promise<InfographicAsset[]> {
  const ai = providedAI || getAI();
  const b64Image = await renderPageToImage(file, pageNumber);
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      { inlineData: { data: b64Image, mimeType: 'image/png' } },
      { 
        text: `You are an expert data visualizer for The Economist. Analyze this page for visual assets.
        
        CLASSIFICATION:
        1. "visual_evidence": Charts, tables, or plots showing specific data or experimental results.
        2. "explanatory_concept": Diagrams or schematics explaining a conceptual framework, architecture, or workflow.
        
        DECISION LAYER (renderingMode):
        - "preserve": Use for high-quality figures, complex schematics, or rich data plots that are already clear.
        - "reconstruct": Use for simple charts (bar/line) or basic diagrams where structured extraction improves clarity or allows for editorial styling.
        - "derive_explanatory": Use for complex or dense concepts that would benefit from a simplified companion visual alongside the original.
        
        Provide: 
        - bounding box: [ymin, xmin, ymax, xmax] (0-1000)
        - caption: accurate transcription or summary
        - type: (chart_plot, diagram_schematic, table_like, raster_photo, equation_panel)
        - classification: (visual_evidence, explanatory_concept)
        - renderingMode: (preserve, reconstruct, derive_explanatory)
        - confidence: (0-1)
        - rationale: brief explanation of choice
        - scoring: { centrality: 0-1, evidence: 0-1, distinctiveness: 0-1 }
        
        TRIGGER "derive_explanatory" IF:
        - The figure is a schematic but the text suggests a complex mechanism that is under-explained visually.
        - The concept is fundamental to the paper's contribution.
        - Simplified reconstruction would materially improve comprehension for a non-expert.` 
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          assets: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                bbox: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                caption: { type: Type.STRING },
                type: { type: Type.STRING },
                classification: { type: Type.STRING, enum: ["visual_evidence", "explanatory_concept"] },
                renderingMode: { type: Type.STRING, enum: ["preserve", "reconstruct", "derive_explanatory"] },
                confidence: { type: Type.NUMBER },
                rationale: { type: Type.STRING },
                explanationPurpose: { type: Type.STRING },
                scoring: {
                  type: Type.OBJECT,
                  properties: {
                    centrality: { type: Type.NUMBER },
                    evidence: { type: Type.NUMBER },
                    distinctiveness: { type: Type.NUMBER }
                  },
                  required: ["centrality", "evidence", "distinctiveness"]
                }
              },
              required: ["bbox", "caption", "type", "classification", "renderingMode", "confidence", "rationale", "scoring"]
            }
          }
        }
      }
    }
  });

  const rawText = response.text;
  if (!rawText) return [];
  
  let data;
  try {
    const cleaned = cleanJsonResponse(rawText);
    if (!cleaned) throw new Error("Empty response from Vision AI");
    data = JSON.parse(cleaned);
  } catch (e: any) {
    console.error("Figure detection parse failure:", rawText);
    return []; // Return empty instead of crashing scanning phase
  }

  const assets: InfographicAsset[] = [];
  if (!data.assets || !Array.isArray(data.assets)) return [];

  for (const item of data.assets) {
    const bbox: BoundingBox = {
      ymin: item.bbox[0],
      xmin: item.bbox[1],
      ymax: item.bbox[2],
      xmax: item.bbox[3]
    };

    const pngData = await cropRegionToImage(file, pageNumber, bbox);

    assets.push({
      id: `asset_${pageNumber}_${Math.random().toString(36).substr(2, 9)}`,
      assetType: item.type === 'table_like' ? 'table' : 
                 item.type === 'chart_plot' ? 'chart' :
                 item.type === 'diagram_schematic' ? 'diagram' :
                 item.type === 'equation_panel' ? 'equation' : 'figure',
      renderingMode: item.renderingMode,
      classification: item.classification,
      isSourceOfTruth: true,
      explanationPurpose: item.explanationPurpose,
      page: pageNumber,
      caption: item.caption,
      bbox,
      confidence: item.confidence,
      scoring: item.scoring,
      rationale: item.rationale,
      reconstructionStatus: 'original',
      pngData
    });
  }

  return assets;
}

export async function extractVisualSpec(asset: InfographicAsset, isExplanatory: boolean = false, narrativeContext?: string, providedAI?: any): Promise<InfographicAsset> {
  if (!asset.pngData) return asset;
  const ai = providedAI || getAI();

  let prompt = '';
  if (asset.assetType === 'chart') {
    prompt = "Extract a structured chart spec from this image. Include chartType (bar, line, scatter, pie), title, xAxisLabel, yAxisLabel, and series data with labels and numeric values. Be precise but conservative.";
  } else {
    prompt = "Extract a structured diagram spec from this image. Include nodes (id, label, type) and edges (from, to, label).";
    if (isExplanatory) {
      prompt += " This is a COMPANION EXPLANATORY diagram. SIMPLIFY the concept. Do not try to recreate every node. Just capture the core logic (e.g., A side-by-side comparison of 'Standard' vs 'Dropout' network layers). Use minimal labels.";
    }
  }

  if (narrativeContext) {
    prompt += `\n\nNARRATIVE CONTEXT:\n${narrativeContext}\n\nTASK: Generate an 'interpretiveSummary' (30-60 words). DO NOT just recite the image caption or subheadings. Explain what this visual reveals about the paper's core claims using reasoning and the provided context. How does this image support the research narrative?`;
  }

  const baseSchemaProperties: any = {
    interpretiveSummary: { type: Type.STRING, description: "Expert interpretation of the visual's significance in the broader context." }
  };

  const responseSchema = asset.assetType === 'chart' 
    ? {
        type: Type.OBJECT,
        properties: {
          ...baseSchemaProperties,
          chartType: { type: Type.STRING },
          title: { type: Type.STRING },
          xAxisLabel: { type: Type.STRING },
          yAxisLabel: { type: Type.STRING },
          series: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                data: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      x: { type: Type.STRING },
                      y: { type: Type.NUMBER }
                    }
                  }
                }
              }
            }
          }
        }
      }
    : {
        type: Type.OBJECT,
        properties: {
          ...baseSchemaProperties,
          diagramType: { type: Type.STRING },
          title: { type: Type.STRING },
          nodes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, label: { type: Type.STRING } } } },
          edges: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { from: { type: Type.STRING }, to: { type: Type.STRING }, label: { type: Type.STRING } } } }
        }
      };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { inlineData: { data: asset.pngData, mimeType: 'image/png' } },
        { text: prompt }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema as any
      }
    });

    const rawText = response.text;
    if (!rawText) {
       console.warn("Empty response for spec extraction", asset.id);
       return asset;
    }
    
    let spec;
    try {
      const cleaned = cleanJsonResponse(rawText);
      if (!cleaned) throw new Error("AI returned empty visualization spec");
      spec = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn("Failed to parse visual spec:", rawText);
      return asset;
    }
    
    if (asset.assetType === 'chart') {
      return { ...asset, interpretiveSummary: spec.interpretiveSummary, chartSpec: { ...spec, sourcePage: asset.page, confidence: asset.confidence, caption: asset.caption }, reconstructionStatus: 'reconstructed' };
    } else {
      return { ...asset, interpretiveSummary: spec.interpretiveSummary, diagramSpec: { ...spec, sourcePage: asset.page, confidence: asset.confidence, caption: asset.caption }, reconstructionStatus: 'reconstructed' };
    }
  } catch (e) {
    console.warn("Failed to extract spec for asset", asset.id, e);
    return asset;
  }
}

export async function analyzeAssetSignificance(asset: InfographicAsset, narrativeContext: string, providedAI?: any): Promise<string> {
  const ai = providedAI || getAI();
  const prompt = `
    NARRATIVE CONTEXT:
    ${narrativeContext}
    
    VISUAL CAPTION:
    ${asset.caption}
    
    TASK: Provide a deep interpretation (30-60 words) for this visual asset.
    DO NOT repeat the caption. DO NOT list subheadings.
    EXPLAIN why this specific data/diagram is critical to the narrative above.
    Use high-density, analytical language.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { inlineData: { data: asset.pngData!, mimeType: 'image/png' } },
        { text: prompt }
      ]
    });
    return response.text.trim();
  } catch (e) {
    return asset.caption;
  }
}
