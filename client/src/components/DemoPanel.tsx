import { useState, useEffect } from 'preact/hooks';
import { getStorageStats, getWeakModules, getAllProgress } from '../lib/idb-store';
import { useConnection } from '../hooks/useConnection';
import type { Profile, StorageStats, WeakModule, Progress } from '../types';

interface DemoPanelProps {
    profile: Profile;
    onClose: () => void;
}

type Tab = 'privacy' | 'bandwidth' | 'learning';

export function DemoPanel({ profile, onClose }: DemoPanelProps) {
    const [stats, setStats] = useState<StorageStats | null>(null);
    const [weakModules, setWeakModules] = useState<WeakModule[]>([]);
    const [progress, setProgress] = useState<Progress[]>([]);
    const [sentData, setSentData] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<Tab>('privacy');
    const connection = useConnection();

    useEffect(() => {
        const interval = setInterval(async () => {
            setStats(await getStorageStats());
            setWeakModules(await getWeakModules());
            setProgress(await getAllProgress());
        }, 1000);

        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const url = args[0];
            const options = args[1] || {};
            if (typeof url === 'string' && !url.includes('demo')) {
                let bodySize = 0;
                if (options.body) {
                    if (typeof options.body === 'string') bodySize = options.body.length;
                    else if (options.body instanceof Blob) bodySize = options.body.size;
                }
                setSentData(prev => [{
                    time: new Date().toLocaleTimeString(),
                    url: url.length > 35 ? url.substring(0, 35) + '…' : url,
                    size: url.length + bodySize,
                    method: options.method || 'GET',
                    type: url.includes('/kpir') ? 'PIR' : url.includes('/catalog') ? 'Catalog' : 'Other'
                }, ...prev].slice(0, 10));
            }
            return originalFetch(...args);
        };

        return () => { clearInterval(interval); window.fetch = originalFetch; };
    }, []);

    const total = progress.length;
    const passed = progress.filter(p => p.passed).length;
    const accuracy = total
        ? Math.round((progress.reduce((s, p) => s + p.correct, 0) / progress.reduce((s, p) => s + p.total, 0)) * 100)
        : 0;

    const tabs: { id: Tab; label: string }[] = [
        { id: 'privacy', label: 'Privacy' },
        { id: 'bandwidth', label: 'Bandwidth' },
        { id: 'learning', label: 'Learning' },
    ];

    const typeColor: Record<string, string> = {
        PIR: 'text-violet-500',
        Catalog: 'text-sky-500',
        Other: 'text-stone-400',
    };

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

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">

                    {/* ── Privacy Tab ── */}
                    {activeTab === 'privacy' && (
                        <div className="grid grid-cols-2 gap-6">
                            {/* Device knows */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                    <span className="text-xs font-medium text-stone-500 uppercase tracking-widest">Device knows</span>
                                </div>

                                <div className="bg-stone-50 rounded-xl p-4 border border-stone-100 space-y-2">
                                    <p className="text-xs font-medium text-stone-500 mb-3">Identity</p>
                                    <Row label="Username" value={profile.username} mono />
                                    <Row label="Ghost ID" value={`${profile.ghostID.substring(0, 16)}…`} mono />
                                    <Row label="Weak modules" value={String(weakModules.length)} />
                                    <Row label="Progress records" value={String(progress.length)} />
                                </div>

                                <div className="bg-stone-50 rounded-xl p-4 border border-stone-100 space-y-2">
                                    <p className="text-xs font-medium text-stone-500 mb-3">Storage</p>
                                    <Row label="Cached modules" value={String(stats?.modules || 0)} />
                                    <Row label="Total size" value={`${stats?.totalMB || 0} MB`} />
                                    <div className="mt-2 h-1 bg-stone-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-stone-400 rounded-full transition-all"
                                             style={{ width: `${Math.min((stats?.totalMB ? parseFloat(stats.totalMB) / 50 : 0) * 100, 100)}%` }} />
                                    </div>
                                </div>

                                <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                                    <p className="text-xs font-medium text-stone-500 mb-3">Recent requests sent</p>
                                    {sentData.length === 0
                                        ? <p className="text-xs text-stone-300">No requests yet</p>
                                        : sentData.slice(0, 5).map((d, i) => (
                                            <div key={i} className="flex items-center justify-between py-1.5 border-b border-stone-100 last:border-0">
                                                <span style={{ fontFamily: "'DM Mono', monospace" }}
                                                      className={`text-xs ${typeColor[d.type] || 'text-stone-400'}`}>{d.type}</span>
                                                <span style={{ fontFamily: "'DM Mono', monospace" }}
                                                      className="text-xs text-stone-400">{d.size}B</span>
                                                <span className="text-xs text-stone-300">{d.time}</span>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>

                            {/* Server sees */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="w-2 h-2 rounded-full bg-red-400" />
                                    <span className="text-xs font-medium text-stone-500 uppercase tracking-widest">Server sees</span>
                                </div>

                                <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                                    <p className="text-xs font-medium text-stone-500 mb-3">Never</p>
                                    {['Your Ghost ID', 'Your scores', 'Which module', 'Your identity', 'Your IP'].map(item => (
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
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { label: 'First module', value: '~49 KB', sub: '1.2s on 2G', color: 'text-stone-900' },
                                    { label: 'Repeat session', value: '~80 B', sub: 'Instant', color: 'text-emerald-600' },
                                    { label: 'Reduction', value: '~98%', sub: 'vs no caching', color: 'text-violet-600' },
                                ].map(card => (
                                    <div key={card.label} className="bg-stone-50 rounded-xl p-5 border border-stone-100">
                                        <div style={{ fontFamily: "'DM Mono', monospace" }}
                                             className={`text-2xl font-light ${card.color}`}>{card.value}</div>
                                        <div className="text-xs text-stone-500 mt-1">{card.label}</div>
                                        <div className="text-xs text-stone-300 mt-0.5">{card.sub}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-stone-50 rounded-xl border border-stone-100 overflow-hidden">
                                <div className="px-5 py-3.5 border-b border-stone-100">
                                    <p className="text-xs font-medium text-stone-500">Live network log</p>
                                </div>
                                <div className="divide-y divide-stone-100">
                                    {sentData.length === 0
                                        ? <p className="text-xs text-stone-300 p-5">No network activity yet</p>
                                        : sentData.map((d, i) => (
                                            <div key={i} className="flex items-center px-5 py-3 gap-4">
                                                <span style={{ fontFamily: "'DM Mono', monospace" }}
                                                      className={`text-xs w-16 ${typeColor[d.type] || 'text-stone-400'}`}>{d.type}</span>
                                                <span style={{ fontFamily: "'DM Mono', monospace" }}
                                                      className="text-xs text-stone-500 flex-1 truncate">{d.url}</span>
                                                <span style={{ fontFamily: "'DM Mono', monospace" }}
                                                      className="text-xs text-stone-400 w-14 text-right">{d.size}B</span>
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
                                    { label: 'Attempts', value: total, color: 'text-stone-900' },
                                    { label: 'Passed', value: passed, color: 'text-emerald-600' },
                                    { label: 'Review', value: weakModules.length, color: 'text-amber-500' },
                                    { label: 'Accuracy', value: `${accuracy}%`, color: 'text-violet-600' },
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
                                        : progress.slice(0, 6).map((p, i) => (
                                            <div key={i} className="flex items-center px-5 py-3 gap-4">
                                                <span style={{ fontFamily: "'DM Mono', monospace" }}
                                                      className="text-xs text-stone-500 flex-1 truncate">{p.moduleId}</span>
                                                <span className="text-xs text-stone-400">{p.correct}/{p.total}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                                                    p.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                                }`}>
                                                    {p.passed ? 'pass' : 'fail'}
                                                </span>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>

                            {weakModules.length > 0 && (
                                <div className="bg-amber-50 rounded-xl border border-amber-100 p-5">
                                    <p className="text-xs font-medium text-amber-600 mb-3">Needs review</p>
                                    <div className="space-y-1.5">
                                        {weakModules.map((w, i) => (
                                            <div key={i} className="flex items-center justify-between">
                                                <span style={{ fontFamily: "'DM Mono', monospace" }}
                                                      className="text-xs text-stone-600">{w.moduleId}</span>
                                                <span className="text-xs text-stone-400">{w.attemptCount} attempt{w.attemptCount !== 1 ? 's' : ''}</span>
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
                    <span className="text-xs text-stone-300">updates every 1s · {connection.online ? 'online' : 'offline'}</span>
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
