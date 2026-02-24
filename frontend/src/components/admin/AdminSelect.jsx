export default function AdminSelect({
  label,
  value,
  onChange,
  options = [],
  required = false,
  helperText,
  error,
}) {
  const handleChange = (e) => {
    onChange(e.target.value);
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <select
        value={value}
        onChange={handleChange}
        className={`w-full px-4 py-3 bg-slate-800 border ${
          error ? 'border-red-500' : 'border-slate-700'
        } rounded-lg text-white focus:outline-none focus:border-primary transition-colors`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helperText && <p className="text-xs text-slate-500 mt-1">{helperText}</p>}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
