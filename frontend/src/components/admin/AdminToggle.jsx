export default function AdminToggle({ label, value, onChange, helperText }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-slate-300 uppercase tracking-wider">
          {label}
        </label>
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            value ? 'bg-primary' : 'bg-slate-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              value ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      {helperText && <p className="text-xs text-slate-500 mt-1">{helperText}</p>}
    </div>
  );
}
