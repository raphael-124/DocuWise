import React, { useState, useEffect } from 'react';
import { FileText, Calendar, Trash2, ArrowRight, Loader2, Library, Plus } from 'lucide-react';

interface Document {
    document_id: string;
    filename: string;
    uploaded_at: string;
    chunks: number;
}

interface LibraryViewProps {
    onSelectDocument: (docId: string, filename: string) => void;
    onUploadNew: () => void;
}

export default function LibraryView({ onSelectDocument, onUploadNew }: LibraryViewProps) {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

    const fetchDocuments = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API}/api/documents`);
            if (!response.ok) throw new Error('Failed to fetch library');
            const data = await response.json();
            setDocuments(data.documents || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, []);

    const handleDelete = async (e: React.MouseEvent, docId: string) => {
        e.stopPropagation();
        if (deletingId) return;
        
        setDeletingId(docId);
        try {
            const response = await fetch(`${API}/api/documents/${encodeURIComponent(docId)}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                setDocuments(prev => prev.filter(d => d.document_id !== docId));
            }
        } catch (err) {
            console.error("Failed to delete document:", err);
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                <Loader2 className="animate-spin text-primary mb-4" size={40} />
                <p className="text-muted">Loading your library...</p>
            </div>
        );
    }

    return (
        <div className="library-container animate-slide-up">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary-light rounded-2xl text-primary">
                        <Library size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">My Library</h2>
                        <p className="text-sm text-muted">Manage your uploaded study materials</p>
                    </div>
                </div>
                <button 
                    onClick={onUploadNew}
                    className="btn btn-primary flex items-center gap-2"
                    style={{ borderRadius: '1rem' }}
                >
                    <Plus size={18} /> Upload New
                </button>
            </div>

            {error && (
                <div className="error-card bg-error-light text-error p-4 rounded-xl mb-6">
                    {error}
                </div>
            )}

            {documents.length === 0 ? (
                <div className="card glass-effect text-center py-16">
                    <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText size={32} className="text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">No documents yet</h3>
                    <p className="text-muted mb-6">Upload your first document to start studying with AI.</p>
                    <button onClick={onUploadNew} className="btn btn-primary">Get Started</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {documents.map((doc, index) => (
                        <div 
                            key={doc.document_id} 
                            className="document-card glass-effect group hover:border-primary/50 transition-all cursor-pointer animate-slide-up"
                            style={{ animationDelay: `${index * 0.1}s` }}
                            onClick={() => onSelectDocument(doc.document_id, doc.filename)}
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 bg-primary-light rounded-2xl text-primary group-hover:bg-primary group-hover:text-white group-hover:shadow-glow transition-all duration-300">
                                    <FileText size={24} />
                                </div>
                                <button 
                                    onClick={(e) => handleDelete(e, doc.document_id)}
                                    className="p-2 text-error btn-danger-glow hover:shadow-glow rounded-full transition-all"
                                    disabled={deletingId === doc.document_id}
                                    title="Delete document"
                                >
                                    {deletingId === doc.document_id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                                </button>
                            </div>
                            
                            <h3 className="font-extrabold text-xl mb-3 line-clamp-1 group-hover:text-primary transition-colors">
                                {doc.filename}
                            </h3>
                            
                            <div className="flex flex-col gap-4 mt-auto">
                                <div className="flex items-center gap-2 text-sm text-muted">
                                    <Calendar size={14} />
                                    <span>{formatDate(doc.uploaded_at)}</span>
                                    <span className="mx-1">•</span>
                                    <span>{doc.chunks} parts</span>
                                </div>
                                
                                <div className="flex items-center justify-between pt-4 border-t border-border-light/30">
                                    <span className="text-xs font-bold uppercase tracking-widest text-muted group-hover:text-primary transition-colors">Study Ready</span>
                                    <div className="w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                                        <ArrowRight size={16} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                .library-container {
                    padding-bottom: 2rem;
                }
                .document-card {
                    padding: 2.2rem;
                    border-radius: 2.5rem;
                    border: 1px solid var(--border-light);
                    display: flex;
                    flex-direction: column;
                    background: var(--bg-card);
                    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                    position: relative;
                    overflow: hidden;
                }
                .document-card:hover {
                    transform: translateY(-10px) scale(1.03);
                    box-shadow: 0 30px 60px -12px rgba(var(--primary-rgb), 0.25);
                    border-color: var(--primary);
                }
                .document-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(135deg, var(--primary-light), transparent);
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                .document-card:hover::before {
                    opacity: 1;
                }
                .shadow-glow {
                    box-shadow: 0 8px 24px rgba(var(--error-rgb), 0.3) !important;
                }
                .btn-danger-glow:hover {
                    background: rgba(var(--error-rgb), 0.1);
                    color: var(--error);
                    box-shadow: 0 0 15px rgba(var(--error-rgb), 0.2);
                }
            `}</style>
        </div>
    );
}
