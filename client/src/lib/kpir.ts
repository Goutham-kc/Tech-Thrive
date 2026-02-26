// client/src/lib/kpir.ts

const N_MODULES: number = 20;
const FIELD: number = 256;  // Everything works in Z_256

export type PIRVectors = [Uint8Array, Uint8Array, Uint8Array];

export function generateVectors(targetIndex: number): PIRVectors {
    const v0 = new Uint8Array(N_MODULES);
    const v1 = new Uint8Array(N_MODULES);
    const v2 = new Uint8Array(N_MODULES);

    // Random bytes — already in Z_256 naturally
    crypto.getRandomValues(v0);
    crypto.getRandomValues(v1);

    for (let i = 0; i < N_MODULES; i++) {
        const targetVal = (i === targetIndex) ? 1 : 0;

        // v2[i] = (targetVal - v0[i] - v1[i]) mod 256
        // +512 ensures positive before mod
        v2[i] = ((targetVal - v0[i] - v1[i]) % FIELD + FIELD * 2) % FIELD;
    }

    return [v0, v1, v2];
}

export function recoverChunk(responses: Uint8Array[]): Uint8Array {
    const size = responses[0].length;
    const recovered = new Uint8Array(size);

    for (let i = 0; i < size; i++) {
        recovered[i] = (responses[0][i] + responses[1][i] + responses[2][i]) % FIELD;
    }

    return recovered;
}