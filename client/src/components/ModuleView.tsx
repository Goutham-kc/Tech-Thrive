import { useState, useEffect } from 'preact/hooks';
import { getModule, saveModule } from '../lib/idb-store';
import { fetchCatalog, sendKpir } from '../lib/api';
import { generateVectors, recoverChunk } from '../lib/kpir';
import type { Module } from '../types';

interface ModuleViewProps {
    moduleId: string;
    sessionToken: string;
    onBack: () => void;
    /**
     * Called when the user clicks "Take quiz".
     * Passes moduleId, topic, and tier so the parent can wire Quiz correctly.
     */
    onStartQuiz: (moduleId: string, topic: string, tier: number) => void;
}

type DownloadState = 'idle' | 'downloading' | 'decompressing' | 'ready' | 'error';

function detectMimeType(buffer: Uint8Array): string {
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg';
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'application/pdf';
    return 'application/octet-stream';
}

export function ModuleView({ moduleId, sessionToken, onBack, onStartQuiz }: ModuleViewProps) {
    const [downloadState, setDownloadState] = useState<DownloadState>('idle');
    const [progress, setProgress] = useState(0);
    const [totalChunks, setTotalChunks] = useState(0);
    const [moduleTitle, setModuleTitle] = useState('');
    const [moduleTopic, setModuleTopic] = useState('');
    const [moduleTier, setModuleTier] = useState(1);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState('');
    const [filename, setFilename] = useState('');
    const [error, setError] = useState('');

    useEffect(() => { loadModule(); }, [moduleId]);

    async function loadModule() {
        const cached = await getModule(moduleId);
        if (cached && (cached as any).fileData) {
            const buffer = new Uint8Array((cached as any).fileData as number[]);
            const mime = detectMimeType(buffer);
            setFileUrl(URL.createObjectURL(new Blob([buffer], { type: mime })));
            setMimeType(mime);
            setModuleTitle(cached.title || moduleId);
            setModuleTopic((cached as any).topic || '');
            setModuleTier((cached as any).tier || 1);
            setFilename((cached as any).filename || moduleId);
            setDownloadState('ready');
            return;
        }
        await startDownload();
    }

    async function startDownload() {
        setDownloadState('downloading');
        setError('');
        setProgress(0);

        try {
            const catalogData = await fetchCatalog();
            const modules: any[] = catalogData.modules;

            // n = total modules in catalog — required to size PIR vectors correctly
            const nModules = modules.length;

            const targetModule = modules.find((m: any) => String(m.id) === String(moduleId));
            if (!targetModule) throw new Error('Module not found in catalog');

            setModuleTitle(targetModule.title || moduleId);
            setModuleTopic(targetModule.topic || '');
            setModuleTier(targetModule.tier || 1);
            setFilename(targetModule.filename || moduleId);
            setTotalChunks(targetModule.chunk_count);

            // targetIndex is the 0-based position in the ordered catalog array.
            const targetIndex = modules.indexOf(targetModule);
            const recoveredChunks: Uint8Array[] = [];

            for (let chunkIndex = 0; chunkIndex < targetModule.chunk_count; chunkIndex++) {
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

                const responses: Uint8Array[] = data.responses.map(
                    (r: number[]) => new Uint8Array(r)
                );

                recoveredChunks.push(recoverChunk(responses));
                setProgress(chunkIndex + 1);
            }

            setDownloadState('decompressing');

            // Concatenate recovered chunks
            const totalSize = recoveredChunks.reduce((a, c) => a + c.length, 0);
            const full = new Uint8Array(totalSize);
            let offset = 0;
            for (const chunk of recoveredChunks) { full.set(chunk, offset); offset += chunk.length; }

            // Trim server-side padding to exact compressed byte count
            const trimmed = full.slice(0, targetModule.compressed_size);

            // Validate compression header before attempting decompression
            const isGzip = trimmed[0] === 0x1F && trimmed[1] === 0x8B;

            if (!isGzip) {
                throw new Error(
                    `Compressed data header invalid. Expected gzip (0x1F 0x8B).`
                );
            }

            // Decompress using native DecompressionStream
            const ds = new DecompressionStream('gzip');
            const writer = ds.writable.getWriter();
            writer.write(trimmed);
            writer.close();
            const decompressedChunks: Uint8Array[] = [];
            const reader = ds.readable.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                decompressedChunks.push(value);
            }
            const decompSize = decompressedChunks.reduce((a, c) => a + c.length, 0);
            const decompressed = new Uint8Array(decompSize);
            let dOff = 0;
            for (const c of decompressedChunks) { decompressed.set(c, dOff); dOff += c.length; }

            const mime = detectMimeType(decompressed);
            setMimeType(mime);
            setFileUrl(URL.createObjectURL(new Blob([decompressed], { type: mime })));

            // Cache to IndexedDB
            await saveModule({
                ...targetModule,
                id: moduleId,
                fileData: Array.from(decompressed),
            } as any);

            setDownloadState('ready');
        } catch (err: any) {
            setError(err.message || 'Download failed');
            setDownloadState('error');
        }
    }

    const progressPct = totalChunks > 0 ? Math.round((progress / totalChunks) * 100) : 0;

    return (
        <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="min-h-screen bg-stone-50">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap');`}</style>

            <div className="bg-white border-b border-stone-100 px-6 py-3.5 flex items-center justify-between">
                <button onClick={onBack}
                        className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Library
                </button>
                <span className="text-sm font-medium text-stone-700">{moduleTitle || moduleId}</span>
                {downloadState === 'ready' ? (
                    <button onClick={() => onStartQuiz(moduleId, moduleTopic, moduleTier)}
                            className="px-3.5 py-1.5 bg-stone-900 text-white text-xs font-medium rounded-lg hover:bg-stone-700 transition-colors">
                        Take quiz →
                    </button>
                ) : <div className="w-20" />}
            </div>

            <div className="max-w-4xl mx-auto p-8">
                {(downloadState === 'downloading' || downloadState === 'decompressing') && (
                    <div className="flex flex-col items-center justify-center py-24 gap-6">
                        <div className="w-full max-w-sm">
                            <div className="flex justify-between items-center mb-2">
                                <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-xs text-stone-400">
                                    {downloadState === 'decompressing' ? 'decompressing…' : `chunk ${progress} / ${totalChunks}`}
                                </span>
                                <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-xs text-stone-400">
                                    {downloadState === 'decompressing' ? '' : `${progressPct}%`}
                                </span>
                            </div>
                            <div className="h-px bg-stone-100 w-full rounded-full overflow-hidden">
                                <div className="h-full bg-stone-400 transition-all duration-300 rounded-full"
                                     style={{ width: downloadState === 'decompressing' ? '100%' : `${progressPct}%` }} />
                            </div>
                            <p className="text-xs text-stone-300 mt-3 text-center">
                                {downloadState === 'downloading'
                                    ? 'Fetching via PIR — server cannot see which module'
                                    : 'Almost done…'}
                            </p>
                        </div>
                    </div>
                )}

                {downloadState === 'error' && (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <p className="text-sm text-stone-600">{error}</p>
                        <button onClick={startDownload}
                                className="px-4 py-2 bg-stone-900 text-white text-xs font-medium rounded-lg hover:bg-stone-700 transition-colors">
                            Retry
                        </button>
                    </div>
                )}

                {downloadState === 'ready' && fileUrl && (
                    <div className="space-y-4">
                        {mimeType.startsWith('image/') && (
                            <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden">
                                <img src={fileUrl} alt={moduleTitle} className="w-full h-auto" />
                            </div>
                        )}
                        {mimeType === 'application/pdf' && (
                            <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden">
                                <iframe src={fileUrl} className="w-full" style={{ height: '75vh' }} title={moduleTitle} />
                            </div>
                        )}
                        {!mimeType.startsWith('image/') && mimeType !== 'application/pdf' && (
                            <div className="bg-white border border-stone-100 rounded-2xl p-8 text-center">
                                <p className="text-sm text-stone-500 mb-4">This file type cannot be previewed inline.</p>
                                <a href={fileUrl} download={filename}
                                   className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-900 text-white text-xs font-medium rounded-lg hover:bg-stone-700 transition-colors">
                                    Download {filename}
                                </a>
                            </div>
                        )}
                        <div className="flex items-center justify-between pt-2">
                            <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-xs text-stone-300">
                                cached locally · private retrieval
                            </span>
                            <div className="flex gap-2">
                                <a href={fileUrl} download={filename}
                                   className="px-3.5 py-1.5 border border-stone-200 text-stone-600 text-xs font-medium rounded-lg hover:border-stone-300 transition-colors">
                                    Download
                                </a>
                                <button onClick={() => onStartQuiz(moduleId, moduleTopic, moduleTier)}
                                        className="px-3.5 py-1.5 bg-stone-900 text-white text-xs font-medium rounded-lg hover:bg-stone-700 transition-colors">
                                    Take quiz →
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}