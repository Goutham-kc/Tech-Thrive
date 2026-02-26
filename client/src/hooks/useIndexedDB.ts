import { useState, useEffect } from 'preact/hooks';
import { getDB } from '../lib/idb-store';

export function useIndexedDB<T>(storeName: string) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const db = await getDB();
                const result = await db.getAll(storeName) as T[];
                if (!cancelled) {
                    setData(result);
                    setLoading(false);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError(err.message || 'Failed to load');
                    setLoading(false);
                }
            }
        }

        load();
        return () => { cancelled = true; };
    }, [storeName]);

    return { data, loading, error };
}