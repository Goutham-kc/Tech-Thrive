// client/src/lib/kpir.ts

const FIELD = 256; // Z_256

export type PIRVectors = [Uint8Array, Uint8Array, Uint8Array];

/**
 * Generate k=3 random secret-sharing vectors over Z_256 for a given target
 * module index.  The vectors sum to the standard basis vector e_{targetIndex}:
 *   v0[i] + v1[i] + v2[i] ≡ (i === targetIndex ? 1 : 0)  (mod 256)
 *
 * @param targetIndex  0-based index of the module in the catalog
 * @param nModules     total number of modules in the current catalog
 */
export function generateVectors(targetIndex: number, nModules: number): PIRVectors {
    if (targetIndex < 0 || targetIndex >= nModules) {
        throw new RangeError(`targetIndex ${targetIndex} out of range [0, ${nModules})`);
    }

    const v0 = new Uint8Array(nModules);
    const v1 = new Uint8Array(nModules);
    const v2 = new Uint8Array(nModules);

    crypto.getRandomValues(v0);
    crypto.getRandomValues(v1);

    for (let i = 0; i < nModules; i++) {
        const targetVal = i === targetIndex ? 1 : 0;
        // v2[i] = (targetVal - v0[i] - v1[i]) mod 256
        v2[i] = ((targetVal - v0[i] - v1[i]) % FIELD + FIELD * 2) % FIELD;
    }

    return [v0, v1, v2];
}

/**
 * Recover the target chunk by summing the three server responses over Z_256.
 */
export function recoverChunk(responses: Uint8Array[]): Uint8Array {
    const size = responses[0].length;
    const recovered = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
        recovered[i] = (responses[0][i] + responses[1][i] + responses[2][i]) % FIELD;
    }
    return recovered;
}