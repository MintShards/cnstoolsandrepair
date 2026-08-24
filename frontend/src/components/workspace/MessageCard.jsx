import { useState } from 'react';
import { formatAge, formatDatePacific } from '../../utils/dateFormat';
import { telHref } from '../../utils/links';
import StaffAvatar from './StaffAvatar';
import WorkOrderChip from './WorkOrderChip';

function namesFor(ids, staffById, currentUserId) {
  return ids.map((id) => (id === currentUserId ? 'You' : staffById[id] || 'Former staff'));
}

/**
 * One feed entry — a staff post or a logged customer call. Footer carries the
 * lightweight coordination signals: 👍 acknowledge, seen-by, pin, delete.
 */
export default function MessageCard({
  message, currentUser, staffById,
  onAck, ackBusyId, onPin, pinBusyId, onDelete, onOpenTask,
}) {
  const [showSeenBy, setShowSeenBy] = useState(false);
  const isCall = message.type === 'call';
  const mine = message.author?.user_id === currentUser?.id;
  const acked = currentUser && message.acknowledged_by.includes(currentUser.id);
  const ackNames = namesFor(message.acknowledged_by, staffById, currentUser?.id);
  const seenNames = namesFor(message.read_by, staffById, currentUser?.id);

  return (
    <div className={`rounded-xl border bg-white dark:bg-slate-800 shadow-sm transition-colors ${
      message.important
        ? 'border-red-300 dark:border-red-800/60 border-l-4 border-l-red-500'
        : 'border-slate-200 dark:border-slate-700'
    }`}>
      <div className="p-4">
        {/* Author line */}
        <div className="flex items-center gap-2.5">
          <StaffAvatar userId={message.author?.user_id} name={message.author?.name} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {message.author?.name}
              {isCall && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-primary dark:text-blue-400">
                  <span className="material-symbols-outlined text-xs">phone_in_talk</span>
                  Call Log
                </span>
              )}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500" title={formatDatePacific(message.created_at)}>
              {formatAge(message.created_at) || 'today'}
            </p>
          </div>
          {message.important && (
            <span className="material-symbols-outlined text-red-500 flex-shrink-0" title="Flagged important">flag</span>
          )}
          {message.pinned && (
            <span className="material-symbols-outlined text-amber-500 flex-shrink-0" title="Pinned">keep</span>
          )}
        </div>

        {/* Call details */}
        {isCall && message.call && (
          <div className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 px-3.5 py-2.5 flex items-center gap-3">
            <span className="material-symbols-outlined text-primary dark:text-blue-400">call</span>
            <div className="min-w-0 text-sm">
              <p className="font-bold text-slate-900 dark:text-white truncate">
                {message.call.caller_name}
                {message.call.company && <span className="font-medium text-slate-500 dark:text-slate-400"> · {message.call.company}</span>}
              </p>
              {message.call.phone && (
                <a
                  href={telHref(message.call.phone)}
                  className="text-xs font-bold text-primary dark:text-blue-400 hover:underline"
                >
                  {message.call.phone}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Body */}
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">{message.body}</p>

        {/* Links */}
        {(message.repair_id || message.task_id) && (
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
            <WorkOrderChip repairId={message.repair_id} requestNumber={message.request_number} />
            {message.task_id && (
              <button
                onClick={() => onOpenTask(message.task_id)}
                title="Open the follow-up task from this call"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-accent-orange/10 hover:bg-accent-orange/20 border border-accent-orange/40 text-accent-orange transition-colors"
              >
                <span className="material-symbols-outlined text-sm">task_alt</span>
                Follow-up task
              </button>
            )}
          </div>
        )}

        {/* Footer: ack / seen-by / pin / delete */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-1.5">
          <button
            onClick={() => onAck(message)}
            disabled={ackBusyId === message.id}
            title={acked ? `Remove your 👍 (${ackNames.join(', ')})` : ackNames.length ? `👍 by ${ackNames.join(', ')}` : 'Acknowledge — “seen it, on it”'}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs font-bold border transition-all disabled:opacity-50 ${
              acked
                ? 'bg-primary/10 border-primary/40 text-primary dark:text-blue-400'
                : 'bg-slate-50 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600/50 text-slate-500 dark:text-slate-400 hover:border-primary/40 hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-sm">thumb_up</span>
            {message.acknowledged_by.length > 0 && message.acknowledged_by.length}
          </button>

          <button
            onClick={() => setShowSeenBy((v) => !v)}
            title={seenNames.length ? `Seen by ${seenNames.join(', ')}` : 'Nobody has seen this yet'}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">visibility</span>
            {message.read_by.length}
          </button>

          <span className="flex-1" />

          <button
            onClick={() => onPin(message)}
            disabled={pinBusyId === message.id}
            title={message.pinned ? 'Unpin from the top of the feed' : 'Pin to the top of the feed'}
            className={`inline-flex items-center px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
              message.pinned
                ? 'text-amber-500 hover:text-amber-600'
                : 'text-slate-400 dark:text-slate-500 hover:text-amber-500'
            }`}
          >
            <span className="material-symbols-outlined text-sm">{message.pinned ? 'keep_off' : 'keep'}</span>
          </button>

          {mine && (
            <button
              onClick={() => onDelete(message)}
              title="Delete your message"
              className="inline-flex items-center px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
            </button>
          )}
        </div>

        {showSeenBy && (
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            {seenNames.length ? `Seen by ${seenNames.join(', ')}` : 'Nobody has seen this yet'}
            {/* Hover tooltips don't exist on touch — this disclosure is the
                only way a phone user learns WHO acknowledged. */}
            {ackNames.length > 0 && ` · 👍 ${ackNames.join(', ')}`}
          </p>
        )}
      </div>
    </div>
  );
}
