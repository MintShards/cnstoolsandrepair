export default function IndustriesTab() {
  return (
    <div>
      <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-6">
        Industries Page Content
      </h2>

      <div className="p-6 bg-blue-900/20 border border-blue-700 rounded-lg">
        <div className="flex gap-3">
          <span className="material-symbols-outlined text-blue-400">info</span>
          <div className="flex-1 text-sm text-blue-300">
            <p className="font-bold mb-1">Industries Management</p>
            <p className="text-blue-400 mb-2">
              Industries are managed via the Industries API at <code className="px-2 py-1 bg-slate-900 rounded">/api/industries</code>.
            </p>
            <p className="text-blue-400">
              Advanced CRUD interface for industries coming in next update. For now, use FastAPI docs at{' '}
              <a href="http://localhost:8000/docs" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-200">
                /docs
              </a>.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 p-6 bg-slate-800 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">Current Industries</h3>
        <ul className="space-y-2 text-slate-300 text-sm">
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">check_circle</span>
            Automotive Repair & Body Shops
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">check_circle</span>
            Fleet Maintenance & Transportation
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">check_circle</span>
            Manufacturing & Production
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">check_circle</span>
            Metal Fabrication & Welding
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">check_circle</span>
            Construction & Heavy Equipment
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">check_circle</span>
            Oil & Gas Services
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">check_circle</span>
            Aerospace & Aviation
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">check_circle</span>
            Marine & Shipyard
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">check_circle</span>
            Mining & Resource Extraction
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">check_circle</span>
            MRO (Maintenance, Repair, Operations)
          </li>
        </ul>
      </div>
    </div>
  );
}
