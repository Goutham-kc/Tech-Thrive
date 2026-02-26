// Base URL can be overridden at build time via VITE_API_URL env variable.
// Falls back to the local dev server.
const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "http://127.0.0.1:8000";

import { emitNetEvent } from './events';
import type { NetEventType } from './events';

/**
 * Instrumented fetch wrapper — measures real request and response byte sizes
 * and broadcasts a NetEvent so the Demo Panel bandwidth tab shows live data.
 */
async function apiFetch(
    url: string,
    options: RequestInit = {},
    type: NetEventType = 'Other',
): Promise<Response> {
    // Measure outgoing bytes from the serialized body
    const reqBytes = options.body
        ? new Blob([options.body as string]).size
        : 0;

    const res = await fetch(url, options);

    // Clone so the original response body is still consumable by the caller
    const clone = res.clone();
    const buf = await clone.arrayBuffer();
    const resBytes = buf.byteLength;

    emitNetEvent({
        type,
        method: options.method ?? 'GET',
        url: url.replace(API_BASE, ''),
        reqBytes,
        resBytes,
        status: res.status,
        timestamp: Date.now(),
    });

    return res;
}

// -------- Public API --------

export async function fetchCatalog() {
    const res = await apiFetch(`${API_BASE}/catalog`, {}, 'Catalog');
    if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`);
    return res.json();
}

export async function createSession(ghostId: string): Promise<string> {
    const body = JSON.stringify({ ghost_id: ghostId });
    const res = await apiFetch(
        `${API_BASE}/session`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
        'Auth',
    );
    if (!res.ok) throw new Error(`Session creation failed: ${res.status}`);
    const data = await res.json();
    return data.token;
}

export async function sendKpir(payload: {
    token: string;
    vectors: number[][];
    chunk_index: number;
}) {
    const body = JSON.stringify(payload);
    const res = await apiFetch(
        `${API_BASE}/kpir`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
        'PIR',
    );
    if (!res.ok) throw new Error(`KPIR request failed: ${res.status}`);
    return res.json();
}

export async function fetchQuiz(moduleId: number | string) {
    const res = await apiFetch(`${API_BASE}/quiz/${moduleId}`, {}, 'Quiz');
    if (!res.ok) throw new Error(`Quiz fetch failed: ${res.status}`);
    return res.json();
}

// -------- Admin API --------

export async function adminListModules(adminKey: string) {
    const res = await apiFetch(
        `${API_BASE}/admin/modules?admin_key=${encodeURIComponent(adminKey)}`,
        {},
        'Other',
    );
    if (!res.ok) throw new Error(`Admin list failed: ${res.status}`);
    return res.json();
}

export async function adminUploadModule(
    adminKey: string,
    file: File,
    title: string,
    topic: string,
    tier: number,
) {
    const form = new FormData();
    form.append('admin_key', adminKey);
    form.append('title', title);
    form.append('topic', topic);
    form.append('tier', String(tier));
    form.append('file', file);

    // FormData bodies can't be measured as a simple Blob — approximate from file size
    const reqBytes = file.size;
    const res = await fetch(`${API_BASE}/admin/upload`, { method: 'POST', body: form });

    const clone = res.clone();
    const buf = await clone.arrayBuffer();
    emitNetEvent({
        type: 'Other',
        method: 'POST',
        url: '/admin/upload',
        reqBytes,
        resBytes: buf.byteLength,
        status: res.status,
        timestamp: Date.now(),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Upload failed: ${res.status}`);
    }
    return res.json();
}

export async function adminDeleteModule(adminKey: string, moduleId: number) {
    const body = JSON.stringify({ admin_key: adminKey });
    const res = await apiFetch(
        `${API_BASE}/admin/modules/${moduleId}`,
        { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body },
        'Other',
    );
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Delete failed: ${res.status}`);
    }
    return res.json();
}

export async function adminAddQuizQuestion(
    adminKey: string,
    moduleId: number,
    question: string,
    options: string[],
    correct: number,
) {
    const body = JSON.stringify({ admin_key: adminKey, module_id: moduleId, question, options, correct });
    const res = await apiFetch(
        `${API_BASE}/admin/quiz`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
        'Other',
    );
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Quiz save failed: ${res.status}`);
    }
    return res.json();
}

export async function adminDeleteQuizQuestion(adminKey: string, questionId: number) {
    const body = JSON.stringify({ admin_key: adminKey });
    const res = await apiFetch(
        `${API_BASE}/admin/quiz/${questionId}`,
        { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body },
        'Other',
    );
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Delete failed: ${res.status}`);
    }
    return res.json();
}