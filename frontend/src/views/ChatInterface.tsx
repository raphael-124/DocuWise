import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, User, Bot, Loader2, Quote, Copy, ThumbsUp, ThumbsDown, RefreshCcw, Check, ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChatInterfaceProps {
    documentId: string;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    sources?: string[];
    id: string;
}

const CodeBlock = ({ className, children, ...props }: any) => {
    const [copied, setCopied] = useState(false);
    const match = /language-(\w+)/.exec(className || '');
    const lang = match ? match[1] : '';
    // Detect inline code: no newline in the raw string content
    const isInline = !String(children).includes('\n');

    const handleCopy = () => {
        navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (isInline) {
        return <code className={className} {...props}>{children}</code>;
    }

    return (
        <div className="relative group">
            <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                    onClick={handleCopy}
                    className="p-1.5 rounded bg-gray-800 border border-gray-700 text-gray-400 hover:text-white transition-colors"
                >
                    {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                </button>
            </div>
            <SyntaxHighlighter
                style={oneDark}
                language={lang || 'text'}
                PreTag="div"
                {...props}
            >
                {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
        </div>
    );
};

export default function ChatInterface({ documentId }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const endOfMessagesRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = useCallback(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);
    const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

    const toggleSources = (id: string) => {
        setExpandedSources(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!documentId) return;
            setIsHistoryLoading(true);
            try {
                const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';
                const response = await fetch(`${API}/api/chat/history?document_id=${encodeURIComponent(documentId)}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.history && data.history.length > 0) {
                        const formattedMessages = data.history.map((msg: any, index: number) => ({
                            id: `hist-${index}`,
                            role: msg.role as 'user' | 'assistant',
                            content: msg.content,
                            sources: [] 
                        }));
                        setMessages(formattedMessages);
                    } else {
                        // Keep default welcome message if no history
                        setMessages([
                            { 
                                id: '1',
                                role: 'assistant', 
                                content: "Hello! 👋 I've indexed your document. I'm ready to help you analyze, summarize, or explain any part of it. What would you like to know?" 
                            }
                        ]);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch chat history:", err);
            } finally {
                setIsHistoryLoading(false);
                setTimeout(scrollToBottom, 100);
            }
        };

        fetchHistory();
    }, [documentId, scrollToBottom]);

    useEffect(() => {
        if (!isHistoryLoading) {
            scrollToBottom();
        }
    }, [messages, scrollToBottom, isHistoryLoading]);

    const handleCopyMessage = (content: string) => {
        navigator.clipboard.writeText(content);
    };

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        const userMsgId = Date.now().toString();
        const aiMsgId = (Date.now() + 1).toString();

        setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: userMessage }]);
        setInput('');
        setIsLoading(true);

        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: '', sources: [] }]);

        try {
            const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';
            const response = await fetch(`${API}/api/chat?document_id=${encodeURIComponent(documentId)}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: userMessage, top_k: 4 }),
            });

            if (!response.ok) throw new Error('Failed to connect to assistant');
            if (!response.body) throw new Error('No response stream');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let done = false;

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                const chunkValue = decoder.decode(value, { stream: true });

                const lines = chunkValue.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') break;
                        if (!dataStr) continue;

                        try {
                            const parsed = JSON.parse(dataStr);
                            setMessages(prev => {
                                const next = [...prev];
                                const last = next[next.length - 1];
                                if (parsed.text) last.content += parsed.text;
                                if (parsed.sources && parsed.sources.length > 0) {
                                    last.sources = Array.from(new Set([...(last.sources || []), ...parsed.sources]));
                                }
                                return next;
                            });
                        } catch { /* ignore partials */ }
                    }
                }
            }
        } catch (err: any) {
            setMessages(prev => {
                const next = [...prev];
                next[next.length - 1].content = `⚠️ **Error:** ${err.message}`;
                return next;
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="chat-view-container">
            <div className="messages-area hidden-scroll">
                <div className="messages-list">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`message-container chat-bubble ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`}>
                            <div className={`avatar ${msg.role === 'user' ? 'avatar-user' : 'avatar-ai'}`}>
                                {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                            </div>
                            
                            <div className="message-content-wrapper">
                                <div className="message-text">
                                    {msg.role === 'assistant' ? (
                                        <div className="markdown-body">
                                            <ReactMarkdown 
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    code: CodeBlock
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        msg.content
                                    )}
                                </div>

                                {msg.role === 'assistant' && msg.content !== '' && (
                                    <div className="message-actions">
                                        <button onClick={() => handleCopyMessage(msg.content)} className="action-btn" title="Copy message">
                                            <Copy size={14} />
                                        </button>
                                        <button className="action-btn" title="Helpful">
                                            <ThumbsUp size={14} />
                                        </button>
                                        <button className="action-btn" title="Not helpful">
                                            <ThumbsDown size={14} />
                                        </button>
                                        <button onClick={() => {/* logic to retry */}} className="action-btn" title="Regenerate">
                                            <RefreshCcw size={14} />
                                        </button>
                                    </div>
                                )}

                                {msg.sources && msg.sources.length > 0 && (
                                    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
                                        <button 
                                            onClick={() => toggleSources(msg.id)}
                                            style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '0.5rem', 
                                                color: 'var(--text-muted)', 
                                                fontSize: '0.7rem', 
                                                fontWeight: 700, 
                                                marginBottom: '0.5rem', 
                                                letterSpacing: '0.05em',
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: 0
                                            }}
                                        >
                                            {expandedSources[msg.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                            <Quote size={10} /> {msg.sources.length} {msg.sources.length === 1 ? 'SOURCE' : 'SOURCES'}
                                        </button>
                                        
                                        {expandedSources[msg.id] && (
                                            <div className="animate-fade-in" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                {msg.sources.map((src, idx) => (
                                                    <div key={idx} className="source-item" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}>
                                                        {src}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {isLoading && messages[messages.length - 1]?.content === '' && (
                        <div className="message-container">
                            <div className="avatar avatar-ai">
                                <Bot size={20} />
                            </div>
                            <div className="message-content-wrapper">
                                <div className="thinking-container">
                                    <Loader2 size={16} className="animate-spin text-primary" />
                                    <span className="shimmer-text">Processing your request...</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={endOfMessagesRef} />
                </div>
            </div>

            <div className="chat-input-area">
                <div className="chat-input-container">
                    <div className="chat-input-wrapper glass-effect" style={{ borderRadius: '1.5rem', padding: '0.4rem 0.4rem 0.4rem 1.25rem' }}>
                        <textarea
                            ref={textareaRef}
                            className="chat-textarea"
                            placeholder="Message Study Assistant..."
                            rows={1}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            onInput={(e) => {
                                const el = e.currentTarget;
                                el.style.height = 'auto';
                                el.style.height = `${el.scrollHeight}px`;
                            }}
                            disabled={isLoading}
                        />
                        <button
                            onClick={() => handleSend()}
                            className="btn btn-primary"
                            disabled={isLoading || !input.trim()}
                            style={{ 
                                width: '36px', 
                                height: '36px', 
                                padding: 0,
                                borderRadius: '50%',
                                flexShrink: 0
                            }}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
                <p className="text-dim" style={{ textAlign: 'center', fontSize: '0.7rem', marginTop: '0.75rem' }}>
                    Study AI can make mistakes. Check important information.
                </p>
            </div>
        </div>
    );
}
