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

export interface StorageStats {
    modules: number;
    progress: number;
    weakModules: number;
    totalMB: string;
}