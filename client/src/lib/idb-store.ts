import { openDB, type IDBPDatabase } from 'idb';
import type { Profile, Progress, WeakModule, Module, StorageStats } from '../types';

const DB_NAME = 'GhostLearn';
// v4: moduleUnlocks keyed by "profileId:moduleId" so each vault is independent.
//     Also adds placementDone store to track per-profile placement test state.
// v5: adds profileId index on progress store for per-profile queries.
const DB_VERSION = 5;

// 75% correct required to unlock the next module in regular quizzes
export const PASS_THRESHOLD = 0.75;

export async function initDB(): Promise<IDBPDatabase> {
    return await openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
            if (!db.objectStoreNames.contains('vault')) {
                const vaultStore = db.createObjectStore('vault', { keyPath: 'id' });
                vaultStore.createIndex('ghostID', 'ghostID', { unique: true });
                vaultStore.createIndex('lastAccessed', 'lastAccessed');
            }
            if (!db.objectStoreNames.contains('catalog')) {
                db.createObjectStore('catalog', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('chunks')) {
                const chunkStore = db.createObjectStore('chunks', { keyPath: 'key' });
                chunkStore.createIndex('moduleId', 'moduleId');
                chunkStore.createIndex('timestamp', 'timestamp');
            }
            if (!db.objectStoreNames.contains('modules')) {
                const moduleStore = db.createObjectStore('modules', { keyPath: 'id' });
                moduleStore.createIndex('topic', 'topic');
                moduleStore.createIndex('tier', 'tier');
                moduleStore.createIndex('downloadedAt', 'downloadedAt');
            }
            if (!db.objectStoreNames.contains('progress')) {
                const progressStore = db.createObjectStore('progress', {
                    keyPath: 'id',
                    autoIncrement: true,
                });
                progressStore.createIndex('moduleId', 'moduleId');
                progressStore.createIndex('profileId', 'profileId');
                progressStore.createIndex('timestamp', 'timestamp');
                progressStore.createIndex('passed', 'passed');
                progressStore.createIndex('date', 'date');
            }

            // v5: add profileId index to existing progress store
            if (oldVersion < 5 && db.objectStoreNames.contains('progress')) {
                const tx = (db as any)._upgradeTransaction;
                if (tx) {
                    const store = tx.objectStore('progress');
                    if (!store.indexNames.contains('profileId')) {
                        store.createIndex('profileId', 'profileId');
                    }
                }
            }
            if (!db.objectStoreNames.contains('weakModules')) {
                const weakStore = db.createObjectStore('weakModules', {
                    keyPath: 'id',
                    autoIncrement: true,
                });
                weakStore.createIndex('moduleId', 'moduleId');
                weakStore.createIndex('resolved', 'resolvedAt');
            }

            // v2→v3 migration: drop old topicUnlocks store
            if (oldVersion < 3 && db.objectStoreNames.contains('topicUnlocks')) {
                db.deleteObjectStore('topicUnlocks');
            }

            // v3→v4 migration: drop unscoped moduleUnlocks, recreate with compound key
            if (oldVersion < 4 && db.objectStoreNames.contains('moduleUnlocks')) {
                db.deleteObjectStore('moduleUnlocks');
            }

            // v4: moduleUnlocks keyed by "profileId:moduleId"
            if (!db.objectStoreNames.contains('moduleUnlocks')) {
                const unlockStore = db.createObjectStore('moduleUnlocks', { keyPath: 'key' });
                unlockStore.createIndex('profileId', 'profileId');
            }

            // v4: track whether each profile has completed the placement test
            if (!db.objectStoreNames.contains('placementDone')) {
                db.createObjectStore('placementDone', { keyPath: 'profileId' });
            }

            console.log(`✅ IndexedDB v${DB_VERSION} ready`);
        },
    });
}

let dbInstance: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
    if (!dbInstance) dbInstance = await initDB();
    return dbInstance;
}

// ============ VAULT ============

export async function saveProfile(profile: Profile): Promise<Profile> {
    const db = await getDB();
    const p = { ...profile, lastAccessed: Date.now() };
    await db.put('vault', p);
    localStorage.setItem('activeProfile', profile.id);
    return p;
}

export async function getActiveProfile(): Promise<Profile | null> {
    const id = localStorage.getItem('activeProfile');
    if (!id) return null;
    const db = await getDB();
    return await db.get('vault', id);
}

export async function findProfileByGhostID(ghostID: string): Promise<Profile | null> {
    const db = await getDB();
    return await db.transaction('vault').store.index('ghostID').get(ghostID);
}

// ============ CATALOG ============

export async function saveCatalog(catalog: any, version?: string): Promise<void> {
    const db = await getDB();
    await db.put('catalog', { id: 'main', data: catalog, version, downloadedAt: Date.now() });
}

export async function getCatalog(): Promise<any | null> {
    const db = await getDB();
    const entry = await db.get('catalog', 'main');
    return entry?.data ?? null;
}

// ============ MODULES ============

export async function saveModule(moduleData: Module): Promise<void> {
    const db = await getDB();
    await db.put('modules', { ...moduleData, downloadedAt: Date.now() });
}

export async function getModule(id: string): Promise<Module | null> {
    const db = await getDB();
    return await db.get('modules', id);
}

export async function getAllModules(): Promise<Module[]> {
    const db = await getDB();
    return await db.getAll('modules');
}

// ============ MODULE UNLOCK PROGRESSION ============

function unlockKey(profileId: string, moduleId: string): string {
    return `${profileId}:${moduleId}`;
}

/**
 * Seed the very first module as unlocked for this profile.
 */
export async function seedFirstModule(profileId: string, firstModuleId: string): Promise<void> {
    const db = await getDB();
    const key = unlockKey(profileId, firstModuleId);
    const existing = await db.get('moduleUnlocks', key);
    if (!existing) {
        await db.put('moduleUnlocks', { key, profileId, moduleId: firstModuleId, unlockedAt: Date.now() });
    }
}

/**
 * Returns the Set of module IDs unlocked for a specific profile.
 */
export async function getUnlockedModuleIds(profileId: string): Promise<Set<string>> {
    const db = await getDB();
    const all = await db.transaction('moduleUnlocks').store.index('profileId').getAll(profileId);
    return new Set(all.map((r: any) => String(r.moduleId)));
}

/**
 * Unlock a specific module for a specific profile.
 */
export async function unlockModule(profileId: string, moduleId: string): Promise<void> {
    const db = await getDB();
    const key = unlockKey(profileId, moduleId);
    await db.put('moduleUnlocks', { key, profileId, moduleId: String(moduleId), unlockedAt: Date.now() });
}

/**
 * Unlock multiple modules at once (used after placement quiz).
 */
export async function unlockModules(profileId: string, moduleIds: string[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('moduleUnlocks', 'readwrite');
    await Promise.all(moduleIds.map(moduleId => {
        const key = unlockKey(profileId, moduleId);
        return tx.store.put({ key, profileId, moduleId: String(moduleId), unlockedAt: Date.now() });
    }));
    await tx.done;
}

// ============ PLACEMENT TEST ============

export async function hasCompletedPlacement(profileId: string): Promise<boolean> {
    const db = await getDB();
    const record = await db.get('placementDone', profileId);
    return !!record;
}

export async function markPlacementDone(profileId: string): Promise<void> {
    const db = await getDB();
    await db.put('placementDone', { profileId, completedAt: Date.now() });
}

// ============ PROGRESS ============

export async function saveProgress(
    profileId: string,
    moduleId: string,
    correct: number,
    total: number,
    topic: string,
    tier: number,
    orderedCatalog: any[],
): Promise<{ id: number; passed: boolean; unlockedNextModuleId: string | null }> {
    const db = await getDB();
    const passed = total > 0 && correct / total >= PASS_THRESHOLD;

    const id = await db.add('progress', {
        profileId, moduleId, topic, tier, correct, total, passed,
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0],
    });

    let unlockedNextModuleId: string | null = null;

    if (passed) {
        await resolveWeakModule(moduleId);

        const currentIndex = orderedCatalog.findIndex(
            (m: any) => String(m.id) === String(moduleId)
        );
        if (currentIndex !== -1 && currentIndex + 1 < orderedCatalog.length) {
            const nextModule = orderedCatalog[currentIndex + 1];
            unlockedNextModuleId = String(nextModule.id);
            await unlockModule(profileId, unlockedNextModuleId);
        }
    } else {
        await addWeakModule(moduleId);
    }

    return { id: id as number, passed, unlockedNextModuleId };
}

export async function getAllProgress(): Promise<Progress[]> {
    const db = await getDB();
    return await db.getAll('progress');
}

export async function getProgressForProfile(profileId: string): Promise<Progress[]> {
    const db = await getDB();
    try {
        return await db.transaction('progress').store.index('profileId').getAll(profileId);
    } catch {
        // Index may not exist yet on old DBs — fall back to filtering all records
        const all = await db.getAll('progress') as Progress[];
        return all.filter((p: any) => p.profileId === profileId);
    }
}

// ============ WEAK MODULES ============

async function addWeakModule(moduleId: string): Promise<void> {
    const db = await getDB();
    const existing = await db.transaction('weakModules').store
        .index('moduleId').getAll(moduleId) as WeakModule[];
    const active = existing.find(e => !e.resolvedAt);
    if (active) {
        active.attemptCount = (active.attemptCount || 1) + 1;
        active.lastAttempt = Date.now();
        await db.put('weakModules', active);
    } else {
        await db.add('weakModules', {
            moduleId, identifiedAt: Date.now(), lastAttempt: Date.now(),
            resolvedAt: null, attemptCount: 1,
        });
    }
}

async function resolveWeakModule(moduleId: string): Promise<void> {
    const db = await getDB();
    const existing = await db.transaction('weakModules').store
        .index('moduleId').getAll(moduleId) as WeakModule[];
    const active = existing.find(e => !e.resolvedAt);
    if (active) {
        active.resolvedAt = Date.now();
        await db.put('weakModules', active);
    }
}

export async function getWeakModules(): Promise<WeakModule[]> {
    const db = await getDB();
    const all = await db.getAll('weakModules') as WeakModule[];
    return all.filter(w => !w.resolvedAt);
}

// ============ STORAGE STATS ============

export async function getStorageStats(): Promise<StorageStats> {
    const db = await getDB();
    const modules = await db.getAll('modules') as Module[];
    const progress = await db.getAll('progress') as Progress[];
    const totalBytes = modules.reduce((s, m) => s + new Blob([JSON.stringify(m)]).size, 0);
    return {
        modules: modules.length,
        progress: progress.length,
        weakModules: (await getWeakModules()).length,
        totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
    };
}