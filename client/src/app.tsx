import { useEffect, useState } from "preact/hooks";
import { fetchCatalog } from "./lib/api";

export default function App() {
  const [modules, setModules] = useState<number[]>([]);

  useEffect(() => {
    fetchCatalog().then(data => {
      setModules(data.modules);
    });
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl mb-4">Catalog</h1>
      <ul>
        {modules.map(id => (
          <li key={id}>Module {id}</li>
        ))}
      </ul>
    </div>
  );
}