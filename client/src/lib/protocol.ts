import { generateVectors, recoverChunk } from './kpir';
import { fetchCatalog, sendKpir } from './api';

export async function fetchModule(
    moduleId: string | number,
    sessionToken: string
): Promise<Uint8Array> {
    // Fetch catalog to get nModules (required for PIR vector sizing) and module metadata
    const catalogData = await fetchCatalog();
    const modules: any[] = catalogData.modules;
    const nModules = modules.length;

    const targetModule = modules.find((m: any) => String(m.id) === String(moduleId));
    if (!targetModule) throw new Error(`Module ${moduleId} not found in catalog`);

    // PIR index is the 0-based position in the ordered catalog array, NOT the DB id
    const targetIndex = modules.indexOf(targetModule);
    const totalChunks: number = targetModule.chunk_count;

    const allChunks: Uint8Array[] = [];

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        // Generate fresh vectors for every chunk — reusing vectors across chunks
        // would leak which chunks belong to the same module.
        const vectors = generateVectors(targetIndex, nModules);

        const data = await sendKpir({
            token: sessionToken,
            vectors: [
                Array.from(vectors[0]),
                Array.from(vectors[1]),
                Array.from(vectors[2]),
            ],
            chunk_index: chunkIndex,
        });

        // Server returns responses as plain number arrays (see pir-test.js and api.ts)
        const responses: Uint8Array[] = data.responses.map(
            (r: number[]) => new Uint8Array(r)
        );

        allChunks.push(recoverChunk(responses));
    }

    // Concatenate all recovered chunks
    const totalSize = allChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const finalModule = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of allChunks) {
        finalModule.set(chunk, offset);
        offset += chunk.length;
    }

    // Trim server-side padding to exact compressed_size, then caller decompresses
    return finalModule.slice(0, targetModule.compressed_size);
}