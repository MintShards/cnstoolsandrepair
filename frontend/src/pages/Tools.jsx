import { useState, useEffect } from 'react';
import { toolsAPI } from '../services/api';

export default function Tools() {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const data = await toolsAPI.list();
        setTools(data);
      } catch (error) {
        console.error('Failed to fetch tools:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTools();
  }, []);

  return (
    <main className="relative min-h-screen px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-900">
      <div className="max-w-screen-xl mx-auto">
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">Our Expertise</h2>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight uppercase">Tools We Repair</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-2xl mx-auto text-base lg:text-lg">
            Professional repair services for all major pneumatic tool categories and brands.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-6xl text-primary animate-spin">refresh</span>
            <p className="mt-4 text-slate-500">Loading tools...</p>
          </div>
        ) : tools.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
            {tools.map((tool) => (
              <div
                key={tool.id}
                className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700"
              >
                <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <span
                    className="material-symbols-outlined text-primary text-4xl"
                    style={{ fontVariationSettings: "'wght' 600" }}
                  >
                    build
                  </span>
                </div>
                <h3 className="text-lg font-black mb-2 uppercase tracking-tight">{tool.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{tool.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-6xl text-slate-400">inventory_2</span>
            <p className="mt-4 text-slate-500">No tools listed yet. Check back soon!</p>
          </div>
        )}
      </div>
    </main>
  );
}
