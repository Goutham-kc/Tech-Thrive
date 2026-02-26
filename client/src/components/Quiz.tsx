import { useState } from 'preact/hooks';
import { saveProgress, PASS_THRESHOLD } from '../lib/idb-store';
import { fetchCatalog } from '../lib/api';

interface QuizQuestion {
    id?: number;
    question: string;
    options: string[];
    correct: number;
}

interface QuizProps {
    moduleId: string;
    topic: string;
    tier: number;
    questions: QuizQuestion[];
    onComplete: (correct: number, total: number, passed: boolean, unlockedNextModuleId: string | null) => void;
    onBack: () => void;
}

const TIER_LABELS: Record<number, string> = {
    1: 'Beginner',
    2: 'Intermediate',
    3: 'Advanced',
};

export function Quiz({ moduleId, topic, tier, questions, onComplete, onBack }: QuizProps) {
    const [current, setCurrent] = useState(0);
    const [selected, setSelected] = useState<number | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [answers, setAnswers] = useState<boolean[]>([]);
    const [finished, setFinished] = useState(false);
    const [saving, setSaving] = useState(false);
    const [finalScore, setFinalScore] = useState(0);
    const [unlockedNextModuleId, setUnlockedNextModuleId] = useState<string | null>(null);

    const q = questions[current];
    const isLast = current === questions.length - 1;
    const passScore = Math.ceil(questions.length * PASS_THRESHOLD);
    const passed = finalScore >= passScore;

    function confirm() {
        if (selected === null) return;
        setConfirmed(true);
        setAnswers(prev => [...prev, selected === q.correct]);
    }

    async function next() {
        if (selected === null) return;

        if (isLast) {
            const allAnswers = [...answers, selected === q.correct];
            const correctCount = allAnswers.filter(Boolean).length;
            setSaving(true);

            try {
                // Fetch the ordered catalog so saveProgress can find the next module
                const catalogData = await fetchCatalog();
                const orderedCatalog: any[] = catalogData.modules ?? [];

                const result = await saveProgress(
                    moduleId,
                    correctCount,
                    questions.length,
                    topic,
                    tier,
                    orderedCatalog,
                );

                setFinalScore(correctCount);
                setUnlockedNextModuleId(result.unlockedNextModuleId);
                setFinished(true);
                onComplete(correctCount, questions.length, result.passed, result.unlockedNextModuleId);
            } finally {
                setSaving(false);
            }
        } else {
            setCurrent(c => c + 1);
            setSelected(null);
            setConfirmed(false);
        }
    }

    /* ── Results screen ── */
    if (finished) {
        const pct = Math.round((finalScore / questions.length) * 100);
        const tierLabel = TIER_LABELS[tier] ?? `Tier ${tier}`;

        return (
            <div
                style={{ fontFamily: "'DM Sans', sans-serif" }}
                className="min-h-screen bg-stone-50 flex items-center justify-center p-6"
            >
                <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap');`}</style>
                <div className="w-full max-w-sm text-center">

                    {/* Result icon */}
                    <div className={`w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center text-2xl ${
                        passed ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'
                    }`}>
                        {passed ? '✓' : '↻'}
                    </div>

                    <h2 className="text-xl font-medium text-stone-900 mb-1">
                        {passed ? 'Well done' : 'Keep practicing'}
                    </h2>

                    {/* Score */}
                    <div
                        style={{ fontFamily: "'DM Mono', monospace" }}
                        className="text-4xl font-light text-stone-900 my-6"
                    >
                        {pct}<span className="text-stone-300">%</span>
                        <div className="text-base mt-1 text-stone-400">
                            {finalScore}<span className="text-stone-300">/{questions.length}</span>
                        </div>
                    </div>

                    {/* Pass threshold hint */}
                    <p className="text-xs text-stone-400 mb-6">
                        {Math.round(PASS_THRESHOLD * 100)}% required to advance
                        {!passed && ` — you need ${passScore - finalScore} more correct`}
                    </p>

                    {/* Unlock banner */}
                    {passed && unlockedNextModuleId && (
                        <div className="mb-6 px-4 py-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-left">
                            <p className="text-xs font-medium text-emerald-500 uppercase tracking-widest mb-1">
                                Next module unlocked
                            </p>
                            <p className="text-sm text-emerald-800">
                                Your library has expanded. The next module is now available
                                — retrieved privately via PIR, so the server never knew which one you passed.
                            </p>
                        </div>
                    )}

                    {passed && !unlockedNextModuleId && (
                        <div className="mb-6 px-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl">
                            <p className="text-sm text-stone-500">
                                You've completed all available modules — well done.
                            </p>
                        </div>
                    )}

                    {!passed && (
                        <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-100 rounded-2xl text-left">
                            <p className="text-xs font-medium text-amber-500 uppercase tracking-widest mb-1">
                                Module added to review
                            </p>
                            <p className="text-sm text-amber-800">
                                Review the material and try again. Your progress is saved locally — the server never sees your score.
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={onBack}
                            className="flex-1 py-3 border border-stone-200 text-stone-600 text-sm font-medium rounded-xl hover:border-stone-300 transition-colors"
                        >
                            {passed ? 'Back to library' : 'Back to module'}
                        </button>
                        {!passed && (
                            <button
                                onClick={() => {
                                    setCurrent(0);
                                    setSelected(null);
                                    setConfirmed(false);
                                    setAnswers([]);
                                    setFinished(false);
                                    setFinalScore(0);
                                    setUnlockedNextModuleId(null);
                                }}
                                className="flex-1 py-3 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-700 transition-colors"
                            >
                                Try again
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    /* ── Question screen ── */
    return (
        <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="min-h-screen bg-stone-50">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap');`}</style>

            {/* Top bar */}
            <div className="bg-white border-b border-stone-100 px-6 py-3.5 flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors"
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Back
                </button>

                {/* Progress dots */}
                <div className="flex items-center gap-1">
                    {questions.map((_, i) => (
                        <div
                            key={i}
                            className={`rounded-full transition-all ${
                                i < answers.length
                                    ? answers[i]
                                        ? 'w-2 h-2 bg-emerald-400'
                                        : 'w-2 h-2 bg-red-300'
                                    : i === current
                                        ? 'w-2 h-2 bg-stone-400'
                                        : 'w-1.5 h-1.5 bg-stone-200'
                            }`}
                        />
                    ))}
                </div>

                <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-xs text-stone-400">
                    {current + 1}/{questions.length}
                </span>
            </div>

            {/* Question */}
            <div className="max-w-lg mx-auto px-6 py-12">
                <p className="text-lg font-medium text-stone-900 leading-relaxed mb-8">{q.question}</p>

                {/* Options */}
                <div className="space-y-2.5 mb-8">
                    {q.options.map((opt, i) => {
                        let style = 'border-stone-200 bg-white text-stone-700 hover:border-stone-300';
                        if (confirmed) {
                            if (i === q.correct) style = 'border-emerald-200 bg-emerald-50 text-emerald-800';
                            else if (i === selected && i !== q.correct) style = 'border-red-200 bg-red-50 text-red-700';
                            else style = 'border-stone-100 bg-stone-50 text-stone-400';
                        } else if (i === selected) {
                            style = 'border-stone-400 bg-stone-50 text-stone-900';
                        }

                        return (
                            <button
                                key={i}
                                onClick={() => !confirmed && setSelected(i)}
                                disabled={confirmed}
                                className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm transition-all ${style}`}
                            >
                                <span
                                    style={{ fontFamily: "'DM Mono', monospace" }}
                                    className="text-xs text-stone-300 mr-3"
                                >
                                    {String.fromCharCode(65 + i)}
                                </span>
                                {opt}
                            </button>
                        );
                    })}
                </div>

                {/* Action button */}
                {!confirmed ? (
                    <button
                        onClick={confirm}
                        disabled={selected === null}
                        className="w-full py-3.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        Check answer
                    </button>
                ) : (
                    <div className="space-y-3">
                        <div className={`px-4 py-3 rounded-xl text-sm ${
                            selected === q.correct
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                            {selected === q.correct
                                ? 'Correct'
                                : `Correct answer: ${q.options[q.correct]}`}
                        </div>
                        <button
                            onClick={next}
                            disabled={saving}
                            className="w-full py-3.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-700 disabled:opacity-40 transition-colors"
                        >
                            {saving ? 'Saving…' : isLast ? 'See results' : 'Next →'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}