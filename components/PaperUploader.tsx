
/* eslint-disable @typescript-eslint/naming-convention */
import React, { useState, useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';

interface Props {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

const PaperUploader: React.FC<Props> = ({ onFileSelect, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) onFileSelect(e.dataTransfer.files[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) onFileSelect(e.target.files[0]);
  };

  return (
    <div 
      className={`group relative p-20 border border-slate-200 rounded-3xl transition-all duration-500 bg-white hover:bg-[#F9FAFB] cursor-pointer
        ${dragActive ? 'border-red-400 bg-red-50/30' : ''}
        ${isLoading ? 'opacity-70 pointer-events-none' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => !isLoading && inputRef.current?.click()}
    >
      <input 
        ref={inputRef}
        type="file" 
        className="hidden" 
        accept=".pdf" 
        onChange={handleChange}
      />
      
      <div className="flex flex-col items-center justify-center space-y-6 text-center">
        {isLoading ? (
          <div className="space-y-4">
            <Loader2 className="w-10 h-10 text-[#E3120B] animate-spin mx-auto opacity-70" />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E3120B]">Processing Paper...</p>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-red-50 transition-colors duration-500">
              <Upload className="w-5 h-5 text-slate-400 group-hover:text-[#E3120B]" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-900 tracking-tight">Select or drop PDF</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Single Academic Publication</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaperUploader;
