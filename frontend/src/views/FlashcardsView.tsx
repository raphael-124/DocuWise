import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, ChevronLeft, ChevronRight, RotateCw, RefreshCw, Layers } from 'lucide-react';

interface Flashcard {
    question: string;
    answer: string;
}

interface FlashcardsViewProps {
    documentId: string;
}

export default function FlashcardsView({ documentId }: FlashcardsViewProps) {
    const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    const fetchFlashcards = useCallback(async () => {
        setLoading(true);
        setError(null);
        setCurrentIndex(0);
        setIsFlipped(false);
        try {
            const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';
            const res = await fetch(`${API}/api/flashcards/generate?document_id=${encodeURIComponent(documentId)}&num_cards=5`, {
                method: 'POST'
            });
            if (!res.ok) throw new Error('Failed to generate flashcards');
            const data = await res.json();
            setFlashcards(data.flashcards || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [documentId]);

    useEffect(() => {
        fetchFlashcards();
    }, [fetchFlashcards]);

    if (loading) {
        return (
            <div className="card text-center flex-col items-center justify-center p-12 animate-fade-in">
                <Loader2 size={48} className="animate-spin text-primary mb-4" />
                <h3 style={{ fontSize: '1.25rem' }}>Creating your flashcards...</h3>
                <p className="text-muted mt-2">AI is distilling the key concepts.</p>
            </div>
        );
    }

    if (error || flashcards.length === 0) {
        return (
            <div className="card text-center flex-col items-center justify-center p-12">
                <p className="text-error mb-6">{error || 'No flashcards available.'}</p>
                <button onClick={fetchFlashcards} className="btn btn-primary">
                    <RefreshCw size={18} /> Regenerate
                </button>
            </div>
        );
    }

    const currentCard = flashcards[currentIndex];

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-2 text-muted font-bold text-sm">
                    <Layers size={18} className="text-primary" />
                    <span>{currentIndex + 1} OF {flashcards.length}</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsFlipped(!isFlipped)} className="btn btn-ghost btn-sm">
                        <RotateCw size={14} /> Flip
                    </button>
                    <button onClick={fetchFlashcards} className="btn btn-ghost btn-sm">
                        <RefreshCw size={14} /> New Set
                    </button>
                </div>
            </div>

            <div className="flashcard-wrapper" onClick={() => setIsFlipped(!isFlipped)}>
                <div className={`flashcard-inner ${isFlipped ? 'is-flipped' : ''}`}>
                    <div className="flashcard-face flashcard-front">
                        <p className="flashcard-content">{currentCard.question}</p>
                        <span className="text-dim" style={{ position: 'absolute', bottom: '1.5rem', fontSize: '0.7rem', letterSpacing: '0.1em' }}>
                            QUESTION · TAP TO REVEAL
                        </span>
                    </div>
                    <div className="flashcard-face flashcard-back">
                        <p className="flashcard-content">{currentCard.answer}</p>
                        <span style={{ position: 'absolute', bottom: '1.5rem', fontSize: '0.7rem', color: 'var(--primary)', letterSpacing: '0.1em' }}>
                            ANSWER
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex justify-center gap-6 mt-12">
                <button 
                    disabled={currentIndex === 0}
                    onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev - 1); setIsFlipped(false); }}
                    className="btn btn-secondary"
                    style={{ width: '64px', height: '64px', borderRadius: '50%', padding: 0 }}
                >
                    <ChevronLeft size={24} />
                </button>
                <button 
                    disabled={currentIndex === flashcards.length - 1}
                    onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev + 1); setIsFlipped(false); }}
                    className="btn btn-primary"
                    style={{ width: '64px', height: '64px', borderRadius: '50%', padding: 0 }}
                >
                    <ChevronRight size={24} />
                </button>
            </div>
        </div>
    );
}
