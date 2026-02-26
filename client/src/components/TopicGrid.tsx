import { useIndexedDB } from '../hooks/useIndexedDB';
import type { Module } from '../types';

interface TopicGridProps {
    onSelectModule: (moduleId: string) => void;
}

export function TopicGrid({ onSelectModule }: TopicGridProps) {
    const { data: modules, loading } = useIndexedDB<Module>('modules');
    
    // Sample topics if no modules yet
    const sampleTopics = [
        { id: 'algebra', name: 'Algebra', icon: '🔢', count: 5 },
        { id: 'geometry', name: 'Geometry', icon: '📐', count: 4 },
        { id: 'fractions', name: 'Fractions', icon: '🥧', count: 3 },
    ];
    
    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }
    
    const displayModules = Array.isArray(modules) && modules.length > 0 ? modules : sampleTopics;
    
    return (
        <div>
            <h2 className="text-2xl font-bold mb-6">Continue Learning</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayModules.map((item: any) => (
                    <div
                        key={item.id}
                        onClick={() => onSelectModule(item.id)}
                        className="bg-white rounded-lg shadow-md hover:shadow-xl transition cursor-pointer p-6 border border-gray-100 hover:border-indigo-200"
                    >
                        <div className="text-4xl mb-3">{item.icon || '📘'}</div>
                        <h3 className="text-xl font-semibold mb-2">{item.name || item.title}</h3>
                        <p className="text-gray-600 text-sm mb-3">
                            {item.count || item.tier || 'Beginner'} lessons available
                        </p>
                        <div className="flex justify-between items-center">
                            <span className="text-indigo-600 text-sm font-medium">
                                Continue →
                            </span>
                            <span className="text-xs text-gray-400">
                                {item.topic || 'offline'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}