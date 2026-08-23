import { AVATAR_COLORS } from '../../constants/workspace';

function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}

function colorFor(id) {
  const s = String(id || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const SIZES = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

/** Monday-style initials avatar with a colour derived from the user id. */
export default function StaffAvatar({ userId, name, size = 'md', className = '' }) {
  return (
    <span
      title={name || undefined}
      className={`inline-flex items-center justify-center rounded-full text-white font-black uppercase select-none flex-shrink-0 ${SIZES[size] || SIZES.md} ${colorFor(userId)} ${className}`}
    >
      {initialsOf(name)}
    </span>
  );
}
