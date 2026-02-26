import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import zlib from 'node:zlib';

const BASE = "http://127.0.0.1:8000";
const K = 3;

// Hardcoded for testing — change to select a different module by index
const TARGET_INDEX = 0;

async function createSession() {
    const res = await fetch(`${BASE}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ghost_id: "debug-user" })
    });
    const data = await res.json();
    return data.token;
}

async function getCatalog() {
    const res = await fetch(`${BASE}/catalog`);
    const data = await res.json();
    return data.modules;
}

function generateKVectors(nModules, targetIndex) {
    const vectors = [];
    for (let i = 0; i < K - 1; i++) {
        const v = [];
        for (let j = 0; j < nModules; j++) {
            v.push(Math.floor(Math.random() * 256));
        }
        vectors.push(v);
    }

    const last = [];
    for (let j = 0; j < nModules; j++) {
        let sum = 0;
        for (let i = 0; i < K - 1; i++) {
            sum = (sum + vectors[i][j]) % 256;
        }
        if (j === targetIndex) {
            last.push((1 - sum + 256) % 256);
        } else {
            last.push((0 - sum + 256) % 256);
        }
    }
    vectors.push(last);
    return vectors;
}

function detectExtension(buffer) {
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return "jpg";
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return "pdf";
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return "png";
    return "bin";
}

function reconstruct(responses) {
    const chunkSize = responses[0].length;
    const result = new Uint8Array(chunkSize);
    for (let i = 0; i < chunkSize; i++) {
        let sum = 0;
        for (let k = 0; k < responses.length; k++) {
            sum = (sum + responses[k][i]) % 256;
        }
        result[i] = sum;
    }
    return result;
}

// Session TTL is 60s server-side. Refresh token if a download might take longer.
async function refreshSessionIfNeeded(token, startTime) {
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed > 45) {
        console.log("Refreshing session token...");
        return await createSession();
    }
    return token;
}

async function run() {
    try {
        let token = await createSession();
        const sessionStart = Date.now();

        const modules = await getCatalog();
        const nModules = modules.length;
        const targetModule = modules[TARGET_INDEX];

        console.log(`Downloading module: ${JSON.stringify(targetModule)}`);

        const totalChunks = targetModule.chunk_count;
        const recoveredChunks = [];

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            token = await refreshSessionIfNeeded(token, sessionStart);

            const vectors = generateKVectors(nModules, TARGET_INDEX);

            const res = await fetch(`${BASE}/kpir`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, vectors, chunk_index: chunkIndex })
            });

            if (!res.ok) throw new Error(`Server error on chunk ${chunkIndex}: ${res.status}`);

            const data = await res.json();
            const recovered = reconstruct(data.responses);
            recoveredChunks.push(Buffer.from(recovered));

            console.log(`Recovered chunk ${chunkIndex + 1}/${totalChunks}`);
        }

        const fullCompressed = Buffer.concat(recoveredChunks);

        // Trim padding added by the server to fill the last chunk to CHUNK_SIZE
        const trimmed = fullCompressed.slice(0, targetModule.compressed_size);

        console.log("Decompressing binary stream...");
        const decompressed = zlib.brotliDecompressSync(trimmed);

        const ext = targetModule.filename
            ? targetModule.filename.split('.').pop()
            : detectExtension(decompressed);
        const filename = targetModule.filename || `recovered_file.${ext}`;

        fs.writeFileSync(filename, decompressed);
        console.log(`File reconstructed and saved as '${filename}' successfully!`);

    } catch (error) {
        console.error("Critical Failure:", error.message);
    }
}

run();