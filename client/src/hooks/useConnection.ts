import { useState, useEffect } from 'preact/hooks';

interface ConnectionState {
    online: boolean;
    type: string;
}

export function useConnection(): ConnectionState {
    const [online, setOnline] = useState<boolean>(navigator.onLine);
    const [type, setType] = useState<string>('unknown');

    useEffect(() => {
        const handleOnline = () => setOnline(true);
        const handleOffline = () => setOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        let conn: any = null;
        let handleChange: (() => void) | null = null;

        if ('connection' in navigator) {
            conn = (navigator as any).connection;
            setType(conn.effectiveType);
            handleChange = () => setType(conn.effectiveType);
            conn.addEventListener('change', handleChange);
        }

        // Single cleanup function always removes all listeners
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (conn && handleChange) {
                conn.removeEventListener('change', handleChange);
            }
        };
    }, []);

    return { online, type };
}