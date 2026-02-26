import { useState } from 'preact/hooks';
import { saveProfile, findProfileByGhostID } from '../lib/idb-store';
import type { Profile } from '../types';

interface VaultAccessProps {
    onAuthenticated: (profile: Profile) => void;
}

// Temporary function - Person 1 will replace this with real crypto
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

export function VaultAccess({ onAuthenticated }: VaultAccessProps) {
    const [view, setView] = useState<'landing' | 'create' | 'unlock'>('landing');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    async function handleCreateVault(e: Event) {
        e.preventDefault();
        setError('');
        
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        
        setLoading(true);
        
        try {
            const ghostID = await generateGhostID(username, password);
            
            const existing = await findProfileByGhostID(ghostID);
            if (existing) {
                setError('Vault already exists');
                setLoading(false);
                return;
            }
            
            const profile: Profile = {
                id: crypto.randomUUID(),
                username,
                ghostID,
                createdAt: Date.now()
            };
            
            await saveProfile(profile);
            onAuthenticated(profile);
            
        } catch (err) {
            setError('Failed to create vault');
        } finally {
            setLoading(false);
        }
    }
    
    async function handleUnlock(e: Event) {
        e.preventDefault();
        setError('');
        setLoading(true);
        
        try {
            const ghostID = await generateGhostID(username, password);
            const profile = await findProfileByGhostID(ghostID);
            
            if (!profile) {
                setError('Invalid credentials');
                setLoading(false);
                return;
            }
            
            await saveProfile(profile);
            onAuthenticated(profile);
            
        } catch (err) {
            setError('Failed to unlock');
        } finally {
            setLoading(false);
        }
    }
    
    if (view === 'landing') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            🔐 GhostLearn
                        </h1>
                        <p className="text-gray-600 mt-2">Your private learning vault</p>
                    </div>
                    
                    <div className="space-y-4">
                        <button
                            onClick={() => setView('create')}
                            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition transform hover:scale-105"
                        >
                            🆕 Create New Vault
                        </button>
                        
                        <button
                            onClick={() => setView('unlock')}
                            className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 transition"
                        >
                            🔓 Unlock Existing
                        </button>
                    </div>
                    
                    <p className="text-xs text-gray-400 text-center mt-8">
                        🔒 Your identity never leaves this device
                    </p>
                </div>
            </div>
        );
    }
    
    if (view === 'create') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
                    <button
                        onClick={() => setView('landing')}
                        className="text-gray-500 hover:text-gray-700 mb-4 flex items-center"
                    >
                        ← Back
                    </button>
                    
                    <h2 className="text-2xl font-bold mb-6">Create New Vault</h2>
                    
                    <form onSubmit={handleCreateVault}>
                        <div className="mb-4">
                            <label className="block text-gray-700 mb-2">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername((e.target as HTMLInputElement).value)}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-400"
                                required
                                autoFocus
                            />
                        </div>
                        
                        <div className="mb-4">
                            <label className="block text-gray-700 mb-2">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-400"
                                required
                            />
                        </div>
                        
                        <div className="mb-6">
                            <label className="block text-gray-700 mb-2">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-400"
                                required
                            />
                        </div>
                        
                        {error && (
                            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                                {error}
                            </div>
                        )}
                        
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                        >
                            {loading ? 'Creating...' : 'Create Vault'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
                <button
                    onClick={() => setView('landing')}
                    className="text-gray-500 hover:text-gray-700 mb-4 flex items-center"
                >
                    ← Back
                </button>
                
                <h2 className="text-2xl font-bold mb-6">Unlock Vault</h2>
                
                <form onSubmit={handleUnlock}>
                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername((e.target as HTMLInputElement).value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-400"
                            required
                            autoFocus
                        />
                    </div>
                    
                    <div className="mb-6">
                        <label className="block text-gray-700 mb-2">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-400"
                            required
                        />
                    </div>
                    
                    {error && (
                        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                            {error}
                        </div>
                    )}
                    
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                        {loading ? 'Unlocking...' : 'Unlock'}
                    </button>
                </form>
            </div>
        </div>
    );
}