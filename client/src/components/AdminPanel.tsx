import { useState, useEffect, useRef } from 'preact/hooks';
import {
    adminListModules,
    adminUploadModule,
    adminDeleteModule,
    adminAddQuizQuestion,
    adminDeleteQuizQuestion,
    fetchQuiz,
} from '../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Module {
    id: number;
    title: string;
    topic: string;
    tier: number;
    chunk_count: number;
    compressed_size: number;
    filename: string | null;
}

interface Question {
    id?: number;
    question: string;
    options: [string, string, string, string];
    correct: number;
}

type AdminTab = 'modules' | 'upload' | 'quiz';

// ─── Constants ───────────────────────────────────────────────────────────────

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap'); * { box-sizing: border-box; }`;
const INPUT_CLASS = "w-full px-3 py-2.5 bg-white border border-stone-200 rounded-lg text-sm text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400 transition-colors";
const LABEL_CLASS = "block text-xs font-medium text-stone-400 uppercase tracking-widest mb-1.5";
const EMPTY_QUESTION = (): Question => ({ question: '', options: ['', '', '', ''], correct: 0 });

// ─── Main component ───────────────────────────────────────────────────────────

interface AdminPanelProps {
    onClose: () => void;
}

export function AdminPanel({ onClose }: AdminPanelProps) {
    const [adminKey, setAdminKey] = useState('');
    const [authed, setAuthed] = useState(false);
    const [authError, setAuthError] = useState('');
    const [activeTab, setActiveTab] = useState<AdminTab>('modules');

    // ── Auth screen ──────────────────────────────────────────────────────────
    if (!authed) {
        return (
            <Overlay onClose={onClose}>
                <div className="w-full max-w-sm">
                    <ModalHeader title="Admin access" sub="Enter your admin key to continue" onClose={onClose} />
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        if (!adminKey.trim()) { setAuthError('Enter admin key'); return; }
                        // Key is verified server-side on first real action
                        setAuthed(true);
                    }} className="space-y-4 mt-6">
                        <div>
                            <label className={LABEL_CLASS}>Admin key</label>
                            <input type="password" value={adminKey}
                                   onInput={(e) => { setAdminKey((e.target as HTMLInputElement).value); setAuthError(''); }}
                                   className={INPUT_CLASS} placeholder="••••••••••••" autoFocus />
                        </div>
                        {authError && <p className="text-xs text-red-500">{authError}</p>}
                        <button type="submit"
                                className="w-full py-3 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-700 transition-colors">
                            Enter
                        </button>
                    </form>
                </div>
            </Overlay>
        );
    }

    // ── Tabbed admin UI ──────────────────────────────────────────────────────
    return (
        <Overlay onClose={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
                    <div>
                        <h2 className="text-base font-medium text-stone-900">Admin Panel</h2>
                        <p style={{ fontFamily: "'DM Mono', monospace" }} className="text-xs text-stone-400 mt-0.5 font-light">
                            authenticated
                        </p>
                    </div>
                    <button onClick={onClose} className="text-stone-300 hover:text-stone-500 transition-colors">
                        <XIcon />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-6 pt-3 pb-0 border-b border-stone-100">
                    {([
                        { id: 'modules' as AdminTab, label: 'Modules' },
                        { id: 'upload' as AdminTab, label: 'Upload' },
                        { id: 'quiz' as AdminTab, label: 'Quiz Editor' },
                    ]).map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === t.id
                                        ? 'border-stone-900 text-stone-900'
                                        : 'border-transparent text-stone-400 hover:text-stone-600'
                                }`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-auto">
                    {activeTab === 'modules' && <ModulesTab adminKey={adminKey} />}
                    {activeTab === 'upload' && <UploadTab adminKey={adminKey} onUploaded={() => setActiveTab('modules')} />}
                    {activeTab === 'quiz' && <QuizTab adminKey={adminKey} />}
                </div>
            </div>
        </Overlay>
    );
}

// ─── Modules Tab ─────────────────────────────────────────────────────────────

function ModulesTab({ adminKey }: { adminKey: string }) {
    const [modules, setModules] = useState<Module[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deleting, setDeleting] = useState<number | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

    async function load() {
        setLoading(true);
        setError('');
        try {
            const data = await adminListModules(adminKey);
            setModules(data.modules || []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    async function handleDelete(moduleId: number) {
        setDeleting(moduleId);
        setError('');
        try {
            const data = await adminDeleteModule(adminKey, moduleId);
            setModules(data.modules || []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setDeleting(null);
            setConfirmDelete(null);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48">
                <p style={{ fontFamily: "'DM Mono', monospace" }} className="text-xs text-stone-300 animate-pulse">loading modules…</p>
            </div>
        );
    }

    return (
        <div className="p-6">
            {error && <ErrorBanner message={error} />}

            <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-medium text-stone-400 uppercase tracking-widest">
                    {modules.length} module{modules.length !== 1 ? 's' : ''} in catalog
                </p>
                <button onClick={load} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
                    Refresh
                </button>
            </div>

            {modules.length === 0 ? (
                <div className="text-center py-16 text-stone-300">
                    <p style={{ fontFamily: "'DM Mono', monospace" }} className="text-sm">No modules yet — upload one</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {modules.map(m => (
                        <div key={m.id}
                             className="flex items-center justify-between px-4 py-3.5 bg-stone-50 border border-stone-100 rounded-xl hover:border-stone-200 transition-colors">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-stone-800 truncate">{m.title}</p>
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                                        m.tier === 3 ? 'bg-stone-800 text-stone-100' :
                                        m.tier === 2 ? 'bg-stone-200 text-stone-600' :
                                        'bg-stone-100 text-stone-500'
                                    }`}>T{m.tier}</span>
                                </div>
                                <p className="text-xs text-stone-400 mt-0.5 capitalize">
                                    {m.topic} · {m.chunk_count} chunks · {(m.compressed_size / 1024).toFixed(1)} KB
                                    {m.filename && <span style={{ fontFamily: "'DM Mono', monospace" }}> · {m.filename}</span>}
                                </p>
                            </div>

                            <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                                <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-xs text-stone-300">#{m.id}</span>

                                {confirmDelete === m.id ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-stone-500">Delete?</span>
                                        <button
                                            onClick={() => handleDelete(m.id)}
                                            disabled={deleting === m.id}
                                            className="px-2.5 py-1 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-40 transition-colors">
                                            {deleting === m.id ? '…' : 'Yes'}
                                        </button>
                                        <button
                                            onClick={() => setConfirmDelete(null)}
                                            className="px-2.5 py-1 bg-stone-100 text-stone-600 text-xs font-medium rounded-lg hover:bg-stone-200 transition-colors">
                                            No
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setConfirmDelete(m.id)}
                                        className="text-stone-300 hover:text-red-400 transition-colors p-1">
                                        <TrashIcon />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Upload Tab ───────────────────────────────────────────────────────────────

function UploadTab({ adminKey, onUploaded }: { adminKey: string; onUploaded: () => void }) {
    const [title, setTitle] = useState('');
    const [topic, setTopic] = useState('');
    const [tier, setTier] = useState<1 | 2 | 3>(1);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState<{ moduleId: number; title: string } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    async function handleUpload(e: Event) {
        e.preventDefault();
        if (!file) { setError('Select a file first'); return; }
        if (!title.trim()) { setError('Title is required'); return; }
        if (!topic.trim()) { setError('Topic is required'); return; }

        setUploading(true);
        setError('');
        setSuccess(null);

        try {
            const data = await adminUploadModule(adminKey, file, title.trim(), topic.trim(), tier);
            setSuccess({ moduleId: data.module_id, title: title.trim() });
            // Reset form
            setTitle(''); setTopic(''); setTier(1); setFile(null);
            if (fileRef.current) fileRef.current.value = '';
        } catch (e: any) {
            setError(e.message);
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="p-6 max-w-lg">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-6">Upload new module</p>

            {error && <ErrorBanner message={error} className="mb-4" />}

            {success && (
                <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between">
                    <p className="text-sm text-emerald-700">
                        <span className="font-medium">{success.title}</span> uploaded as module #{success.moduleId}
                    </p>
                    <button onClick={onUploaded} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium transition-colors ml-3">
                        View →
                    </button>
                </div>
            )}

            <form onSubmit={handleUpload} className="space-y-4">
                {/* File picker */}
                <div>
                    <label className={LABEL_CLASS}>File</label>
                    <input ref={fileRef} type="file" className="hidden"
                           onInput={(e) => setFile((e.target as HTMLInputElement).files?.[0] ?? null)} />
                    <button type="button" onClick={() => fileRef.current?.click()}
                            className={`w-full px-4 py-3 border-2 border-dashed rounded-xl text-sm transition-colors ${
                                file ? 'border-stone-300 bg-stone-50 text-stone-700' : 'border-stone-200 text-stone-400 hover:border-stone-300 hover:bg-stone-50'
                            }`}>
                        {file ? (
                            <span className="flex items-center justify-center gap-2">
                                <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-xs">{file.name}</span>
                                <span className="text-stone-300">·</span>
                                <span className="text-xs text-stone-400">{(file.size / 1024).toFixed(1)} KB</span>
                            </span>
                        ) : 'Click to select file'}
                    </button>
                </div>

                <div>
                    <label className={LABEL_CLASS}>Title</label>
                    <input type="text" value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
                           className={INPUT_CLASS} placeholder="e.g. Introduction to Algebra" />
                </div>

                <div>
                    <label className={LABEL_CLASS}>Topic</label>
                    <input type="text" value={topic} onInput={(e) => setTopic((e.target as HTMLInputElement).value)}
                           className={INPUT_CLASS} placeholder="e.g. algebra, geometry, physics" />
                </div>

                <div>
                    <label className={LABEL_CLASS}>Tier</label>
                    <div className="flex gap-2">
                        {([1, 2, 3] as const).map(t => (
                            <button type="button" key={t} onClick={() => setTier(t)}
                                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                                        tier === t
                                            ? 'bg-stone-900 text-white border-stone-900'
                                            : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
                                    }`}>
                                {t === 1 ? 'Beginner' : t === 2 ? 'Intermediate' : 'Advanced'}
                            </button>
                        ))}
                    </div>
                </div>

                <button type="submit" disabled={uploading || !file}
                        className="w-full py-3 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                    {uploading && <SpinnerIcon />}
                    {uploading ? 'Uploading & processing…' : 'Upload module'}
                </button>
            </form>

            <div className="mt-4 p-3.5 bg-stone-50 rounded-lg border border-stone-100">
                <p className="text-xs text-stone-400 leading-relaxed">
                    Files are brotli-compressed, chunked into {4}KB blocks, and added to the PIR catalog immediately.
                    Supported: PDF, images, and any binary format.
                </p>
            </div>
        </div>
    );
}

// ─── Quiz Editor Tab ──────────────────────────────────────────────────────────

function QuizTab({ adminKey }: { adminKey: string }) {
    const [modules, setModules] = useState<Module[]>([]);
    const [selectedModule, setSelectedModule] = useState<Module | null>(null);
    const [existingQuestions, setExistingQuestions] = useState<any[]>([]);
    const [questions, setQuestions] = useState<Question[]>(Array.from({ length: 5 }, EMPTY_QUESTION));
    const [saving, setSaving] = useState(false);
    const [saveResults, setSaveResults] = useState<('idle' | 'ok' | 'err')[]>(Array(5).fill('idle'));
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        adminListModules(adminKey)
            .then(d => setModules(d.modules || []))
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!selectedModule) return;
        fetchQuiz(selectedModule.id)
            .then(d => setExistingQuestions(d.questions || []))
            .catch(() => {});
    }, [selectedModule]);

    function updateQuestion(i: number, field: keyof Question, value: any) {
        setQuestions(prev => {
            const next = [...prev];
            next[i] = { ...next[i], [field]: value };
            return next;
        });
    }

    function updateOption(qi: number, oi: number, value: string) {
        setQuestions(prev => {
            const next = [...prev];
            const opts = [...next[qi].options] as [string, string, string, string];
            opts[oi] = value;
            next[qi] = { ...next[qi], options: opts };
            return next;
        });
    }

    async function handleSave() {
        if (!selectedModule) return;
        setSaving(true);
        setDone(false);
        setError('');
        const results: ('idle' | 'ok' | 'err')[] = Array(5).fill('idle');

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.question.trim() || q.options.some(o => !o.trim())) continue;
            try {
                await adminAddQuizQuestion(adminKey, selectedModule.id, q.question, q.options, q.correct);
                results[i] = 'ok';
            } catch {
                results[i] = 'err';
            }
            setSaveResults([...results]);
        }

        setSaving(false);
        setDone(true);
        fetchQuiz(selectedModule.id).then(d => setExistingQuestions(d.questions || []));
    }

    async function handleDeleteExisting(questionId: number) {
        try {
            await adminDeleteQuizQuestion(adminKey, questionId);
            setExistingQuestions(prev => prev.filter((q: any) => q.id !== questionId));
        } catch (e: any) {
            setError(e.message);
        }
    }

    // Module picker
    if (!selectedModule) {
        return (
            <div className="p-6">
                <p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-4">Select module to edit quiz</p>
                {error && <ErrorBanner message={error} className="mb-4" />}

                {modules.length === 0 ? (
                    <p className="text-sm text-stone-400 text-center py-8">No modules found. Upload a module first.</p>
                ) : (
                    <div className="space-y-2">
                        {modules.map(m => (
                            <button key={m.id} onClick={() => setSelectedModule(m)}
                                    className="w-full text-left px-4 py-3.5 bg-stone-50 border border-stone-100 rounded-xl hover:border-stone-300 hover:bg-white transition-all">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-stone-800">{m.title}</p>
                                        <p className="text-xs text-stone-400 mt-0.5 capitalize">{m.topic} · Tier {m.tier}</p>
                                    </div>
                                    <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-xs text-stone-300">#{m.id}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Question editor
    return (
        <div className="flex flex-col h-full">
            {/* Sub-header */}
            <div className="px-6 py-3 border-b border-stone-100 flex items-center gap-2">
                <button onClick={() => { setSelectedModule(null); setDone(false); setSaveResults(Array(5).fill('idle')); }}
                        className="text-xs text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    All modules
                </button>
                <span className="text-stone-200">/</span>
                <span className="text-sm font-medium text-stone-700">{selectedModule.title}</span>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-8">
                {error && <ErrorBanner message={error} />}

                {/* Existing questions */}
                {existingQuestions.length > 0 && (
                    <div>
                        <p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-3">
                            Existing ({existingQuestions.length})
                        </p>
                        <div className="space-y-2">
                            {existingQuestions.map((q: any) => (
                                <div key={q.id} className="flex items-start justify-between px-4 py-3 bg-stone-50 rounded-xl border border-stone-100">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-stone-700 truncate">{q.question}</p>
                                        <p className="text-xs text-stone-400 mt-0.5">
                                            correct: <span className="text-emerald-600">{q.options[q.correct]}</span>
                                        </p>
                                    </div>
                                    <button onClick={() => handleDeleteExisting(q.id)}
                                            className="ml-3 text-stone-300 hover:text-red-400 transition-colors flex-shrink-0">
                                        <XIcon size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* New questions */}
                <div>
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-4">Add up to 5 questions</p>
                    <div className="space-y-6">
                        {questions.map((q, i) => (
                            <div key={i} className="bg-stone-50 rounded-2xl border border-stone-100 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <span style={{ fontFamily: "'DM Mono', monospace" }}
                                          className="w-6 h-6 rounded-md bg-stone-200 text-stone-600 text-xs flex items-center justify-center font-medium">
                                        {i + 1}
                                    </span>
                                    {saveResults[i] === 'ok' && <span className="text-xs text-emerald-500 font-medium">✓ Saved</span>}
                                    {saveResults[i] === 'err' && <span className="text-xs text-red-400 font-medium">✗ Failed</span>}
                                </div>

                                <div className="mb-4">
                                    <label className={LABEL_CLASS}>Question</label>
                                    <input type="text" value={q.question}
                                           onInput={(e) => updateQuestion(i, 'question', (e.target as HTMLInputElement).value)}
                                           className={INPUT_CLASS} placeholder="Type your question here…" />
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    {q.options.map((opt, oi) => (
                                        <div key={oi} className="flex items-center gap-2">
                                            <button type="button" onClick={() => updateQuestion(i, 'correct', oi)}
                                                    className={`w-6 h-6 rounded-full border-2 flex-shrink-0 transition-colors ${
                                                        q.correct === oi
                                                            ? 'border-emerald-500 bg-emerald-500'
                                                            : 'border-stone-200 hover:border-stone-400'
                                                    }`}>
                                                {q.correct === oi && (
                                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="mx-auto">
                                                        <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                    </svg>
                                                )}
                                            </button>
                                            <input type="text" value={opt}
                                                   onInput={(e) => updateOption(i, oi, (e.target as HTMLInputElement).value)}
                                                   className={`${INPUT_CLASS} ${q.correct === oi ? 'border-emerald-200 bg-emerald-50' : ''}`}
                                                   placeholder={`Option ${String.fromCharCode(65 + oi)}`} />
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-stone-400">Click a circle to mark the correct answer</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="border-t border-stone-100 px-6 py-4 flex items-center justify-between bg-white">
                <p className="text-xs text-stone-400">
                    {done
                        ? `${saveResults.filter(r => r === 'ok').length} question(s) saved`
                        : 'Fill all fields for each question you want to save'}
                </p>
                <button onClick={handleSave} disabled={saving}
                        className="px-5 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
                    {saving && <SpinnerIcon />}
                    {saving ? 'Saving…' : done ? 'Save again' : 'Save all questions'}
                </button>
            </div>
        </div>
    );
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: any; onClose: () => void }) {
    return (
        <div style={{ fontFamily: "'DM Sans', sans-serif" }}
             className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <style>{FONTS}</style>
            {children}
        </div>
    );
}

function ModalHeader({ title, sub, onClose }: { title: string; sub: string; onClose: () => void }) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <h2 className="text-base font-medium text-stone-900">{title}</h2>
                <p className="text-xs text-stone-400 mt-0.5">{sub}</p>
            </div>
            <button onClick={onClose} className="text-stone-300 hover:text-stone-500 transition-colors">
                <XIcon />
            </button>
        </div>
    );
}

function ErrorBanner({ message, className = '' }: { message: string; className?: string }) {
    return (
        <div className={`px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 ${className}`}>
            {message}
        </div>
    );
}

function XIcon({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 4h10M5 4V2.5h4V4M6 6.5v4M8 6.5v4M3 4l.7 7.5a1 1 0 001 .5h4.6a1 1 0 001-.5L11 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    );
}

function SpinnerIcon() {
    return (
        <svg className="animate-spin" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v2M6 9v2M1 6h2M9 6h2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
    );
}