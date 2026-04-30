import { GoogleGenAI } from "@google/genai";
import { QAMessage } from "../types";

// --- Types ---
interface CachedPaper {
    text: string;
    chunks: { text: string; embedding: number[] }[];
}

// --- Internal State ---
let currentPaperCache: CachedPaper | null = null;

function getAI() {
  const apiKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || 
                 (import.meta as any).env?.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("RAG ERROR: No API Key found in environment.");
    throw new Error("Gemini API Key not found. Please check your environment variables.");
  }

  return new GoogleGenAI({ apiKey });
}

/**
 * Split text into semantic/size-based chunks with overlap
 */
function chunkText(text: string, size: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + size, text.length);
        chunks.push(text.substring(start, end));
        start += (size - overlap);
    }
    return chunks;
}

/**
 * Calculate similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Explicit RAG Process using @google/genai SDK
 */
export async function askQuestion(fullText: string, history: QAMessage[], question: string): Promise<string> {
    console.log("RAG: Preparation for explicit retrieval flows.");
    const ai = getAI();

    try {
        // 1. Prepare Embeddings (Cache if same paper)
        if (!currentPaperCache || currentPaperCache.text !== fullText) {
            console.log("RAG: New paper detected. Chunking and embedding...");
            const rawChunks = chunkText(fullText);
            
            const embeddedChunks = [];
            for (const chunk of rawChunks) {
                // Use @google/genai SDK pattern from skill
                const result = await ai.models.embedContent({
                    model: "gemini-embedding-2-preview",
                    contents: [chunk]
                });
                
                if (result.embeddings?.[0]?.values) {
                    embeddedChunks.push({
                        text: chunk,
                        embedding: result.embeddings[0].values
                    });
                }
            }
            
            currentPaperCache = { text: fullText, chunks: embeddedChunks };
            console.log(`RAG: Embedded ${embeddedChunks.length} chunks.`);
        }

        // 2. Embed the Question
        const queryEmbeddingRes = await ai.models.embedContent({
            model: "gemini-embedding-2-preview",
            contents: [question]
        });
        const queryEmbedding = queryEmbeddingRes.embeddings?.[0]?.values;

        if (!queryEmbedding) throw new Error("Could not generate query embedding");

        // 3. Document Retrieval (Search top 5 most relevant chunks)
        const scoredChunks = currentPaperCache.chunks.map(chunk => ({
            ...chunk,
            score: cosineSimilarity(queryEmbedding, chunk.embedding)
        }));

        const topChunks = scoredChunks
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        console.log("RAG: Retrieved relevant context. Top score:", topChunks[0]?.score);

        // 4. Generation with retrieved context
        const contextText = topChunks.map(c => c.text).join('\n\n---RETRIEVED SEGMENT---\n\n');
        
        const finalPrompt = `You are a Research Assistant. Use the following retrieved sections from the paper to answer the question.
        If the information is not present in these segments, refer to common knowledge but state that you are doing so.
        
        RETRIEVED CONTEXT:
        ${contextText}
        
        CHAT HISTORY:
        ${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
        
        USER QUESTION: ${question}`;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: finalPrompt
        });
        
        return response.text || "No response generated.";

    } catch (err: any) {
        console.error("EXPLICIT RAG ERROR:", err);
        throw err;
    }
}
