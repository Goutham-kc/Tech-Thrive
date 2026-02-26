// client/src/lib/events.ts

export type NetEventType = 'PIR' | 'Auth' | 'Catalog' | 'Quiz' | 'Other';

export interface NetEvent {
    type: NetEventType;
    method: string;
    url: string;
    reqBytes: number;
    resBytes: number;
    status: number;
    timestamp: number;
}

// ── Per-session cumulative totals ──────────────────────────────────────────
// These survive panel open/close since they live in module scope, not component
// state. The Demo Panel adds the running totals to its in-window log aggregates.

interface SessionTotals {
    reqBytes: number;
    resBytes: number;
    byType: Partial<Record<NetEventType, { reqBytes: number; resBytes: number; count: number }>>;
}

const SESSION_TOTALS: SessionTotals = {
    reqBytes: 0,
    resBytes: 0,
    byType: {},
};

export function getSessionTotals(): Readonly<SessionTotals> {
    return SESSION_TOTALS;
}

// ── Event bus ─────────────────────────────────────────────────────────────

let lastEvent: NetEvent | null = null;
const listeners: ((event: NetEvent) => void)[] = [];

export const emitNetEvent = (event: NetEvent) => {
    // Accumulate into session totals
    SESSION_TOTALS.reqBytes += event.reqBytes;
    SESSION_TOTALS.resBytes += event.resBytes;

    const bucket = SESSION_TOTALS.byType[event.type] ?? { reqBytes: 0, resBytes: 0, count: 0 };
    bucket.reqBytes += event.reqBytes;
    bucket.resBytes += event.resBytes;
    bucket.count    += 1;
    SESSION_TOTALS.byType[event.type] = bucket;

    lastEvent = event;
    listeners.forEach(l => l(event));
};

export const subscribeNetEvent = (callback: (event: NetEvent) => void) => {
    listeners.push(callback);
    return () => {
        const idx = listeners.indexOf(callback);
        if (idx > -1) listeners.splice(idx, 1);
    };
};

export const getLastEvent = () => lastEvent;