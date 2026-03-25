import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, User, Bot, Loader2, Quote, FileText, Search, X, Trash2, ArrowUpRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: string[];
}

export default function GlobalSearchView({ onClose }: { onClose: () => void }) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: "Welcome to **Library Search**! 🔍 I can search across all your uploaded documents at once. Ask me something like 'What are the common themes across my notes?' or 'Summarize everything I have on thermodynamics'."
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    const QUICK_SUGGESTIONS = [
        "Summarize my entire library",
        "What are the common themes in my notes?",
        "Compare different topics I've studied",
        "Give me a study plan based on my files"
    ];

    const clearChat = () => {
        setMessages([
            {
                id: '1',
                role: 'assistant',
                content: "Welcome to **Library Search**! 🔍 I can search across all your uploaded documents at once. Ask me something like 'What are the common themes across my notes?' or 'Summarize everything I have on thermodynamics'."
            }
        ]);
    };

    const scrollToBottom = () => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        const userMsgId = Date.now().toString();
        
        setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: userMessage }]);
        setInput('');
        setIsLoading(true);

        try {
            const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';
            const response = await fetch(`${API}/api/search/global`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: userMessage }),
            });

            if (!response.ok) throw new Error('Global search failed');
            
            const data = await response.json();
            
            setMessages(prev => [...prev, { 
                id: (Date.now() + 1).toString(), 
                role: 'assistant', 
                content: data.answer,
                sources: data.sources
            }]);
        } catch (err: any) {
            setMessages(prev => [...prev, { 
                id: (Date.now() + 1).toString(), 
                role: 'assistant', 
                content: `⚠️ **Error:** ${err.message}. Make sure you have uploaded at least one document.`
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="global-search-overlay glass-effect animate-fade-in">
            <div className="global-search-modal card glass-effect animate-scale-up">
                <div className="modal-header border-b pb-4 mb-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-light rounded-xl text-primary">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Library Search</h2>
                            <p className="text-xs text-muted">Asking across all your documents</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={clearChat} className="p-2 hover:bg-error/10 hover:text-error rounded-full transition-colors" title="Clear Chat">
                            <Trash2 size={18} />
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="modal-messages hidden-scroll flex-1 overflow-y-auto pr-2" style={{ maxHeight: '60vh' }}>
                    {messages.map((msg) => (
                        <div key={msg.id} className={`message-item flex gap-4 mb-6 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`avatar flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-muted text-primary'}`}>
                                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                            </div>
                            <div className={`message-bubble max-w-[85%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-muted/50 border border-border-light'}`}>
                                <div className="markdown-body text-sm">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                                
                                {msg.sources && msg.sources.length > 0 && (
                                    <div className="sources-container mt-4 pt-4 border-t border-border-light/30">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                                            <Quote size={10} /> Sourced from:
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {msg.sources.map((src, i) => (
                                                <div key={i} className="source-pill flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 border border-primary/20 rounded-lg text-[11px] font-semibold text-primary transition-all hover:bg-primary/10">
                                                    <FileText size={12} /> {src}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {isLoading && (
                        <div className="flex gap-4 mb-6 animate-pulse">
                            <div className="avatar bg-muted text-primary w-8 h-8 rounded-full flex items-center justify-center">
                                <Bot size={16} />
                            </div>
                            <div className="thinking p-4 rounded-2xl bg-muted/30 border border-border-light flex items-center gap-3">
                                <Loader2 size={16} className="animate-spin text-primary" />
                                <span className="text-sm shimmer-text">Consulting your library...</span>
                            </div>
                        </div>
                    )}

                    {/* Quick Suggestions - Only show when no messages except welcome */}
                    {messages.length === 1 && !isLoading && (
                        <div className="mt-8">
                            <p className="text-xs font-bold text-muted uppercase tracking-widest mb-4">Quick Start</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {QUICK_SUGGESTIONS.map((suggestion, i) => (
                                    <button 
                                        key={i} 
                                        onClick={() => { setInput(suggestion); }}
                                        className="suggestion-pill text-left p-4 rounded-2xl bg-muted/30 border border-border-light hover:border-primary/40 hover:bg-primary-light/30 transition-all flex justify-between items-center group"
                                    >
                                        <span className="text-sm font-medium">{suggestion}</span>
                                        <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div ref={endOfMessagesRef} />
                </div>

                <div className="modal-footer pt-4 mt-auto border-t">
                    <form onSubmit={handleSend} className="flex gap-2 bg-muted/50 p-2 rounded-2xl border border-border-light focus-within:border-primary/50 transition-colors">
                        <div className="flex items-center ml-2 text-muted">
                            <Search size={18} />
                        </div>
                        <input 
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Search across your entire library..."
                            className="flex-1 bg-transparent border-none focus:outline-none p-2 text-sm"
                            disabled={isLoading}
                        />
                        <button 
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="btn btn-primary p-2 h-10 w-10 flex items-center justify-center rounded-xl"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            </div>

            <style>{`
                .global-search-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 1000;
                    background: rgba(0,0,0,0.4);
                    backdrop-filter: blur(12px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 1rem;
                    animation: fadeIn 0.3s ease-out;
                }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

                .global-search-modal {
                    width: 100%;
                    max-width: 900px;
                    height: 85vh;
                    display: flex;
                    flex-direction: column;
                    padding: 2rem;
                    border-radius: 2.5rem;
                    background: var(--bg-card);
                    border: 1px solid rgba(255,255,255,0.1);
                    box-shadow: 0 0 40px rgba(var(--primary-rgb), 0.15), 
                                0 25px 50px -12px rgba(0,0,0,0.5);
                    position: relative;
                    overflow: hidden;
                }
                
                .global-search-modal::before {
                    content: '';
                    position: absolute;
                    top: -2px; left: -2px; right: -2px; bottom: -2px;
                    background: linear-gradient(135deg, var(--primary), var(--secondary), var(--primary));
                    z-index: -1;
                    opacity: 0.3;
                    border-radius: inherit;
                }

                .modal-header {
                    margin-bottom: 2rem;
                }

                .shimmer-text {
                    background: linear-gradient(90deg, var(--text-muted) 0%, var(--primary) 50%, var(--text-muted) 100%);
                    background-size: 200% 100%;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    animation: shimmer 2s infinite linear;
                }
                @keyframes shimmer {
                    from { background-position: 200% 0; }
                    to { background-position: -200% 0; }
                }

                .message-bubble {
                    transition: transform 0.2s ease;
                }
                .message-bubble:hover {
                    transform: translateY(-2px);
                }

                .source-pill {
                    background: var(--bg-muted);
                    border: 1px solid rgba(var(--primary-rgb), 0.1);
                    color: var(--primary);
                    padding: 0.4rem 0.8rem !important;
                    font-size: 0.75rem !important;
                    border-radius: 0.75rem !important;
                }

                form:focus-within {
                    box-shadow: 0 0 0 2px var(--primary-light), 0 10px 15px -3px rgba(0,0,0,0.1);
                    transform: scale(1.01);
                }
                form {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
            `}</style>
        </div>
    );
}
