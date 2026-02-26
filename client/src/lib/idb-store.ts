import { openDB, IDBPDatabase } from 'idb';
import type { Profile, Progress, WeakModule, Module, StorageStats } from '../types';

const DB_NAME = 'GhostLearn';
const DB_VERSION = 1;

export async function initDB(): Promise<IDBPDatabase> {
    return await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // Vault store
            if (!db.objectStoreNames.contains('vault')) {
                const vaultStore = db.createObjectStore('vault', { keyPath: 'id' });
                vaultStore.createIndex('ghostID', 'ghostID', { unique: true });
                vaultStore.createIndex('lastAccessed', 'lastAccessed');
            }
            
            // Catalog store
            if (!db.objectStoreNames.contains('catalog')) {
                db.createObjectStore('catalog', { keyPath: 'id' });
            }
            
            // Chunks store
            if (!db.objectStoreNames.contains('chunks')) {
                const chunkStore = db.createObjectStore('chunks', { keyPath: 'key' });
                chunkStore.createIndex('moduleId', 'moduleId');
                chunkStore.createIndex('timestamp', 'timestamp');
            }
            
            // Modules store
            if (!db.objectStoreNames.contains('modules')) {
                const moduleStore = db.createObjectStore('modules', { keyPath: 'id' });
                moduleStore.createIndex('topic', 'topic');
                moduleStore.createIndex('tier', 'tier');
                moduleStore.createIndex('downloadedAt', 'downloadedAt');
            }
            
            // Progress store
            if (!db.objectStoreNames.contains('progress')) {
                const progressStore = db.createObjectStore('progress', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                progressStore.createIndex('moduleId', 'moduleId');
                progressStore.createIndex('timestamp', 'timestamp');
                progressStore.createIndex('passed', 'passed');
                progressStore.createIndex('date', 'date');
            }
            
            // Weak modules store
            if (!db.objectStoreNames.contains('weakModules')) {
                const weakStore = db.createObjectStore('weakModules', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                weakStore.createIndex('moduleId', 'moduleId');
                weakStore.createIndex('resolved', 'resolvedAt');
            }
            
            console.log('✅ IndexedDB ready');
        }
    });
}

let dbInstance: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
    if (!dbInstance) {
        dbInstance = await initDB();
    }
    return dbInstance;
}

// ============ VAULT METHODS ============

export async function saveProfile(profile: Profile): Promise<Profile> {
    const db = await getDB();
    const profileWithAccess = {
        ...profile,
        lastAccessed: Date.now()
    };
    await db.put('vault', profileWithAccess);
    localStorage.setItem('activeProfile', profile.id);
    return profileWithAccess;
}

export async function getActiveProfile(): Promise<Profile | null> {
    const id = localStorage.getItem('activeProfile');
    if (!id) return null;
    const db = await getDB();
    return await db.get('vault', id);
}

export async function findProfileByGhostID(ghostID: string): Promise<Profile | null> {
    const db = await getDB();
    const index = db.transaction('vault').store.index('ghostID');
    return await index.get(ghostID);
}

// ============ CATALOG METHODS ============

export async function saveCatalog(catalog: any, version?: string): Promise<void> {
    const db = await getDB();
    await db.put('catalog', {
        id: 'main',
        data: catalog,
        version,
        downloadedAt: Date.now()
    });
}

export async function getCatalog(): Promise<any | null> {
    const db = await getDB();
    const catalog = await db.get('catalog', 'main');
    return catalog?.data || null;
}

// ============ MODULE METHODS ============

export async function saveModule(moduleData: Module): Promise<void> {
    const db = await getDB();
    await db.put('modules', {
        ...moduleData,
        downloadedAt: Date.now()
    });
}

export async function getModule(id: string): Promise<Module | null> {
    const db = await getDB();
    return await db.get('modules', id);
}

export async function getAllModules(): Promise<Module[]> {
    const db = await getDB();
    return await db.getAll('modules');
}

// ============ PROGRESS METHODS ============

export async function saveProgress(moduleId: string, correct: number, total: number): Promise<{ id: number; passed: boolean }> {
    const db = await getDB();
    const passed = correct >= 2;
    
    const id = await db.add('progress', {
        moduleId,
        correct,
        total,
        passed,
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0]
    });
    
    if (!passed) {
        await addWeakModule(moduleId);
    } else {
        await resolveWeakModule(moduleId);
    }
    
    return { id: id as number, passed };
}

export async function getAllProgress(): Promise<Progress[]> {
    const db = await getDB();
    return await db.getAll('progress');
}

// ============ WEAK MODULE METHODS ============

async function addWeakModule(moduleId: string): Promise<void> {
    const db = await getDB();
    const index = db.transaction('weakModules').store.index('moduleId');
    const existing = await index.getAll(moduleId) as WeakModule[];
    
    const active = existing.find(e => !e.resolvedAt);
    if (active) {
        active.attemptCount = (active.attemptCount || 1) + 1;
        active.lastAttempt = Date.now();
        await db.put('weakModules', active);
    } else {
        await db.add('weakModules', {
            moduleId,
            identifiedAt: Date.now(),
            lastAttempt: Date.now(),
            resolvedAt: null,
            attemptCount: 1
        });
    }
}

async function resolveWeakModule(moduleId: string): Promise<void> {
    const db = await getDB();
    const index = db.transaction('weakModules').store.index('moduleId');
    const existing = await index.getAll(moduleId) as WeakModule[];
    
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
    
    const totalBytes = modules.reduce((sum, m) => 
        sum + new Blob([JSON.stringify(m)]).size, 0
    );
    
    return {
        modules: modules.length,
        progress: progress.length,
        weakModules: (await getWeakModules()).length,
        totalMB: (totalBytes / (1024 * 1024)).toFixed(2)
    };
}