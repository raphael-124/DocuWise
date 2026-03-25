import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle, XCircle, RefreshCw, RotateCw, Trophy, Target, History, Bot } from 'lucide-react';

interface Option {
    text: string;
    is_correct: boolean;
}

interface Question {
    question: string;
    options: Option[];
    explanation: string;
}

interface QuizViewProps {
    documentId: string;
}

export default function QuizView({ documentId }: QuizViewProps) {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [score, setScore] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [history, setHistory] = useState<any[]>([]);

    const fetchHistory = async () => {
        try {
            const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';
            const res = await fetch(`${API}/api/quiz/history?document_id=${encodeURIComponent(documentId)}`);
            if (res.ok) {
                const data = await res.json();
                setHistory(data.history || []);
            }
        } catch { /* ignore */ }
    };

    const fetchQuiz = useCallback(async () => {
        setLoading(true);
        setError(null);
        setCurrentIndex(0);
        setSelectedOption(null);
        setIsAnswered(false);
        setScore(0);
        setIsComplete(false);
        try {
            const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';
            const res = await fetch(`${API}/api/quiz/generate?document_id=${encodeURIComponent(documentId)}&num_questions=5`, {
                method: 'POST'
            });
            if (!res.ok) throw new Error('Failed to generate quiz');
            const data = await res.json();
            setQuestions(data.questions || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [documentId]);

    useEffect(() => {
        fetchQuiz();
        fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchQuiz]);

    const saveScore = async (finalScore: number, total: number) => {
        try {
            const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';
            await fetch(`${API}/api/quiz/history`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ document_id: documentId, score: finalScore, total })
            });
            fetchHistory();
        } catch { /* ignore */ }
    };

    useEffect(() => {
        if (isComplete) saveScore(score, questions.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isComplete]);

    if (loading) {
        return (
            <div className="card text-center flex-col items-center justify-center p-12">
                <Loader2 size={48} className="animate-spin text-primary mb-4" />
                <h3 style={{ fontSize: '1.25rem' }}>Preparing your quiz...</h3>
                <p className="text-muted mt-2">Generating challenging questions for you.</p>
            </div>
        );
    }

    if (error || questions.length === 0) {
        return (
            <div className="card text-center flex-col items-center justify-center p-12">
                <p className="text-error mb-6">{error || 'Unable to generate quiz.'}</p>
                <button onClick={fetchQuiz} className="btn btn-primary">
                    <RefreshCw size={18} /> Try Again
                </button>
            </div>
        );
    }

    if (isComplete) {
        const pct = Math.round((score / questions.length) * 100);
        return (
            <div className="card text-center flex-col items-center p-10 animate-fade-in">
                <Trophy size={64} className={pct >= 80 ? 'text-warning' : 'text-primary'} style={{ marginBottom: '1.5rem' }} />
                <h2 style={{ fontSize: '3rem', fontWeight: 800 }} className="text-gradient mb-2">
                    {score} / {questions.length}
                </h2>
                <p style={{ fontSize: '1.25rem', fontWeight: 500 }} className="mb-8">
                    {pct >= 80 ? 'Mastery! 🎉' : pct >= 50 ? 'Good Job! 👍' : 'Keep Learning! 📖'}
                </p>

                {history.length > 0 && (
                    <div style={{ width: '100%', maxWidth: '320px', textAlign: 'left', marginBottom: '2rem' }}>
                        <p className="text-muted" style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <History size={14} /> Recent Attempts
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {history.slice(-3).reverse().map((h, i) => (
                                <div key={i} className="flex justify-between items-center p-2 rounded bg-muted" style={{ fontSize: '0.75rem' }}>
                                    <span className="text-dim">{new Date(h.timestamp).toLocaleDateString()}</span>
                                    <span style={{ fontWeight: 700 }}>{h.score}/{h.total}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex gap-4">
                    <button onClick={() => { setIsComplete(false); setScore(0); setCurrentIndex(0); }} className="btn btn-secondary">
                        <RotateCw size={18} /> Retake
                    </button>
                    <button onClick={fetchQuiz} className="btn btn-primary">
                        <RefreshCw size={18} /> New Quiz
                    </button>
                </div>
            </div>
        );
    }

    const currentQ = questions[currentIndex];
    const progress = ((currentIndex + 1) / questions.length) * 100;

    const handleSelect = (idx: number) => {
        if (isAnswered) return;
        setSelectedOption(idx);
        setIsAnswered(true);
        if (currentQ.options[idx].is_correct) setScore(s => s + 1);
    };

    return (
        <div className="animate-fade-in pb-12">
            <div className="flex justify-between items-end mb-4">
                <div className="flex items-center gap-3">
                    <Target size={24} className="text-primary" />
                    <h3 style={{ fontWeight: 700 }}>QUESTION {currentIndex + 1} OF {questions.length}</h3>
                </div>
            </div>
            
            <div className="progress-bar-container" style={{ height: '6px' }}>
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>

            <div className="card glass-effect p-8 mt-8 mb-8">
                <p style={{ fontSize: '1.25rem', fontWeight: 500, lineHeight: 1.6 }} className="mb-10">{currentQ.question}</p>
                <div className="flex flex-col gap-3">
                    {currentQ.options.map((opt, idx) => (
                        <button
                            key={idx}
                            disabled={isAnswered}
                            onClick={() => handleSelect(idx)}
                            className={`quiz-option ${isAnswered ? (opt.is_correct ? 'correct' : (idx === selectedOption ? 'incorrect' : '')) : ''}`}
                        >
                            <span className="quiz-option-letter">{String.fromCharCode(65 + idx)}</span>
                            <span className="flex-1">{opt.text}</span>
                            {isAnswered && opt.is_correct && <CheckCircle size={20} className="text-success" />}
                            {isAnswered && !opt.is_correct && idx === selectedOption && <XCircle size={20} className="text-error" />}
                        </button>
                    ))}
                </div>
            </div>

            {isAnswered && (
                <div className="card bg-muted p-6 mb-8 animate-fade-in" style={{ borderLeft: '4px solid var(--primary)' }}>
                    <p className="text-primary" style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Bot size={14} /> Explanation
                    </p>
                    <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{currentQ.explanation}</p>
                </div>
            )}

            <div className="flex justify-end">
                <button
                    disabled={!isAnswered}
                    onClick={() => currentIndex < questions.length - 1 ? (setCurrentIndex(c => c + 1), setSelectedOption(null), setIsAnswered(false)) : setIsComplete(true)}
                    className="btn btn-primary px-10 py-3 rounded-full"
                >
                    {currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                </button>
            </div>
        </div>
    );
}
