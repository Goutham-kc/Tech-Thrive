const API_BASE = "http://127.0.0.1:8000";

export async function fetchCatalog() {
  const res = await fetch(`${API_BASE}/catalog`);
  return res.json();
}

export async function sendKpir(payload: any) {
  const res = await fetch(`${API_BASE}/kpir`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return res.json();
}