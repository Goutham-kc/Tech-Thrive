import { useState, useEffect, useRef } from 'preact/hooks';
import { getStorageStats, getWeakModules, getAllProgress } from '../lib/idb-store';
import { useConnection } from '../hooks/useConnection';
import type { Profile, StorageStats, WeakModule, Progress } from '../types';
import { subscribeNetEvent, getSessionTotals } from '../lib/events';

interface DemoPanelProps {
    profile: Profile;
    catalog?: any[];
    onClose: () => void;
}

type Tab = 'privacy' | 'bandwidth' | 'learning';

interface NetEntry {
    time:       string;
    url:        string;
    reqBytes:   number;
    resBytes:   number;
    totalBytes: number;
    method:     string;
    type:       'PIR' | 'Catalog' | 'Auth' | 'Quiz' | 'Other';
    status:     number;
}

function fmt(b: number): string {
    if (b === 0)           return '0 B';
    if (b < 1024)          return `${b} B`;
    if (b < 1024 * 1024)   return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

export function DemoPanel({ profile, catalog = [], onClose }: DemoPanelProps) {
    const [stats,       setStats]       = useState<StorageStats | null>(null);
    const [weakModules, setWeakModules] = useState<WeakModule[]>([]);
    const [progress,    setProgress]    = useState<Progress[]>([]);
    const [netLog,      setNetLog]      = useState<NetEntry[]>([]);
    const [activeTab,   setActiveTab]   = useState<Tab>('privacy');
    // Session totals — re-read on every new event so cards stay current
    const [totals, setTotals] = useState(() => getSessionTotals());
    const connection = useConnection();

    useEffect(() => {
        // Poll IDB every second for live learning / storage stats
        const interval = setInterval(async () => {
            setStats(await getStorageStats());
            setWeakModules(await getWeakModules());
            setProgress(await getAllProgress());
        }, 1000);

        // Subscribe to the event bus — captures every instrumented API call
        const unsubscribe = subscribeNetEvent((event) => {
            // Refresh totals snapshot (accumulated in module scope, never reset)
            setTotals({ ...getSessionTotals() });

            setNetLog(prev => [{
                time:       new Date(event.timestamp).toLocaleTimeString(),
                url:        event.url.length > 44 ? event.url.slice(0, 44) + '…' : event.url,
                reqBytes:   event.reqBytes,
                resBytes:   event.resBytes,
                totalBytes: event.reqBytes + event.resBytes,
                method:     event.method,
                type:       event.type,
                status:     event.status,
            }, ...prev].slice(0, 50));
        });

        return () => {
            clearInterval(interval);
            unsubscribe();
        };
    }, []);

    // ── Derived values ────────────────────────────────────────────────────

    const moduleTitle = (id: string) => {
        const m = catalog.find(m => String(m.id) === String(id));
        return m?.title ?? `Module ${id}`;
    };

    // Learning aggregates
    const total    = progress.length;
    const passed   = progress.filter(p => p.passed).length;
    const accuracy = total
    ? Math.min(100, Math.round(
        (progress.reduce((s, p) => s + p.correct, 0) /
         progress.reduce((s, p) => s + p.total,   0)) * 100
      ))
    : 0;    

    // Bandwidth — use session totals for cards (survive panel reopen)
    const sessionReqB  = totals.reqBytes;
    const sessionResB  = totals.resBytes;
    const pirBucket    = totals.byType['PIR']     ?? { reqBytes: 0, resBytes: 0, count: 0 };
    const catalogBucket= totals.byType['Catalog'] ?? { reqBytes: 0, resBytes: 0, count: 0 };
    const authBucket   = totals.byType['Auth']    ?? { reqBytes: 0, resBytes: 0, count: 0 };
    const quizBucket   = totals.byType['Quiz']    ?? { reqBytes: 0, resBytes: 0, count: 0 };
    const pirResB      = pirBucket.resBytes;
    const nonPirResB   = sessionResB - pirResB;
    const totalRequests= Object.values(totals.byType).reduce((s, b) => s + (b?.count ?? 0), 0);

    const typeColor: Record<string, string> = {
        PIR:     'text-violet-500',
        Catalog: 'text-sky-500',
        Auth:    'text-amber-500',
        Quiz:    'text-emerald-500',
        Other:   'text-stone-400',
    };

    const tabs: { id: Tab; label: string }[] = [
        { id: 'privacy',   label: 'Privacy'   },
        { id: 'bandwidth', label: 'Bandwidth' },
        { id: 'learning',  label: 'Learning'  },
    ];

    return (
        <div style={{ fontFamily: "'DM Sans', sans-serif" }}
             className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap');`}</style>

            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden shadow-xl border border-stone-100">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
                    <div>
                        <h2 className="text-base font-medium text-stone-900">Demo Panel</h2>
                        <p style={{ fontFamily: "'DM Mono', monospace" }}
                           className="text-xs text-stone-400 mt-0.5 font-light">live privacy & bandwidth view</p>
                    </div>
                    <button onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-50 transition-colors">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-6 pt-3 pb-0 border-b border-stone-100">
                    {tabs.map(t => (
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

                <div className="flex-1 overflow-auto p-6">

                    {/* ── Privacy Tab ── */}
                    {activeTab === 'privacy' && (
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                    <span className="text-xs font-medium text-stone-500 uppercase tracking-widest">Device knows</span>
                                </div>
                                <div className="bg-stone-50 rounded-xl p-4 border border-stone-100 space-y-2">
                                    <p className="text-xs font-medium text-stone-500 mb-3">Identity</p>
                                    <Row label="Username"         value={profile.username} mono />
                                    <Row label="Ghost ID"         value={`${profile.ghostID.substring(0, 16)}…`} mono />
                                    <Row label="Weak modules"     value={String(weakModules.length)} />
                                    <Row label="Progress records" value={String(progress.length)} />
                                </div>
                                <div className="bg-stone-50 rounded-xl p-4 border border-stone-100 space-y-2">
                                    <p className="text-xs font-medium text-stone-500 mb-3">Storage</p>
                                    <Row label="Cached modules" value={String(stats?.modules || 0)} />
                                    <Row label="Total size"     value={`${stats?.totalMB || 0} MB`} />
                                    <div className="mt-2 h-1 bg-stone-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-stone-400 rounded-full transition-all"
                                             style={{ width: `${Math.min((stats?.totalMB ? parseFloat(stats.totalMB) / 50 : 0) * 100, 100)}%` }} />
                                    </div>
                                </div>
                                <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                                    <p className="text-xs font-medium text-stone-500 mb-3">Recent requests</p>
                                    {netLog.length === 0
                                        ? <p className="text-xs text-stone-300">No requests yet</p>
                                        : netLog.slice(0, 5).map((d, i) => (
                                            <div key={i} className="flex items-center justify-between py-1.5 border-b border-stone-100 last:border-0">
                                                <span style={{ fontFamily: "'DM Mono', monospace" }}
                                                      className={`text-xs ${typeColor[d.type]}`}>{d.type}</span>
                                                <span style={{ fontFamily: "'DM Mono', monospace" }}
                                                      className="text-xs text-stone-400">↓ {fmt(d.resBytes)}</span>
                                                <span className="text-xs text-stone-300">{d.time}</span>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="w-2 h-2 rounded-full bg-red-400" />
                                    <span className="text-xs font-medium text-stone-500 uppercase tracking-widest">Server sees</span>
                                </div>
                                <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                                    <p className="text-xs font-medium text-stone-500 mb-3">Never</p>
                                    {['Your Ghost ID', 'Your scores', 'Which module you accessed', 'Your identity', 'Your IP'].map(item => (
                                        <div key={item} className="flex items-center justify-between py-1.5">
                                            <span className="text-xs text-stone-600">{item}</span>
                                            <span className="text-xs text-red-400 font-medium">✗</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                                    <p className="text-xs font-medium text-stone-500 mb-3">Always</p>
                                    {['Random vectors (meaningless)', 'Timestamp (irreducible)', 'Session token (single use)'].map(item => (
                                        <div key={item} className="flex items-center justify-between py-1.5">
                                            <span className="text-xs text-stone-600">{item}</span>
                                            <span className="text-xs text-emerald-500 font-medium">✓</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                                    <p className="text-xs font-medium text-stone-500 mb-3">K=3 PIR vectors (sample)</p>
                                    <div style={{ fontFamily: "'DM Mono', monospace" }}
                                         className="text-xs text-stone-500 leading-relaxed bg-white rounded-lg p-3 border border-stone-100">
                                        v₀ = [142, 87, 231, …]<br/>
                                        v₁ = [56, 193, 22, …]<br/>
                                        v₂ = [201, 45, 178, …]
                                    </div>
                                    <p className="text-xs text-stone-400 mt-2">Any 2 vectors reveal nothing about your query</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Bandwidth Tab ── */}
                    {activeTab === 'bandwidth' && (
                        <div className="space-y-6">

                            {/* Summary cards — session totals, survive panel reopen */}
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    {
                                        label: 'Data received',
                                        value: fmt(sessionResB),
                                        sub:   totalRequests === 0
                                            ? 'open a module to populate'
                                            : `${totalRequests} request${totalRequests !== 1 ? 's' : ''} this session`,
                                        color: 'text-stone-900',
                                    },
                                    {
                                        label: 'PIR module data',
                                        value: fmt(pirResB),
                                        sub:   `${pirBucket.count} PIR call${pirBucket.count !== 1 ? 's' : ''} — encrypted chunks`,
                                        color: 'text-violet-600',
                                    },
                                    {
                                        label: 'Metadata sent',
                                        value: fmt(sessionReqB),
                                        sub:   'outgoing vectors + headers',
                                        color: 'text-emerald-600',
                                    },
                                ].map(card => (
                                    <div key={card.label} className="bg-stone-50 rounded-xl p-5 border border-stone-100">
                                        <div style={{ fontFamily: "'DM Mono', monospace" }}
                                             className={`text-2xl font-light ${card.color}`}>{card.value}</div>
                                        <div className="text-xs text-stone-500 mt-1 font-medium">{card.label}</div>
                                        <div className="text-xs text-stone-300 mt-0.5">{card.sub}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Per-type breakdown table */}
                            {totalRequests > 0 && (
                                <div className="bg-stone-50 rounded-xl border border-stone-100 overflow-hidden">
                                    <div className="px-5 py-3.5 border-b border-stone-100">
                                        <p className="text-xs font-medium text-stone-500">Breakdown by request type</p>
                                    </div>
                                    <div className="divide-y divide-stone-100">
                                        {(
                                            [
                                                { type: 'PIR',     bucket: totals.byType['PIR'],     label: 'PIR chunks',    color: 'text-violet-500'  },
                                                { type: 'Catalog', bucket: totals.byType['Catalog'], label: 'Catalog fetch', color: 'text-sky-500'     },
                                                { type: 'Auth',    bucket: totals.byType['Auth'],    label: 'Session auth',  color: 'text-amber-500'   },
                                                { type: 'Quiz',    bucket: totals.byType['Quiz'],    label: 'Quiz fetch',    color: 'text-emerald-500' },
                                                { type: 'Other',   bucket: totals.byType['Other'],   label: 'Admin / other', color: 'text-stone-400'   },
                                            ] as const
                                        )
                                            .filter(row => row.bucket && row.bucket.count > 0)
                                            .map(row => {
                                                const b = row.bucket!;
                                                const pct = sessionResB > 0
                                                    ? Math.round((b.resBytes / sessionResB) * 100)
                                                    : 0;
                                                return (
                                                    <div key={row.type} className="flex items-center px-5 py-3 gap-4">
                                                        <span style={{ fontFamily: "'DM Mono', monospace" }}
                                                              className={`text-xs w-16 font-medium ${row.color}`}>
                                                            {row.type}
                                                        </span>
                                                        <span className="text-xs text-stone-500 w-28 truncate">{row.label}</span>
                                                        <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full transition-all duration-500 ${
                                                                row.type === 'PIR'     ? 'bg-violet-400' :
                                                                row.type === 'Catalog' ? 'bg-sky-300'    :
                                                                row.type === 'Auth'    ? 'bg-amber-300'  :
                                                                row.type === 'Quiz'    ? 'bg-emerald-400':
                                                                'bg-stone-300'
                                                            }`} style={{ width: `${pct}%` }} />
                                                        </div>
                                                        <span style={{ fontFamily: "'DM Mono', monospace" }}
                                                              className="text-xs text-stone-400 w-12 text-right">
                                                            ↑ {fmt(b.reqBytes)}
                                                        </span>
                                                        <span style={{ fontFamily: "'DM Mono', monospace" }}
                                                              className="text-xs text-stone-700 w-14 text-right font-medium">
                                                            ↓ {fmt(b.resBytes)}
                                                        </span>
                                                        <span style={{ fontFamily: "'DM Mono', monospace" }}
                                                              className="text-xs text-stone-400 w-14 text-right">
                                                            {b.count} req{b.count !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}

                            {/* Visual response breakdown bar */}
                            {sessionResB > 0 && (
                                <div className="bg-stone-50 rounded-xl p-5 border border-stone-100">
                                    <p className="text-xs font-medium text-stone-500 mb-3">Response breakdown</p>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="flex-1 h-2.5 bg-stone-200 rounded-full overflow-hidden flex">
                                            <div className="h-full bg-violet-400 transition-all duration-500"
                                                 style={{ width: `${Math.round((pirResB / sessionResB) * 100)}%` }} />
                                            <div className="h-full bg-sky-300 transition-all duration-500"
                                                 style={{ width: `${Math.round(((catalogBucket.resBytes + authBucket.resBytes) / sessionResB) * 100)}%` }} />
                                            <div className="h-full bg-emerald-300 transition-all duration-500"
                                                 style={{ width: `${Math.round((quizBucket.resBytes / sessionResB) * 100)}%` }} />
                                        </div>
                                        <span style={{ fontFamily: "'DM Mono', monospace" }}
                                              className="text-xs text-stone-400">{fmt(sessionResB)}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-violet-400" />
                                            <span className="text-xs text-stone-500">PIR chunks — {fmt(pirResB)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-sky-300" />
                                            <span className="text-xs text-stone-500">Catalog + auth — {fmt(catalogBucket.resBytes + authBucket.resBytes)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-300" />
                                            <span className="text-xs text-stone-500">Quiz — {fmt(quizBucket.resBytes)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Live network log */}
                            <div className="bg-stone-50 rounded-xl border border-stone-100 overflow-hidden">
                                <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between">
                                    <p className="text-xs font-medium text-stone-500">Live network log</p>
                                    <span style={{ fontFamily: "'DM Mono', monospace" }}
                                          className="text-xs text-stone-300">{netLog.length} entries (last 50)</span>
                                </div>
                                <div className="divide-y divide-stone-100">
                                    {netLog.length === 0
                                        ? <p className="text-xs text-stone-300 p-5">
                                            No activity yet — make any request to see it here
                                          </p>
                                        : netLog.map((d, i) => (
                                            <div key={i} className="flex items-center px-5 py-2.5 gap-3">
                                                <span style={{ fontFamily: "'DM Mono', monospace" }}
                                                      className={`text-xs w-14 font-medium ${typeColor[d.type]}`}>
                                                    {d.type}
                                                </span>
                                                <span style={{ fontFamily: "'DM Mono', monospace" }}
                                                      className="text-xs text-stone-500 flex-1 truncate">{d.url}</span>
                                                <span style={{ fontFamily: "'DM Mono', monospace" }}
                                                      className="text-xs text-stone-300 w-16 text-right"
                                                      title="sent">↑ {fmt(d.reqBytes)}</span>
                                                <span style={{ fontFamily: "'DM Mono', monospace" }}
                                                      className="text-xs text-stone-700 w-16 text-right font-medium"
                                                      title="received">↓ {fmt(d.resBytes)}</span>
                                                <span style={{ fontFamily: "'DM Mono', monospace" }}
                                                      className={`text-xs w-8 text-right ${d.status < 300 ? 'text-emerald-500' : 'text-red-400'}`}>
                                                    {d.status}
                                                </span>
                                                <span className="text-xs text-stone-300 w-16 text-right">{d.time}</span>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Learning Tab ── */}
                    {activeTab === 'learning' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-4 gap-4">
                                {[
                                    { label: 'Attempts',  value: total,              color: 'text-stone-900'   },
                                    { label: 'Passed',    value: passed,             color: 'text-emerald-600' },
                                    { label: 'Review',    value: weakModules.length, color: 'text-amber-500'   },
                                    { label: 'Accuracy',  value: `${accuracy}%`,     color: 'text-violet-600'  },
                                ].map(s => (
                                    <div key={s.label} className="bg-stone-50 rounded-xl p-5 border border-stone-100 text-center">
                                        <div style={{ fontFamily: "'DM Mono', monospace" }}
                                             className={`text-2xl font-light ${s.color}`}>{s.value}</div>
                                        <div className="text-xs text-stone-400 mt-1">{s.label}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-stone-50 rounded-xl border border-stone-100 overflow-hidden">
                                <div className="px-5 py-3.5 border-b border-stone-100">
                                    <p className="text-xs font-medium text-stone-500">Recent activity</p>
                                </div>
                                <div className="divide-y divide-stone-100">
                                    {progress.length === 0
                                        ? <p className="text-xs text-stone-300 p-5">No quiz activity yet</p>
                                        : [...progress].reverse().slice(0, 8).map((p, i) => {
                                            const title = moduleTitle(p.moduleId);
                                            const pct   = Math.round((p.correct / p.total) * 100);
                                            return (
                                                <div key={i} className="flex items-center px-5 py-3 gap-4">
                                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                                        p.passed ? 'bg-emerald-400' : 'bg-amber-400'
                                                    }`} />
                                                    <span className="text-xs text-stone-700 font-medium flex-1 truncate">
                                                        {title}
                                                    </span>
                                                    <div className="w-20 h-1.5 bg-stone-200 rounded-full overflow-hidden flex-shrink-0">
                                                        <div className={`h-full rounded-full transition-all ${
                                                            p.passed ? 'bg-emerald-400' : 'bg-amber-400'
                                                        }`} style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <span style={{ fontFamily: "'DM Mono', monospace" }}
                                                          className="text-xs text-stone-400 w-10 text-right flex-shrink-0">
                                                        {p.correct}/{p.total}
                                                    </span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium flex-shrink-0 ${
                                                        p.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                                    }`}>
                                                        {p.passed ? 'pass' : 'fail'}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                            </div>

                            {weakModules.length > 0 && (
                                <div className="bg-amber-50 rounded-xl border border-amber-100 p-5">
                                    <p className="text-xs font-medium text-amber-600 mb-3">Needs review</p>
                                    <div className="space-y-2">
                                        {weakModules.map((w, i) => (
                                            <div key={i} className="flex items-center justify-between">
                                                <span className="text-xs text-stone-700 font-medium">
                                                    {moduleTitle(w.moduleId)}
                                                </span>
                                                <span style={{ fontFamily: "'DM Mono', monospace" }}
                                                      className="text-xs text-stone-400">
                                                    {w.attemptCount} attempt{w.attemptCount !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-stone-100 px-6 py-3 flex justify-between items-center">
                    <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-xs text-stone-300 font-light">
                        {profile.ghostID.substring(0, 16)}…
                    </span>
                    <span className="text-xs text-stone-300">
                        updates every 1s · {connection.online ? 'online' : 'offline'}
                    </span>
                </div>
            </div>
        </div>
    );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-center justify-between py-1">
            <span className="text-xs text-stone-400">{label}</span>
            <span style={mono ? { fontFamily: "'DM Mono', monospace" } : {}}
                  className="text-xs text-stone-600">{value}</span>
        </div>
    );
}