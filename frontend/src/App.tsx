import React, { useState, useEffect, lazy, Suspense } from 'react';
import DocumentUploader from './components/DocumentUploader';
// Lazy-load heavy views to reduce initial JS bundle size
const ChatInterface    = lazy(() => import('./views/ChatInterface'));
const FlashcardsView   = lazy(() => import('./views/FlashcardsView'));
const QuizView         = lazy(() => import('./views/QuizView'));
const SummaryView      = lazy(() => import('./views/SummaryView'));
import LibraryView from './views/LibraryView';
import GlobalSearchView from './views/GlobalSearchView';
import { 
    BookOpen, 
    MessageSquare, 
    Layers, 
    HelpCircle, 
    Sparkles, 
    FileText, 
    Sun, 
    Moon,
    X,
    FolderOpen,
    Trash2,
    Loader2,
    Plus,
    Search,
    ArrowRight
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

function App() {
    const [documentId, setDocumentId] = useState<string | null>(null);
    const [filename, setFilename] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'home' | 'summary' | 'chat' | 'flashcards' | 'quiz'>('home');
    const [aiProvider, setAiProvider] = useState<'gemini' | 'ollama' | 'huggingface'>('gemini');
    const [isDeleting, setIsDeleting] = useState(false);
    const [showLibrary, setShowLibrary] = useState(false);
    const [showGlobalSearch, setShowGlobalSearch] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Theme Management
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (localStorage.getItem('study-assistant-theme') as 'light' | 'dark') || 'light';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('study-assistant-theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

    const handleUploadSuccess = (docId: string, name: string) => {
        setDocumentId(docId);
        setFilename(name);
        setActiveTab('home');
    };

    const handleDeleteDocument = async () => {
        if (!documentId || isDeleting) return;
        setIsDeleting(true);
        try {
            await fetch(`${API}/api/documents/${encodeURIComponent(documentId)}`, { 
                method: 'DELETE'
            });
        } finally {
            setIsDeleting(false);
            setDocumentId(null);
            setFilename(null);
        }
    };

    const navItems = [
        { id: 'home', label: 'Home', icon: BookOpen, color: 'var(--primary)', light: 'var(--primary-light)' },
        { id: 'chat', label: 'Chat', icon: MessageSquare, color: 'var(--chat-col)', light: 'var(--chat-light)' },
        { id: 'summary', label: 'Summary', icon: FileText, color: 'var(--summary-col)', light: 'var(--summary-light)' },
        { id: 'flashcards', label: 'Flashcards', icon: Layers, color: 'var(--flash-col)', light: 'var(--flash-light)' },
        { id: 'quiz', label: 'Quiz', icon: HelpCircle, color: 'var(--quiz-col)', light: 'var(--quiz-light)' },
    ] as const;

    if (!documentId) {
        return (
            <div className="app-layout" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1rem' }}>
                <div className="theme-toggle" style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={toggleTheme} className="btn btn-secondary glass-effect" style={{ borderRadius: '50%', width: '40px', height: '40px', padding: 0 }}>
                        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                </div>

                <main style={{ width: '100%', maxWidth: '1000px' }}>
                    <div className="card glass-effect animate-slide-up" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                        <div className={`animate-float ${isProcessing ? 'animate-rolling' : ''}`} style={{ marginBottom: '2rem', display: 'inline-flex', padding: '1.5rem', background: 'var(--primary-light)', borderRadius: '2rem' }}>
                            <Sparkles size={48} style={{ color: 'var(--primary)' }} />
                        </div>
                        <h1 className="text-gradient" style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)', marginBottom: '1rem', fontWeight: 800 }}>DocuWise</h1>
                        <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '3rem', maxWidth: '600px', marginInline: 'auto' }}>
                            Transform documents into interactive learning tools. Summarize, chat, and test yourself with AI.
                        </p>
                        
                        {!showLibrary ? (
                            <>
                                <DocumentUploader 
                                    onUploadSuccess={handleUploadSuccess} 
                                    aiProvider={aiProvider} 
                                    onProcessingChange={setIsProcessing}
                                />
                                <div style={{ marginTop: '2rem', display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
                                    <button 
                                        onClick={() => { console.log('Opening Library'); setShowLibrary(true); }} 
                                        className="btn btn-secondary glass-effect flex items-center gap-2 font-bold px-8 py-3"
                                        style={{ borderRadius: '1.25rem', boxShadow: 'var(--shadow-lg)' }}
                                    >
                                        <FolderOpen size={20} /> My Library
                                    </button>
                                    <button 
                                        onClick={() => { console.log('Opening Global Search'); setShowGlobalSearch(true); }} 
                                        className="btn btn-premium flex items-center gap-2 font-bold px-8 py-3"
                                        style={{ borderRadius: '1.25rem' }}
                                    >
                                        <Search size={20} /> Search All
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="animate-slide-up">
                                <LibraryView 
                                    onSelectDocument={handleUploadSuccess} 
                                    onUploadNew={() => setShowLibrary(false)} 
                                />
                                <div style={{ marginTop: '2rem' }}>
                                    <button 
                                        onClick={() => setShowLibrary(false)} 
                                        className="btn btn-ghost flex items-center gap-2 mx-auto text-muted"
                                    >
                                        <Plus size={18} /> Upload Something Else
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {!showLibrary && (
                            <div style={{ marginTop: '3rem' }}>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '1rem' }}>Powered by</p>
                                <div className="glass-effect" style={{ display: 'inline-flex', gap: '0.25rem', padding: '0.4rem', borderRadius: '99px' }}>
                                    {(['gemini', 'huggingface', 'ollama'] as const).map((p) => (
                                        <button key={p} onClick={() => setAiProvider(p)} className={`btn ${aiProvider === p ? 'btn-primary' : 'btn-ghost'}`} style={{ borderRadius: '99px', padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>
                                            {p.charAt(0).toUpperCase() + p.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </main>

                {showGlobalSearch && (
                    <GlobalSearchView onClose={() => setShowGlobalSearch(false)} />
                )}
            </div>
        );
    }

    return (
        <div className="app-layout">
            <header className="header-compact">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: 'var(--primary)', color: 'white', padding: '0.5rem', borderRadius: '0.75rem' }}>
                        <Sparkles size={18} />
                    </div>
                    <h2 className="text-gradient" style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>DocuWise</h2>
                    <div className="document-status-pill hide-mobile">
                        <FolderOpen size={14} />
                        <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filename}</span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button onClick={toggleTheme} className="btn btn-ghost" style={{ padding: '0.5rem', borderRadius: '50%' }}>
                        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                    </button>
                    <button 
                        onClick={handleDeleteDocument}
                        className="btn btn-ghost hover:bg-error-light/20"
                        disabled={isDeleting}
                        title="Delete document from index"
                        style={{ padding: '0.5rem', borderRadius: '50%', color: 'var(--error)' }}
                    >
                        {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                    </button>
                    <button 
                        onClick={() => { setDocumentId(null); setFilename(null); }} 
                        className="btn btn-secondary"
                        title="Close without deleting"
                        style={{ borderRadius: '99px', padding: '0.5rem 1rem', fontSize: '0.8rem', gap: '0.4rem' }}
                    >
                        <X size={16} /> <span className="hide-mobile">Close</span>
                    </button>
                </div>
            </header>

            <nav className="centered-nav-container">
                <div className="navbar-pill">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            className={`nav-pill-btn ${activeTab === item.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(item.id)}
                        >
                            <item.icon size={18} />
                            <span className="hide-mobile">{item.label}</span>
                        </button>
                    ))}
                </div>
            </nav>

            <main className="main-content-wrapper">
                <div className="view-container">
                    <div className="view-wrapper">
                        {/* Persistent views keep component state like chat history alive */}
                        <div className={`persistence-view ${activeTab === 'home' ? 'active' : ''}`}>
                            <div className="dashboard-hero animate-slide-up" style={{ textAlign: 'center', marginBottom: '2rem' }}>
                                <div className="p-3 bg-primary-light rounded-xl text-primary inline-flex mb-4 shadow-sm">
                                    <Sparkles size={28} />
                                </div>
                                <h2 className="text-gradient-premium" style={{ fontSize: 'clamp(2rem, 4vw, 2.5rem)', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.01em' }}>
                                    Document Dashboard
                                </h2>
                                <p style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500, maxWidth: '600px', margin: '0 auto' }}>
                                    Mastering <strong className="text-primary">{filename}</strong>
                                </p>
                            </div>

                            <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                                {navItems.filter(i => i.id !== 'home').map((item, idx) => (
                                    <button 
                                        key={item.id} 
                                        className="feature-card glass-effect animate-slide-up group" 
                                        style={{ 
                                            animationDelay: `${idx * 0.05}s`,
                                            padding: '1.5rem',
                                            borderRadius: '1.5rem',
                                            textAlign: 'left',
                                            alignItems: 'flex-start'
                                        }}
                                        onClick={() => setActiveTab(item.id)}
                                    >
                                        <div className="icon-wrapper" style={{ 
                                            background: activeTab === item.id ? item.color : item.light, 
                                            color: item.color,
                                            width: '50px',
                                            height: '50px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '1rem',
                                            marginBottom: '1.25rem',
                                            transition: 'all 0.3s ease'
                                        }}>
                                            <item.icon size={24} />
                                        </div>
                                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)', transition: 'color 0.3s' }}>{item.label}</h3>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                            {item.id === 'chat' && "Interactive Q&A powered by AI."}
                                            {item.id === 'summary' && "Get high-level overview and key takeaways."}
                                            {item.id === 'flashcards' && "Master key terms with AI study cards."}
                                            {item.id === 'quiz' && "Test your knowledge with custom questions."}
                                        </p>
                                        <div className="mt-4 flex items-center gap-2 font-bold text-xs uppercase tracking-wider group-hover:gap-3 transition-all" style={{ color: item.color }}>
                                            Open {item.label} <ArrowRight size={14} />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={`persistence-view ${activeTab === 'chat' ? 'active' : ''}`}>
                            <div className="card glass-effect" style={{ height: 'calc(100vh - 200px)', padding: '1rem' }}>
                                <Suspense fallback={<div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><Loader2 size={32} className="animate-spin" style={{color:'var(--primary)'}}/></div>}>
                                    <ChatInterface documentId={documentId!} />
                                </Suspense>
                            </div>
                        </div>

                        <div className={`persistence-view ${activeTab === 'summary' ? 'active' : ''}`}>
                            <div className="card glass-effect">
                                <Suspense fallback={<div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><Loader2 size={32} className="animate-spin" style={{color:'var(--primary)'}}/></div>}>
                                    <SummaryView documentId={documentId!} />
                                </Suspense>
                            </div>
                        </div>

                        <div className={`persistence-view ${activeTab === 'flashcards' ? 'active' : ''}`}>
                            <div className="card glass-effect">
                                <Suspense fallback={<div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><Loader2 size={32} className="animate-spin" style={{color:'var(--primary)'}}/></div>}>
                                    <FlashcardsView documentId={documentId!} />
                                </Suspense>
                            </div>
                        </div>

                        <div className={`persistence-view ${activeTab === 'quiz' ? 'active' : ''}`}>
                            <div className="card glass-effect">
                                <Suspense fallback={<div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><Loader2 size={32} className="animate-spin" style={{color:'var(--primary)'}}/></div>}>
                                    <QuizView documentId={documentId!} />
                                </Suspense>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            
            <style>{`
                @media (max-width: 640px) {
                    .hide-mobile { display: none !important; }
                    .header-compact { padding: 1rem 1rem 0; }
                    .centered-nav-container { top: 0.5rem; }
                    .nav-pill-btn { padding: 0.5rem !important; }
                }
            `}</style>

            {showGlobalSearch && (
                <GlobalSearchView onClose={() => setShowGlobalSearch(false)} />
            )}
        </div>
    );
}

export default App;
