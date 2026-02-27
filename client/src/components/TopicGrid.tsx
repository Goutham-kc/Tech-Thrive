import { useState, useEffect, useCallback } from 'preact/hooks';
import { fetchCatalog } from '../lib/api';
import {
    getUnlockedModuleIds,
    saveCatalog,
    getAllProgress,
    PASS_THRESHOLD,
} from '../lib/idb-store';
import type { Profile } from '../types';

interface TopicGridProps {
    profileId: string;
    onSelectModule: (moduleId: string) => void;
    /** Incremented by parent whenever a quiz is passed so the grid refreshes */
    refreshKey?: number;
}

const TOPIC_ICONS: Record<string, string> = {
    algebra: '∑',
    geometry: '△',
    fractions: '½',
    calculus: '∫',
    statistics: '~',
    physics: 'ϕ',
    chemistry: '⚗',
    biology: '⊕',
    history: '◷',
    english: 'Aa',
    science: '⚛',
    math: '∑',
    language: 'Aa',
    geography: '◉',
};

const TIER_LABELS: Record<number, string> = {
    1: 'Beginner',
    2: 'Intermediate',
    3: 'Advanced',
};

const TIER_COLORS: Record<number, string> = {
    1: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    2: 'bg-sky-50 text-sky-700 border-sky-100',
    3: 'bg-violet-50 text-violet-700 border-violet-100',
};

export function TopicGrid({ profileId, onSelectModule, refreshKey = 0 }: TopicGridProps) {
    const [catalog, setCatalog] = useState<any[]>([]);
    const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState<string>('all');
    const [overallMastery, setOverallMastery] = useState(0);
    const [totalQuizzes, setTotalQuizzes] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            // Always fetch fresh catalog from server — catalog is public, not private.
            // The server learns nothing about the student from this call.
            const data = await fetchCatalog();
            const modules: any[] = data.modules ?? [];

            // Persist catalog locally so ModuleView can use it offline
            await saveCatalog(modules);

            const unlocked = await getUnlockedModuleIds(profileId);

            setCatalog(modules);
            setUnlockedIds(unlocked);

            // Derive mastery and quiz count from real idb progress — no external lib needed
            const allProgress = await getAllProgress();
            const quizCount = allProgress.length;
            const totalAnswered = allProgress.reduce((s, p) => s + (p.total ?? 0), 0);
            const mastery = totalAnswered > 0
                ? Math.min(100, Math.round(
                    (allProgress.reduce((s, p) => s + Math.min(p.correct ?? 0, p.total ?? 0), 0) /
                     totalAnswered) * 100
                  ))
                : 0;
            setOverallMastery(mastery);
            setTotalQuizzes(quizCount);
        } catch (e: any) {
            setError('Could not reach server. Showing offline data.');
            // Fall back to locally cached catalog
            const { getCatalog } = await import('../lib/idb-store');
            const cached = await getCatalog();
            if (Array.isArray(cached)) {
                setCatalog(cached);
                const unlocked = await getUnlockedModuleIds(profileId);
                setUnlockedIds(unlocked);
            }
        } finally {
            setLoading(false);
        }
    }, [refreshKey]);

    useEffect(() => { load(); }, [load]);

    const topics = ['all', ...Array.from(new Set(catalog.map((m: any) => m.topic)))];
    const filtered = filter === 'all' ? catalog : catalog.filter((m: any) => m.topic === filter);

    const unlockedCount = catalog.filter(m => unlockedIds.has(String(m.id))).length;
    const totalCount = catalog.length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div
                    style={{ fontFamily: "'DM Mono', monospace" }}
                    className="text-xs text-stone-300 animate-pulse"
                >
                    syncing catalog…
                </div>
            </div>
        );
    }

    return (
        <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="p-8 max-w-5xl mx-auto">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap');`}</style>

            {/* ── Stats strip ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                {[
                    { value: unlockedCount, label: 'Unlocked', sub: `of ${totalCount}` },
                    { value: totalCount - unlockedCount, label: 'Locked', sub: 'modules' },
                    { value: `${overallMastery}%`, label: 'Mastery', sub: 'overall' },
                    { value: totalQuizzes, label: 'Quizzes', sub: 'taken' },
                ].map((s, i) => (
                    <div key={i} style={{ fontFamily: "'DM Sans', sans-serif" }}
                         className={`rounded-2xl border px-5 py-4 flex flex-col gap-1 ${
                             i === 0 ? 'bg-stone-900 border-stone-900' : 'bg-white border-stone-100'
                         }`}>
                        <span style={{ fontFamily: "'DM Mono', monospace" }}
                              className={`text-2xl font-light ${i === 0 ? 'text-white' : 'text-stone-900'}`}>
                            {s.value}
                        </span>
                        <span className={`text-xs font-medium uppercase tracking-widest ${i === 0 ? 'text-stone-400' : 'text-stone-500'}`}>
                            {s.label}
                        </span>
                        <span style={{ fontFamily: "'DM Mono', monospace" }}
                              className={`text-xs ${i === 0 ? 'text-stone-600' : 'text-stone-300'}`}>
                            {s.sub}
                        </span>
                    </div>
                ))}
            </div>

            {/* Header */}
            <div className="mb-8 flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-medium text-stone-900 tracking-tight">Your library</h1>
                    <p className="text-sm text-stone-400 mt-1">
                        {unlockedCount} of {totalCount} module{totalCount !== 1 ? 's' : ''} unlocked
                        {totalCount > unlockedCount && (
                            <span className="ml-2 text-stone-300">
                                · pass each quiz at {Math.round(PASS_THRESHOLD * 100)}%+ to advance
                            </span>
                        )}
                    </p>
                </div>
                {error && (
                    <span className="text-xs text-amber-500 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg">
                        {error}
                    </span>
                )}
            </div>

            {/* Filter tabs — only show when there are multiple topics */}
            {topics.length > 2 && (
                <div className="flex gap-1 mb-6 flex-wrap">
                    {topics.map(t => (
                        <button
                            key={t}
                            onClick={() => setFilter(t)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                                filter === t
                                    ? 'bg-stone-900 text-white'
                                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            )}

            {/* Empty state */}
            {catalog.length === 0 && (
                <div className="text-center py-24">
                    <p style={{ fontFamily: "'DM Mono', monospace" }} className="text-sm text-stone-300">
                        no modules in catalog yet
                    </p>
                    <p className="text-xs text-stone-300 mt-2">ask an admin to upload content</p>
                </div>
            )}

            {/* Module grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((item: any) => {
                    const isUnlocked = unlockedIds.has(String(item.id));
                    const icon = TOPIC_ICONS[item.topic?.toLowerCase()] ?? item.topic?.[0]?.toUpperCase() ?? '?';
                    const tierLabel = TIER_LABELS[item.tier] ?? `Tier ${item.tier}`;
                    const tierColor = TIER_COLORS[item.tier] ?? 'bg-stone-100 text-stone-500 border-stone-100';

                    return isUnlocked
                        ? (
                            /* ── Unlocked card ── */
                            <button
                                key={item.id}
                                onClick={() => onSelectModule(String(item.id))}
                                className="group text-left bg-white border rounded-2xl p-5 hover:border-stone-300 hover:shadow-sm transition-all duration-150"
                                style={{ borderColor: '#ede9e4' }}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div
                                        style={{ fontFamily: "'DM Mono', monospace" }}
                                        className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-lg text-stone-600 group-hover:bg-stone-100 transition-colors"
                                    >
                                        {icon}
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium border ${tierColor}`}>
                                        {tierLabel}
                                    </span>
                                </div>

                                <h3 className="font-medium text-stone-900 text-sm mb-1 group-hover:text-stone-700">
                                    {item.title}
                                </h3>
                                <p className="text-xs text-stone-400 capitalize mb-3">{item.topic}</p>

                                {/* Chunk dots — visual size indicator */}
                                {item.chunk_count > 0 && (
                                    <div className="flex items-center gap-0.5 mt-2">
                                        {Array.from({ length: Math.min(item.chunk_count, 10) }).map((_, i) => (
                                            <div
                                                key={i}
                                                className="w-1.5 h-1 rounded-full bg-stone-200 group-hover:bg-stone-300 transition-colors"
                                            />
                                        ))}
                                        {item.chunk_count > 10 && (
                                            <span className="text-stone-300 text-xs ml-1">+{item.chunk_count - 10}</span>
                                        )}
                                    </div>
                                )}

                                <div className="mt-4 pt-3 border-t border-stone-50 flex items-center justify-between">
                                    <span
                                        style={{ fontFamily: "'DM Mono', monospace" }}
                                        className="text-xs text-stone-300"
                                    >
                                        {(item.compressed_size / 1024).toFixed(1)} KB
                                    </span>
                                    <span className="text-xs text-stone-400 font-medium group-hover:text-stone-600 transition-colors">
                                        Open →
                                    </span>
                                </div>
                            </button>
                        )
                        : (
                            /* ── Locked card ── */
                            <div
                                key={item.id}
                                className="relative text-left bg-stone-50 border rounded-2xl p-5 cursor-not-allowed select-none"
                                style={{ borderColor: '#ede9e4' }}
                            >
                                {/* Lock overlay */}
                                <div className="absolute inset-0 rounded-2xl flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-1.5 opacity-40">
                                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                            <rect x="3" y="8" width="12" height="8" rx="2" stroke="#78716c" strokeWidth="1.4"/>
                                            <path d="M6 8V5.5a3 3 0 016 0V8" stroke="#78716c" strokeWidth="1.4" strokeLinecap="round"/>
                                        </svg>
                                    </div>
                                </div>

                                {/* Blurred content */}
                                <div className="opacity-25 pointer-events-none select-none">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-stone-200 flex items-center justify-center text-lg text-stone-400">
                                            {icon}
                                        </div>
                                        <span className="text-xs px-2 py-0.5 rounded-md font-medium border bg-stone-100 text-stone-400 border-stone-200">
                                            {tierLabel}
                                        </span>
                                    </div>
                                    <h3 className="font-medium text-stone-400 text-sm mb-1">{item.title}</h3>
                                    <p className="text-xs text-stone-300 capitalize">{item.topic}</p>
                                </div>

                                {/* "Pass to unlock" pill — positioned at bottom */}
                                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center gap-1.5">
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-stone-400">
                                        <rect x="1.5" y="4.5" width="7" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                                        <path d="M3 4.5V3a2 2 0 014 0v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                                    </svg>
                                    <span
                                        style={{ fontFamily: "'DM Mono', monospace" }}
                                        className="text-xs text-stone-400"
                                    >
                                        pass previous quiz to unlock
                                    </span>
                                </div>
                            </div>
                        );
                })}
            </div>

            {filtered.length === 0 && catalog.length > 0 && (
                <div className="text-center py-20 text-stone-300">
                    <p style={{ fontFamily: "'DM Mono', monospace" }} className="text-sm">
                        no modules in this topic
                    </p>
                </div>
            )}
        </div>
    );
}