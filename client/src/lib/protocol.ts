import { generateVectors, recoverChunk } from './kpir';

export async function fetchModule(
    targetIndex: number,
    totalChunks: number,
    sessionToken: string
): Promise<Uint8Array> {

    const vectors = generateVectors(targetIndex);
    const allChunks: Uint8Array[] = [];

    for (let i = 0; i < totalChunks; i++) {
        const payload = {
            v: [
                Array.from(vectors[0]),
                Array.from(vectors[1]),
                Array.from(vectors[2])
            ],
            idx: i,
            tok: sessionToken
        };

        const response = await fetch('/kpir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`PIR fetch failed: ${response.status}`);
        }

        const data = await response.json();

        const rawResponses: Uint8Array[] = data.r.map((b64: string) =>
            Uint8Array.from(atob(b64), c => c.charCodeAt(0))
        );

        allChunks.push(recoverChunk(rawResponses));
    }

    const totalSize = allChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const finalModule = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of allChunks) {
        finalModule.set(chunk, offset);
        offset += chunk.length;
    }

    return finalModule;
}