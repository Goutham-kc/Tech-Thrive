import { openDB, type IDBPDatabase } from 'idb';
import type { Profile, Progress, WeakModule, Module, StorageStats, TopicUnlock } from '../types';

const DB_NAME = 'GhostLearn';
// v3: replaces topicUnlocks with moduleUnlocks (flat per-module progression)
const DB_VERSION = 3;

// 75% correct required to unlock the next module
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
                progressStore.createIndex('timestamp', 'timestamp');
                progressStore.createIndex('passed', 'passed');
                progressStore.createIndex('date', 'date');
            }
            if (!db.objectStoreNames.contains('weakModules')) {
                const weakStore = db.createObjectStore('weakModules', {
                    keyPath: 'id',
                    autoIncrement: true,
                });
                weakStore.createIndex('moduleId', 'moduleId');
                weakStore.createIndex('resolved', 'resolvedAt');
            }
            // v2 store — keep for migration compatibility, drop in v3
            if (oldVersion < 3 && db.objectStoreNames.contains('topicUnlocks')) {
                db.deleteObjectStore('topicUnlocks');
            }
            // v3: flat set of unlocked module IDs (string keys matching catalog id)
            // The first module in the catalog is always unlocked by default.
            if (!db.objectStoreNames.contains('moduleUnlocks')) {
                db.createObjectStore('moduleUnlocks', { keyPath: 'moduleId' });
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

/**
 * Seed the very first module as unlocked. Call this after fetching the catalog
 * for the first time so the user always has something to start with.
 */
export async function seedFirstModule(firstModuleId: string): Promise<void> {
    const db = await getDB();
    const existing = await db.get('moduleUnlocks', firstModuleId);
    if (!existing) {
        await db.put('moduleUnlocks', { moduleId: firstModuleId, unlockedAt: Date.now() });
    }
}

/**
 * Returns the Set of module IDs the user has unlocked.
 */
export async function getUnlockedModuleIds(): Promise<Set<string>> {
    const db = await getDB();
    const all = await db.getAll('moduleUnlocks');
    return new Set(all.map((r: any) => String(r.moduleId)));
}

/**
 * Unlock a specific module by ID.
 */
export async function unlockModule(moduleId: string): Promise<void> {
    const db = await getDB();
    await db.put('moduleUnlocks', { moduleId: String(moduleId), unlockedAt: Date.now() });
}

// ============ PROGRESS ============

/**
 * Persist a quiz result.
 *
 * If the score is ≥ 75%, unlocks the next module in the ordered catalog list
 * and marks the weak module as resolved.
 *
 * @param moduleId        catalog module id (string)
 * @param correct         number of correct answers
 * @param total           total questions
 * @param topic           topic of the module
 * @param tier            tier of the module
 * @param orderedCatalog  full catalog modules array sorted by id ASC (needed to
 *                        find the next module to unlock)
 *
 * Returns { id, passed, unlockedNextModuleId } so the UI can react.
 */
export async function saveProgress(
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
        moduleId, topic, tier, correct, total, passed,
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0],
    });

    let unlockedNextModuleId: string | null = null;

    if (passed) {
        await resolveWeakModule(moduleId);

        // Find the next module in the ordered catalog and unlock it
        const currentIndex = orderedCatalog.findIndex(
            (m: any) => String(m.id) === String(moduleId)
        );
        if (currentIndex !== -1 && currentIndex + 1 < orderedCatalog.length) {
            const nextModule = orderedCatalog[currentIndex + 1];
            unlockedNextModuleId = String(nextModule.id);
            await unlockModule(unlockedNextModuleId);
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