// Base URL can be overridden at build time via VITE_API_URL env variable.
// Falls back to the local dev server.
const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "http://127.0.0.1:8000";

// -------- Public API --------

export async function fetchCatalog() {
  const res = await fetch(`${API_BASE}/catalog`);
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`);
  return res.json();
}

export async function createSession(ghostId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ghost_id: ghostId }),
  });
  if (!res.ok) throw new Error(`Session creation failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

export async function sendKpir(payload: {
  token: string;
  vectors: number[][];
  chunk_index: number;
}) {
  const res = await fetch(`${API_BASE}/kpir`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`KPIR request failed: ${res.status}`);
  return res.json();
}

export async function fetchQuiz(moduleId: number | string) {
  const res = await fetch(`${API_BASE}/quiz/${moduleId}`);
  if (!res.ok) throw new Error(`Quiz fetch failed: ${res.status}`);
  return res.json();
}

// -------- Admin API --------

export async function adminListModules(adminKey: string) {
  const res = await fetch(`${API_BASE}/admin/modules?admin_key=${encodeURIComponent(adminKey)}`);
  if (!res.ok) throw new Error(`Admin list failed: ${res.status}`);
  return res.json(); // { modules: [...] }
}

export async function adminUploadModule(
  adminKey: string,
  file: File,
  title: string,
  topic: string,
  tier: number
) {
  const form = new FormData();
  form.append("admin_key", adminKey);
  form.append("title", title);
  form.append("topic", topic);
  form.append("tier", String(tier));
  form.append("file", file);

  const res = await fetch(`${API_BASE}/admin/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `Upload failed: ${res.status}`);
  }
  return res.json(); // { status, module_id, modules: [...] }
}

export async function adminDeleteModule(adminKey: string, moduleId: number) {
  const res = await fetch(`${API_BASE}/admin/modules/${moduleId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_key: adminKey }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `Delete failed: ${res.status}`);
  }
  return res.json(); // { status, modules: [...] }
}

export async function adminAddQuizQuestion(
  adminKey: string,
  moduleId: number,
  question: string,
  options: string[],
  correct: number
) {
  const res = await fetch(`${API_BASE}/admin/quiz`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_key: adminKey, module_id: moduleId, question, options, correct }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `Quiz save failed: ${res.status}`);
  }
  return res.json();
}

export async function adminDeleteQuizQuestion(adminKey: string, questionId: number) {
  const res = await fetch(`${API_BASE}/admin/quiz/${questionId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_key: adminKey }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `Delete failed: ${res.status}`);
  }
  return res.json();
}