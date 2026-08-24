import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { messagesAPI, tasksAPI } from '../../services/api';
import { useToast } from '../admin/shared/ToastProvider';
import { apiErrorMessage } from '../../utils/apiError';
import usePollWhileVisible from '../../utils/usePollWhileVisible';
import TabHeader from '../sales/TabHeader';
import { BTN_PRIMARY, BTN_NEUTRAL } from '../sales/ui';
import StaffAvatar from './StaffAvatar';
import MessageCard from './MessageCard';
import LogCallModal from './LogCallModal';
import WorkOrderPicker from './WorkOrderPicker';
import TaskDetailModal from './TaskDetailModal';
import TaskFormModal from './TaskFormModal';
import ConfirmModal from '../sales/ConfirmModal';

const POLL_MS = 30000;
const PAGE_SIZE = 30;

/**
 * The Shop Feed: pinned notices on top, a composer, then everything that has
 * happened — posts and logged customer calls, newest first. Viewing the feed
 * marks it read, which is what drives everyone's unread badges.
 */
export default function FeedSection({ currentUser, staff, refreshCounts, focusTick }) {
  const showToast = useToast();
  const [pinned, setPinned] = useState([]);
  const [messages, setMessages] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const [body, setBody] = useState('');
  const [important, setImportant] = useState(false);
  const [workOrder, setWorkOrder] = useState(null);
  const [showWorkOrderPicker, setShowWorkOrderPicker] = useState(false);
  const [posting, setPosting] = useState(false);

  const [showLogCall, setShowLogCall] = useState(false);
  const [ackBusyId, setAckBusyId] = useState(null);
  const [pinBusyId, setPinBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [taskModal, setTaskModal] = useState(null);
  const [editTask, setEditTask] = useState(null);

  // How many messages the user has scrolled into — polls re-fetch that window.
  const loadedRef = useRef(PAGE_SIZE);

  const staffById = useMemo(() => {
    const map = {};
    (staff || []).forEach((s) => { map[s.id] = s.name; });
    return map;
  }, [staff]);

  const load = useCallback(async (withSpinner = false) => {
    if (withSpinner) setLoading(true);
    try {
      const windowSize = Math.min(Math.max(loadedRef.current, PAGE_SIZE), 100);
      const [pinnedRes, pageRes] = await Promise.all([
        messagesAPI.list({ pinned: true }),
        messagesAPI.list({ skip: 0, limit: windowSize }),
      ]);
      setPinned(pinnedRes.messages);
      setMessages(pageRes.messages);
      setTotal(pageRes.total);
      // Opening the feed is what "reading" means here; badges across
      // everyone's sessions converge within one poll cycle. Only a visible
      // tab counts as reading — a feed mounted in a background tab
      // (middle-click) must not mark anything "seen by" until it's actually
      // looked at; the focus catch-up re-runs load() the moment that happens.
      if (document.visibilityState === 'visible') {
        const { marked } = await messagesAPI.markAllRead();
        if (marked > 0) refreshCounts();
      }
    } catch {
      showToast('error', 'Failed to load the shop feed.');
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, [refreshCounts, showToast]);

  useEffect(() => { load(true); }, [load]);

  // Sync: 30s poll while the feed is on screen and the tab is visible,
  // + focus catch-up. A hidden tab polling would mark messages read for
  // someone who isn't looking.
  usePollWhileVisible(() => load(false), POLL_MS);
  useEffect(() => {
    if (focusTick > 0) load(false);
  }, [focusTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadOlder = async () => {
    setLoadingOlder(true);
    try {
      const { messages: older, total: t } = await messagesAPI.list({ skip: messages.length, limit: PAGE_SIZE });
      setMessages((prev) => [...prev, ...older]);
      setTotal(t);
      loadedRef.current = messages.length + older.length;
    } catch {
      showToast('error', 'Failed to load older messages.');
    } finally {
      setLoadingOlder(false);
    }
  };

  const handlePost = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    try {
      await messagesAPI.create({
        type: 'post',
        body: body.trim(),
        important,
        repair_id: workOrder?.repair_id || null,
      });
      setBody('');
      setImportant(false);
      setWorkOrder(null);
      setShowWorkOrderPicker(false);
      load(false);
      refreshCounts();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to post.'));
    } finally {
      setPosting(false);
    }
  };

  const replaceMessage = (updated) => {
    setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    setPinned((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  const handleAck = async (message) => {
    setAckBusyId(message.id);
    try {
      replaceMessage(await messagesAPI.ack(message.id));
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to update your 👍.'));
    } finally {
      setAckBusyId(null);
    }
  };

  const handlePin = async (message) => {
    setPinBusyId(message.id);
    try {
      await messagesAPI.setPin(message.id, !message.pinned);
      showToast('success', message.pinned ? 'Unpinned.' : 'Pinned to the top of the feed.');
      load(false);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to update the pin.'));
    } finally {
      setPinBusyId(null);
    }
  };

  const handleDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await messagesAPI.delete(target.id);
      showToast('success', 'Message deleted.');
      load(false);
      refreshCounts();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to delete the message.'));
    }
  };

  const openTask = async (taskId) => {
    try {
      setTaskModal(await tasksAPI.get(taskId));
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'That task no longer exists.'));
    }
  };

  const cardProps = {
    currentUser, staffById,
    onAck: handleAck, ackBusyId,
    onPin: handlePin, pinBusyId,
    onDelete: setDeleteTarget,
    onOpenTask: openTask,
  };

  return (
    <div>
      <TabHeader
        title="Shop Feed"
        subtitle="What's happening — posts, calls, and heads-ups for the whole shop"
        action={(
          <button onClick={() => setShowLogCall(true)} className={BTN_PRIMARY} title="Log a customer call">
            <span className="material-symbols-outlined text-base">phone_in_talk</span>
            <span className="hidden sm:inline">Log Call</span>
          </button>
        )}
      />

      {/* Pinned notices */}
      {pinned.length > 0 && (
        <div className="mb-4 space-y-2.5">
          <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">keep</span>
            Pinned
          </p>
          {pinned.map((message) => (
            <MessageCard key={`pin-${message.id}`} message={message} {...cardProps} />
          ))}
        </div>
      )}

      {/* Composer */}
      <form onSubmit={handlePost} className="mb-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3.5">
        <div className="flex items-start gap-2.5">
          {currentUser && <StaffAvatar userId={currentUser.id} name={currentUser.name} size="md" className="mt-1" />}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePost(e);
            }}
            maxLength={5000}
            rows={2}
            placeholder="Share something with the shop... (Ctrl+Enter to post)"
            className="flex-1 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors resize-none"
          />
        </div>
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setImportant((v) => !v)}
            title="Flag as important"
            className={`inline-flex items-center gap-1 px-2.5 py-2.5 rounded-lg text-xs font-bold border transition-all ${
              important
                ? 'bg-red-50 dark:bg-red-900/20 border-red-400 text-red-600 dark:text-red-400'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-red-300 hover:text-red-500'
            }`}
          >
            <span className="material-symbols-outlined text-sm">{important ? 'flag' : 'outlined_flag'}</span>
            Important
          </button>
          <button
            type="button"
            onClick={() => setShowWorkOrderPicker((v) => !v)}
            title="Link a work order"
            className={`inline-flex items-center gap-1 px-2.5 py-2.5 rounded-lg text-xs font-bold border transition-all ${
              workOrder
                ? 'bg-primary/10 border-primary/40 text-primary dark:text-blue-400'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-primary/40 hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-sm">build_circle</span>
            {workOrder ? workOrder.request_number : 'Link WO'}
          </button>
          <span className="flex-1" />
          <button
            type="submit"
            disabled={posting || !body.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-blue-500 text-white rounded-xl text-sm font-black uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className={`material-symbols-outlined text-base ${posting ? 'animate-spin' : ''}`}>
              {posting ? 'progress_activity' : 'send'}
            </span>
            Post
          </button>
        </div>
        {showWorkOrderPicker && (
          <div className="mt-3">
            <WorkOrderPicker value={workOrder} onChange={setWorkOrder} label="Attach a Work Order" />
          </div>
        )}
      </form>

      {/* Feed */}
      {loading && messages.length === 0 ? (
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
          <p className="mt-3 text-slate-500 dark:text-slate-400">Loading the feed...</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 block mb-3">forum</span>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Nothing here yet — post the first update or log a call</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {messages.map((message) => (
            <MessageCard key={message.id} message={message} {...cardProps} />
          ))}
          {messages.length < total && (
            <button
              onClick={loadOlder}
              disabled={loadingOlder}
              className={`${BTN_NEUTRAL} w-full disabled:opacity-50`}
            >
              <span className={`material-symbols-outlined text-base ${loadingOlder ? 'animate-spin' : ''}`}>
                {loadingOlder ? 'progress_activity' : 'history'}
              </span>
              Load older ({total - messages.length} more)
            </button>
          )}
        </div>
      )}

      {showLogCall && (
        <LogCallModal
          staff={staff}
          onLogged={() => { setShowLogCall(false); load(false); refreshCounts(); }}
          onClose={() => setShowLogCall(false)}
        />
      )}
      {taskModal && (
        <TaskDetailModal
          task={taskModal}
          onEdit={(task) => { setTaskModal(null); setEditTask(task); }}
          onChanged={(updated) => { if (updated) setTaskModal(updated); refreshCounts(); }}
          onClose={() => setTaskModal(null)}
        />
      )}
      {editTask && (
        <TaskFormModal
          task={editTask}
          staff={staff}
          onSaved={() => { setEditTask(null); refreshCounts(); }}
          onClose={() => setEditTask(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmModal
          message="Delete this message from the shop feed? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
