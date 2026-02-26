// validator.ts

import { generateVectors, recoverChunk } from './kpir';

const N_MODULES = 20;
const CHUNK_SIZE = 4096;

const mockServerMatrix = Array.from({ length: N_MODULES }, (_, i) => {
    return new Uint8Array(CHUNK_SIZE).fill(i + 10);
});

// Server simulation — now correctly in Z_256
const computeResponse = (v: Uint8Array): Uint8Array => {
    const response = new Uint8Array(CHUNK_SIZE);

    for (let byteIdx = 0; byteIdx < CHUNK_SIZE; byteIdx++) {
        let dot = 0;
        for (let modIdx = 0; modIdx < N_MODULES; modIdx++) {
            dot += v[modIdx] * mockServerMatrix[modIdx][byteIdx];
        }
        response[byteIdx] = dot % 256;
    }

    return response;
};

function verifyVectors(targetIndex: number): void {
    const [v0, v1, v2] = generateVectors(targetIndex);

    for (let i = 0; i < N_MODULES; i++) {
        const sum = (v0[i] + v1[i] + v2[i]) % 256;
        const expected = i === targetIndex ? 1 : 0;

        if (sum !== expected) {
            console.error(`❌ Vector sum wrong at index ${i}: got ${sum}, expected ${expected}`);
            return;
        }
    }
    console.log(`✅ Vectors verified — sum equals basis vector e_${targetIndex}`);
}

async function runTest(targetModuleIndex: number) {
    console.log(`--- Testing PIR for Module Index: ${targetModuleIndex} ---`);

    const [v0, v1, v2] = generateVectors(targetModuleIndex);

    const r0 = computeResponse(v0);
    const r1 = computeResponse(v1);
    const r2 = computeResponse(v2);

    const recovered = recoverChunk([r0, r1, r2]);

    const expectedValue = targetModuleIndex + 10;
    const isCorrect = recovered.every(byte => byte === expectedValue % 256);

    if (isCorrect) {
        console.log(`✅ SUCCESS: Data recovered perfectly. Every byte = ${expectedValue}`);
    } else {
        console.error("❌ FAILURE: Data mismatch!");
        console.log("Recovered (first 5 bytes):", recovered.slice(0, 5));
        console.log("Expected:", expectedValue);
    }
}

// Test all module indices
const start = performance.now()

for (let i = 0; i < N_MODULES; i++) {
    verifyVectors(i)
    await runTest(i)
}

const elapsed = performance.now() - start
console.log(`\nAll 20 modules verified in ${elapsed.toFixed(2)}ms`)