import { useState } from 'preact/hooks';
import { markPlacementDone, unlockModules, seedFirstModule } from '../lib/idb-store';

interface PlacementQuestion {
    id: number;
    module_id: number;
    question: string;
    options: string[];
    correct: number;
}

interface PlacementQuizProps {
    profileId: string;
    questions: PlacementQuestion[];
    /** Ordered catalog modules — needed to always unlock module[0] */
    catalog: any[];
    onComplete: () => void;
}

export function PlacementQuiz({ profileId, questions, catalog, onComplete }: PlacementQuizProps) {
    const [current, setCurrent]     = useState(0);
    const [selected, setSelected]   = useState<number | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [answers, setAnswers]     = useState<{ moduleId: number; correct: boolean }[]>([]);
    const [saving, setSaving]       = useState(false);
    const [results, setResults]     = useState<{ unlocked: number[]; total: number; mastered: number } | null>(null);

    const q       = questions[current];
    const isLast  = current === questions.length - 1;
    const total   = questions.length;

    function confirm() {
        if (selected === null) return;
        setConfirmed(true);
    }

    async function next() {
        if (selected === null) return;

        const newAnswers = [...answers, { moduleId: q.module_id, correct: selected === q.correct }];

        if (!isLast) {
            setAnswers(newAnswers);
            setCurrent(c => c + 1);
            setSelected(null);
            setConfirmed(false);
            return;
        }

        // Last question — compute results and persist unlocks
        setSaving(true);
        try {
            // Group answers by module_id, count correct per module
            const perModule: Record<number, { correct: number; total: number }> = {};
            for (const a of newAnswers) {
                if (!perModule[a.moduleId]) perModule[a.moduleId] = { correct: 0, total: 0 };
                perModule[a.moduleId].total   += 1;
                perModule[a.moduleId].correct += a.correct ? 1 : 0;
            }

            // Unlock modules the user did NOT get 100% on — those need study.
            // Modules with a perfect score are already mastered and stay locked
            // (they can be unlocked later by passing the previous module's quiz).
            const toUnlock: string[] = [];
            for (const [moduleId, score] of Object.entries(perModule)) {
                if (score.total === 0 || score.correct < score.total) {
                    toUnlock.push(String(moduleId));
                }
            }

            // Modules with no placement questions couldn't be tested — unlock them too
            const testedModuleIds = new Set(Object.keys(perModule));
            for (const m of catalog) {
                const id = String(m.id);
                if (!testedModuleIds.has(id) && !toUnlock.includes(id)) {
                    toUnlock.push(id);
                }
            }

            // Count modules that were tested and scored 100% (already mastered)
            const masteredCount = Object.values(perModule).filter(
                s => s.total > 0 && s.correct === s.total
            ).length;

            // Module 1 (first in catalog) is always unlocked regardless
            if (catalog.length > 0) {
                const firstId = String(catalog[0].id);
                await seedFirstModule(profileId, firstId);
                if (!toUnlock.includes(firstId)) toUnlock.push(firstId);
            }

            if (toUnlock.length > 0) {
                await unlockModules(profileId, toUnlock);
            }

            await markPlacementDone(profileId);

            setResults({ unlocked: toUnlock.map(Number), total: catalog.length, mastered: masteredCount });
        } finally {
            setSaving(false);
        }
    }

    // ── Results screen ──
    if (results) {
        const unlockedCount = results.unlocked.length;
        const masteredCount = results.total - results.unlocked.filter(id =>
            // modules that were tested are in results.total; unlocked ones need study
            // mastered = tested modules NOT in the unlock list
            true
        ).length;
        // Simpler: mastered = catalog modules that were tested and scored 100%
        // results.mastered is passed through from the compute step
        const toStudyCount = unlockedCount;
        const alreadyKnowCount = results.mastered ?? 0;

        return (
            <div style={{ fontFamily: "'DM Sans', sans-serif" }}
                 className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
                <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap');`}</style>
                <div className="w-full max-w-sm text-center">

                    <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center text-2xl mx-auto mb-6">
                        ✓
                    </div>

                    <h2 className="text-xl font-medium text-stone-900 mb-1">Placement complete</h2>
                    <p className="text-sm text-stone-400 mb-8">
                        Your library has been personalised based on what you already know.
                    </p>

                    {/* Score card */}
                    <div style={{ fontFamily: "'DM Mono', monospace" }}
                         className="grid grid-cols-2 gap-3 mb-8">
                        <div className="bg-stone-50 border border-stone-100 rounded-xl p-4">
                            <div className="text-2xl font-light text-emerald-600">{toStudyCount}</div>
                            <div className="text-xs text-stone-400 mt-1">modules to study</div>
                        </div>
                        <div className="bg-stone-50 border border-stone-100 rounded-xl p-4">
                            <div className="text-2xl font-light text-stone-900">{alreadyKnowCount}</div>
                            <div className="text-xs text-stone-400 mt-1">already mastered</div>
                        </div>
                    </div>

                    {alreadyKnowCount > 0 && (
                        <div className="mb-6 px-4 py-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-left">
                            <p className="text-xs font-medium text-emerald-500 uppercase tracking-widest mb-1">
                                Already mastered
                            </p>
                            <p className="text-sm text-emerald-800">
                                {alreadyKnowCount} module{alreadyKnowCount !== 1 ? 's were' : ' was'} skipped
                                because you scored 100% on their questions.
                            </p>
                        </div>
                    )}

                    {alreadyKnowCount === 0 && (
                        <div className="mb-6 px-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl text-left">
                            <p className="text-sm text-stone-500">
                                All modules are unlocked — work through them at your own pace.
                            </p>
                        </div>
                    )}

                    <button
                        onClick={onComplete}
                        className="w-full py-3.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-700 transition-colors"
                    >
                        Enter library →
                    </button>
                </div>
            </div>
        );
    }

    // ── Question screen ──
    return (
        <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="min-h-screen bg-stone-50">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap');`}</style>

            {/* Header */}
            <div className="bg-white border-b border-stone-100 px-6 py-3.5 flex items-center justify-between">
                <div>
                    <span className="text-sm font-medium text-stone-700">Placement test</span>
                    <p style={{ fontFamily: "'DM Mono', monospace" }}
                       className="text-xs text-stone-300 mt-0.5">
                        helps us unlock the right modules for you
                    </p>
                </div>
                {/* Progress dots */}
                <div className="flex items-center gap-1">
                    {questions.map((_, i) => (
                        <div key={i} className={`rounded-full transition-all ${
                            i < answers.length
                                ? answers[i].correct
                                    ? 'w-2 h-2 bg-emerald-400'
                                    : 'w-2 h-2 bg-red-300'
                                : i === current
                                    ? 'w-2 h-2 bg-stone-400'
                                    : 'w-1.5 h-1.5 bg-stone-200'
                        }`} />
                    ))}
                </div>
                <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-xs text-stone-400">
                    {current + 1}/{total}
                </span>
            </div>

            {/* Question */}
            <div className="max-w-lg mx-auto px-6 py-12">
                <p className="text-lg font-medium text-stone-900 leading-relaxed mb-8">
                    {q.question}
                </p>

                <div className="space-y-2.5 mb-8">
                    {q.options.map((opt, i) => {
                        let style = 'border-stone-200 bg-white text-stone-700 hover:border-stone-300';
                        if (confirmed) {
                            if (i === q.correct)                   style = 'border-emerald-200 bg-emerald-50 text-emerald-800';
                            else if (i === selected && i !== q.correct) style = 'border-red-200 bg-red-50 text-red-700';
                            else                                   style = 'border-stone-100 bg-stone-50 text-stone-400';
                        } else if (i === selected) {
                            style = 'border-stone-400 bg-stone-50 text-stone-900';
                        }

                        return (
                            <button key={i} onClick={() => !confirmed && setSelected(i)}
                                    disabled={confirmed}
                                    className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm transition-all ${style}`}>
                                <span style={{ fontFamily: "'DM Mono', monospace" }}
                                      className="text-xs text-stone-300 mr-3">
                                    {String.fromCharCode(65 + i)}
                                </span>
                                {opt}
                            </button>
                        );
                    })}
                </div>

                {!confirmed ? (
                    <button onClick={confirm} disabled={selected === null}
                            className="w-full py-3.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
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
                        <button onClick={next} disabled={saving}
                                className="w-full py-3.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-700 disabled:opacity-40 transition-colors">
                            {saving ? 'Saving…' : isLast ? 'See results' : 'Next →'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}