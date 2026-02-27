import { useState, useRef } from 'preact/hooks';
import { saveProfile, findProfileByGhostID } from '../lib/idb-store';
import type { Profile } from '../types';

interface VaultAccessProps {
    onAuthenticated: (profile: Profile, isNew: boolean) => void;
    onAdminAccess: (adminKey: string) => void;
}

// ── Helpers (defined outside component to prevent remount on render) ──

async function generateGhostID(username: string, password: string): Promise<string> {
    const input = username + password + 'ghost-salt-2026';
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .substring(0, 32);
}

function downloadKey(profile: Profile) {
    const key = { ghostID: profile.ghostID, username: profile.username, createdAt: profile.createdAt };
    const blob = new Blob([JSON.stringify(key, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ghostlearn-key-${profile.username}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap'); * { box-sizing: border-box; }`;

const INPUT_CLASS = `
    w-full px-4 py-3 bg-white border border-stone-200 rounded-lg text-sm text-stone-800
    placeholder-stone-300 focus:outline-none focus:border-stone-400 focus:ring-0
    font-mono tracking-wide transition-colors
`;
const LABEL_CLASS = "block text-xs font-medium text-stone-400 uppercase tracking-widest mb-2";

// Shell and BackButton as module-level components so they never remount
function Shell({ children }: { children: any }) {
    return (
        <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
            <style>{FONTS}</style>
            <div className="w-full max-w-sm">{children}</div>
        </div>
    );
}

function BackButton({ onClick }: { onClick: () => void }) {
    return (
        <button onClick={onClick} className="flex items-center text-xs text-stone-400 hover:text-stone-600 mb-10 transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mr-1.5">
                <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
        </button>
    );
}

// ── Main component ──

export function VaultAccess({ onAuthenticated, onAdminAccess }: VaultAccessProps) {
    const [view, setView] = useState<'landing' | 'create' | 'unlock' | 'restore' | 'created' | 'admin'>('landing');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [newProfile, setNewProfile] = useState<Profile | null>(null);
    const [adminKey, setAdminKey] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    function reset() {
        setError(''); setUsername(''); setPassword(''); setConfirmPassword(''); setNewProfile(null);
    }

    function goBack() {
        setView('landing');
        reset();
    }

    async function handleCreateVault(e: Event) {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) { setError('Passwords do not match'); return; }
        setLoading(true);
        try {
            const ghostID = await generateGhostID(username, password);
            const existing = await findProfileByGhostID(ghostID);
            if (existing) { setError('Vault already exists for this identity'); setLoading(false); return; }
            const profile: Profile = { id: crypto.randomUUID(), username, ghostID, createdAt: Date.now() };
            await saveProfile(profile);
            setNewProfile(profile);
            setView('created');
        } catch { setError('Failed to create vault'); }
        finally { setLoading(false); }
    }

    async function handleUnlock(e: Event) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const ghostID = await generateGhostID(username, password);
            const profile = await findProfileByGhostID(ghostID);
            if (!profile) { setError('No vault found for these credentials'); setLoading(false); return; }
            await saveProfile(profile);
            onAuthenticated(profile, false);
        } catch { setError('Failed to unlock vault'); }
        finally { setLoading(false); }
    }

    async function handleKeyFileUpload(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        setError('');
        setLoading(true);
        try {
            const text = await file.text();
            const key = JSON.parse(text);
            if (!key.ghostID || !key.username) throw new Error('Invalid key file');
            let profile = await findProfileByGhostID(key.ghostID);
            if (!profile) {
                profile = { id: crypto.randomUUID(), username: key.username, ghostID: key.ghostID, createdAt: key.createdAt || Date.now() };
                await saveProfile(profile);
            } else {
                await saveProfile(profile);
            }
            onAuthenticated(profile, false);
        } catch {
            setError('Invalid or corrupted key file');
        } finally {
            setLoading(false);
        }
    }

    // ── Landing ──
    if (view === 'landing') {
        return (
            <Shell>
                <div className="mb-12 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-stone-900 mb-6">
                        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                            <path d="M11 2C6.03 2 2 6.03 2 11s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 4a2 2 0 110 4 2 2 0 010-4zm0 10c-2.67 0-5.03-1.37-6.43-3.44C4.91 10.6 8.29 9 11 9s6.09 1.6 6.43 3.56C16.03 14.63 13.67 16 11 16z" fill="white"/>
                        </svg>
                    </div>
                    <h1 style={{ fontFamily: "'DM Mono', monospace", fontWeight: 300, letterSpacing: '-0.02em' }}
                        className="text-2xl text-stone-900">GhostLearn</h1>
                    <p className="text-sm text-stone-400 mt-1 font-light">Private learning, locally stored</p>
                </div>
                <div className="space-y-3">
                    <button onClick={() => setView('create')}
                            className="w-full py-3.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-700 transition-colors">
                        Create new vault
                    </button>
                    <button onClick={() => setView('unlock')}
                            className="w-full py-3.5 bg-white text-stone-700 text-sm font-medium rounded-xl border border-stone-200 hover:border-stone-300 hover:bg-stone-50 transition-colors">
                        Unlock with password
                    </button>
                    <button onClick={() => setView('restore')}
                            className="w-full py-3.5 bg-white text-stone-500 text-sm font-medium rounded-xl border hover:border-stone-200 hover:bg-stone-50 transition-colors"
                            style={{ borderColor: '#ede9e4' }}>
                        Restore from key file
                    </button>
                </div>
                <div className="mt-8 pt-6 border-t border-stone-100">
                    <button onClick={() => setView('admin')}
                            className="w-full py-2.5 text-xs text-stone-400 hover:text-stone-600 transition-colors font-medium">
                        Admin access
                    </button>
                </div>
                <p style={{ fontFamily: "'DM Mono', monospace" }}
                   className="text-center text-xs text-stone-300 mt-4 font-light">
                    identity never leaves this device
                </p>
            </Shell>
        );
    }

    // ── Vault Created ──
    if (view === 'created' && newProfile) {
        return (
            <Shell>
                <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5 text-2xl">✓</div>
                    <h2 className="text-xl font-medium text-stone-900">Vault created</h2>
                    <p className="text-sm text-stone-400 mt-1">Save your privacy key to restore on another device</p>
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace" }}
                     className="bg-stone-50 border border-stone-100 rounded-xl p-4 mb-6 space-y-1.5">
                    <div className="flex justify-between text-xs">
                        <span className="text-stone-400">username</span>
                        <span className="text-stone-600">{newProfile.username}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-stone-400">ghost id</span>
                        <span className="text-stone-500">{newProfile.ghostID.substring(0, 16)}…</span>
                    </div>
                </div>
                <div className="space-y-3">
                    <button onClick={() => downloadKey(newProfile)}
                            className="w-full py-3.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-700 transition-colors flex items-center justify-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M7 2v7M4 7l3 3 3-3M2 12h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Download privacy key
                    </button>
                    <button onClick={() => onAuthenticated(newProfile, true)}
                            className="w-full py-3 text-stone-400 text-sm hover:text-stone-600 transition-colors">
                        Skip for now →
                    </button>
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace" }}
                     className="mt-6 p-3.5 bg-amber-50 rounded-lg border border-amber-100">
                    <p className="text-xs text-amber-600 leading-relaxed">
                        Without this file, your vault cannot be restored on a new device or after clearing browser data.
                    </p>
                </div>
            </Shell>
        );
    }

    // ── Restore from key file ──
    if (view === 'restore') {
        return (
            <Shell>
                <BackButton onClick={goBack} />
                <div className="mb-8">
                    <h2 className="text-xl font-medium text-stone-900">Restore vault</h2>
                    <p className="text-sm text-stone-400 mt-1">Upload your <span style={{ fontFamily: "'DM Mono', monospace" }}>ghostlearn-key.json</span> file</p>
                </div>
                <input ref={fileInputRef} type="file" accept=".json,application/json"
                       className="hidden" onInput={handleKeyFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} disabled={loading}
                        className="w-full py-12 border-2 border-dashed border-stone-200 rounded-2xl text-stone-400 hover:border-stone-300 hover:text-stone-500 hover:bg-stone-50 transition-all disabled:opacity-40">
                    <div className="flex flex-col items-center gap-3">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M12 16V8M9 11l3-3 3 3M6 20h12a2 2 0 002-2V8l-6-6H6a2 2 0 00-2 2v14a2 2 0 002 2z"
                                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="text-sm font-medium">{loading ? 'Reading file...' : 'Tap to upload key file'}</span>
                    </div>
                </button>
                {error && (
                    <div className="mt-4 flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-lg">
                        <span className="text-red-400 text-xs">⚠</span>
                        <p className="text-xs text-red-600">{error}</p>
                    </div>
                )}
                <p style={{ fontFamily: "'DM Mono', monospace" }}
                   className="text-center text-xs text-stone-300 mt-8">
                    the file never leaves your device
                </p>
            </Shell>
        );
    }

    // ── Admin Access ──
    if (view === 'admin') {
        const handleAdminSubmit = (e: Event) => {
            e.preventDefault();
            if (adminKey.trim()) {
                onAdminAccess(adminKey.trim());
            }
        };

        return (
            <Shell>
                <BackButton onClick={goBack} />
                <div className="mb-8">
                    <h2 className="text-xl font-medium text-stone-900">Admin access</h2>
                    <p className="text-sm text-stone-400 mt-1">Enter your admin key to continue</p>
                </div>
                <form onSubmit={handleAdminSubmit} className="space-y-4">
                    <div>
                        <label className={LABEL_CLASS}>Admin key</label>
                        <input
                            type="password"
                            value={adminKey}
                            onInput={(e) => setAdminKey((e.target as HTMLInputElement).value)}
                            className={INPUT_CLASS}
                            placeholder="••••••••"
                            required
                            autoFocus
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!adminKey.trim()}
                        className="w-full py-3.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors mt-2"
                    >
                        Enter admin panel
                    </button>
                </form>
            </Shell>
        );
    }

    // ── Create / Unlock ──
    const isCreate = view === 'create';
    return (
        <Shell>
            <BackButton onClick={goBack} />
            <div className="mb-8">
                <h2 className="text-xl font-medium text-stone-900">
                    {isCreate ? 'Create vault' : 'Unlock vault'}
                </h2>
                <p className="text-sm text-stone-400 mt-1">
                    {isCreate ? 'Your vault lives on this device only' : 'Enter your credentials to continue'}
                </p>
            </div>
            <form onSubmit={isCreate ? handleCreateVault : handleUnlock} className="space-y-4">
                <div>
                    <label className={LABEL_CLASS}>Username</label>
                    <input type="text" value={username}
                           onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
                           className={INPUT_CLASS} placeholder="your_name" required autoFocus />
                </div>
                <div>
                    <label className={LABEL_CLASS}>Password</label>
                    <input type="password" value={password}
                           onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                           className={INPUT_CLASS} placeholder="••••••••" required />
                </div>
                {isCreate && (
                    <div>
                        <label className={LABEL_CLASS}>Confirm password</label>
                        <input type="password" value={confirmPassword}
                               onInput={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
                           className={INPUT_CLASS} placeholder="••••••••" required />
                    </div>
                )}
                {error && (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-lg">
                        <span className="text-red-400 text-xs">⚠</span>
                        <p className="text-xs text-red-600">{error}</p>
                    </div>
                )}
                <button type="submit" disabled={loading}
                        className="w-full py-3.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors mt-2">
                    {loading ? (isCreate ? 'Creating...' : 'Unlocking...') : (isCreate ? 'Create vault' : 'Unlock')}
                </button>
            </form>
            {isCreate && (
                <div style={{ fontFamily: "'DM Mono', monospace" }}
                     className="mt-6 p-3.5 bg-stone-100 rounded-lg border border-stone-200">
                    <p className="text-xs text-stone-400 leading-relaxed">
                        A Ghost ID is derived locally from your credentials. No account is created. No data is sent.
                    </p>
                </div>
            )}
        </Shell>
    );
}