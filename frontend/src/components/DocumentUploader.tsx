import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle, Loader2, AlertCircle, Sparkles, X, Plus } from 'lucide-react';

interface DocumentUploaderProps {
    onUploadSuccess: (documentId: string, filename: string) => void;
    onProcessingChange?: (isProcessing: boolean) => void;
    aiProvider: 'gemini' | 'ollama' | 'huggingface';
}

type UploadStage = 'idle' | 'uploading' | 'extracting' | 'embedding' | 'done';

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.txt', '.md'];

export default function DocumentUploader({ onUploadSuccess, onProcessingChange, aiProvider }: DocumentUploaderProps) {
    const [file, setFile] = useState<File | null>(null);
    const [stage, setStage] = useState<UploadStage>('idle');
    const [error, setError] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    const stageMessages: Record<UploadStage, string> = {
        idle: '',
        uploading: 'Uploading file...',
        extracting: 'Analyzing content...',
        embedding: 'Indexing for AI...',
        done: 'Success!'
    };

    const stageProgress: Record<UploadStage, number> = {
        idle: 0,
        uploading: 25,
        extracting: 50,
        embedding: 80,
        done: 100
    };

    const validateFile = (selectedFile: File): boolean => {
        const ext = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            setError(`Unsupported format. Use: ${ALLOWED_EXTENSIONS.join(', ')}`);
            return false;
        }
        if (selectedFile.size > 20 * 1024 * 1024) {
            setError('File size exceeds 20MB limit.');
            return false;
        }
        return true;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFile = e.target.files[0];
            if (validateFile(selectedFile)) {
                setFile(selectedFile);
                setError(null);
            }
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && validateFile(droppedFile)) {
            setFile(droppedFile);
            setError(null);
        }
    };

    // This function is intended to be called internally after a successful upload
    // to trigger the parent's onUploadSuccess prop and reset processing state.
    const handleUploadSuccess = (documentId: string, filename: string) => {
        onUploadSuccess(documentId, filename);
        onProcessingChange?.(false); // Signal that processing is complete
    };

    const handleUpload = async () => {
        if (!file) return;
        setError(null);
        setStage('uploading');
        onProcessingChange?.(true); // Signal that processing has started

        const formData = new FormData();
        formData.append('file', file);

        try {
            const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';
            
            // Immediately show "Analyzing" as that's the first step on the server
            setStage('extracting');
            
            const response = await fetch(`${API}/api/upload?ai_provider=${aiProvider}`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.detail || 'Upload failed. Check server status.');
            }

            // Once fetch returns, it means embedding is also done (since it's one blocking call on server)
            setStage('embedding');
            const data = await response.json();
            
            setStage('done');
            setTimeout(() => handleUploadSuccess(data.document_id, data.filename), 800);
        } catch (err: any) {
            console.error("Upload Error Details:", err);
            setStage('idle');
            onProcessingChange?.(false);
            setError(err.message || "An unknown error occurred during upload.");
        }
    };

    const isProcessing = stage !== 'idle';

    return (
        <div 
            className={`uploader-container ${isDragOver ? 'drag-over' : ''} animate-fade-in`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
        >
            {isProcessing ? (
                <div style={{ width: '100%', maxWidth: '400px' }}>
                    <div style={{ marginBottom: '2rem' }}>
                        {stage === 'done' ? (
                            <CheckCircle size={64} style={{ color: 'var(--success)', margin: '0 auto' }} />
                        ) : (
                            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Loader2 size={64} className="animate-spin" style={{ color: 'var(--primary)' }} />
                                <Sparkles size={24} className="animate-rolling" style={{ position: 'absolute' }} />
                            </div>
                        )}
                    </div>

                    <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                        {stage === 'done' ? 'Done!' : 'Processing...'}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                        {stageMessages[stage]}
                    </p>

                    <div className="progress-bar-container">
                        <div className="progress-bar-fill" style={{ width: `${stageProgress[stage]}%` }} />
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                        <FileText size={14} />
                        <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {file?.name}
                        </span>
                    </div>
                </div>
            ) : (
                <>
                    <div className="animate-float" style={{
                        color: 'var(--primary)',
                        padding: '1.5rem',
                        background: 'var(--primary-light)',
                        borderRadius: '2rem',
                        marginBottom: '1.5rem'
                    }}>
                        <UploadCloud size={48} />
                    </div>

                    <h2 style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>Upload Document</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '400px' }}>
                        Drop your PDF or notes here to start chatting with your materials.
                    </p>

                    {error && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: 'var(--error)',
                            background: 'rgba(239, 68, 68, 0.1)',
                            padding: '0.75rem 1.25rem',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: '1.5rem',
                            fontSize: '0.9rem'
                        }}>
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    {!file ? (
                        <div style={{ width: '100%' }}>
                            <label className="btn btn-primary" style={{ cursor: 'pointer', borderRadius: '99px', padding: '0.8rem 2.5rem' }}>
                                <Plus size={18} /> Choose File
                                <input type="file" accept={ALLOWED_EXTENSIONS.join(',')} onChange={handleFileChange} style={{ display: 'none' }} />
                            </label>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '1.5rem' }}>
                                PDF, DOCX, PPTX, TXT, MD up to 20MB
                            </p>
                        </div>
                    ) : (
                        <div style={{ width: '100%', maxWidth: '400px' }}>
                            <div className="card glass-effect" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <FileText size={24} style={{ color: 'var(--primary)' }} />
                                    <div style={{ textAlign: 'left' }}>
                                        <p style={{ fontSize: '0.9rem', fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {file.name}
                                        </p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setFile(null)} className="btn btn-ghost" style={{ padding: '0.25rem' }}>
                                    <X size={18} />
                                </button>
                            </div>
                            <button onClick={handleUpload} className="btn btn-primary" style={{ width: '100%', height: '48px' }}>
                                Analyze Document
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
