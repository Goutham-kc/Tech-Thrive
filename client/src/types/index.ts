export interface Profile {
    id: string;
    username: string;
    ghostID: string;
    createdAt: number;
    lastAccessed?: number;
}

export interface Progress {
    id?: number;
    moduleId: string;
    topic: string;       // topic the module belongs to
    tier: number;        // tier of the module attempted
    correct: number;
    total: number;
    passed: boolean;
    timestamp: number;
    date: string;
}

export interface WeakModule {
    id?: number;
    moduleId: string;
    identifiedAt: number;
    lastAttempt: number;
    resolvedAt: number | null;
    attemptCount: number;
}

export interface Module {
    id: string;
    topic: string;
    tier: number;
    title: string;
    content?: any;
    downloadedAt: number;
}

/**
 * Persisted per-topic tier unlock.
 * unlockedTier is the highest tier the user has earned for this topic.
 * Every topic defaults to tier 1 (no record = tier 1 accessible).
 */
export interface TopicUnlock {
    topic: string;       // keyPath
    unlockedTier: number;
}

export interface StorageStats {
    modules: number;
    progress: number;
    weakModules: number;
    totalMB: string;
}