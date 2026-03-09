export default function GalleryTab() {
  return (
    <div>
      <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-6">
        Gallery Page Content
      </h2>

      <div className="p-6 bg-blue-900/20 border border-blue-700 rounded-lg">
        <div className="flex gap-3">
          <span className="material-symbols-outlined text-blue-400">info</span>
          <div className="flex-1 text-sm text-blue-300">
            <p className="font-bold mb-1">Gallery Management</p>
            <p className="text-blue-400 mb-2">
              Gallery photos are managed via the Gallery API at <code className="px-2 py-1 bg-slate-900 rounded">/api/gallery</code>.
            </p>
            <p className="text-blue-400">
              Advanced photo uploader with drag-drop reordering coming in next update. For now, use FastAPI docs at{' '}
              <a href="http://localhost:8000/docs" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-200">
                /docs
              </a>.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 p-6 bg-slate-800 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">Gallery Features (Coming Soon)</h3>
        <ul className="space-y-2 text-slate-300 text-sm">
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-500">radio_button_unchecked</span>
            Drag-and-drop photo upload
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-500">radio_button_unchecked</span>
            Visual grid with image previews
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-500">radio_button_unchecked</span>
            Drag-to-reorder display sequence
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-500">radio_button_unchecked</span>
            Category tagging and filtering
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-500">radio_button_unchecked</span>
            Bulk delete and management
          </li>
        </ul>
      </div>
    </div>
  );
}
