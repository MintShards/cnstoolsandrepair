export default function AboutTab() {
  return (
    <div>
      <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-6">
        About Page Content
      </h2>

      <div className="p-6 bg-blue-900/20 border border-blue-700 rounded-lg">
        <div className="flex gap-3">
          <span className="material-symbols-outlined text-blue-400">info</span>
          <div className="flex-1 text-sm text-blue-300">
            <p className="font-bold mb-1">About Content Management</p>
            <p className="text-blue-400 mb-2">
              About page content is managed via the About Content API at <code className="px-2 py-1 bg-slate-900 rounded">/api/about-content</code>.
            </p>
            <p className="text-blue-400">
              Rich text editor for company story, mission statement, and team description coming in next update.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 p-6 bg-slate-800 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">About Page Sections (Coming Soon)</h3>
        <ul className="space-y-3 text-slate-300 text-sm">
          <li>
            <div className="font-bold text-white mb-1">Company Story</div>
            <p className="text-slate-400">Rich text editor for your company's history and background</p>
          </li>
          <li>
            <div className="font-bold text-white mb-1">Mission Statement</div>
            <p className="text-slate-400">Define your company's purpose and values</p>
          </li>
          <li>
            <div className="font-bold text-white mb-1">Team Description</div>
            <p className="text-slate-400">Highlight your team's expertise and qualifications</p>
          </li>
        </ul>
      </div>
    </div>
  );
}
