import { useState, useEffect } from 'preact/hooks';
import { getStorageStats, getWeakModules, getAllProgress } from '../lib/idb-store';
import { useConnection } from '../hooks/useConnection';
import type { Profile, StorageStats, WeakModule, Progress } from '../types';

interface DemoPanelProps {
    profile: Profile;
    onClose: () => void;
}

export function DemoPanel({ profile, onClose }: DemoPanelProps) {
    const [stats, setStats] = useState<StorageStats | null>(null);
    const [weakModules, setWeakModules] = useState<WeakModule[]>([]);
    const [progress, setProgress] = useState<Progress[]>([]);
    const [sentData, setSentData] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'privacy' | 'bandwidth' | 'learning'>('privacy');
    const connection = useConnection();
    
    useEffect(() => {
        const interval = setInterval(async () => {
            setStats(await getStorageStats());
            setWeakModules(await getWeakModules());
            setProgress(await getAllProgress());
        }, 1000);
        
        // Intercept fetch to show sent data
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const url = args[0];
            const options = args[1] || {};
            
            if (typeof url === 'string' && !url.includes('demo')) {
                let bodySize = 0;
                if (options.body) {
                    if (typeof options.body === 'string') {
                        bodySize = options.body.length;
                    } else if (options.body instanceof Blob) {
                        bodySize = options.body.size;
                    }
                }
                setSentData(prev => [{
                    time: new Date().toLocaleTimeString(),
                    url: url.length > 40 ? url.substring(0, 40) + '...' : url,
                    size: url.length + bodySize,
                    method: options.method || 'GET',
                    type: url.includes('/kpir') ? '🔐 PIR' : 
                          url.includes('/catalog') ? '📋 Catalog' : '🌐 Other'
                }, ...prev].slice(0, 8));
            }
            
            return originalFetch(...args);
        };
        
        return () => {
            clearInterval(interval);
            window.fetch = originalFetch;
        };
    }, []);
    
    const learningStats = {
        total: progress.length,
        passed: progress.filter(p => p.passed).length,
        accuracy: progress.length ? 
            Math.round((progress.reduce((sum, p) => sum + p.correct, 0) / 
                       progress.reduce((sum, p) => sum + p.total, 0)) * 100) : 0,
        weakCount: weakModules.length
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                    <div>
                        <h2 className="text-2xl font-bold">🔍 GhostLearn Demo Panel</h2>
                        <p className="text-indigo-100 text-sm mt-1">Live privacy & bandwidth visualization</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-white hover:text-indigo-200 text-2xl"
                    >
                        ✕
                    </button>
                </div>
                
                {/* Tabs */}
                <div className="flex border-b px-6 bg-gray-50">
                    {[
                        { id: 'privacy', label: '🛡️ Privacy View', desc: 'Server blindness' },
                        { id: 'bandwidth', label: '📊 Bandwidth View', desc: 'Bytes saved' },
                        { id: 'learning', label: '📚 Learning View', desc: 'Local progress' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-6 py-4 font-medium border-b-2 transition ${
                                activeTab === tab.id 
                                    ? 'border-indigo-600 text-indigo-600' 
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                            title={tab.desc}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {activeTab === 'privacy' && (
                        <div className="grid grid-cols-2 gap-6">
                            {/* Left: Device knows */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-gray-700 flex items-center">
                                    <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                                    📱 Device Knows
                                </h3>
                                
                                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                    <h4 className="font-medium mb-3 text-green-800">Identity & Progress</h4>
                                    <div className="space-y-2 text-sm">
                                        <p><span className="text-gray-600">Ghost ID:</span> <span className="font-mono">{profile.ghostID.substring(0, 16)}...</span></p>
                                        <p><span className="text-gray-600">Username:</span> {profile.username}</p>
                                        <p><span className="text-gray-600">Weak modules:</span> {weakModules.length}</p>
                                        <p><span className="text-gray-600">Progress records:</span> {progress.length}</p>
                                    </div>
                                </div>
                                
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <h4 className="font-medium mb-3 text-blue-800">Storage</h4>
                                    <div className="space-y-2 text-sm">
                                        <p><span className="text-gray-600">Modules cached:</span> {stats?.modules || 0}</p>
                                        <p><span className="text-gray-600">Total size:</span> {stats?.totalMB || 0} MB</p>
                                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                            <div 
                                                className="bg-blue-600 rounded-full h-2" 
                                                style={{ width: `${Math.min((stats?.totalMB ? parseFloat(stats.totalMB) / 50 : 0) * 100, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                                    <h4 className="font-medium mb-3 text-purple-800">Sent to Server</h4>
                                    <div className="space-y-2 max-h-40 overflow-auto">
                                        {sentData.length === 0 ? (
                                            <p className="text-gray-500 text-sm">No requests yet</p>
                                        ) : (
                                            sentData.map((d, i) => (
                                                <div key={i} className="text-xs bg-white p-2 rounded border">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">{d.time}</span>
                                                        <span className="font-mono text-indigo-600">{d.type}</span>
                                                    </div>
                                                    <div className="flex justify-between mt-1">
                                                        <span className="font-mono">{d.method}</span>
                                                        <span className="text-gray-600">{d.url}</span>
                                                        <span className="font-bold">{d.size}B</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Right: Server sees */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-gray-700 flex items-center">
                                    <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                                    🖥️ Server Sees
                                </h3>
                                
                                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                                    <h4 className="font-medium mb-3 text-red-800">❌ NEVER SEES</h4>
                                    <ul className="space-y-2 text-sm">
                                        <li className="flex items-center"><span className="w-5 text-green-600">✓</span> Your Ghost ID <span className="text-red-600 ml-2">✗</span></li>
                                        <li className="flex items-center"><span className="w-5 text-green-600">✓</span> Your scores <span className="text-red-600 ml-2">✗</span></li>
                                        <li className="flex items-center"><span className="w-5 text-green-600">✓</span> Which module <span className="text-red-600 ml-2">✗</span></li>
                                        <li className="flex items-center"><span className="w-5 text-green-600">✓</span> Your identity <span className="text-red-600 ml-2">✗</span></li>
                                        <li className="flex items-center"><span className="w-5 text-green-600">✓</span> Your IP <span className="text-red-600 ml-2">✗</span></li>
                                    </ul>
                                </div>
                                
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <h4 className="font-medium mb-3">✓ DOES SEE</h4>
                                    <ul className="space-y-2 text-sm">
                                        <li>• Random vectors (meaningless)</li>
                                        <li>• Timestamp (irreducible)</li>
                                        <li>• Session token (single use)</li>
                                    </ul>
                                </div>
                                
                                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                                    <h4 className="font-medium mb-3 text-indigo-800">🔐 K=3 PIR Guarantee</h4>
                                    <p className="text-sm mb-2">Server receives 3 random vectors:</p>
                                    <div className="bg-white p-3 rounded font-mono text-xs mb-2">
                                        v₀ = [142, 87, 231, ...]<br/>
                                        v₁ = [56, 193, 22, ...]<br/>
                                        v₂ = [201, 45, 178, ...]
                                    </div>
                                    <p className="text-sm text-indigo-700">
                                        Any 2 vectors reveal NOTHING about your request
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'bandwidth' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold">📊 Bandwidth Savings</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-6 rounded-lg shadow text-center border border-gray-200">
                                    <div className="text-3xl font-bold text-indigo-600">~49KB</div>
                                    <div className="text-gray-600 mt-2">First Module</div>
                                    <div className="text-xs text-gray-400 mt-1">1.2s on 2G</div>
                                </div>
                                <div className="bg-white p-6 rounded-lg shadow text-center border border-gray-200">
                                    <div className="text-3xl font-bold text-green-600">~80B</div>
                                    <div className="text-gray-600 mt-2">Repeat Session</div>
                                    <div className="text-xs text-gray-400 mt-1">Instant</div>
                                </div>
                                <div className="bg-white p-6 rounded-lg shadow text-center border border-gray-200">
                                    <div className="text-3xl font-bold text-purple-600">200KB</div>
                                    <div className="text-gray-600 mt-2">Video (first)</div>
                                    <div className="text-xs text-gray-400 mt-1">0B repeat</div>
                                </div>
                            </div>
                            
                            <div className="bg-gray-50 p-6 rounded-lg">
                                <h4 className="font-medium mb-4">Real-time Bandwidth Usage</h4>
                                <div className="space-y-3">
                                    {sentData.length === 0 ? (
                                        <p className="text-gray-500">No network activity yet</p>
                                    ) : (
                                        sentData.map((d, i) => (
                                            <div key={i} className="flex items-center justify-between bg-white p-3 rounded shadow-sm">
                                                <div className="flex items-center space-x-4">
                                                    <span className="text-gray-500 w-16">{d.time}</span>
                                                    <span className={`px-2 py-1 rounded text-xs font-mono ${
                                                        d.type === '🔐 PIR' ? 'bg-purple-100 text-purple-700' :
                                                        d.type === '📋 Catalog' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-gray-100 text-gray-700'
                                                    }`}>
                                                        {d.type}
                                                    </span>
                                                    <span className="font-mono text-sm">{d.method}</span>
                                                </div>
                                                <div className="flex items-center space-x-4">
                                                    <span className="text-gray-600 text-sm">{d.url}</span>
                                                    <span className="font-bold text-indigo-600">{d.size}B</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                            
                            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                <h4 className="font-medium text-green-800 mb-2">🎯 Total Savings</h4>
                                <p className="text-sm">
                                    Without GhostLearn: <span className="line-through text-gray-500">~2.5MB per session</span><br/>
                                    With GhostLearn: <span className="font-bold text-green-700">~49KB first, ~80B repeat</span><br/>
                                    <span className="text-green-600">98% bandwidth reduction!</span>
                                </p>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'learning' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold">📚 Your Learning Progress</h3>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white p-4 rounded-lg shadow text-center">
                                    <div className="text-2xl font-bold text-indigo-600">{learningStats.total}</div>
                                    <div className="text-sm text-gray-600">Total Attempts</div>
                                </div>
                                <div className="bg-white p-4 rounded-lg shadow text-center">
                                    <div className="text-2xl font-bold text-green-600">{learningStats.passed}</div>
                                    <div className="text-sm text-gray-600">Passed</div>
                                </div>
                                <div className="bg-white p-4 rounded-lg shadow text-center">
                                    <div className="text-2xl font-bold text-orange-600">{learningStats.weakCount}</div>
                                    <div className="text-sm text-gray-600">Need Review</div>
                                </div>
                                <div className="bg-white p-4 rounded-lg shadow text-center">
                                    <div className="text-2xl font-bold text-purple-600">{learningStats.accuracy}%</div>
                                    <div className="text-sm text-gray-600">Accuracy</div>
                                </div>
                            </div>
                            
                            <div className="bg-white p-6 rounded-lg shadow">
                                <h4 className="font-medium mb-4">Recent Activity</h4>
                                <div className="space-y-3">
                                    {progress.slice(0, 5).map((p, i) => (
                                        <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0">
                                            <div>
                                                <span className="font-mono text-sm">{p.moduleId}</span>
                                                <span className="mx-2 text-gray-400">•</span>
                                                <span className="text-sm text-gray-600">
                                                    {new Date(p.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex items-center space-x-3">
                                                <span className="text-sm">
                                                    {p.correct}/{p.total}
                                                </span>
                                                <span className={`px-2 py-1 rounded text-xs ${
                                                    p.passed ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                                }`}>
                                                    {p.passed ? '✅ Pass' : '❌ Fail'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                    {progress.length === 0 && (
                                        <p className="text-gray-500 text-center py-4">
                                            No learning activity yet. Take a quiz to see progress!
                                        </p>
                                    )}
                                </div>
                            </div>
                            
                            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                <h4 className="font-medium text-yellow-800 mb-2">⚠️ Needs Review</h4>
                                {weakModules.length === 0 ? (
                                    <p className="text-sm text-gray-600">All modules mastered! 🎉</p>
                                ) : (
                                    <ul className="list-disc list-inside space-y-1">
                                        {weakModules.map((w, i) => (
                                            <li key={i} className="text-sm">
                                                {w.moduleId} (attempts: {w.attemptCount})
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                <div className="border-t p-4 bg-gray-50 text-xs text-gray-500 flex justify-between">
                    <span>Ghost ID: {profile.ghostID.substring(0, 16)}...</span>
                    <span>Live updates every 1s</span>
                </div>
            </div>
        </div>
    );
}