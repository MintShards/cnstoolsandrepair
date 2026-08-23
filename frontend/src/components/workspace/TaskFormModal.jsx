import { useState } from 'react';
import { tasksAPI } from '../../services/api';
import { useToast } from '../admin/shared/ToastProvider';
import { apiErrorMessage } from '../../utils/apiError';
import useEscapeClose from '../../utils/useEscapeClose';
import useBodyScrollLock from '../../utils/useBodyScrollLock';
import { TASK_PRIORITY_LIST, RECURRENCE_OPTIONS } from '../../constants/workspace';
import { INPUT_CLS, LABEL_CLS, CANCEL_BTN_CLS, SUBMIT_BTN_CLS } from './formStyles';
import WorkOrderPicker from './WorkOrderPicker';

/**
 * Create/edit a task. VisitLogger-style modal: priority as segmented pills,
 * recurrence unlocks once a due date is set, optional work-order link.
 */
export default function TaskFormModal({ task, staff, defaultAssigneeId, defaultDueDate, onSaved, onClose }) {
  const showToast = useToast();
  const editing = Boolean(task);

  const [title, setTitle] = useState(task?.title || '');
  const [details, setDetails] = useState(task?.details || '');
  const [priority, setPriority] = useState(task?.priority || 'normal');
  const [dueDate, setDueDate] = useState(task?.due_date || defaultDueDate || '');
  const [assigneeId, setAssigneeId] = useState(task ? (task.assignee_id || '') : (defaultAssigneeId || ''));
  const [recurrence, setRecurrence] = useState(task?.recurrence || 'none');
  const [workOrder, setWorkOrder] = useState(
    task?.repair_id ? { repair_id: task.repair_id, request_number: task.request_number } : null
  );
  const [saving, setSaving] = useState(false);
  useEscapeClose(onClose);
  useBodyScrollLock(true);

  const activeStaff = (staff || []).filter((s) => s.is_active);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: title.trim(),
      details: details.trim() || null,
      priority,
      due_date: dueDate || null,
      assignee_id: assigneeId || null,
      repair_id: workOrder?.repair_id || null,
      recurrence: dueDate ? recurrence : 'none',
    };
    try {
      const saved = editing
        ? await tasksAPI.update(task.id, payload)
        : await tasksAPI.create(payload);
      showToast('success', editing ? 'Task updated.' : 'Task created.');
      onSaved(saved);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to save the task.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {editing ? 'Edit Task' : 'New Task'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-5">
          <div>
            <label className={LABEL_CLS}>Task *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              placeholder="What needs to get done..."
              className={INPUT_CLS}
              autoFocus
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Details</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={5000}
              rows={3}
              placeholder="Anything the person doing this should know..."
              className={`${INPUT_CLS} resize-none`}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Priority</label>
            <div className="flex gap-2">
              {TASK_PRIORITY_LIST.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-bold text-xs uppercase ${
                    priority === p.value
                      ? 'border-primary bg-primary/5 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.dot}`} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={LABEL_CLS}>Assign To</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className={INPUT_CLS}
            >
              <option value="">Unassigned — anyone can claim it</option>
              {activeStaff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Repeats</label>
              <select
                value={dueDate ? recurrence : 'none'}
                onChange={(e) => setRecurrence(e.target.value)}
                disabled={!dueDate}
                title={dueDate ? undefined : 'Set a due date to make this task repeat'}
                className={`${INPUT_CLS} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {RECURRENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          {dueDate && recurrence !== 'none' && (
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-3">
              Completing this task automatically schedules the next occurrence.
            </p>
          )}

          <WorkOrderPicker value={workOrder} onChange={setWorkOrder} />

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className={CANCEL_BTN_CLS}>Cancel</button>
            <button type="submit" disabled={saving || !title.trim()} className={SUBMIT_BTN_CLS}>
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
