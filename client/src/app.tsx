import { useEffect, useState } from "preact/hooks";
import { getActiveProfile } from "./lib/idb-store";
import { createSession, fetchQuiz } from "./lib/api";
import { VaultAccess } from "./components/VaultAccess";
import { StatusBar } from "./components/StatusBar";
import { TopicGrid } from "./components/TopicGrid";
import { ModuleView } from "./components/ModuleView";
import { Quiz } from "./components/Quiz";
import { DemoPanel } from "./components/DemoPanel";
import { AdminPanel } from "./components/AdminPanel";
import type { Profile } from "./types";

type Screen =
    | { name: 'grid' }
    | { name: 'module'; moduleId: string; token: string }
    | { name: 'quiz'; moduleId: string; topic: string; tier: number; questions: any[] };

export default function App() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [screen, setScreen] = useState<Screen>({ name: 'grid' });
    const [showDemo, setShowDemo] = useState(false);
    const [showAdmin, setShowAdmin] = useState(false);
    const [sessionToken, setSessionToken] = useState<string>('');
    /**
     * Bump this whenever the user passes a quiz so TopicGrid re-runs its
     * catalog + unlock fetch and reveals the newly unlocked module.
     */
    const [gridRefreshKey, setGridRefreshKey] = useState(0);

    useEffect(() => {
        getActiveProfile().then(p => {
            if (p) setProfile(p);
            setAuthLoading(false);
        });
    }, []);

    useEffect(() => {
        if (!profile) return;
        // Use createSession from api.ts so VITE_API_URL env var is respected
        createSession(profile.ghostID)
            .then(token => setSessionToken(token))
            .catch(() => {});
    }, [profile]);

    function handleLogout() {
        localStorage.removeItem('activeProfile');
        setProfile(null);
        setSessionToken('');
        setScreen({ name: 'grid' });
        setShowDemo(false);
        setShowAdmin(false);
    }

    function handleSelectModule(moduleId: string) {
        setScreen({ name: 'module', moduleId, token: sessionToken });
    }

    async function handleStartQuiz(moduleId: string, topic: string, tier: number) {
        try {
            const data = await fetchQuiz(moduleId);
            const questions = data.questions ?? [];
            if (questions.length === 0) {
                alert('No quiz questions available for this module yet.');
                return;
            }
            setScreen({ name: 'quiz', moduleId, topic, tier, questions });
        } catch {
            alert('Could not load quiz. Are you online?');
        }
    }

    /**
     * Called by Quiz when the user finishes.
     * If they passed, bump the refresh key so TopicGrid re-reads moduleUnlocks
     * and reveals the newly unlocked card.
     */
    function handleQuizComplete(
        _correct: number,
        _total: number,
        passed: boolean,
        unlockedNextModuleId: string | null,
    ) {
        if (passed && unlockedNextModuleId) {
            setGridRefreshKey(k => k + 1);
        }
        setScreen({ name: 'grid' });
    }

    if (authLoading) {
        return (
            <div
                style={{ fontFamily: "'DM Mono', monospace" }}
                className="min-h-screen bg-stone-50 flex items-center justify-center"
            >
                <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300&display=swap');`}</style>
                <span className="text-xs text-stone-300 animate-pulse">loading vault...</span>
            </div>
        );
    }

    if (!profile) {
        return <VaultAccess onAuthenticated={setProfile} />;
    }

    return (
        <div className="min-h-screen bg-stone-50 flex flex-col">
            <StatusBar
                profile={profile}
                onOpenDemo={() => setShowDemo(true)}
                onOpenAdmin={() => setShowAdmin(true)}
                onLogout={handleLogout}
            />

            <main className="flex-1">
                {screen.name === 'grid' && (
                    <TopicGrid
                        onSelectModule={handleSelectModule}
                        refreshKey={gridRefreshKey}
                    />
                )}
                {screen.name === 'module' && (
                    <ModuleView
                        moduleId={screen.moduleId}
                        sessionToken={screen.token}
                        onBack={() => setScreen({ name: 'grid' })}
                        onStartQuiz={handleStartQuiz}
                    />
                )}
                {screen.name === 'quiz' && (
                    <Quiz
                        moduleId={screen.moduleId}
                        topic={screen.topic}
                        tier={screen.tier}
                        questions={screen.questions}
                        onComplete={handleQuizComplete}
                        onBack={() =>
                            setScreen({
                                name: 'module',
                                moduleId: screen.moduleId,
                                token: sessionToken,
                            })
                        }
                    />
                )}
            </main>

            {showDemo && <DemoPanel profile={profile} onClose={() => setShowDemo(false)} />}
            {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
        </div>
    );
}