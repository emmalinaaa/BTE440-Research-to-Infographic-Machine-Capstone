
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { extractTextFromPDF, getThumbnails } from './services/pdfService';
import { analyzePaper, setRateLimitListener } from './services/geminiService';
import { InfographicData, PipelineStep } from './types';
import PaperUploader from './components/PaperUploader';
import InfographicViewer from './components/InfographicViewer';
import PaperScanner from './components/PaperScanner';
import { Layers, PlayCircle, AlertCircle, Cpu, Search, Eye, BarChart3, FileCode, Key, Clock } from 'lucide-react';

const SAMPLE_DATA: InfographicData = {
  title: "Dropout: A Simple Way to Prevent Neural Networks from Overfitting",
  summary: "Dropout is a technique for addressing the problem of overfitting in large neural networks with millions of parameters. The key idea is to randomly drop units from the neural network during training, which prevents units from co-adapting too much.",
  researchQuestion: "How can we efficiently prevent co-adaptation and overfitting in deep neural networks with limited training data?",
  narrativeLayers: {
    coreIdea: { 
      type: 'claim',
      title: "The Breaking of Co-adaptation", 
      tokens: [
        { type: 'text', value: "Deep neural networks are prone to " },
        { type: 'benchmark', value: "overfitting" },
        { type: 'text', value: " because units develop complex dependencies during training. " },
        { type: 'dataset', value: "Dropout" },
        { type: 'text', value: " addresses this by making the presence of any particular hidden unit unreliable for feature extraction. This stochastic intervention forces the model to learn more robust, generalized features that perform consistently across unseen datasets." }
      ]
    },
    evidence: { 
      type: 'evidence',
      title: "Benchmarks & Error Rates", 
      tokens: [
        { type: 'dataset', value: "MNIST" },
        { type: 'text', value: ": Reduced error from " },
        { type: 'percentage', value: "1.60%" },
        { type: 'text', value: " (standard) to " },
        { type: 'percentage', value: "1.05%" },
        { type: 'text', value: " with Dropout.\n" },
        { type: 'dataset', value: "CIFAR-10" },
        { type: 'text', value: ": Improved accuracy from " },
        { type: 'percentage', value: "85.1%" },
        { type: 'text', value: " to " },
        { type: 'percentage', value: "87.4%" },
        { type: 'text', value: ".\n" },
        { type: 'dataset', value: "ImageNet" },
        { type: 'text', value: ": " },
        { type: 'benchmark', value: "Top-5 error" },
        { type: 'text', value: " reduced from " },
        { type: 'percentage', value: "17.5%" },
        { type: 'text', value: " to " },
        { type: 'percentage', value: "15.3%" },
        { type: 'text', value: ".\n" },
        { type: 'text', value: "Generalization: Performance delta of " },
        { type: 'metric', value: "+2.2%" },
        { type: 'text', value: " across vision tasks." }
      ]
    },
    mechanismAnalysis: { 
      type: 'mechanism',
      title: "Stochastic Bernoulli Masking", 
      tokens: [
        { type: 'text', value: "During training, each hidden unit is independent and retained with a fixed probability " },
        { type: 'hyperparameter_range', value: "p" },
        { type: 'text', value: " using a " },
        { type: 'rank', value: "Bernoulli distribution" },
        { type: 'text', value: ". At test time, unit weights are scaled by " },
        { type: 'hyperparameter_range', value: "p" },
        { type: 'text', value: " to ensure parity between the expected output of training and testing phases." }
      ]
    },
    impactAnalysis: {
      type: 'impact',
      title: "System-Level Impact",
      tokens: [
        { type: 'dataset', value: "Dropout" },
        { type: 'text', value: " effectively approximates model averaging across an exponential number of architectures in polynomial time. It provides a computationally efficient regularization layer that became a standard architectural component for modern deep learning systems." }
      ]
    }
  },
  keyFindings: "Dropout significantly reduces overfitting and improves performance across diverse tasks.", // Legacy
  methodology: "Randomly dropping units during training and scaling weights at test time.", // Legacy
  limitations: "Training time is increased by a factor of 2–3 compared to standard neural networks.",
  contributions: "Introduced a general-purpose regularizer that is computationally efficient and significantly improves generalization in deep learning.",
  citations: [
    { section: "Core Idea", page: 1, quote: "The key idea is to randomly drop units (along with their connections) from the neural network during training.", confidence: 0.98 },
    { section: "Mechanism", page: 3, quote: "At test time, it is not feasible to explicitly average the predictions from exponentially many thinned models. However, a very simple approximate averaging method works well in practice.", confidence: 0.95 }
  ],
  assets: [
    {
      id: "figure_dropout_1",
      assetType: "figure",
      renderingMode: "derive_explanatory",
      isSourceOfTruth: true,
      page: 1,
      caption: "Figure 1: Comparison between a standard neural net and a thinned net produced by applying dropout.",
      confidence: 1.0,
      rationale: "Central conceptual diagram of the paper.",
      reconstructionStatus: "original",
      classification: "explanatory_concept",
      selectedRole: "hero",
      pngData: "" // Placeholder for crop
    },
    {
      id: "figure_dropout_1_companion",
      assetType: "diagram",
      renderingMode: "reconstruct",
      classification: "explanatory_concept",
      isSourceOfTruth: false,
      companionAssetId: "figure_dropout_1",
      page: 1,
      caption: "Expert Explanation: Conceptual overview of unit thinning.",
      confidence: 0.9,
      reconstructionStatus: "reconstructed",
      selectedRole: "hero", // Companion to hero
      diagramSpec: {
        diagramType: "comparison",
        title: "Standard vs Dropout Network",
        nodes: [
          { id: "s1", label: "Standard Unit" },
          { id: "d1", label: "Active Unit" },
          { id: "d2", label: "Dropped Unit", type: "ghost" }
        ],
        edges: [
          { from: "s1", to: "s2" },
          { from: "d1", to: "d3" }
        ],
        caption: "A simplified view of how dropout samples sub-architectures.",
        sourcePage: 1,
        confidence: 0.9
      }
    }
  ],
  candidateAssets: [
    {
      id: "figure_dropout_1",
      assetType: "figure",
      renderingMode: "derive_explanatory",
      isSourceOfTruth: true,
      page: 1,
      caption: "Figure 1: Comparison between a standard neural net and a thinned net produced by applying dropout.",
      confidence: 1.0,
      rationale: "Central conceptual diagram of the paper.",
      reconstructionStatus: "original",
      classification: "explanatory_concept",
      pngData: ""
    }
  ],
  debug_summary: "Grounded Dropout paper sample data initialized."
};

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [currentStep, setCurrentStep] = useState<PipelineStep>('idle');
  const [stepDetail, setStepDetail] = useState<string>('');
  const [result, setResult] = useState<InfographicData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [discoveries, setDiscoveries] = useState<any[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [latestTelemetry, setLatestTelemetry] = useState<string>('');

  const handleFileSelect = async (file: File) => {
    setIsLoading(true);
    setIsRateLimited(false);
    setError(null);
    setDiscoveries([]); // Reset
    setLatestTelemetry('');
    setCurrentStep('extracting_text');
    setStepDetail('Initializing document analysis...');
    
    setRateLimitListener((active) => {
      setIsRateLimited(active);
    });

    try {
      // Get thumbnails for the scanner animation
      const thumbs = await getThumbnails(file);
      setThumbnails(thumbs);

      const pages = await extractTextFromPDF(file);
      const data = await analyzePaper(pages, file, (step, detail, payload) => {
        setCurrentStep(step);
        if (detail) setStepDetail(detail);
        if (payload) {
          if (payload.type === 'log') {
            setLatestTelemetry(prev => prev + '\n' + payload.message);
          } else {
            // Add a unique ID to each discovery entry for React keys
            const discoveryEntry = {
              ...payload,
              discoveryId: `${step}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
            };
            setDiscoveries(prev => [...prev, discoveryEntry]);
          }
        }
      });
      setResult(data);
      setLatestTelemetry(data.debug_summary || '');
      setCurrentStep('idle');
    } catch (err: any) {
      console.error("Extraction error:", err);
      const trace = err.message + (err.stack ? `\n\nStack: ${err.stack}` : '');
      setLatestTelemetry(prev => prev + `\n\nCRITICAL FAILURE:\n${trace}`);
      
      let message = err.message || 'An unexpected error occurred during analysis.';
      
      if (message.includes('process is not defined')) {
        message = "Environment configuration error: 'process' is not defined. This is a technical issue with the build environment.";
      } else if (message.includes('API_KEY') || message.includes('Gemini API Key not found')) {
        message = "Gemini API Key not found. Please ensure you have added GEMINI_API_KEY to the Settings menu (gear icon) in the top right.";
      } else if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
        message = "Rate limit exceeded. Try using a smaller paper or providing a Paid API Key for higher throughput.";
      } else if (message.includes('403') || message.includes('PERMISSION_DENIED')) {
        message = "Permission denied. Please check your API key and ensure it has access to the Gemini 3.1 series models.";
      }

      setError(message);
      setCurrentStep('error');
    } finally {
      setIsLoading(false);
      setIsRateLimited(false);
      setRateLimitListener(() => {}); // Clear listener
    }
  };

  const loadDemo = () => {
    setResult(SAMPLE_DATA);
  };

  const loadQATest = () => {
    setResult({ 
      ...SAMPLE_DATA, 
      fullText: "The Transformer is a model architecture eschewing recurrence and instead relying entirely on an attention mechanism to draw global dependencies between input and output. The Transformer allows for significantly more parallelization and can reach a new state of the art in translation quality after being trained for as little as twelve hours on eight P100 GPUs. The model achieved 28.4 BLEU on the WMT 2014 English-to-German translation task."
    });
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB]">
      <header className="py-8 px-12 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-sm z-50">
        <div className="flex items-center gap-3">
          <Layers size={22} className="text-slate-900" />
          <h1 className="text-sm font-normal tracking-widest uppercase text-slate-900">Research to Infographic Machine</h1>
        </div>
        <div className="flex gap-4 items-center">
          <nav className="hidden md:flex items-center gap-8 border-l border-slate-100 pl-8">
            <button onClick={loadQATest} className="text-[10px] font-bold tracking-widest uppercase text-slate-300 hover:text-[#E3120B] transition-colors">QA Test</button>
            <button onClick={loadDemo} className="text-[10px] font-bold tracking-widest uppercase text-slate-400 hover:text-slate-600 transition-colors">Load Demo</button>
          </nav>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto py-20 px-12">
        {!result ? (
          <div className="space-y-24">
            <section className="text-center space-y-6 max-w-3xl mx-auto">
              <h2 className="text-5xl font-extralight text-slate-900 leading-tight tracking-tight">
                Research to Infographic Machine
              </h2>
              <p className="text-lg text-slate-500 font-light leading-relaxed">
                A high-fidelity pipeline that transforms dense research papers into structured visual narratives with verified data integrity.
              </p>
            </section>

            <section className="max-w-2xl mx-auto">
              {isLoading && isRateLimited && (
                <div className="mb-6 p-4 bg-orange-50 border border-orange-100 rounded-lg flex items-center gap-3 animate-pulse">
                  <Clock className="text-orange-500" size={18} />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700">Quota Pause Active</span>
                    <span className="text-xs text-orange-600 font-light">The API is rate-limited. The pipeline is waiting for the quota to reset (exponential backoff active).</span>
                  </div>
                </div>
              )}

              {isLoading ? (
                <div className="flex flex-col items-center">
                  <PaperScanner 
                    thumbnails={thumbnails} 
                    currentStep={currentStep} 
                    detail={stepDetail} 
                    discoveries={discoveries}
                    isRateLimited={isRateLimited}
                    onShowDiagnostics={() => setShowDiagnostics(true)}
                  />
                  
                  {showDiagnostics && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm p-8 flex flex-col"
                    >
                      <div className="max-w-4xl mx-auto w-full flex flex-col h-full">
                         <div className="flex justify-between items-center mb-12 border-b-2 border-slate-900 pb-6">
                            <h2 className="text-[11px] font-bold uppercase tracking-[0.4em] text-[#E3120B]">Internal Research Log • Technical Trace</h2>
                            <button 
                              onClick={() => setShowDiagnostics(false)}
                              className="text-[10px] font-bold uppercase tracking-widest hover:text-[#E3120B]"
                            >
                               Close Trace
                            </button>
                         </div>

                         <div className="flex-1 bg-slate-900 text-slate-300 font-mono text-[11px] p-8 rounded-sm overflow-y-auto custom-scrollbar whitespace-pre shadow-2xl">
                            {latestTelemetry || "Establishing connection to document..."}
                         </div>

                         <div className="mt-8 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            <span>Grounding Engine Vol.03</span>
                            <button onClick={() => navigator.clipboard.writeText(latestTelemetry)} className="hover:text-slate-900">Copy Entire Log</button>
                         </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              ) : (
                <PaperUploader onFileSelect={handleFileSelect} isLoading={isLoading} />
              )}
              
              {error && (
                <div className="mt-8 p-6 bg-red-50/50 border border-red-100 rounded-lg text-red-600 text-sm flex flex-col gap-4 animate-in fade-in zoom-in duration-300">
                   <div className="flex items-start gap-4">
                      <AlertCircle className="shrink-0 mt-0.5 opacity-70" size={18} />
                      <div className="flex flex-col gap-1 flex-1">
                         <span className="font-bold">Process Aborted</span>
                         <span className="font-light opacity-90">{error}</span>
                         <div className="flex gap-4 mt-3">
                            <button onClick={() => setError(null)} className="text-[10px] font-bold uppercase tracking-widest hover:underline text-red-700">Clear Error</button>
                            <button onClick={() => setShowDiagnostics(!showDiagnostics)} className="text-[10px] font-bold uppercase tracking-widest hover:underline text-slate-500">
                               {showDiagnostics ? 'Hide Background Log' : 'Inspect Grounding Trace'}
                            </button>
                         </div>
                      </div>
                   </div>

                   {showDiagnostics && (
                      <div className="mt-4 p-4 bg-slate-900 text-slate-300 font-mono text-[10px] rounded-md overflow-x-auto max-h-[300px] custom-scrollbar whitespace-pre animate-in slide-in-from-top-2 duration-300">
                         <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-800 text-slate-500 italic">
                            <span>System Diagnostics Trace</span>
                            <button onClick={() => navigator.clipboard.writeText(latestTelemetry)} className="hover:text-white transition-colors">Copy to Clipboard</button>
                         </div>
                         {latestTelemetry || "No background telemetry captured before failure."}
                      </div>
                   )}
                </div>
              )}
            </section>

            <section className="pt-24 border-t border-slate-100">
              <div className="mb-16">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">The Intelligence Pipeline</h3>
                <p className="text-sm text-slate-500 font-light italic">How the agentic loop transforms raw PDF bytes into a verified infographic.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
                <Step icon={<Cpu size={20}/>} title="Ingest" desc="PDF binary is parsed into a page-indexed text stream with layout awareness." />
                <Step icon={<Search size={20}/>} title="Detect" desc="Multi-pass text scan identifies table anchors and numeric ranking patterns." />
                <Step icon={<Eye size={20}/>} title="Vision" desc="Fallback vision pass renders pages to extract data hidden from text streams." />
                <Step icon={<BarChart3 size={20}/>} title="Validate" desc="Numbers are normalized and verified against a 80% numeric-density threshold." />
                <Step icon={<FileCode size={20}/>} title="Render" desc="Narrative synthesis and SVG charting generate the final self-contained HTML." />
              </div>
            </section>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="mb-12">
              <button 
                onClick={() => setResult(null)} 
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-[#E3120B] transition-all flex items-center gap-2"
              >
                ← Back to Studio
              </button>
            </div>
            <InfographicViewer data={result} />
          </div>
        )}
      </main>

      <footer className="border-t border-slate-100 py-12 px-12 mt-20">
        <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row justify-between items-center opacity-40 text-[10px] font-bold tracking-[0.3em] uppercase text-slate-900">
          <span>Research to Infographic Machine v2.1</span>
          <span className="mt-4 md:mt-0 italic">Powered by Gemini 3 Synthesis</span>
        </div>
      </footer>
    </div>
  );
};

const Step: React.FC<{icon: React.ReactNode, title: string, desc: string}> = ({icon, title, desc}) => (
  <div className="space-y-4">
    <div className="text-slate-900 opacity-60">{icon}</div>
    <div className="space-y-1">
      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900">{title}</h4>
      <p className="text-xs text-slate-500 leading-relaxed font-light">{desc}</p>
    </div>
  </div>
);

export default App;
