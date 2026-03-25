import React, { useState, useEffect } from 'react';
import { Loader2, FileText, RefreshCw } from 'lucide-react';

function renderMarkdown(text: string) {
    if (!text) return null;
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    lines.forEach((line, lineIdx) => {
        const processInline = (str: string): React.ReactNode[] => {
            const parts: React.ReactNode[] = [];
            const regex = /(\*\*(.+?)\*\*|`(.+?)`|\*(.+?)\*)/g;
            let lastIndex = 0;
            let match;
            while ((match = regex.exec(str)) !== null) {
                if (match.index > lastIndex) parts.push(str.slice(lastIndex, match.index));
                if (match[2]) parts.push(<strong key={match.index}>{match[2]}</strong>);
                else if (match[3]) parts.push(<code key={match.index}>{match[3]}</code>);
                else if (match[4]) parts.push(<em key={match.index}>{match[4]}</em>);
                lastIndex = match.index + match[0].length;
            }
            if (lastIndex < str.length) parts.push(str.slice(lastIndex));
            return parts.length > 0 ? parts : [str];
        };

        const trimmed = line.trim();
        if (trimmed.startsWith('### ')) {
            elements.push(<h4 key={lineIdx} style={{ fontSize: '1rem', fontWeight: 600, marginTop: '1rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>{processInline(trimmed.slice(4))}</h4>);
        } else if (trimmed.startsWith('## ')) {
            elements.push(<h3 key={lineIdx} style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>{processInline(trimmed.slice(3))}</h3>);
        } else if (trimmed.startsWith('# ')) {
            elements.push(<h2 key={lineIdx} style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '1.5rem', marginBottom: '0.5rem' }}>{processInline(trimmed.slice(2))}</h2>);
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
            elements.push(<li key={lineIdx} style={{ marginBottom: '0.3em', marginLeft: '1.5em' }}>{processInline(trimmed.slice(2))}</li>);
        } else if (/^\d+\.\s/.test(trimmed)) {
            elements.push(<li key={lineIdx} style={{ marginBottom: '0.3em', marginLeft: '1.5em', listStyleType: 'decimal' }}>{processInline(trimmed.replace(/^\d+\.\s/, ''))}</li>);
        } else if (trimmed === '') {
            elements.push(<br key={lineIdx} />);
        } else {
            elements.push(<p key={lineIdx} style={{ marginBottom: '0.4em', lineHeight: 1.7 }}>{processInline(trimmed)}</p>);
        }
    });
    return <div className="chat-content">{elements}</div>;
}

export default function SummaryView({ documentId }: SummaryViewProps) {
    const [summary, setSummary] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSummary = async () => {
        setLoading(true);
        setError(null);
        try {
            const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';
            const res = await fetch(`${API}/api/summary?document_id=${encodeURIComponent(documentId)}`, {
                method: 'POST'
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => null);
                throw new Error(errData?.detail || 'Failed to generate summary');
            }
            const data = await res.json();
            setSummary(data.summary);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSummary();
    }, [documentId]);

    if (loading) {
        return (
            <div className="card text-center flex-col items-center justify-center p-8 animate-fade-in min-h-[400px]">
                <Loader2 size={40} className="animate-spin text-primary mb-4" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Generating Summary...</h3>
                <p className="text-muted mt-2 text-sm">AI is reading and summarizing your document.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card text-center flex-col items-center justify-center p-8 animate-fade-in min-h-[400px]">
                <p className="text-error mb-4">{error}</p>
                <button onClick={fetchSummary} className="btn btn-primary flex items-center gap-2">
                    <RefreshCw size={16} /> Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-light" style={{ borderColor: 'var(--border-light)' }}>
                <div className="flex items-center gap-2">
                    <FileText size={20} className="text-primary" />
                    <h2 className="text-xl font-bold">Summary</h2>
                </div>
                <button onClick={fetchSummary} className="btn btn-secondary flex items-center gap-1 text-xs px-3 py-1.5">
                    <RefreshCw size={14} /> Regenerate
                </button>
            </div>
            <div className="markdown-body">
                {renderMarkdown(summary || '')}
            </div>
        </div>
    );
}

interface SummaryViewProps {
    documentId: string;
}
