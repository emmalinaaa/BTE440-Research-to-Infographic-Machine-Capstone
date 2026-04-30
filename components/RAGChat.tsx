import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { QAMessage } from '../types';
import { askQuestion } from '../services/ragService';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

interface RAGChatProps {
  fullText: string;
}

const RAGChat: React.FC<RAGChatProps> = ({ fullText }) => {
  const [messages, setMessages] = useState<QAMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg: QAMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const answer = await askQuestion(fullText, messages, userMsg.content);
      const assistantMsg: QAMessage = {
        role: 'assistant',
        content: answer,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('RAG Error:', err);
      let errorMessage = "Sorry, I encountered an error while analyzing the paper.";
      
      if (err.message?.includes('API Key not found')) {
        errorMessage = "Identity Verification Error: Gemini API Key is missing. Please provide it in the Settings menu.";
      } else if (err.status === 429 || err.message?.includes('quota') || err.message?.includes('429')) {
        errorMessage = "Capacity Exhausted: I'm receiving too many requests. Please wait a moment before asking another question.";
      } else if (err.message?.includes('PERMISSION_DENIED')) {
        errorMessage = "Access Denied: Your API key does not have permission to use the required language model.";
      } else if (err.message) {
        errorMessage = `Analysis Error: ${err.message.substring(0, 100)}`;
      }

      const errorMsg: QAMessage = {
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="mt-24 border-t border-slate-100 pt-16 max-w-3xl mx-auto px-6">
      <div className="mb-8">
        <h3 className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-[#E3120B] mb-2">Researcher Assistant</h3>
        <p className="text-sm text-slate-500 font-light">Ask any technical questions about the original research paper.</p>
      </div>

      <div className="bg-slate-50/50 border border-slate-100 rounded-2xl overflow-hidden flex flex-col h-[500px]">
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
              <Bot size={32} className="mb-4 text-slate-400" />
              <p className="text-xs font-medium uppercase tracking-widest">Waiting for your query...</p>
            </div>
          )}
          
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  m.role === 'user' ? 'bg-[#E3120B] text-white' : 'bg-white border border-slate-200 text-slate-600 shadow-sm'
                }`}>
                  {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  m.role === 'user' 
                    ? 'bg-[#E3120B] text-white rounded-tr-none' 
                    : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                }`}>
                  <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:text-white prose-code:text-[#E3120B] prose-code:bg-slate-50 prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                    <Markdown
                      components={{
                        // @ts-ignore
                        p: ({ children }) => <p className={`mb-3 last:mb-0 ${m.role === 'user' ? 'text-white' : 'text-slate-700'}`}>{children}</p>,
                        // @ts-ignore
                        ul: ({ children }) => <ul className={`list-disc ml-4 mb-3 ${m.role === 'user' ? 'text-white' : 'text-slate-600'}`}>{children}</ul>,
                        // @ts-ignore
                        ol: ({ children }) => <ol className={`list-decimal ml-4 mb-3 ${m.role === 'user' ? 'text-white' : 'text-slate-600'}`}>{children}</ol>,
                        // @ts-ignore
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        // @ts-ignore
                        strong: ({ children }) => <strong className={`font-bold ${m.role === 'user' ? 'text-white' : 'text-slate-900'}`}>{children}</strong>,
                        // @ts-ignore
                        code: ({ children }) => <code className={`${m.role === 'user' ? 'bg-white/20 text-white' : 'bg-slate-50 text-[#E3120B]'} px-1 rounded font-mono text-[0.8em]`}>{children}</code>
                      }}
                    >
                      {m.content}
                    </Markdown>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isTyping && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-4"
            >
              <div className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center shadow-sm">
                <Loader2 size={14} className="animate-spin" />
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-bounce"></span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-slate-100 flex gap-2">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about methodology, constraints, or datasets..."
            className="flex-1 bg-slate-50 px-4 py-2 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-[#E3120B] transition-all"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isTyping}
            className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-[#E3120B] disabled:bg-slate-200 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default RAGChat;
