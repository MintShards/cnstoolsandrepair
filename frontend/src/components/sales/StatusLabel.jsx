// Customer/prospect state the tracker way: a dot and quiet text, not a filled
// pill — repeated down a table, pills read as noise before they read as data.
export default function StatusLabel({ isCustomer, className = '' }) {
  return isCustomer ? (
    <span
      title="Converted to a repair-tracker customer"
      className={`inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap ${className}`}
    >
      <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
      Customer
    </span>
  ) : (
    <span
      title="Not yet a repair-tracker customer"
      className={`text-xs font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap ${className}`}
    >
      Prospect
    </span>
  );
}
