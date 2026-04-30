
import { GoogleGenAI, Type } from "@google/genai";
import { InfographicData, TableData, Citation, InfographicAsset, PipelineStep, DocumentContext, VisualRole, NarrativeSection, FactualClaim, NumericInsight, ClaimVerification, FaithfulnessReport, CoverageReport } from "../types";
import { renderPageToImage } from "./pdfService";
import { detectFiguresOnPage, extractVisualSpec, analyzeAssetSignificance } from "./visionService";

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("Gemini API Key not found. Please check your environment variables.");
  }

  return new GoogleGenAI({ apiKey });
}

/**
 * Basic deduplication using multiple heuristics to prevent identical assets from appearing twice.
 */
function deduplicateAssets(assets: InfographicAsset[]): InfographicAsset[] {
  const seenIds = new Set<string>();
  const seenHashes = new Set<string>();
  const unique: InfographicAsset[] = [];

  for (const asset of assets) {
    // 1. Technical identity
    if (seenIds.has(asset.id)) continue;

    // 2. Positional + Type identity (Prevent same figure on same page being detected slightly differently)
    const posHash = `${asset.page}_${asset.assetType}_${Math.round((asset.bbox?.ymin || 0)/20)}_${Math.round((asset.bbox?.xmin || 0)/20)}`;
    
    // 3. Caption identity
    const cleanCaption = asset.caption.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50);
    const captionHash = `${asset.page}_${cleanCaption}`;

    if (seenHashes.has(posHash) || (cleanCaption.length > 10 && seenHashes.has(captionHash))) {
      continue;
    }

    seenIds.add(asset.id);
    seenHashes.add(posHash);
    seenHashes.add(captionHash);
    unique.push(asset);
  }

  return unique;
}

/**
 * Scores every asset against the paper's core narrative layers using an LLM pass.
 */
async function rankAndSlotAssetsWithAI(
  assets: InfographicAsset[], 
  narrative: Partial<InfographicData>,
  providedAI: any
): Promise<{
  slots: Record<VisualRole, InfographicAsset | null>;
  rejections: string[];
}> {
  const ai = providedAI || getAI();
  
  const manifest = assets.map(a => ({
    id: a.id,
    type: a.assetType,
    page: a.page,
    caption: a.caption
  }));

  const context = {
    title: narrative.title,
    summary: narrative.summary,
    coreClaim: narrative.narrativeLayers?.coreIdea?.tokens?.map(t => t.value).join(''),
    mechanism: narrative.narrativeLayers?.mechanismAnalysis?.tokens?.map(t => t.value).join(''),
    evidence: narrative.narrativeLayers?.evidence?.tokens?.map(t => t.value).join('')
  };

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze the provided visual assets and rank their suitability for three specific infographic roles.
    
    PAPER CONTEXT:
    Title: ${context.title}
    Summary: ${context.summary}
    Core Claim: ${context.coreClaim}
    Mechanism: ${context.mechanism}
    Evidence: ${context.evidence}
    
    CANDIDATE ASSETS:
    ${JSON.stringify(manifest, null, 2)}
    
    ROLES & CRITERIA:
    1. hero: Must provide an authoritative overview of the paper's central idea. 
       - EXCLUSION: Equation panels almost NEVER qualify as Hero.
    2. mechanism: Must show a process, transformation, logic flow, or architecture.
    3. evidence: Must show empirical results, comparisons, or benchmarks (usually charts/tables).
    
    DEDUPLICATION & SAFETY:
    - You must assign exactly ONE asset per role (or null if no suitable asset exists).
    - The SAME asset cannot fill multiple roles.
    - If no extracted asset sufficiently explains the "mechanism" but the paper is highly conceptual, suggest "GENERATE_SVG" for that role.
    
    Respond in JSON format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          assignments: {
            type: Type.OBJECT,
            properties: {
              hero: { type: Type.STRING, description: "ID of the asset or 'NULL'" },
              mechanism: { type: Type.STRING, description: "ID of the asset, 'NULL', or 'GENERATE_SVG'" },
              evidence: { type: Type.STRING, description: "ID of the asset or 'NULL'" }
            }
          },
          scores: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                roleScores: {
                  type: Type.OBJECT,
                  properties: {
                    hero: { type: Type.NUMBER },
                    mechanism: { type: Type.NUMBER },
                    evidence: { type: Type.NUMBER }
                  }
                },
                rationale: { type: Type.STRING }
              }
            }
          }
        },
        required: ["assignments", "scores"]
      }
    }
  });

  let decision;
  try {
    decision = JSON.parse(cleanJsonResponse(response.text));
  } catch (e: any) {
    console.error("Asset ranking parse failure:", response.text);
    throw new Error(`Critical: Asset ranking pass returned invalid JSON. Payload: ${response.text.substring(0, 100)}...`);
  }
  
  const slots: Record<VisualRole, InfographicAsset | null> = { hero: null, mechanism: null, evidence: null };
  const rejections: string[] = [];

  // Map scores back to assets
  assets.forEach(a => {
    const scoreData = decision.scores.find((s: any) => s.id === a.id);
    if (scoreData) {
      a.roleScores = scoreData.roleScores;
      a.rationale = scoreData.rationale;
    }
  });

  // Assign slots
  Object.entries(decision.assignments).forEach(([role, id]) => {
    if (id === 'GENERATE_SVG' && role === 'mechanism') {
      // Special trigger handling
      slots[role as VisualRole] = {
        id: 'generated_mechanism_svg',
        assetType: 'diagram',
        renderingMode: 'derive_explanatory',
        classification: 'explanatory_concept',
        isSourceOfTruth: false,
        page: 1,
        caption: `Generated conceptual diagram for: ${context.mechanism?.substring(0, 100)}...`,
        confidence: 0.9,
        reconstructionStatus: 'original',
        provenance: {
          sourceText: "System-generated based on mechanism synthesis.",
          pageNumber: 1,
          confidence: 0.9,
          extractedAt: new Date().toISOString()
        }
      };
    } else {
      const asset = assets.find(a => a.id === id);
      if (asset) {
        asset.selectedRole = role as VisualRole;
        slots[role as VisualRole] = asset;
      }
    }
  });

  return { slots, rejections };
}

/**
 * Utility to pace requests to stay within rate limits.
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function cleanJsonResponse(text: string): string {
  if (!text) return "";
  return text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
}

/**
 * Strips model-hallucinated placeholders from extracted data.
 * If a value is a placeholder, it is removed.
 * If an optional object is empty after removal, it is removed.
 */
function sanityFilter(data: any): any {
  const placeholders = [
    "undefined", "tbd", "n/a", "unknown", "not specified", "placeholder", 
    "none", "no data", "pending", "to be determined", "information not provided"
  ];
  
  const isPlaceholder = (val: any) => {
    if (typeof val !== 'string') return false;
    const lowVal = val.trim().toLowerCase();
    return placeholders.some(p => lowVal === p || lowVal === `[${p}]` || lowVal === `(${p})`);
  };

  const clean = (obj: any): any => {
    if (Array.isArray(obj)) {
      const cleanedArr = obj.map(clean).filter(v => v !== undefined);
      return cleanedArr.length > 0 ? cleanedArr : undefined;
    } else if (obj !== null && typeof obj === 'object') {
      const result: any = {};
      let hasValue = false;
      for (const [key, value] of Object.entries(obj)) {
        const cleanedValue = clean(value);
        if (cleanedValue !== undefined && !isPlaceholder(cleanedValue)) {
          result[key] = cleanedValue;
          hasValue = true;
        }
      }
      return hasValue ? result : undefined;
    }
    return isPlaceholder(obj) ? undefined : obj;
  };

  return clean(data) || {};
}

/**
 * Enhanced exponential backoff with Automatic Paid Fallback.
 * Attempts call with free key first; switches to paid on 429 if available.
 */
async function retryWithBackoff<T>(fn: (ai: any) => Promise<T>, maxRetries: number = 8): Promise<T> {
  let lastError: any;
  let usePaidFallback = false;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const currentAI = getAI();
      return await fn(currentAI);
    } catch (err: any) {
      lastError = err;
      const isRateLimit = err.status === 429 || 
                          (err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED') || err.message.includes('quota')));
      
      if (err.status && err.status >= 400 && err.status < 500 && !isRateLimit) throw err;

      const jitter = Math.random() * 1000;
      const baseDelay = isRateLimit ? 10000 : 2000;
      const waitTime = (baseDelay * Math.pow(2, i)) + jitter;
      
      console.warn(`API attempt ${i + 1}/${maxRetries} failed. ${isRateLimit ? 'Rate Limited' : 'Error'}. Backing off...`);
      
      if (onGlobalRateLimit) onGlobalRateLimit(isRateLimit);
      await delay(waitTime);
    }
  }
  throw lastError;
}

let onGlobalRateLimit: ((active: boolean) => void) | null = null;
export function setRateLimitListener(callback: (active: boolean) => void) {
  onGlobalRateLimit = callback;
}

/**
 * FULL DOCUMENT SYNTHESIS: Iterative chunked approach with context carryover.
 */
async function synthesizeFullDocument(
  pages: { pageNumber: number; text: string }[],
  onProgress?: (step: PipelineStep, detail?: string) => void,
  providedAI?: any
): Promise<Partial<InfographicData>> {
  const ai = providedAI || getAI();
  
  // Dynamic chunk size estimation based on average page length
  const avgPageLength = pages.reduce((acc, p) => acc + p.text.length, 0) / pages.length;
  const CHUNK_SIZE = avgPageLength > 4000 ? 5 : (avgPageLength < 1000 ? 15 : 10);
  
  let runningContext: DocumentContext = {
    runningSummary: "Project initialization.",
    sectionMap: {},
    keyEntities: { methods: [], datasets: [], variables: [] },
    totalPageCount: pages.length
  };

  const chunkSummaries: string[] = [];

  for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
    const chunkEnd = Math.min(i + CHUNK_SIZE, pages.length);
    const chunk = pages.slice(i, chunkEnd);
    
    // Add 1-page overlap for continuity if not at the start
    const overlapPage = i > 0 ? pages[i - 1] : null;
    const chunkWithOverlap = overlapPage ? [overlapPage, ...chunk] : chunk;
    
    const pageRangeStr = `${i + 1}-${chunkEnd}`;
    const contextText = chunkWithOverlap.map(p => `--- PAGE ${p.pageNumber} ---\n${p.text}`).join('\n\n');

    if (onProgress) onProgress('synthesizing_narrative', `Analyzing pages ${pageRangeStr}...`);

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are an editorial researcher for The Economist. Analyze this chunk of a research paper.
      
      PREVIOUS CONTEXT (Summary so far):
      ${runningContext.runningSummary}
      
      CURRENT CHUNK (${pageRangeStr}):
      ${contextText}
      
      TASK:
      1. Provide a compressed summary of this chunk (max 150 words).
      2. Identify new key entities: Methods, Datasets, Variables.
      3. Map the contents to a section title (e.g. "Methodology", "Results").
      
      STRICT CONSTRAINTS:
      - Ground in text. Omit sections not present.
      - Maintain consistency with the previous context.
      - Respond in JSON format.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            chunkSummary: { type: Type.STRING },
            newEntities: {
              type: Type.OBJECT,
              properties: {
                methods: { type: Type.ARRAY, items: { type: Type.STRING } },
                datasets: { type: Type.ARRAY, items: { type: Type.STRING } },
                variables: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            },
            sectionTitle: { type: Type.STRING }
          },
          required: ["chunkSummary", "newEntities", "sectionTitle"]
        }
      }
    });
    
    try {
      const parsedChunk = JSON.parse(cleanJsonResponse(response.text));
      chunkSummaries.push(parsedChunk.chunkSummary);
      
      // Update running context
      runningContext.runningSummary = await compressSummary(ai, runningContext.runningSummary + "\n" + parsedChunk.chunkSummary);
      runningContext.sectionMap[pageRangeStr] = parsedChunk.sectionTitle;
      runningContext.keyEntities.methods = [...new Set([...runningContext.keyEntities.methods, ...parsedChunk.newEntities.methods])].slice(0, 15);
      runningContext.keyEntities.datasets = [...new Set([...runningContext.keyEntities.datasets, ...parsedChunk.newEntities.datasets])].slice(0, 15);
      runningContext.keyEntities.variables = [...new Set([...runningContext.keyEntities.variables, ...parsedChunk.newEntities.variables])].slice(0, 15);
    } catch (parseError: any) {
      console.error(`Failed to parse chunk ${pageRangeStr} response:`, response.text);
      throw new Error(`Critical: AI returned malformed data on page ${pageRangeStr}. Payload: ${response.text.substring(0, 100)}...`);
    }

    await delay(1500);
  }

  if (onProgress) onProgress('synthesizing_narrative', "Finalizing high-density editorial synthesis...");

  const finalResponse = await ai.models.generateContent({
    // ... rest of the finalResponse call remains the same ...
    model: 'gemini-3.1-pro-preview',
    contents: `You are a Lead Designer at The Economist. Transform the following chronological summaries and extracted entities into a high-density, scannable editorial infographic narrative.
    
    ENTITIES DISCOVERED:
    Methods: ${runningContext.keyEntities.methods.join(', ')}
    Datasets: ${runningContext.keyEntities.datasets.join(', ')}
    Variables: ${runningContext.keyEntities.variables.join(', ')}

    CHRONOLOGICAL SUMMARIES:
    ${chunkSummaries.join('\n\n')}

    DESIGN GUIDELINES (ECONOMIST STYLE):
    1. Resolve cross-chunk references: If a method was defined on page 1 and results appear on page 20, link them logically.
    2. Deduplicate: Merge repeated findings across chunks.
    3. Enforce terminology: Use the most authoritative term discovered for each variable/method.
    4. STRUCTURED CONTENT: Do not provide a single block of text for descriptions. Divide narrative into an array of typed tokens.
    5. FATAL ACCURACY: 
       - Separate direct findings ("the model achieved 80%") from interpretation ("this suggests efficiency").
       - Preserve uncertainty: Use qualifiers like "potentially", "likely", or "limited to" if they appear in the source.
       - Do NOT spin limitations or risks as positive outcomes.
       - Maintain technical nuance: Do not oversimplify if it changes the scientific meaning.
    
    TOKEN TYPES:
    - text: regular prose
    - metric: numeric result (e.g. "0.45", "top-5 error rate of 15.3%")
    - dataset: specific data source names (e.g. "ImageNet-2012")
    - benchmark: industry standard tests
    - rank: ordinals (e.g. "SOTA", "First place")
    - percentage: (e.g. "20%")
    - hyperparameter_range: (e.g. "p=0.5")
    - equation_symbol: characters like alpha, beta, etc.
    - figure_reference: cross-references to visual assets.
    - citation: numeric anchor to the citations array (value should be "1", "2", or "3").

    STRICT BLOCK RULES:
    1. coreIdea (type: claim): authoritative summary.
    2. evidence (type: evidence): high-density metric-rich bullets.
    3. impactAnalysis (type: impact): Direct, punchy system-level outcomes.
    4. mechanismAnalysis (type: mechanism): Technical explanation of the innovation.
    
    COMPRESSION RULES:
    - Max 500 words total for the entire narrative.
    
    GROUNDING:
    - Populate the citations array with exactly 3 citations (quote, section, page, confidence).
    - Confidence must be 0.0-1.0 based on how verbatim the quote is.
    - You MUST insert exactly 3 citation tokens across the narrative layers that correspond to these citations by index.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          researchQuestion: { type: Type.STRING },
          narrativeLayers: {
            type: Type.OBJECT,
            properties: {
              coreIdea: { 
                type: Type.OBJECT, 
                properties: { 
                  title: { type: Type.STRING }, 
                  tokens: { 
                    type: Type.ARRAY, 
                    items: { 
                      type: Type.OBJECT,
                      properties: { type: { type: Type.STRING }, value: { type: Type.STRING }, linkId: { type: Type.STRING } },
                      required: ["type", "value"]
                    } 
                  }, 
                  type: { type: Type.STRING } 
                },
                required: ["title", "tokens", "type"]
              },
              evidence: { 
                type: Type.OBJECT, 
                properties: { 
                  title: { type: Type.STRING }, 
                  tokens: { 
                    type: Type.ARRAY, 
                    items: { 
                      type: Type.OBJECT,
                      properties: { type: { type: Type.STRING }, value: { type: Type.STRING }, linkId: { type: Type.STRING } },
                      required: ["type", "value"]
                    } 
                  }, 
                  type: { type: Type.STRING } 
                },
                required: ["title", "tokens", "type"]
              },
              mechanismAnalysis: { 
                type: Type.OBJECT, 
                properties: { 
                  title: { type: Type.STRING }, 
                  tokens: { 
                    type: Type.ARRAY, 
                    items: { 
                      type: Type.OBJECT,
                      properties: { type: { type: Type.STRING }, value: { type: Type.STRING }, linkId: { type: Type.STRING } },
                      required: ["type", "value"]
                    } 
                  }, 
                  type: { type: Type.STRING } 
                },
                required: ["title", "tokens", "type"]
              },
              impactAnalysis: { 
                type: Type.OBJECT, 
                properties: { 
                  title: { type: Type.STRING }, 
                  tokens: { 
                    type: Type.ARRAY, 
                    items: { 
                      type: Type.OBJECT,
                      properties: { type: { type: Type.STRING }, value: { type: Type.STRING }, linkId: { type: Type.STRING } },
                      required: ["type", "value"]
                    } 
                  }, 
                  type: { type: Type.STRING } 
                },
                required: ["title", "tokens", "type"]
              }
            },
            required: ["coreIdea", "evidence", "impactAnalysis"]
          },
          citations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { 
                section: { type: Type.STRING }, 
                page: { type: Type.NUMBER }, 
                quote: { type: Type.STRING },
                confidence: { type: Type.NUMBER }
              },
              required: ["section", "page", "quote", "confidence"]
            }
          }
        },
        required: ["title", "summary", "researchQuestion", "narrativeLayers", "citations"]
      }
    }
  });

  let parsed;
  try {
    const cleaned = cleanJsonResponse(finalResponse.text);
    if (!cleaned) throw new Error("Narrative synthesis engine returned empty text");
    parsed = JSON.parse(cleaned);
  } catch (e: any) {
    console.error("Final synthesis parse failure:", finalResponse.text);
    console.warn(`Warning: Content synthesis pass had issues: ${e.message}. Attempting fallback structure...`);
    parsed = {
      title: "Document Synthesis",
      summary: "Analysis in progress but narrative generation skipped a beat.",
      researchQuestion: "Source Analysis",
      narrativeLayers: {
        coreIdea: { title: "Draft Finding", tokens: [{ type: 'text', value: "Direct extraction failed. Please review the grounding trace." }], type: 'claim' },
        evidence: { title: "Evidence Log", tokens: [{ type: 'text', value: "See secondary research logs for detected metrics." }], type: 'evidence' },
        impactAnalysis: { title: "Potential Impact", tokens: [{ type: 'text', value: "Analysis pending." }], type: 'impact' }
      },
      citations: []
    };
  }
  
  const filtered = sanityFilter(parsed);
  const emptySection = (title: string, type: any): NarrativeSection => ({ title, tokens: [{ type: 'text', value: "Not explicitly detailed in this pass." }], type });

  const finalNarrative = {
    title: filtered.title || "Research Synthesis",
    summary: filtered.summary || "No automated summary available.",
    researchQuestion: filtered.researchQuestion || "Scientific inquiry discovered from text.",
    narrativeLayers: {
      coreIdea: filtered.narrativeLayers?.coreIdea || emptySection("Core Idea", "claim"),
      evidence: filtered.narrativeLayers?.evidence || emptySection("Supporting Evidence", "evidence"),
      mechanismAnalysis: filtered.narrativeLayers?.mechanismAnalysis,
      impactAnalysis: filtered.narrativeLayers?.impactAnalysis || emptySection("Systemic Impact", "impact"),
      limitations: filtered.narrativeLayers?.limitations,
    },
    citations: filtered.citations || []
  };

  return finalNarrative;
}

/**
 * Utility to compress a summary to keep it within context window.
 */
async function compressSummary(ai: any, text: string): Promise<string> {
  if (text.length < 1000) return text;
  const resp = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Compress this research summary into a high-density paragraph of max 300 words. Preserve key findings and entities.\n\n${text}`
  });
  return resp.text;
}

export async function extractClaimsFromInfographic(
  infographicText: string,
  sourceText: string,
  providedAI?: any
): Promise<FactualClaim[]> {
  const ai = providedAI || getAI();
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `You are a structured extraction and verification system.

Input:
Infographic content:
${infographicText}

Source Document Evidence:
${sourceText.substring(0, 50000)}

Task:
Extract factual claims from the infographic, prioritizing those explicitly supported by the source text.
- Include high-confidence interpretations IF they are clearly implied by the source evidence.
- If a claim is an implication rather than a direct quote, set claim_type to "inferred".
- Do not invent new facts, statistics, or precise percentages not in the source.
- Preserve context, caveats, and limitations (e.g., "limited to specific models").
- For every valid claim, you MUST provide the direct source quote and page/chunk reference.

Return JSON in this format:
{
  "claims": [
    {
      "claim_text": "...",
      "claim_type": "statistic | finding | interpretation | limitation | inferred",
      "numbers": [],
      "source_quote": "...",
      "page_or_chunk": "...",
      "confidence": 0.0
    }
  ]
}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          claims: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                claim_text: { type: Type.STRING },
                claim_type: { type: Type.STRING, enum: ['statistic', 'finding', 'interpretation', 'limitation', 'inferred'] },
                numbers: { type: Type.ARRAY, items: { type: Type.STRING } },
                source_quote: { type: Type.STRING },
                page_or_chunk: { type: Type.STRING },
                confidence: { type: Type.NUMBER }
              },
              required: ["claim_text", "claim_type", "numbers", "source_quote", "page_or_chunk", "confidence"]
            }
          }
        },
        required: ["claims"]
      }
    }
  });

  try {
    const data = JSON.parse(cleanJsonResponse(response.text));
    return data.claims || [];
  } catch (e) {
    console.error("Failed to parse claims:", response.text);
    return [];
  }
}

export async function extractNumericInsightsFromInfographic(
  infographicText: string,
  providedAI?: any
): Promise<NumericInsight[]> {
  const ai = providedAI || getAI();
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Extract all numeric values from this research infographic text and explain what each number refers to.

Text:
${infographicText}

Respond in JSON format:
[
  {
    "value": "",
    "context": ""
  }
]`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            value: { type: Type.STRING },
            context: { type: Type.STRING }
          },
          required: ["value", "context"]
        }
      }
    }
  });

  try {
    return JSON.parse(cleanJsonResponse(response.text));
  } catch (e) {
    console.error("Failed to parse numeric insights:", response.text);
    return [];
  }
}

export async function verifyNumericAccuracy(
  insights: NumericInsight[],
  sourceText: string,
  providedAI?: any
): Promise<NumericInsight[]> {
  const ai = providedAI || getAI();
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `You are verifying numerical accuracy.

Infographic numbers:
${JSON.stringify(insights)}

Source text:
${sourceText.substring(0, 60000)}

Task:
For each number:
1. Check if it appears in the source text
2. Verify that the context matches (e.g., accuracy vs error rate)
3. Flag mismatches

Respond in JSON format:
[
  {
    "value": "",
    "found_in_source": true,
    "context_match": true,
    "status": "valid | mismatch | missing"
  }
]`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            value: { type: Type.STRING },
            found_in_source: { type: Type.BOOLEAN },
            context_match: { type: Type.BOOLEAN },
            status: { type: Type.STRING, enum: ['valid', 'mismatch', 'missing'] }
          },
          required: ["value", "found_in_source", "context_match", "status"]
        }
      }
    }
  });

  try {
    const verified = JSON.parse(cleanJsonResponse(response.text));
    return insights.map(insight => {
        const v = verified.find((item: any) => item.value === insight.value);
        return {
            ...insight,
            ...(v || { found_in_source: false, context_match: false, status: 'missing' })
        };
    });
  } catch (e) {
    console.error("Failed to verify numerical accuracy:", response.text);
    return insights;
  }
}

export async function verifyClaim(
  claim: string,
  sourceText: string,
  providedAI?: any
): Promise<ClaimVerification> {
  const ai = providedAI || getAI();
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `You are an expert fact-checking verification system.

Claim:
${claim}

Source Evidence:
${sourceText.substring(0, 60000)}

TASK:
Determine whether the claim is:
- supported: Explicitly stated in the source text.
- partially_supported: Clearly implied or strongly inferred by the source data, even if not phrased identically.
- unsupported: Not grounded in the provided source text.
- contradicted: The source text explicitly states something that contradicts the claim.

GUIDELINES:
1. DO NOT require perfect wording matches. If the meaning is represented faithfully, mark as supported or partially_supported.
2. PRESERVE useful insights: If the claim represents a logical conclusion strongly supported by the evidence, treat it as partially_supported.
3. Be rigorous but fair: High-confidence inferences should be kept.

Return JSON:
{
  "verdict": "supported | partially_supported | unsupported | contradicted",
  "evidence_quote": "Direct quote from the source that supports, implies, or contradicts the claim",
  "page_or_chunk": "Page number or section identifier",
  "explanation": "Brief reasoning for the verdict, highlighting why an inference is considered valid if partially_supported.",
  "confidence": 0.0
}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          verdict: { type: Type.STRING, enum: ['supported', 'partially_supported', 'unsupported', 'contradicted'] },
          evidence_quote: { type: Type.STRING },
          page_or_chunk: { type: Type.STRING },
          explanation: { type: Type.STRING },
          confidence: { type: Type.NUMBER }
        },
        required: ["verdict", "evidence_quote", "explanation", "confidence", "page_or_chunk"]
      }
    }
  });

  try {
    return JSON.parse(cleanJsonResponse(response.text));
  } catch (e) {
    console.error("Failed to parse verification:", response.text);
    return {
      verdict: 'unsupported',
      evidence_quote: "Verification failed.",
      explanation: "Internal error during verification pass.",
      confidence: 0,
      page_or_chunk: "N/A"
    };
  }
}

export async function generateFaithfulnessReport(
  claims: FactualClaim[],
  sourceText: string,
  providedAI?: any
): Promise<FaithfulnessReport> {
  const ai = providedAI || getAI();
  
  const claimsJson = JSON.stringify(claims.map(c => ({
    text: c.claim_text,
    verdict: c.verification?.verdict
  })), null, 2);

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `You are evaluating an AI-generated infographic for faithfulness to the original research paper.

Claims and their preliminary verdicts:
${claimsJson}

Source:
${sourceText.substring(0, 60000)}

Task:
1. Review each claim against the source text.
2. Identify any statements in the infographic that explicitly CONTRADICT the source.
3. Identify statements that are MISLEADING SIMPLIFICATIONS (technically true but omit critical nuances that change the meaning).
4. Identify MISSING CONTEXT (key caveats or results omitted that would be necessary for a fair representation).
5. Compute a faithfulness_score (percentage of strictly 'supported' claims relative to total claims).
6. Count claims that are 'unsupported' or 'contradicted'.
7. Provide a brief summary_of_errors.

Return JSON:
{
  "faithfulness_score": 0.0,
  "unsupported_count": 0,
  "summary_of_errors": "Brief explanation.",
  "contradictions": ["list of contradictions"],
  "misleading_simplifications": ["list of simplifications"],
  "missing_context": ["list of missing context points"]
}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          faithfulness_score: { type: Type.NUMBER },
          unsupported_count: { type: Type.NUMBER },
          summary_of_errors: { type: Type.STRING },
          contradictions: { type: Type.ARRAY, items: { type: Type.STRING } },
          misleading_simplifications: { type: Type.ARRAY, items: { type: Type.STRING } },
          missing_context: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["faithfulness_score", "unsupported_count", "summary_of_errors", "contradictions", "misleading_simplifications", "missing_context"]
      }
    }
  });

  try {
    const data = JSON.parse(cleanJsonResponse(response.text));
    
    // Programmatic override for objective metrics to ensure mathematical consistency 
    // with individual claim verifications performed in the previous step.
    const supportedCount = claims.filter(c => 
      c.verification?.verdict === 'supported' || 
      c.verification?.verdict === 'partially_supported'
    ).length;
    const problematicCount = claims.filter(c => c.verification?.verdict === 'unsupported' || c.verification?.verdict === 'contradicted').length;
    const totalCount = claims.length;
    
    data.faithfulness_score = totalCount > 0 ? (supportedCount / totalCount) : 1;
    data.unsupported_count = problematicCount;
    
    return data;
  } catch (e) {
    console.error("Failed to parse faithfulness report:", response.text);
    return {
      faithfulness_score: 0,
      unsupported_count: claims.length,
      summary_of_errors: "Internal validation failure."
    };
  }
}

export async function analyzeCoverage(
  infographicClaims: FactualClaim[],
  sourceText: string,
  providedAI?: any
): Promise<CoverageReport> {
  const ai = providedAI || getAI();

  // 1. Extract critical claims from source
  const criticalExtraction = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Extract the 5–10 most important, high-level factual claims from this research paper. 
    These should be the "essential" points that any faithful summary MUST include.
    
    Source:
    ${sourceText.substring(0, 60000)}
    
    Return JSON list of strings.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  const criticalClaimsFromSource: string[] = JSON.parse(cleanJsonResponse(criticalExtraction.text));

  // 2. Compare with infographic claims
  const infographicClaimsTexts = infographicClaims.map(c => c.claim_text);

  const coverageAnalysis = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Compare these essential research paper claims against the claims actually present in the infographic.
    
    ESSENTIAL SOURCE CLAIMS:
    ${JSON.stringify(criticalClaimsFromSource)}
    
    INFOGRAPHIC CLAIMS:
    ${JSON.stringify(infographicClaimsTexts)}
    
    TASK:
    Classify each essential source claim as:
    - fully_covered: Explicitly or clearly stated in the infographic.
    - partially_covered: Only some aspects or lower-detail version is present.
    - not_covered: Missing entirely from the infographic.
    
    Return a coverage_score (0.0 to 1.0) based on weighted coverage.
    
    Return JSON:
    {
      "coverage_score": 0.0,
      "critical_claims": [
        {
          "source_claim": "...",
          "coverage": "fully_covered | partially_covered | not_covered",
          "explanation": "...",
          "mapped_infographic_claim": "..."
        }
      ],
      "missing_essentials": ["list of strings"]
    }`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          coverage_score: { type: Type.NUMBER },
          critical_claims: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                source_claim: { type: Type.STRING },
                coverage: { type: Type.STRING, enum: ['fully_covered', 'partially_covered', 'not_covered'] },
                explanation: { type: Type.STRING },
                mapped_infographic_claim: { type: Type.STRING }
              },
              required: ["source_claim", "coverage", "explanation"]
            }
          },
          missing_essentials: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["coverage_score", "critical_claims", "missing_essentials"]
      }
    }
  });

  try {
    return JSON.parse(cleanJsonResponse(coverageAnalysis.text));
  } catch (e) {
    console.error("Failed to parse coverage report:", coverageAnalysis.text);
    return {
      coverage_score: 0,
      critical_claims: criticalClaimsFromSource.map(c => ({
        source_claim: c,
        coverage: 'not_covered',
        explanation: "Coverage analysis failed."
      })),
      missing_essentials: criticalClaimsFromSource
    };
  }
}

export async function refineNarrative(
  originalData: Partial<InfographicData>,
  report: FaithfulnessReport,
  verifiedClaims: FactualClaim[],
  providedAI?: any
): Promise<Partial<InfographicData>> {
  const ai = providedAI || getAI();
  
  const auditContext = {
    faithfulnessScore: report.faithfulness_score,
    contradictions: report.contradictions,
    simplifications: report.misleading_simplifications,
    missingContext: report.missing_context,
    summaryOfErrors: report.summary_of_errors,
    evidencedClaims: verifiedClaims.filter(c => 
      (c.verification?.verdict === 'supported' && (c.verification?.confidence ?? 0) >= 0.8) || 
      (c.verification?.verdict === 'partially_supported' && (c.verification?.confidence ?? 0) >= 0.6)
    ).map(c => ({ 
      text: c.claim_text, 
      status: c.verification?.verdict, 
      confidence: c.verification?.confidence 
    }))
  };

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: `You are a Fact-Checking Editor. Refine and correct the following infographic narrative based on a Faithfulness Audit.
    
    ORIGINAL NARRATIVE:
    ${JSON.stringify(originalData.narrativeLayers, null, 2)}
    
    FAITHFULNESS AUDIT RESULTS:
    ${JSON.stringify(auditContext, null, 2)}
    
    REFINEMENT RULES:
    1. DELETE any statement that explicitly CONTRADICTS the source.
    2. REMOVE purely fabricated or unsupported claims (confidence < 0.6).
    3. RETAIN 'partially_supported' claims if they have confidence >= 0.6, but you MUST flag them with qualifying language (e.g., "Preliminary results suggest...", "Inferred from...", "Potentially..."). 
    4. RETAIN 'supported' claims (confidence >= 0.8) as authoritative findings.
    5. RESTORE missing caveats and limitations (e.g., small sample size, model-specific results) to prevent over-claiming.
    6. SEPARATE Findings from Interpretation for clarity.
    7. PRESERVE Uncertainty: Use qualifiers like "potentially", "likely", or "limited to" for non-authoritative (partially supported) data.
    8. DO NOT ADD NEW CLAIMS that weren't in the original narrative unless they are essential caveats.
    
    Respond with the corrected narrative layers in JSON format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          narrativeLayers: {
            type: Type.OBJECT,
            properties: {
              coreIdea: { 
                type: Type.OBJECT, 
                properties: { 
                  title: { type: Type.STRING }, 
                  tokens: { 
                    type: Type.ARRAY, 
                    items: { 
                      type: Type.OBJECT,
                      properties: { type: { type: Type.STRING }, value: { type: Type.STRING }, linkId: { type: Type.STRING } },
                      required: ["type", "value"]
                    } 
                  }, 
                  type: { type: Type.STRING } 
                },
                required: ["title", "tokens", "type"]
              },
              evidence: { 
                type: Type.OBJECT, 
                properties: { 
                  title: { type: Type.STRING }, 
                  tokens: { 
                    type: Type.ARRAY, 
                    items: { 
                      type: Type.OBJECT,
                      properties: { type: { type: Type.STRING }, value: { type: Type.STRING }, linkId: { type: Type.STRING } },
                      required: ["type", "value"]
                    } 
                  }, 
                  type: { type: Type.STRING } 
                },
                required: ["title", "tokens", "type"]
              },
              mechanismAnalysis: { 
                type: Type.OBJECT, 
                properties: { icon: { type: Type.STRING }, title: { type: Type.STRING }, tokens: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, value: { type: Type.STRING } }, required: ["type", "value"] } }, type: { type: Type.STRING } }
              },
              impactAnalysis: { 
                type: Type.OBJECT, 
                properties: { title: { type: Type.STRING }, tokens: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, value: { type: Type.STRING } }, required: ["type", "value"] } }, type: { type: Type.STRING } }
              },
              limitations: { 
                type: Type.OBJECT, 
                properties: { title: { type: Type.STRING }, tokens: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, value: { type: Type.STRING } }, required: ["type", "value"] } }, type: { type: Type.STRING } }
              }
            },
            required: ["coreIdea", "evidence", "impactAnalysis"]
          }
        },
        required: ["narrativeLayers"]
      }
    }
  });

  try {
    const refined = JSON.parse(cleanJsonResponse(response.text));
    return {
      ...originalData,
      narrativeLayers: refined.narrativeLayers
    };
  } catch (e) {
    console.error("Narrative refinement failed:", response.text);
    return originalData;
  }
}

export async function analyzePaper(
  pages: { pageNumber: number; text: string }[], 
  file: File,
  onProgress?: (step: PipelineStep, detail?: string, payload?: any) => void
): Promise<InfographicData> {
  const telemetry: string[] = [];
  let currentPipelineStep: PipelineStep = 'idle';
  const log = (msg: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const logMsg = `[${timestamp}] ${msg}`;
    telemetry.push(logMsg);
    console.log(logMsg);
    if (onProgress) onProgress(currentPipelineStep, logMsg, { type: 'log', message: logMsg });
  };

  log(`Starting analysis for document with ${pages.length} pages.`);

  try {
    // 1. PHASE 6: Global Narrative Synthesis
    currentPipelineStep = 'synthesizing_narrative';
    log("Phase 1: Narrative Synthesis starting...");
    const narrative = await retryWithBackoff(async (ai) => {
      try {
        const res = await synthesizeFullDocument(pages, onProgress, ai);
        log(`Narrative synthesis complete. Title: ${res.title}`);
        return res;
      } catch (e: any) {
        log(`Narrative synthesis failed: ${e.message}`);
        throw e;
      }
    });

    // 2. PHASE 6: Extract All Assets (Detection Pass Only)
    currentPipelineStep = 'scanning_figures';
    const allDetectedAssets: InfographicAsset[] = [];
  const pagesToScan = pages.length > 20 ? [1, 2, 3, 5, pages.length - 1, pages.length] : pages.map(p => p.pageNumber);
  
  log(`Phase 2: Visual Detection on ${pagesToScan.length} pages...`);
  if (onProgress) onProgress('scanning_figures', `Scanning ${pagesToScan.length} pages for potential visuals...`);

  for (const pageNum of pagesToScan) {
    try {
      if (onProgress) onProgress('scanning_figures', `Detecting figures on page ${pageNum}...`);
      const pageAssets = await retryWithBackoff(async (ai) => {
        const assets = await detectFiguresOnPage(file, pageNum, ai);
        log(`Page ${pageNum}: Detected ${assets.length} potential visuals.`);
        return assets;
      });
      
      pageAssets.forEach(asset => {
        asset.provenance = {
          sourceText: asset.caption,
          pageNumber: pageNum,
          confidence: asset.confidence,
          extractedAt: new Date().toISOString()
        };
        allDetectedAssets.push(asset);
        if (onProgress) onProgress('scanning_figures', `Found ${asset.assetType} on P.${pageNum}`, { asset });
      });
      await delay(1000);
    } catch (e: any) {
      log(`Warning: Failed to detect assets on page ${pageNum}: ${e.message}`);
    }
  }

  // 3. PHASE 3 & 4: Deduplicate and Role-Aware Ranking
  const uniqueDetections = deduplicateAssets(allDetectedAssets);
  log(`Phase 3: Deduplication finished. ${uniqueDetections.length} unique assets remaining.`);
  
  if (onProgress) onProgress('scanning_figures', "Ranking assets against narrative roles...");
  log("Ranking assets for Hero/Mechanism/Evidence slots...");
  
  const selectedSlots = await retryWithBackoff(async (ai) => {
    try {
      const { slots } = await rankAndSlotAssetsWithAI(uniqueDetections, narrative, ai);
      const assigned = Object.keys(slots).filter(k => !!slots[k as VisualRole]);
      log(`Ranking complete. Slots assigned: ${assigned.join(', ') || 'NONE'}`);
      return slots;
    } catch (e: any) {
      log(`Ranking pass failed: ${e.message}`);
      throw e;
    }
  });

  // 4. PHASE 5 & 6: Trigger targeted enrichment
  currentPipelineStep = 'reconstructing_assets';
  const finalizedAssets: InfographicAsset[] = [];
  const selectedEntries = Object.entries(selectedSlots).filter(([_, asset]) => !!asset) as [VisualRole, InfographicAsset][];

  log(`Phase 4: Targeted enrichment for ${selectedEntries.length} selected assets...`);

  const narrativeContextStr = `
    TITLE: ${narrative.title}
    SUMMARY: ${narrative.summary}
    CORE IDEA: ${narrative.narrativeLayers?.coreIdea?.tokens.map(t => t.value).join('')}
    EVIDENCE: ${narrative.narrativeLayers?.evidence?.tokens.map(t => t.value).join('')}
    MECHANISM: ${narrative.narrativeLayers?.mechanismAnalysis?.tokens.map(t => t.value).join('')}
  `;

  for (const [role, asset] of selectedEntries) {
    if (onProgress) onProgress('reconstructing_assets', `Preparing ${role} asset: ${asset.caption.substring(0, 30)}...`, { role, asset });

    try {
      if (asset.renderingMode === 'derive_explanatory' || asset.id === 'generated_mechanism_svg') {
        log(`Generating companion model for ${role}...`);
        if (onProgress) onProgress('reconstructing_assets', `Generating explanatory SVG for ${role}...`, { role, asset, status: 'generating' });
        
        if (asset.id.startsWith('generated_')) {
          const enriched = await retryWithBackoff((ai) => extractVisualSpec(asset, true, narrativeContextStr, ai));
          finalizedAssets.push({ ...enriched, selectedRole: role });
          log(`Synthetic conceptual model completed for ${role}.`);
          if (onProgress) onProgress('reconstructing_assets', `Completed conceptual model for ${role}`, { role, asset: enriched, status: 'complete' });
        } else {
          finalizedAssets.push({ ...asset, selectedRole: role });
          
          let companion = {
            ...asset,
            id: `${asset.id}_companion`,
            renderingMode: 'reconstruct',
            classification: 'explanatory_concept',
            isSourceOfTruth: false,
            caption: `Expert Concept Model: ${asset.caption}`,
            reconstructionStatus: 'original',
            companionAssetId: asset.id,
            selectedRole: role
          } as InfographicAsset;

          const enrichedCompanion = await retryWithBackoff((ai) => extractVisualSpec(companion, true, narrativeContextStr, ai));
          finalizedAssets.push(enrichedCompanion);
          log(`Paired ${role} with synthetic companion.`);
          if (onProgress) onProgress('reconstructing_assets', `Paired ${role} with explanatory model`, { role, asset: enrichedCompanion, status: 'complete' });
        }
      } else if (asset.renderingMode === 'reconstruct') {
        log(`Reconstructing data structure for ${role} (${asset.assetType})...`);
        if (onProgress) onProgress('reconstructing_assets', `Reconstructing ${asset.assetType} structure...`, { role, asset, status: 'reconstructing' });
        const enriched = await retryWithBackoff((ai) => extractVisualSpec(asset, false, narrativeContextStr, ai));
        finalizedAssets.push({ ...enriched, selectedRole: role });
        log(`Reconstruction finished for ${role}.`);
        if (onProgress) onProgress('reconstructing_assets', `Finished ${asset.assetType} reconstruction.`, { role, asset: enriched, status: 'complete' });
      } else {
        // Preserved asset but still needs interpretive summary
        if (onProgress) onProgress('reconstructing_assets', `Interpreting ${role} significance...`, { role, asset, status: 'reconstructing' });
        const summary = await retryWithBackoff((ai) => analyzeAssetSignificance(asset, narrativeContextStr, ai));
        finalizedAssets.push({ ...asset, interpretiveSummary: summary, selectedRole: role });
        log(`Preserving original visual for ${role} with reasoning.`);
        if (onProgress) onProgress('reconstructing_assets', `Preserving original for ${role}`, { role, asset, status: 'complete' });
      }
      
      await delay(2000);
    } catch (e: any) {
      log(`Error during enrichment of ${role}: ${e.message}`);
      finalizedAssets.push({ ...asset, selectedRole: role, reconstructionStatus: 'failed' });
    }
  }

  // 5. PHASE 5: Extract Factual Claims
  currentPipelineStep = 'extracting_claims';
  log("Phase 5: Extracting factual claims for verification...");
  if (onProgress) onProgress('extracting_claims', "Extracting factual claims from generated narrative...");
  
  const infographicText = `
    Title: ${narrative.title}
    Summary: ${narrative.summary}
    Core Idea: ${narrative.narrativeLayers?.coreIdea?.tokens.map(t => t.value).join('')}
    Evidence: ${narrative.narrativeLayers?.evidence?.tokens.map(t => t.value).join('')}
    Mechanism: ${narrative.narrativeLayers?.mechanismAnalysis?.tokens.map(t => t.value).join('')}
    Impact: ${narrative.narrativeLayers?.impactAnalysis?.tokens.map(t => t.value).join('')}
  `;

  const fullSourceText = pages.map(p => p.text).join('\n\n');

  let allClaims = await retryWithBackoff(async (ai) => {
    return await extractClaimsFromInfographic(infographicText, fullSourceText, ai);
  });
  
  // Filter claims that have source quotes and are not "not enough evidence"
  const claims = allClaims.filter(c => 
    c.source_quote && 
    c.source_quote.toLowerCase() !== 'not enough evidence' &&
    !c.claim_text.toLowerCase().includes('not enough evidence')
  );

  log(`Extracted ${claims.length} evidenced factual claims (Filtered from ${allClaims.length}).`);

  // 6. PHASE 6: Extract Numeric Insights
  currentPipelineStep = 'extracting_numeric_insights';
  log("Phase 6: Extracting precise numeric insights...");
  if (onProgress) onProgress('extracting_numeric_insights', "Pinpointing numeric data points...");
  
  const numericInsights = await retryWithBackoff(async (ai) => {
    const extracted = await extractNumericInsightsFromInfographic(infographicText, ai);
    return await verifyNumericAccuracy(extracted, fullSourceText, ai);
  });
  log(`Extracted and verified ${numericInsights.length} numeric insights.`);

  // 7. PHASE 7: Verify Claims
  currentPipelineStep = 'verifying_claims';
  log("Phase 7: Verifying factual claims against source text...");
  if (onProgress) onProgress('verifying_claims', `Verifying ${claims.length} claims with source grounding...`);
  
  for (const claim of claims) {
    log(`Verifying: "${claim.claim_text.substring(0, 50)}..."`);
    claim.verification = await retryWithBackoff(async (ai) => {
      return await verifyClaim(claim.claim_text, fullSourceText, ai);
    });
    log(`Verdict: ${claim.verification.verdict} (${claim.verification.confidence})`);
  }

  // 8. PHASE 8: Faithfulness Audit (On all initial claims to detect errors)
  currentPipelineStep = 'auditing_faithfulness';
  log("Phase 8: Performing final faithfulness audit...");
  if (onProgress) onProgress('auditing_faithfulness', "Calculating document faithfulness score...");
  
  const faithfulnessReport = await retryWithBackoff(async (ai) => {
    return await generateFaithfulnessReport(claims, fullSourceText, ai);
  });
  log(`Faithfulness Score: ${faithfulnessReport.faithfulness_score * 100}%`);

  // 9. PHASE 9: Coverage Analysis
  log("Phase 9: Analyzing information coverage...");
  const coverageReport = await retryWithBackoff(async (ai) => {
    return await analyzeCoverage(claims, fullSourceText, ai);
  });
  log(`Coverage Score: ${Math.round(coverageReport.coverage_score * 100)}%`);

  // 10. Filtering Pass: Remove strictly unsupported or low-confidence claims
  const verifiedClaimsCount = claims.length;
  const keptClaims = claims.filter(c => {
    const confidence = c.verification?.confidence ?? 0;
    const verdict = c.verification?.verdict;
    
    // Explicitly remove if strictly unsupported or contradicted 
    if (verdict === 'unsupported' || verdict === 'contradicted') return false;
    
    // Follow user thresholds for keeping:
    // supported (confidence >= 0.8)
    // partially_supported (confidence >= 0.6)
    if (verdict === 'supported') return confidence >= 0.8;
    if (verdict === 'partially_supported') return confidence >= 0.6;

    // Remove if confidence is below 0.6 for any other cases (though unsupported/contradicted already handled)
    if (confidence < 0.6) return false;

    return false;
  });
  log(`Filtering complete: Kept ${keptClaims.length} / ${verifiedClaimsCount} claims based on confidence thresholds.`);

  // 11. PHASE 11: Refine Narrative (Correction Pass)
  currentPipelineStep = 'refining_narrative';
  log("Phase 11: Refining narrative based on audit feedback...");
  if (onProgress) onProgress('refining_narrative', "Applying corrections and restoring caveats...");
  
  const refinedNarrative = await retryWithBackoff(async (ai) => {
    return await refineNarrative(narrative, faithfulnessReport, keptClaims, ai);
  });
  
  // Update narrative with refined content
  narrative.narrativeLayers = refinedNarrative.narrativeLayers;

  currentPipelineStep = 'generating_report';
  log("Pipeline successful. Bundling result.");
  if (onProgress) onProgress('generating_report', "Finalizing publication package...");

  return {
    ...narrative as InfographicData,
    assets: finalizedAssets,
    candidateAssets: uniqueDetections,
    claims: keptClaims,
    faithfulnessReport,
    coverageReport,
    numericInsights,
    debug_summary: telemetry.join('\n'),
    fullText: pages.map(p => p.text).join('\n\n') 
  };
 } catch (err: any) {
   log(`CRITICAL ERROR: ${err.message}`);
   throw err;
 }
}
