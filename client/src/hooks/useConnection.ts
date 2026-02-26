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
        
        if ('connection' in navigator) {
            const conn = (navigator as any).connection;
            setType(conn.effectiveType);
            
            const handleChange = () => setType(conn.effectiveType);
            conn.addEventListener('change', handleChange);
            
            return () => {
                conn.removeEventListener('change', handleChange);
            };
        }
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
    
    return { online, type };
}