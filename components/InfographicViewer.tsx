
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { InfographicData, InfographicAsset, FactualClaim, NumericInsight, FaithfulnessReport, Citation, CoverageReport } from '../types';
import { Download, Database, FileText, Image as ImageIcon, BarChart3, Share2, CheckCircle, ShieldCheck, AlertCircle } from 'lucide-react';
import { renderChartSVG } from '../services/chartService';
import { renderDiagramSVG } from '../services/reconstructionService';
import { packageInfographic } from '../services/exportService';
import RAGChat from './RAGChat';

interface Props {
  data: InfographicData;
}

const CitationTooltip: React.FC<{ citation?: Citation, index: string, isDark?: boolean }> = ({ citation, index, isDark }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  if (!citation) return <span className="text-slate-300 text-[0.7em] align-top">[{index}]</span>;

  return (
    <span 
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className={`${isDark ? 'text-red-400 border-red-400/30' : 'text-[#E3120B] border-[#E3120B]/30'} font-bold text-[0.7em] align-top cursor-help hover:border-b ml-0.5 px-0.5`}>
        [{index}]
      </span>
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.98 }}
            className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[320px] shadow-2xl rounded-sm z-[100] border overflow-hidden ${
              isDark ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'
            }`}
          >
            <div className={`p-4 ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-[#E3120B] rounded-xs">
                    <Database size={10} className="text-white" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Source Evidence</span>
                </div>
                <div className="text-[9px] font-black text-[#E3120B] bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                  REF.{index}
                </div>
              </div>
              
              <div className={`relative p-3 mb-3 border-l-2 border-[#E3120B] ${isDark ? 'bg-slate-900' : 'bg-white shadow-sm'}`}>
                <p className={`text-[12px] leading-relaxed italic font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                   "{citation.quote}"
                </p>
              </div>

              <div className="flex items-center justify-between mt-4 text-[9px] font-black uppercase tracking-widest text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <FileText size={10} />
                    P.{citation.page}
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle size={10} className="text-emerald-500" />
                    {citation.section}
                  </span>
                </div>
                <div className={`px-2 py-0.5 rounded-xs border ${
                   citation.confidence >= 0.9 ? 'border-emerald-200 text-emerald-600' : 'border-amber-200 text-amber-600'
                }`}>
                  {Math.round(citation.confidence * 100)}% TRUST
                </div>
              </div>
            </div>
            
            {/* Tooltip arrow */}
            <div className={`absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent ${isDark ? 'border-t-slate-950' : 'border-t-slate-200'}`} />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
};

const TokenRenderer: React.FC<{ tokens: any[], citations?: Citation[], onRefClick?: (id: string) => void, isDark?: boolean }> = ({ tokens, citations, onRefClick, isDark }) => {
  if (!tokens) return null;
  return (
    <>
      {tokens.map((t, i) => {
        const key = `${t.type}-${i}`;
        switch(t.type) {
          case 'metric': 
            return <span key={key} className={`${isDark ? 'text-[#FFD1D1] shadow-[0_0_10px_rgba(255,209,209,0.2)]' : 'text-[#E3120B]'} font-bold border-b ${isDark ? 'border-[#FFD1D1]/40' : 'border-red-200'}`}>{t.value}</span>;
          case 'dataset': 
            return <span key={key} className={`${isDark ? 'text-sky-300' : 'text-[#004F71]'} font-bold uppercase text-[0.9em]`}>{t.value}</span>;
          case 'benchmark': 
            return <span key={key} className={`${isDark ? 'text-white' : 'text-slate-900'} font-extrabold italic`}>{t.value}</span>;
          case 'rank': 
            return <span key={key} className={`${isDark ? 'bg-white/20 text-white ring-1 ring-white/30' : 'bg-slate-100 text-slate-800'} px-1.5 py-0.5 rounded font-bold text-[0.85em] mx-0.5 transition-colors`}>{t.value}</span>;
          case 'hyperparameter_range': 
            return <code key={key} className={`${isDark ? 'bg-white/10 text-slate-200' : 'bg-slate-50 text-slate-600'} px-1.5 py-0.5 rounded font-mono text-[0.85em]`}>{t.value}</code>;
          case 'figure_reference': 
            return (
              <button 
                key={key} 
                onClick={() => t.linkId && onRefClick?.(t.linkId)}
                className={`${isDark ? 'text-[#FFD1D1] hover:text-white' : 'text-[#E3120B]'} font-bold text-[0.7em] align-top hover:underline ml-0.5`}
              >
                [Fig {t.value}]
              </button>
            );
          case 'citation':
            const citationIndex = parseInt(t.value) - 1;
            return <CitationTooltip key={key} citation={citations?.[citationIndex]} index={t.value} isDark={isDark} />;
          case 'percentage':
            return <span key={key} className={`${isDark ? 'text-[#FFD1D1]' : 'text-[#E3120B]'} font-bold`}>{t.value}</span>;
          case 'equation_symbol':
            return <i key={key} className="font-serif">{t.value}</i>;
          default: 
            return <span key={key}>{t.value}</span>;
        }
      })}
    </>
  );
};

const EditorialAudit: React.FC<{ report: FaithfulnessReport }> = ({ report }) => {
  const hasCritiques = (report.contradictions?.length || 0) > 0 || 
                       (report.misleading_simplifications?.length || 0) > 0 || 
                       (report.missing_context?.length || 0) > 0;

  if (!hasCritiques) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 p-6 border-l-4 border-amber-500 bg-amber-50/20 rounded-r-sm shadow-sm"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-amber-500 rounded-full">
          <FileText size={16} className="text-white" />
        </div>
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 leading-none mb-1">Editorial Audit Findings</h4>
          <p className="text-[10px] text-amber-600/80 font-medium">Critical observations on source alignment and nuance</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {report.contradictions && report.contradictions.length > 0 && (
          <div className="space-y-3">
            <div className="text-[9px] font-extrabold text-red-600 uppercase flex items-center gap-2 border-b border-red-100 pb-2">
              <AlertCircle size={12} /> Contradictions
            </div>
            <ul className="space-y-2">
              {report.contradictions.map((c, i) => (
                <li key={i} className="text-[11px] text-slate-800 leading-normal flex gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.misleading_simplifications && report.misleading_simplifications.length > 0 && (
          <div className="space-y-3">
            <div className="text-[9px] font-extrabold text-amber-600 uppercase flex items-center gap-2 border-b border-amber-100 pb-2">
              <AlertCircle size={12} /> Misleading Simplifications
            </div>
            <ul className="space-y-2">
              {report.misleading_simplifications.map((s, i) => (
                <li key={i} className="text-[11px] text-slate-800 leading-normal flex gap-2">
                  <span className="text-amber-400 mt-1">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.missing_context && report.missing_context.length > 0 && (
          <div className="space-y-3">
            <div className="text-[9px] font-extrabold text-slate-500 uppercase flex items-center gap-2 border-b border-slate-200 pb-2">
              <ShieldCheck size={12} /> Missing Context Caveats
            </div>
            <ul className="space-y-2">
              {report.missing_context.map((m, i) => (
                <li key={i} className="text-[11px] text-slate-600 leading-normal italic flex gap-2">
                  <span className="text-slate-300 mt-1">•</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const ClaimsSection: React.FC<{ claims: FactualClaim[], report?: FaithfulnessReport, coverageReport?: CoverageReport }> = ({ claims, report, coverageReport }) => {
  if (!claims || claims.length === 0) return null;
  
  return (
    <div className="pt-12 border-t-2 border-slate-900/5 mt-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-[#E3120B] flex items-center justify-center rounded-sm">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-[0.4em] text-slate-900 italic">Audit Log</h3>
          </div>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest pl-11">Verified Factual Claims & Source Grounding</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-0 bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
          {report && (
            <>
              <div className="px-5 py-3 flex flex-col items-center justify-center border-r border-slate-100 min-w-[100px]">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Accuracy</span>
                <span className={`text-xl font-mono font-black ${(report.faithfulness_score * 100) > 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {(report.faithfulness_score * 100).toFixed(0)}%
                </span>
              </div>
              <div className="px-5 py-3 flex flex-col items-center justify-center border-r border-slate-100 min-w-[120px] bg-slate-50/50">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Integrity Risk</span>
                <span className={`text-[10px] font-black tracking-widest ${report.unsupported_count === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {report.unsupported_count === 0 ? 'NOMINAL' : report.unsupported_count > 2 ? 'CRITICAL' : 'ELEVATED'}
                </span>
              </div>
            </>
          )}

          {coverageReport && (
            <div className={`px-5 py-3 flex flex-col items-center justify-center min-w-[100px] border-r border-slate-100 ${coverageReport.coverage_score > 0.8 ? 'bg-emerald-50/30' : 'bg-white'}`}>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Coverage</span>
              <span className={`text-xl font-mono font-black ${coverageReport.coverage_score > 0.8 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {Math.round(coverageReport.coverage_score * 100)}%
              </span>
            </div>
          )}

          {report?.summary_of_errors && report.unsupported_count > 0 && (
             <div className="group relative px-4 py-3 bg-red-50/30">
                <AlertCircle size={16} className="text-amber-500 cursor-help hover:text-red-500 transition-colors" />
                <div className="absolute bottom-full right-0 mb-3 w-72 p-4 bg-slate-900 text-white text-[11px] leading-relaxed rounded-sm shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  <div className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-2 border-b border-white/10 pb-1">Safety Observer Note</div>
                  {report.summary_of_errors}
                  <div className="absolute top-full right-5 border-8 border-transparent border-t-slate-900" />
                </div>
             </div>
          )}
        </div>
      </div>

      {report && <EditorialAudit report={report} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
        {claims.filter(c => c.source_quote || c.verification).map((claim, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="group relative flex flex-col bg-white border border-slate-200/60 rounded-sm hover:border-[#E3120B]/30 hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-300"
          >
            {/* Status Tab */}
            {claim.verification && (
              <div className={`absolute top-0 right-8 px-3 py-1 text-[9px] font-black uppercase tracking-widest z-10 rounded-b-sm ${
                claim.verification.verdict === 'supported' ? 'bg-emerald-500 text-white' :
                claim.verification.verdict === 'partially_supported' ? 'bg-amber-500 text-white' :
                claim.verification.verdict === 'contradicted' ? 'bg-red-50 text-white' :
                'bg-slate-500 text-white'
              }`}>
                {claim.verification.verdict.replace('_', ' ')}
              </div>
            )}

            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-[#E3120B] transition-colors mb-1">
                    {claim.claim_type === 'inferred' ? 'Supported Inference' : claim.claim_type} {claim.page_or_chunk ? `• P.${claim.page_or_chunk}` : ''}
                  </span>
                  <div className={`h-0.5 w-6 transition-all group-hover:w-12 ${
                    claim.claim_type === 'inferred' ? 'bg-indigo-400 group-hover:bg-indigo-600' : 'bg-slate-100 group-hover:bg-[#E3120B]'
                  }`} />
                </div>
                
                {claim.numbers.length > 0 && (
                  <div className="flex gap-1.5">
                    {claim.numbers.map((num, ni) => (
                      <span key={ni} className="text-[10px] font-mono font-bold bg-slate-50 px-2 py-0.5 border border-slate-100 text-[#E3120B] rounded-xs shadow-sm">
                        {num}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-[14px] text-slate-800 font-bold leading-relaxed mb-6">
                {claim.claim_text}
              </p>
              
              {/* Source Grounding Box */}
              {(claim.source_quote || claim.verification?.evidence_quote) && (
                <div className="mt-auto bg-slate-50/50 border-l-2 border-[#E3120B]/20 p-4 relative group-hover:bg-red-50/30 group-hover:border-[#E3120B] transition-all">
                  <div className="absolute -left-[5px] top-4 w-2 h-2 rounded-full bg-[#E3120B] ring-4 ring-white" />
                  <p className="text-[11px] text-slate-500 italic font-medium leading-relaxed mb-4 line-clamp-4">
                    "{claim.source_quote || claim.verification?.evidence_quote}"
                  </p>
                  
                  <div className="flex justify-between items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">Explanation</span>
                      <p className="text-[10px] text-slate-600 font-bold leading-tight line-clamp-2">
                        {claim.verification?.explanation || 'Directly extracted and verified from source document metadata.'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">Confidence</span>
                      <span className="text-[11px] font-mono font-black text-slate-900 px-2 py-0.5 bg-white border border-slate-100 rounded-xs shadow-sm">
                        {((claim.confidence || claim.verification?.confidence || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const NumericInsightsSection: React.FC<{ insights: NumericInsight[] }> = ({ insights }) => {
  if (!insights || insights.length === 0) return null;
  
  return (
    <div className="pt-8 border-t border-slate-200">
      <div className="flex items-center gap-2 mb-6">
        <Database size={14} className="text-[#004F71]" />
        <h3 className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-[#004F71]">Numeric Insights Registry</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {insights.map((insight, i) => (
          <div key={i} className="flex flex-col">
            <div className="text-2xl font-bold text-[#E3120B] tabular-nums">{insight.value}</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter line-clamp-2">{insight.context}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const InfographicViewer: React.FC<Props> = ({ data }) => {

  // Enrich assets with rendered SVGs if they are reconstructed
  const enrichedAssets = data.assets.map(asset => {
    if (asset.reconstructionStatus === 'reconstructed') {
      // Prioritize rendering based on available specs, not just strict assetType
      if (asset.chartSpec) {
        return { ...asset, svgContent: renderChartSVG(asset.chartSpec) };
      }
      if (asset.diagramSpec) {
        return { ...asset, svgContent: renderDiagramSVG(asset.diagramSpec) };
      }
    }
    return asset;
  });

  const [isExporting, setIsExporting] = React.useState(false);
  const layers = data.narrativeLayers;

  const generateFinalHTML = (): string => {
    const style = `
      :root {
        --paper: #FDFCFB;
        --ink: #111827;
        --accent: #E3120B; /* Economist Red */
        --accent-muted: #FCA5A5;
        --muted: #6B7280;
        --divider: #E5E7EB;
        --font-serif: 'Georgia', serif;
        --font-sans: 'Inter', system-ui, sans-serif;
      }
      body { background-color: var(--paper); color: var(--ink); font-family: var(--font-sans); line-height: 1.6; margin: 0; padding: 60px; }
      .container { max-width: 1100px; margin: 0 auto; }
      
      header { border-top: 4px solid var(--accent); padding-top: 24px; margin-bottom: 56px; }
      h1 { font-family: var(--font-serif); font-size: 3.5rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; margin: 0 0 16px 0; }
      .dek { font-family: var(--font-serif); font-size: 1.4rem; font-weight: 400; color: #4B5563; font-style: italic; margin-bottom: 32px; line-height: 1.4; max-width: 850px; }
      
      .visual-tag { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; padding: 3px 8px; display: inline-block; margin-bottom: 12px; }
      .tag-concept { background: #004F71; color: white; }
      .tag-evidence { background: var(--accent); color: white; }

      .grid-layout { display: grid; grid-template-columns: repeat(12, 1fr); gap: 60px; }
      
      .hero-visual { grid-column: span 8; }
      .hero-claim { grid-column: span 4; }
      
      .sidebar { grid-column: span 4; border-left: 1px solid var(--divider); padding-left: 40px; }
      .main-content { grid-column: span 8; }
      
      .card { border-bottom: 2px solid var(--divider); padding-bottom: 24px; margin-bottom: 32px; }
      .card-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: var(--accent); margin-bottom: 12px; border-bottom: 1px solid var(--accent); display: inline-block; }
      .card-content { font-family: var(--font-serif); font-size: 17px; color: #1F2937; }
      
      /* Semantic Token Styles */
      .token-metric { color: var(--accent); font-weight: 700; border-bottom: 1px solid var(--accent-muted); }
      .token-dataset { color: #004F71; font-weight: 600; font-family: var(--font-sans); font-size: 0.9em; text-transform: uppercase; }
      .token-benchmark { color: #111827; font-weight: 800; font-style: italic; }
      .token-rank { background: #F3F4F6; padding: 1px 4px; border-radius: 2px; font-weight: 700; font-size: 0.9em; }
      .token-parameter { font-family: 'Courier New', monospace; color: #4B5563; background: #F9FAFB; padding: 0 2px; }
      .token-figure-ref { color: var(--accent); text-decoration: none; font-weight: 700; font-size: 0.8em; vertical-align: super; cursor: help; position: relative; }
      
      .citation-trigger { position: relative; display: inline-block; }
      .citation-tooltip {
        visibility: hidden;
        position: absolute;
        bottom: 150%;
        left: 50%;
        transform: translateX(-50%);
        width: 300px;
        background: white;
        border: 1px solid var(--divider);
        padding: 20px;
        box-shadow: 0 15px 35px rgba(0,0,0,0.15);
        z-index: 1000;
        text-align: left;
        line-height: 1.5;
        color: var(--ink);
        border-top: 3px solid var(--accent);
      }
      .citation-trigger:hover .citation-tooltip { visibility: visible; }
      .tooltip-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--divider); padding-bottom: 8px; }
      .tooltip-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.1em; }
      .tooltip-quote { font-family: var(--font-serif); font-style: italic; font-size: 13px; color: #374151; margin: 0; }
      .tooltip-meta { display: flex; justify-content: space-between; margin-top: 12px; font-size: 10px; font-weight: 700; color: var(--muted); }
      .tooltip-confidence { color: #059669; }
      
      .visual-box { border: 1px solid var(--divider); padding: 24px; background: white; margin-bottom: 32px; position: relative; }
      .visual-label { font-size: 10px; font-weight: 700; color: var(--muted); margin-bottom: 16px; text-transform: uppercase; }
      .visual-content { background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 350px; overflow: hidden; border: 1px solid #f1f5f9; }
      .asset-image { max-width: 100%; height: auto; }
      .visual-meta { margin-top: 16px; }
      .asset-caption { font-size: 13px; font-weight: 600; color: #374151; margin: 0; line-height: 1.4; }
      .provenance { font-size: 11px; color: var(--muted); font-style: italic; margin-top: 4px; }
      
      .impact-strip { grid-column: span 12; background: #111827; color: white; padding: 64px; margin: 56px -60px; }
      .impact-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.25em; color: #FCA5A5; margin-bottom: 24px; border-bottom: 1px solid #374151; padding-bottom: 8px; display: inline-block; }
      
      .number { color: var(--accent); font-weight: 700; }
      
      footer { border-top: 4px solid var(--ink); padding-top: 40px; margin-top: 80px; display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: var(--muted); }
      @media (max-width: 900px) { 
        body { padding: 30px; }
        .grid-layout { display: block; }
        .hero-visual, .hero-claim, .sidebar, .main-content { margin-bottom: 40px; }
        .sidebar { border-left: none; padding-left: 0; }
        h1 { font-size: 2.5rem; }
      }
    `;

    const heroAsset = enrichedAssets.find(a => a.selectedRole === 'hero');
    const mechanismAsset = enrichedAssets.find(a => a.selectedRole === 'mechanism');
    const evidenceAsset = enrichedAssets.find(a => a.selectedRole === 'evidence');

    const renderAsset = (asset: any, label: string) => {
      if (!asset) return '';
      const content = asset.svgContent ? asset.svgContent : (asset.pngData ? `<img src="assets/${asset.id}.png" class="asset-image" />` : '');
      const explanation = asset.interpretiveSummary || asset.caption;
      return `
        <div class="visual-box" id="${asset.id}">
          <div class="visual-label">${label} • P.${asset.page}</div>
          <div class="visual-content">${content}</div>
          <p style="font-size: 13px; color: var(--ink); font-weight: 600; margin-top: 16px; line-height: 1.4; font-family: var(--font-sans);">${explanation}</p>
          ${asset.interpretiveSummary ? `<p class="provenance" style="margin-top: 4px;">Original: ${asset.caption}</p>` : ''}
        </div>
      `;
    };

    const renderTokens = (tokens: any[]) => {
      if (!tokens) return '';
      return tokens.map(t => {
        switch(t.type) {
          case 'metric': return `<span class="token-metric">${t.value}</span>`;
          case 'dataset': return `<span class="token-dataset">${t.value}</span>`;
          case 'benchmark': return `<span class="token-benchmark">${t.value}</span>`;
          case 'rank': return `<span class="token-rank">${t.value}</span>`;
          case 'hyperparameter_range': return `<span class="token-parameter">${t.value}</span>`;
          case 'percentage': return `<span class="token-metric">${t.value}</span>`;
          case 'equation_symbol': return `<i>${t.value}</i>`;
          case 'figure_reference': return `<a href="#${t.linkId}" class="token-figure-ref">[Fig ${t.value}]</a>`;
          case 'citation': 
            const cit = data.citations?.[parseInt(t.value) - 1];
            if (!cit) return `[${t.value}]`;
            return `
              <span class="citation-trigger">
                <span class="token-figure-ref">[${t.value}]</span>
                <div class="citation-tooltip">
                  <div class="tooltip-header">
                    <span class="tooltip-label">Source Evidence</span>
                    <span class="tooltip-label" style="color:var(--accent)">REF.${t.value}</span>
                  </div>
                  <p class="tooltip-quote">"${cit.quote}"</p>
                  <div class="tooltip-meta">
                    <span>Page ${cit.page} • ${cit.section}</span>
                    <span class="tooltip-confidence">${Math.round(cit.confidence * 100)}% Verified</span>
                  </div>
                </div>
              </span>
            `;
          default: return t.value;
        }
      }).join('');
    };

    const renderBlock = (layer: any, title?: string) => {
      if (!layer || !layer.tokens) return '';
      const displayTitle = title || layer.title;
      return `
        <div class="card">
          <div class="card-label">${displayTitle}</div>
          <div class="card-content">${renderTokens(layer.tokens)}</div>
        </div>
      `;
    };

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${data.title} | Briefing</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
        <style>${style}</style>
      </head>
      <body>
        <div class="container">
          <header>
            <div class="chip chip-accent">Strategic Research Briefing</div>
            <h1>${data.title}</h1>
            <div class="dek">${data.summary}</div>
          </header>

          <main class="grid-layout">
            <div class="hero-visual">
              ${renderAsset(heroAsset, "Primary Visual Anchor")}
            </div>
            <div class="hero-claim">
              ${renderBlock(layers.coreIdea)}
              ${renderBlock(layers.evidence, "Key Evidence")}
            </div>

            <div class="main-content">
              ${renderBlock(layers.mechanismAnalysis)}
              ${renderAsset(mechanismAsset, "Mechanism Explained")}
              ${renderAsset(evidenceAsset, "Empirical Data Evidence")}
            </div>

            <div class="sidebar">
              ${renderBlock(layers.limitations, "Scope & Constraints")}
              <div class="card">
                <div class="card-label">Grounding Integrity</div>
                <div style="font-size: 32px; font-weight: 300;">${Math.round(data.assets[0]?.confidence * 100 || 0)}%</div>
                <p style="font-size: 12px; color: var(--muted);">Confidence score based on vision-gated verification of source figures.</p>
              </div>
            </div>

            <div class="impact-strip">
              <div class="impact-label">Systemic Impact</div>
              <div style="font-size: 32px; font-weight: 300; line-height: 1.2;">
                ${renderTokens(layers.impactAnalysis?.tokens || [])}
              </div>
            </div>
          </main>

          <footer>
            <span>${data.researchQuestion}</span>
            <span style="color: var(--accent);">Grounding-Engine Verified • 2026</span>
          </footer>
        </div>
      </body>
      </html>
    `;
  };

  const generateStandaloneHTML = (): string => {
    const style = `
      :root {
        --paper: #FDFCFB;
        --ink: #111827;
        --accent: #E3120B;
        --accent-muted: #FCA5A5;
        --muted: #6B7280;
        --divider: #E5E7EB;
        --font-serif: 'Georgia', serif;
        --font-sans: 'Inter', system-ui, sans-serif;
      }
      body { background-color: var(--paper); color: var(--ink); font-family: var(--font-sans); line-height: 1.6; margin: 0; padding: 60px; }
      .container { max-width: 1100px; margin: 0 auto; }
      
      header { border-top: 4px solid var(--accent); padding-top: 24px; margin-bottom: 56px; }
      h1 { font-family: var(--font-serif); font-size: 3.5rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; margin: 0 0 16px 0; }
      .dek { font-family: var(--font-serif); font-size: 1.4rem; font-weight: 400; color: #4B5563; font-style: italic; margin-bottom: 32px; line-height: 1.4; max-width: 850px; }

      .visual-tag { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; padding: 3px 8px; display: inline-block; margin-bottom: 12px; }
      .tag-concept { background: #004F71; color: white; }
      .tag-evidence { background: var(--accent); color: white; }

      .grid-layout { display: grid; grid-template-columns: repeat(12, 1fr); gap: 60px; }
      
      .hero-visual { grid-column: span 8; }
      .hero-claim { grid-column: span 4; }
      
      .sidebar { grid-column: span 4; border-left: 1px solid var(--divider); padding-left: 40px; }
      .main-content { grid-column: span 8; }
      
      .card { border-bottom: 2px solid var(--divider); padding-bottom: 24px; margin-bottom: 32px; }
      .card-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: var(--accent); margin-bottom: 12px; border-bottom: 1px solid var(--accent); display: inline-block; }
      .card-content { font-family: var(--font-serif); font-size: 17px; color: #1F2937; }
      
      /* Semantic Token Styles */
      .token-metric { color: var(--accent); font-weight: 700; border-bottom: 1px solid var(--accent-muted); }
      .token-dataset { color: #004F71; font-weight: 600; font-family: var(--font-sans); font-size: 0.9em; text-transform: uppercase; }
      .token-benchmark { color: #111827; font-weight: 800; font-style: italic; }
      .token-rank { background: #F3F4F6; padding: 1px 4px; border-radius: 2px; font-weight: 700; font-size: 0.9em; }
      .token-parameter { font-family: 'Courier New', monospace; color: #4B5563; background: #F9FAFB; padding: 0 2px; }
      .token-figure-ref { color: var(--accent); text-decoration: none; font-weight: 700; font-size: 0.8em; vertical-align: super; cursor: help; position: relative; }
      
      .citation-trigger { position: relative; display: inline-block; }
      .citation-tooltip {
        visibility: hidden;
        position: absolute;
        bottom: 150%;
        left: 50%;
        transform: translateX(-50%);
        width: 300px;
        background: white;
        border: 1px solid var(--divider);
        padding: 20px;
        box-shadow: 0 15px 35px rgba(0,0,0,0.15);
        z-index: 1000;
        text-align: left;
        line-height: 1.5;
        color: var(--ink);
        border-top: 3px solid var(--accent);
      }
      .citation-trigger:hover .citation-tooltip { visibility: visible; }
      .tooltip-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--divider); padding-bottom: 8px; }
      .tooltip-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.1em; }
      .tooltip-quote { font-family: var(--font-serif); font-style: italic; font-size: 13px; color: #374151; margin: 0; }
      .tooltip-meta { display: flex; justify-content: space-between; margin-top: 12px; font-size: 10px; font-weight: 700; color: var(--muted); }
      .tooltip-confidence { color: #059669; }
      
      .visual-box { border: 1px solid var(--divider); padding: 24px; background: white; margin-bottom: 32px; }
      .visual-label { font-size: 10px; font-weight: 700; color: var(--muted); margin-bottom: 16px; text-transform: uppercase; }
      .visual-content { background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 350px; padding: 24px; border: 1px solid #f1f5f9; }
      .asset-image { max-width: 100%; height: auto; }
      .visual-meta { margin-top: 16px; }
      .asset-caption { font-size: 13px; font-weight: 600; color: #374151; margin: 0; line-height: 1.4; }
      .provenance { font-size: 11px; color: var(--muted); font-style: italic; margin-top: 4px; }
      
      .impact-strip { grid-column: span 12; background: #111827; color: white; padding: 64px; margin: 56px -60px; }
      
      .number { color: var(--accent); font-weight: 700; }
      
      footer { border-top: 4px solid var(--ink); padding-top: 40px; margin-top: 80px; display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: var(--muted); }
      @media (max-width: 900px) { .grid-layout { display: block; } .hero-visual, .hero-claim, .sidebar, .main-content { margin-bottom: 40px; } }
    `;

    const heroAsset = enrichedAssets.find(a => a.selectedRole === 'hero');
    const mechanismAsset = enrichedAssets.find(a => a.selectedRole === 'mechanism');
    const evidenceAsset = enrichedAssets.find(a => a.selectedRole === 'evidence');

const renderAsset = (asset: any, label: string) => {
      if (!asset) return '';
      const content = asset.svgContent ? asset.svgContent : (asset.pngData ? `<img src="data:image/png;base64,${asset.pngData}" class="asset-image" />` : '');
      const classificationLabel = asset.classification === 'explanatory_concept' ? 'CONCEPTUAL MODEL' : 'DATA EVIDENCE';
      const explanation = asset.interpretiveSummary || asset.caption;
      
      return `
        <div class="visual-box" id="${asset.id}">
          <div class="visual-tag ${asset.classification === 'explanatory_concept' ? 'tag-concept' : 'tag-evidence'}">${classificationLabel}</div>
          <div class="visual-label">${label} • P.${asset.page}</div>
          <div class="visual-content">${content}</div>
          <div class="visual-meta">
            <p class="asset-caption">${explanation}</p>
            ${asset.interpretiveSummary ? `<div class="provenance" style="margin-bottom: 8px;">Source Title: ${asset.caption}</div>` : ''}
            ${asset.provenance ? `<div class="provenance">Mapped from P.${asset.provenance.pageNumber} (${Math.round(asset.provenance.confidence * 100)}% verified sync)</div>` : ''}
          </div>
        </div>
      `;
    };

    const renderTokens = (tokens: any[]) => {
      if (!tokens) return '';
      return tokens.map(t => {
        switch(t.type) {
          case 'metric': return `<span class="token-metric">${t.value}</span>`;
          case 'dataset': return `<span class="token-dataset">${t.value}</span>`;
          case 'benchmark': return `<span class="token-benchmark">${t.value}</span>`;
          case 'rank': return `<span class="token-rank">${t.value}</span>`;
          case 'hyperparameter_range': return `<span class="token-parameter">${t.value}</span>`;
          case 'percentage': return `<span class="token-metric">${t.value}</span>`;
          case 'equation_symbol': return `<i>${t.value}</i>`;
          case 'figure_reference': return `<a href="#${t.linkId}" class="token-figure-ref">[Fig ${t.value}]</a>`;
          case 'citation': 
            const cit = data.citations?.[parseInt(t.value) - 1];
            if (!cit) return `[${t.value}]`;
            return `
              <span class="citation-trigger">
                <span class="token-figure-ref">[${t.value}]</span>
                <div class="citation-tooltip">
                  <div class="tooltip-header">
                    <span class="tooltip-label">Source Grounding</span>
                    <span class="tooltip-label" style="color:var(--accent)">REF.${t.value}</span>
                  </div>
                  <p class="tooltip-quote">"${cit.quote}"</p>
                  <div class="tooltip-meta">
                    <span>Page ${cit.page} • ${cit.section}</span>
                    <span class="tooltip-confidence">${Math.round(cit.confidence * 100)}% Verified</span>
                  </div>
                </div>
              </span>
            `;
          default: return t.value;
        }
      }).join('');
    };

    const renderBlock = (layer: any, title?: string) => {
      if (!layer || !layer.tokens) return '';
      const displayTitle = title || layer.title;
      return `
        <div class="card">
          <div class="card-label">${displayTitle}</div>
          <div class="card-content">${renderTokens(layer.tokens)}</div>
        </div>
      `;
    };

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${data.title} | Infographic</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
        <style>${style}</style>
      </head>
      <body>
        <div class="container">
          <header>
            <div class="chip" style="background: var(--accent); color: white; display: inline-block; padding: 4px 8px; font-size: 10px; font-weight: 800; margin-bottom: 20px;">DEEP REVIEW</div>
            <h1>${data.title}</h1>
            <p class="dek">${data.summary}</p>
          </header>

          <main class="grid-layout">
            <div class="hero-visual">
              ${renderAsset(heroAsset, "Primary Visual")}
            </div>
            <div class="hero-claim">
              ${renderBlock(layers.coreIdea)}
              ${renderBlock(layers.evidence, "Evidence")}
            </div>

            <div class="main-content">
              ${renderBlock(layers.mechanismAnalysis)}
              ${renderAsset(mechanismAsset, "Mechanism Logic")}
              ${renderAsset(evidenceAsset, "Empirical Evidence")}
            </div>

            <div class="sidebar">
              ${renderBlock(layers.limitations, "Limitations")}
              <div class="card">
                <div class="card-label">Verification</div>
                <div style="font-size: 32px; font-weight: 300;">${Math.round(data.assets[0]?.confidence * 100 || 0)}%</div>
                <p style="font-size: 11px; color: var(--muted);">Vision-gated grounding confidence score.</p>
              </div>
            </div>

            <div class="impact-strip">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3em; color: var(--accent-muted); margin-bottom: 24px;">Global Impact</div>
              <div style="font-size: 32px; font-weight: 300; line-height: 1.2;">
                ${renderTokens(layers.impactAnalysis?.tokens || [])}
              </div>
            </div>
          </main>

          <footer>
            <span>${data.researchQuestion}</span>
            <span style="color: var(--accent);">Grounding Engine Active</span>
          </footer>
        </div>
      </body>
      </html>
    `;
  };

  const handleDownloadHTML = () => {
    const html = generateStandaloneHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `synthesis_${data.title.replace(/\s+/g, '_').toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPackage = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const html = generateFinalHTML();
      const exportData = { ...data, assets: enrichedAssets };
      const zipBlob = await packageInfographic(exportData, html);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
      a.download = `publication_${safeTitle}.zip`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      // Increased delay to ensure browser handles the download before cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsExporting(false);
      }, 5000);
    } catch (err) {
      console.error("ZIP Export failed", err);
      setIsExporting(false);
    }
  };

  // Explicit role-based selection
  const heroAsset = enrichedAssets.find(a => a.selectedRole === 'hero');
  const mechanismAsset = enrichedAssets.find(a => a.selectedRole === 'mechanism');
  const evidenceAsset = enrichedAssets.find(a => a.selectedRole === 'evidence');

  const scrollToAsset = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="space-y-16">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Infographic Engine</h2>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleDownloadHTML}
            className="flex items-center gap-2 px-6 py-2 bg-white border border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-slate-50 hover:text-[#E3120B] transition-all"
          >
            <FileText size={14} />
            HTML Edition
          </button>
          <button 
            disabled={isExporting}
            onClick={handleExportPackage}
            className={`flex items-center gap-2 px-6 py-2 bg-[#E3120B] text-white text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-[#991B1B] transition-all shadow-lg shadow-red-100 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
             {isExporting ? (
              <>
                <Database className="animate-spin" size={14} />
                Packaging...
              </>
            ) : (
              <>
                <Share2 size={14} />
                Export Package (.zip)
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-[#FDFCFB] border border-slate-100 p-24 rounded-sm shadow-sm max-w-[1200px] mx-auto overflow-hidden text-[#1B1B1B]">
        <header className="mb-12 pb-12 border-b-2 border-[#1B1B1B]">
          <div className="inline-block px-3 py-1 bg-[#E3120B] text-white text-[9px] font-extrabold uppercase tracking-widest rounded-sm mb-6">Deep Review Briefing</div>
          <h1 className="text-6xl font-extrabold tracking-tight leading-[0.95] mb-8 max-w-[900px]">
            {data.title}
          </h1>
          <p className="text-xl text-slate-500 font-light leading-relaxed max-w-[800px]">
             {data.summary}
          </p>
          <div className="flex gap-4 mt-8">
            <div className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded-sm">Confidence: {Math.round(data.assets[0]?.confidence * 100 || 0)}%</div>
            <div className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded-sm">Domain: Research</div>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-16">
          {/* Hero Row: Primary Visual + Core Claim */}
          <div className="col-span-8">
            {heroAsset && (
              <div id={heroAsset.id} className="border border-slate-200 bg-white p-6 mb-8 group hover:border-[#FCA5A5] transition-colors">
                <div className="inline-block px-2 py-1 bg-[#1B1B1B] text-white text-[8px] font-bold uppercase tracking-widest mb-4">Primary Visual Anchor • P.{heroAsset.page}</div>
                <div className="bg-slate-50 flex justify-center p-4 min-h-[300px] items-center">
                  {heroAsset.pngData ? <img src={`data:image/png;base64,${heroAsset.pngData}`} className="max-h-[500px]" /> : heroAsset.svgContent ? <div dangerouslySetInnerHTML={{ __html: heroAsset.svgContent }} /> : null}
                </div>
                <p className="mt-4 text-sm font-bold text-slate-800 leading-relaxed">{heroAsset.interpretiveSummary || heroAsset.caption}</p>
                {heroAsset.interpretiveSummary && <p className="mt-1 text-[10px] italic text-slate-400">Fig Title: {heroAsset.caption}</p>}
              </div>
            )}
          </div>

          <div className="col-span-4 flex flex-col justify-start space-y-8">
             {layers.coreIdea && (
               <div className="pt-4 border-t-2 border-[#E3120B]">
                  <h3 className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-[#E3120B] mb-4">{layers.coreIdea.title}</h3>
                  <div className="text-3xl font-light leading-tight tracking-tight">
                      <TokenRenderer tokens={layers.coreIdea.tokens} citations={data.citations} onRefClick={scrollToAsset} />
                  </div>
               </div>
             )}
             
             {layers.evidence && (
                <div className="pt-8 border-t border-slate-200">
                    <h3 className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-[#E3120B] mb-4">Evidence & Results</h3>
                    <div className="text-sm font-medium leading-relaxed whitespace-pre-line text-slate-700">
                        <TokenRenderer tokens={layers.evidence.tokens} citations={data.citations} onRefClick={scrollToAsset} />
                    </div>
                </div>
             )}
          </div>

          {/* Main Mechanism Section */}
          <div className="col-span-8 space-y-12">
            <div className="pt-8 border-t border-slate-200">
                <h3 className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-[#E3120B] mb-4">{layers.mechanismAnalysis?.title || 'Key Mechanism'}</h3>
                <div className="text-lg font-light leading-relaxed text-slate-800">
                    <TokenRenderer tokens={layers.mechanismAnalysis?.tokens || []} citations={data.citations} onRefClick={scrollToAsset} />
                </div>
            </div>

            {mechanismAsset && (
              <div id={mechanismAsset.id} className="p-8 bg-slate-50 border border-slate-200">
                <div className="flex justify-between items-start mb-4">
                  <div className="inline-block px-2 py-1 bg-[#004F71] text-white text-[8px] font-bold uppercase tracking-widest">Mechanism Explanation Visual</div>
                  <div className="text-[9px] font-bold text-[#004F71] underline uppercase tracking-tighter">P.{mechanismAsset.page} source reference</div>
                </div>
                <div className="bg-white p-6 shadow-sm flex justify-center">
                  {mechanismAsset.svgContent ? (
                    <div dangerouslySetInnerHTML={{ __html: mechanismAsset.svgContent }} className="w-full max-w-2xl" />
                  ) : mechanismAsset.pngData ? (
                    <img src={`data:image/png;base64,${mechanismAsset.pngData}`} className="max-h-96" />
                  ) : null}
                </div>
                <p className="mt-4 text-sm font-bold text-slate-800 leading-relaxed">{mechanismAsset.interpretiveSummary || mechanismAsset.caption}</p>
                {mechanismAsset.interpretiveSummary && <p className="mt-1 text-[10px] italic text-slate-400">Fig Title: {mechanismAsset.caption}</p>}
              </div>
            )}

            {evidenceAsset && (
               <div id={evidenceAsset.id} className="p-8 border border-slate-200">
                  <div className="inline-block px-2 py-1 bg-[#E3120B] text-white text-[8px] font-bold uppercase tracking-widest mb-4">Empirical Context • P.{evidenceAsset.page}</div>
                  <div className="bg-slate-50 p-6 flex justify-center">
                    {evidenceAsset.pngData ? <img src={`data:image/png;base64,${evidenceAsset.pngData}`} className="max-h-96" /> : evidenceAsset.svgContent ? <div dangerouslySetInnerHTML={{ __html: evidenceAsset.svgContent }} /> : null}
                  </div>
                  <p className="mt-4 text-sm font-bold text-slate-800 leading-relaxed">{evidenceAsset.interpretiveSummary || evidenceAsset.caption}</p>
                  {evidenceAsset.interpretiveSummary && <p className="mt-1 text-[10px] italic text-slate-400">Fig Title: {evidenceAsset.caption}</p>}
               </div>
            )}

            {layers.impactAnalysis && (
              <div className="bg-[#1B1B1B] text-white p-12 -mx-24 px-24">
                  <h3 className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-[#FCA5A5] mb-6">Systemic Impact</h3>
                  <div className="text-3xl font-light leading-snug tracking-tight">
                      <TokenRenderer tokens={layers.impactAnalysis.tokens} citations={data.citations} onRefClick={scrollToAsset} isDark={true} />
                  </div>
              </div>
            )}

            {data.claims && <ClaimsSection claims={data.claims} report={data.faithfulnessReport} coverageReport={data.coverageReport} />}
            {data.numericInsights && <NumericInsightsSection insights={data.numericInsights} />}
          </div>

          {/* Sidebar for remaining layers */}
          <div className="col-span-4 border-l border-slate-200 pl-12 space-y-12">
            {layers.limitations && (
                <div className="pt-4">
                    <h3 className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-[#E3120B] mb-4">Constraints & Limitations</h3>
                    <div className="text-sm leading-relaxed text-slate-600">
                        <TokenRenderer tokens={layers.limitations.tokens} citations={data.citations} onRefClick={scrollToAsset} />
                    </div>
                </div>
            )}
            
            <div className="pt-8 border-t border-slate-200">
                <h3 className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-[#E3120B] mb-4">Verification</h3>
                <div className="space-y-4">
                   <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                     <span className="text-[10px] text-slate-400 font-bold uppercase">Source Figures</span>
                     <span className="text-2xl font-light">{data.assets.filter(a => a.isSourceOfTruth).length}</span>
                   </div>
                   <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                     <span className="text-[10px] text-slate-400 font-bold uppercase">Citations</span>
                     <span className="text-2xl font-light">{data.citations?.length || 0}</span>
                   </div>
                </div>
            </div>
          </div>
        </div>

        <footer className="mt-24 pt-12 border-t-4 border-[#1B1B1B] flex justify-between text-[11px] font-extrabold uppercase tracking-[0.15em] text-slate-500">
          <span>{data.researchQuestion}</span>
          <span className="text-[#E3120B]">Grounding-Engine Verified • 20 Apr 2026</span>
        </footer>

        {data.fullText && <RAGChat fullText={data.fullText} />}
      </div>
    </div>
  );
};

const DetailSection: React.FC<{title: string, content: string, citations: any[]}> = ({title, content, citations}) => (
  <div className="space-y-4">
    <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">{title}</h3>
    <div className="text-sm text-slate-700 font-light leading-relaxed">
      {content}
      {citations.map((c, i) => (
          <span key={i} title={c.quote} className="ml-2 cursor-help text-[8px] font-bold px-1.5 py-0.5 bg-slate-50 text-slate-400 border border-slate-100 rounded">P.{c.page}</span>
      ))}
    </div>
  </div>
);

export default InfographicViewer;
