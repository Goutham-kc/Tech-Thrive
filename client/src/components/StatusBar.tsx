import { useConnection } from '../hooks/useConnection';
import type { Profile } from '../types';

interface StatusBarProps {
    profile: Profile;
    onOpenDemo: () => void;
    onLogout: () => void;
}

export function StatusBar({ profile, onOpenDemo, onLogout }: StatusBarProps) {
    const { online, type } = useConnection();

    return (
        <div style={{ fontFamily: "'DM Sans', sans-serif" }}
             className="h-11 border-b border-stone-100 bg-white px-5 flex items-center justify-between">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=DM+Mono:wght@300;400&display=swap');`}</style>

            {/* Brand */}
            <div style={{ fontFamily: "'DM Mono', monospace" }} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-stone-900 flex items-center justify-center">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <circle cx="5.5" cy="3.5" r="1.5" fill="white"/>
                        <path d="M1.5 9.5c0-2.21 1.79-4 4-4s4 1.79 4 4" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                </div>
                <span className="text-xs text-stone-500 font-light tracking-wider">ghostlearn</span>
            </div>

            {/* Right */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-stone-300'}`} />
                    <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-xs text-stone-400 font-light">
                        {online ? (type !== 'unknown' ? type : 'online') : 'offline'}
                    </span>
                </div>

                <div className="w-px h-3.5 bg-stone-100" />

                <button onClick={onOpenDemo} className="text-xs text-stone-400 hover:text-stone-600 transition-colors font-medium">
                    Demo
                </button>

                <div className="w-px h-3.5 bg-stone-100" />

                <div style={{ fontFamily: "'DM Mono', monospace" }}
                     className="flex items-center gap-1.5 px-2.5 py-1 bg-stone-50 rounded-md border border-stone-100">
                    <span className="text-xs text-stone-400 font-light">{profile.username}</span>
                    <span className="text-stone-200">·</span>
                    <span className="text-xs text-stone-300 font-light">{profile.ghostID.substring(0, 8)}</span>
                </div>

                <div className="w-px h-3.5 bg-stone-100" />

                <button onClick={onLogout} className="text-xs text-stone-400 hover:text-red-400 transition-colors font-medium">
                    Lock
                </button>
            </div>
        </div>
    );
}