import { useEffect, useState } from "preact/hooks";
import { getActiveProfile, hasCompletedPlacement, seedFirstModule } from "./lib/idb-store";
import { createSession, fetchQuiz, fetchPlacementQuiz, fetchCatalog } from "./lib/api";
import { VaultAccess } from "./components/VaultAccess";
import { StatusBar } from "./components/StatusBar";
import { TopicGrid } from "./components/TopicGrid";
import { ModuleView } from "./components/ModuleView";
import { Quiz } from "./components/Quiz";
import { PlacementQuiz } from "./components/PlacementQuiz";
import { DemoPanel } from "./components/DemoPanel";
import { AdminPanel } from "./components/AdminPanel";
import type { Profile } from "./types";

type Screen =
    | { name: 'grid' }
    | { name: 'module'; moduleId: string; token: string }
    | { name: 'quiz'; moduleId: string; topic: string; tier: number; questions: any[] }
    | { name: 'placement'; questions: any[]; catalog: any[] };

export default function App() {
    const [profile, setProfile]           = useState<Profile | null>(null);
    const [authLoading, setAuthLoading]   = useState(true);
    const [screen, setScreen]             = useState<Screen>({ name: 'grid' });
    const [showDemo, setShowDemo]         = useState(false);
    const [showAdmin, setShowAdmin]       = useState(false);
    const [adminKey, setAdminKey]         = useState<string>('');
    const [sessionToken, setSessionToken] = useState<string>('');
    const [gridRefreshKey, setGridRefreshKey] = useState(0);

    useEffect(() => {
        getActiveProfile().then(async p => {
            if (p) {
                setProfile(p);
                // Returning user — check if they still need placement
                const done = await hasCompletedPlacement(p.id);
                if (!done) {
                    await startPlacement(p);
                }
            }
            setAuthLoading(false);
        });
    }, []);

    useEffect(() => {
        if (!profile) return;
        createSession(profile.ghostID)
            .then(token => setSessionToken(token))
            .catch(() => {});
    }, [profile]);

    async function startPlacement(p: Profile) {
        try {
            const [quizData, catalogData] = await Promise.all([
                fetchPlacementQuiz(),
                fetchCatalog(),
            ]);
            const questions = quizData.questions ?? [];
            const catalog   = catalogData.modules ?? [];

            if (questions.length === 0) {
                // No quiz questions configured yet — skip placement, just unlock module 1
                if (catalog.length > 0) {
                    await seedFirstModule(p.id, String(catalog[0].id));
                }
                return;
            }
            setScreen({ name: 'placement', questions, catalog });
        } catch {
            // Server unreachable — fall through to grid, unlock module 1 defensively
            // TopicGrid.seedFirstModule will handle it on load
        }
    }

    async function handleAuthenticated(p: Profile, isNew: boolean) {
        setProfile(p);
        if (isNew) {
            await startPlacement(p);
        }
    }

    function handleAdminAccess(key: string) {
        setAdminKey(key);
        setShowAdmin(true);
    }

    function handleLogout() {
        localStorage.removeItem('activeProfile');
        setProfile(null);
        setSessionToken('');
        setAdminKey('');
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

    function handlePlacementComplete() {
        setGridRefreshKey(k => k + 1);
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
        return (
            <>
                <VaultAccess onAuthenticated={handleAuthenticated} onAdminAccess={handleAdminAccess} />
                {showAdmin && <AdminPanel onClose={() => { setShowAdmin(false); setAdminKey(''); }} initialAdminKey={adminKey} />}
            </>
        );
    }

    // Placement screen takes over the full viewport (no StatusBar)
    if (screen.name === 'placement') {
        return (
            <PlacementQuiz
                profileId={profile.id}
                questions={screen.questions}
                catalog={screen.catalog}
                onComplete={handlePlacementComplete}
            />
        );
    }

    return (
        <div className="min-h-screen bg-stone-50 flex flex-col">
            <StatusBar
                profile={profile}
                onOpenDemo={() => setShowDemo(true)}
                onLogout={handleLogout}
            />

            <main className="flex-1">
                {screen.name === 'grid' && (
                    <TopicGrid
                        profileId={profile.id}
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
                        profileId={profile.id}
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
            {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} initialAdminKey={adminKey} />}
        </div>
    );
}