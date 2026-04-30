
export interface Citation {
  section: string;
  page: number;
  quote: string;
  confidence: number;
}

export interface Provenance {
  sourceText: string;
  pageNumber: number;
  confidence: number;
  extractedAt: string;
}

export interface DocumentContext {
  runningSummary: string;
  sectionMap: { [pageRange: string]: string };
  keyEntities: {
    methods: string[];
    datasets: string[];
    variables: string[];
  };
  totalPageCount: number;
}

export type AssetType = 'chart' | 'diagram' | 'figure' | 'raster' | 'table' | 'equation';

export type VisualRole = 'hero' | 'mechanism' | 'evidence';

export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface ChartSpec {
  chartType: 'bar' | 'line' | 'scatter' | 'pie';
  title: string;
  subtitle?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  series: {
    label: string;
    data: { x: string | number; y: number }[];
  }[];
  legend?: string[];
  units?: string;
  caption: string;
  sourcePage: number;
  confidence: number;
}

export interface DiagramSpec {
  diagramType: string;
  title: string;
  nodes: { id: string; label: string; type?: string }[];
  edges: { from: string; to: string; label?: string }[];
  groups?: { id: string; label: string; members: string[] }[];
  labels?: { x: number; y: number; text: string }[];
  caption: string;
  sourcePage: number;
  confidence: number;
}

export interface TableData {
  id: string;
  caption: string;
  page: number;
  headers: string[];
  rows: (string | number)[][];
  validated: boolean;
  csv: string;
  type: 'standard' | 'ranking';
  unit?: string;
  debug_reason?: string;
  source?: 'text' | 'vision';
  extraction_confidence?: number;
}

export interface InfographicAsset {
  id: string;
  assetType: AssetType;
  renderingMode: 'preserve' | 'reconstruct' | 'derive_explanatory';
  classification: 'visual_evidence' | 'explanatory_concept';
  isSourceOfTruth: boolean;
  companionAssetId?: string;
  explanationPurpose?: string;
  page: number;
  caption: string;
  citation?: string;
  bbox?: BoundingBox;
  confidence: number;
  rankingScore?: number;
  roleScores?: {
    hero: number;
    mechanism: number;
    evidence: number;
  };
  selectedRole?: VisualRole;
  deduplicationHash?: string;
  scoring?: {
    centrality: number;
    evidence: number;
    distinctiveness: number;
  };
  rationale?: string;
  reconstructionStatus: 'reconstructed' | 'original' | 'failed';
  interpretiveSummary?: string;
  svgContent?: string;
  pngData?: string; // Base64
  csvData?: string;
  chartSpec?: ChartSpec;
  diagramSpec?: DiagramSpec;
  tableData?: TableData;
  provenance?: Provenance;
}

export type PipelineStep = 
  | 'idle'
  | 'extracting_text'
  | 'synthesizing_narrative'
  | 'scanning_figures'
  | 'reconstructing_assets'
  | 'extracting_claims'
  | 'extracting_numeric_insights'
  | 'verifying_claims'
  | 'auditing_faithfulness'
  | 'refining_narrative'
  | 'generating_report'
  | 'error';

export type TokenType = 'text' | 'metric' | 'dataset' | 'benchmark' | 'rank' | 'hyperparameter_range' | 'percentage' | 'equation_symbol' | 'figure_reference' | 'citation';

export interface ContentToken {
  type: TokenType;
  value: string;
  linkId?: string;
}

export interface NarrativeSection {
  title: string;
  tokens: ContentToken[]; 
  type: 'claim' | 'evidence' | 'mechanism' | 'impact' | 'limitations';
}

export interface ClaimVerification {
  verdict: 'supported' | 'partially_supported' | 'unsupported' | 'contradicted';
  evidence_quote: string;
  explanation: string;
  confidence: number;
  page_or_chunk?: string;
}

export interface FaithfulnessReport {
  faithfulness_score: number;
  unsupported_count: number;
  summary_of_errors: string;
  contradictions?: string[];
  misleading_simplifications?: string[];
  missing_context?: string[];
}

export interface CoverageClaim {
  source_claim: string;
  coverage: 'fully_covered' | 'partially_covered' | 'not_covered';
  explanation: string;
  mapped_infographic_claim?: string;
}

export interface CoverageReport {
  coverage_score: number;
  critical_claims: CoverageClaim[];
  missing_essentials: string[];
}

export interface FactualClaim {
  claim_text: string;
  claim_type: 'statistic' | 'finding' | 'interpretation' | 'limitation' | 'inferred';
  numbers: (string | number)[];
  source_quote?: string;
  page_or_chunk?: string;
  confidence?: number;
  verification?: ClaimVerification;
}

export interface NumericInsight {
  value: string;
  context: string;
  found_in_source?: boolean;
  context_match?: boolean;
  status?: 'valid' | 'mismatch' | 'missing';
}

export interface InfographicData {
  title: string;
  summary: string;
  researchQuestion: string;
  narrativeLayers: {
    coreIdea: NarrativeSection;
    evidence: NarrativeSection;
    mechanismAnalysis?: NarrativeSection;
    impactAnalysis: NarrativeSection;
    limitations?: NarrativeSection;
    extensions?: NarrativeSection; // Legacy/Optional
  };
  keyFindings: string; // Legacy field
  methodology: string; // Legacy field
  limitations: string; // Legacy field
  contributions: string; // Legacy field
  citations: Citation[];
  assets: InfographicAsset[];
  candidateAssets?: InfographicAsset[];
  claims?: FactualClaim[];
  faithfulnessReport?: FaithfulnessReport;
  coverageReport?: CoverageReport;
  numericInsights?: NumericInsight[];
  debug_summary: string;
  fullText?: string; // New field for RAG
}

export interface QAMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Manifest {
  metadata: {
    title: string;
    generatedAt: string;
    sourceFile?: string;
  };
  narrative: {
    summary: string;
    researchQuestion: string;
    methodology: string;
    keyFindings: string;
    limitations: string;
    contributions: string;
  };
  assets: {
    id: string;
    type: AssetType;
    page: number;
    caption: string;
    status: string;
    fileName: string;
  }[];
  citations: Citation[];
}
