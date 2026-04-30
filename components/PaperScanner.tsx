
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  thumbnails: string[];
  currentStep: string;
  detail: string;
  discoveries?: any[];
  isRateLimited?: boolean;
  onShowDiagnostics?: () => void;
}

const PaperScanner: React.FC<Props> = ({ 
  thumbnails, 
  currentStep, 
  detail, 
  discoveries = [], 
  isRateLimited = false,
  onShowDiagnostics
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Cycle through pages
  useEffect(() => {
    if (thumbnails.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % thumbnails.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [thumbnails]);

  // Auto-scroll discovery feed
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [discoveries]);

  const getStepTitle = () => {
    switch (currentStep) {
      case 'extracting_text': return "Paper Review";
      case 'synthesizing_narrative': return "Story Drafting";
      case 'scanning_figures': return "Visual Discovery";
      case 'reconstructing_assets': return "Graphic Production";
      case 'extracting_claims': return "Factual Verification";
      case 'verifying_claims': return "Source Grounding";
      case 'auditing_faithfulness': return "Faithfulness Audit";
      case 'refining_narrative': return "Self-Correction Pass";
      case 'extracting_numeric_insights': return "Numeric Extraction";
      default: return "Finalizing";
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-12 px-4 select-none">
      <div className="flex flex-col lg:flex-row gap-20 items-center lg:items-start justify-center">
        
        {/* Visual Focus: The Scanning Page */}
        <div className="relative shrink-0">
          <div className="relative w-[280px] h-[360px] bg-white border border-slate-200 shadow-[0_15px_40px_rgba(0,0,0,0.03)] overflow-hidden z-10">
            {thumbnails[currentIndex] ? (
              <motion.img 
                key={currentIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.45 }}
                src={thumbnails[currentIndex]} 
                alt="Reviewing page" 
                className="w-full h-full object-cover grayscale brightness-110"
              />
            ) : (
              <div className="w-full h-full bg-slate-50 flex items-center justify-center">
                <span className="text-slate-200 font-serif italic">Reviewing...</span>
              </div>
            )}

            {/* Precision Scanning Line */}
            <motion.div
              animate={{ top: ['0%', '100%'] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 h-[1px] bg-[#E3120B] z-30 opacity-40"
            />
          </div>

          <div className="mt-8 flex flex-col items-center gap-1.5 opacity-40">
             <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-500">Document Focal Point</span>
             <span className="text-[11px] font-mono tracking-tight text-slate-900 italic">Folio {currentIndex + 1} / {thumbnails.length}</span>
          </div>
        </div>

        {/* Informational Core: The Synthesis Log */}
        <div className="flex-1 w-full max-w-lg space-y-12">
          <header className="space-y-6">
             <div className="space-y-2 border-l-2 border-[#E3120B] pl-6">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.4em] text-[#E3120B]">
                   Current Action: {getStepTitle()}
                </h2>
                <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                   <span>Archive Vol 01 / Issue 01</span>
                </div>
             </div>
             
             <div className="min-h-[48px] pl-6">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={detail}
                    initial={{ opacity: 0, x: 2 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-[15px] text-slate-900 font-light leading-relaxed tracking-tight"
                  >
                    {detail || "Initiating correspondence with source document..."}
                  </motion.p>
                </AnimatePresence>
             </div>
          </header>

          <section className="space-y-6">
             <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.4em] text-slate-400">Research Log</h3>
                <div className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter italic">
                   {discoveries.length} Points Tracked
                </div>
             </div>

             <div 
               ref={scrollRef}
               className="h-[280px] overflow-y-auto pr-6 space-y-5 custom-scrollbar"
               style={{ maskImage: 'linear-gradient(to bottom, black 90%, transparent)' }}
             >
                <AnimatePresence initial={false}>
                  {discoveries.map((disc, i) => (
                    <motion.div
                      key={disc.discoveryId || (disc.asset?.id ? `${disc.asset.id}-${i}` : `disc-${i}`)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group flex flex-col gap-2 transition-opacity hover:opacity-100 opacity-90"
                    >
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-bold uppercase tracking-widest text-slate-900 underline decoration-slate-200 underline-offset-4">
                            {disc.role || disc.asset?.assetType || 'Record'}
                         </span>
                         <span className="text-[10px] text-slate-300">P.{disc.asset?.page || '01'}</span>
                      </div>
                      <p className="text-[12px] leading-relaxed text-slate-600 font-light">
                         {disc.asset?.caption || "Fragment identified; awaiting verification..."}
                      </p>
                      {disc.status === 'complete' && (
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-50">
                           <span className="text-green-600">✓</span>
                           <span className="text-[9px] font-bold text-green-600 uppercase tracking-[0.2em]">Verified</span>
                        </div>
                      )}
                    </motion.div>
                  )).reverse()}
                  
                  {discoveries.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 py-16">
                       <span className="text-[11px] font-bold uppercase tracking-[0.4em] italic">Awaiting signals</span>
                    </div>
                  )}
                </AnimatePresence>
             </div>
          </section>

          {/* Minimalist Progress Meter */}
          <footer className="pt-6 border-t border-slate-100 space-y-4">
             {isRateLimited && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 p-3 rounded text-[10px] font-bold text-[#E3120B] uppercase tracking-widest flex items-center justify-between"
                >
                   <span>API Rate Limit Protection Active</span>
                   <span className="animate-pulse">Backing Off...</span>
                </motion.div>
             )}
             <div className="flex justify-between items-end">
                <div className="flex flex-col gap-1">
                   <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400">Production progress</span>
                   <button 
                     onClick={onShowDiagnostics}
                     className="text-[9px] font-extrabold text-[#E3120B] uppercase tracking-tighter hover:underline"
                   >
                      Inspect Research Log
                   </button>
                </div>
                <span className="text-[11px] font-mono text-slate-900 font-bold">
                   {Math.min(99, Math.round((discoveries.length * 3) + 20))}%
                </span>
             </div>
             <div className="h-[1px] bg-slate-100 w-full overflow-hidden shrink-0">
                <motion.div 
                   className="h-full bg-[#E3120B]"
                   animate={{ 
                      width: currentStep === 'extracting_text' ? '15%' : 
                             currentStep === 'synthesizing_narrative' ? '40%' : 
                             currentStep === 'scanning_figures' ? '60%' : 
                             currentStep === 'reconstructing_assets' ? '75%' : 
                             currentStep === 'extracting_claims' ? '85%' : 
                             currentStep === 'verifying_claims' ? '90%' :
                             currentStep === 'auditing_faithfulness' ? '92%' :
                             currentStep === 'refining_narrative' ? '96%' :
                             currentStep === 'extracting_numeric_insights' ? '98%' : '98%'
                   }}
                   transition={{ duration: 1.5, ease: "easeOut" }}
                />
             </div>
          </footer>
        </div>

      </div>
    </div>
  );
};

const StatusMetric: React.FC<{label: string, value: any}> = ({label, value}) => (
  <div className="text-center">
     <div className="text-xl font-light text-slate-900">{value}</div>
     <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
  </div>
);

export default PaperScanner;
