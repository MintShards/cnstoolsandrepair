export default function AdminTextarea({
  label,
  value,
  onChange,
  placeholder = "",
  required = false,
  maxLength,
  rows = 4,
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
      <textarea
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        className={`w-full px-4 py-3 bg-slate-800 border ${
          error ? 'border-red-500' : 'border-slate-700'
        } rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-colors resize-none`}
      />
      <div className="flex justify-between mt-1">
        {helperText && <p className="text-xs text-slate-500">{helperText}</p>}
        {maxLength && (
          <p className="text-xs text-slate-500">
            {value?.length || 0}/{maxLength}
          </p>
        )}
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
