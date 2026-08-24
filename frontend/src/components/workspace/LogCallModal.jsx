import { useState } from 'react';
import { messagesAPI } from '../../services/api';
import { useToast } from '../admin/shared/ToastProvider';
import { apiErrorMessage } from '../../utils/apiError';
import useEscapeClose from '../../utils/useEscapeClose';
import useBodyScrollLock from '../../utils/useBodyScrollLock';
import { TASK_PRIORITY_LIST } from '../../constants/workspace';
import { INPUT_CLS, LABEL_CLS, CANCEL_BTN_CLS, SUBMIT_BTN_CLS } from './formStyles';
import WorkOrderPicker from './WorkOrderPicker';

/**
 * Log a customer call into the shop feed — and, in the same motion, hand it
 * off as an assigned follow-up task when something needs doing about it.
 */
export default function LogCallModal({ staff, onLogged, onClose }) {
  const showToast = useToast();
  const [callerName, setCallerName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [body, setBody] = useState('');
  const [important, setImportant] = useState(false);
  const [workOrder, setWorkOrder] = useState(null);
  const [withTask, setWithTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskPriority, setTaskPriority] = useState('normal');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  useEscapeClose(onClose);
  useBodyScrollLock(true);

  const activeStaff = (staff || []).filter((s) => s.is_active);

  const toggleTask = () => {
    setWithTask((v) => {
      const next = !v;
      if (next && !taskTitle.trim() && callerName.trim()) {
        setTaskTitle(`Call back ${callerName.trim()}`);
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await messagesAPI.create({
        type: 'call',
        body: body.trim(),
        important,
        call: {
          caller_name: callerName.trim(),
          company: company.trim() || null,
          phone: phone.trim() || null,
        },
        repair_id: workOrder?.repair_id || null,
        spawn_task: withTask && taskTitle.trim() ? {
          title: taskTitle.trim(),
          assignee_id: taskAssigneeId || null,
          priority: taskPriority,
          due_date: taskDueDate || null,
        } : null,
      });
      showToast('success', result.task ? 'Call logged and task assigned.' : 'Call logged to the feed.');
      onLogged(result);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to log the call.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Log a Call</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Everyone sees it in the Shop Feed</p>
          </div>
          <button onClick={onClose} className="p-2 -m-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-5">
          <div>
            <label className={LABEL_CLS}>Who Called *</label>
            <input
              type="text"
              value={callerName}
              onChange={(e) => setCallerName(e.target.value)}
              maxLength={200}
              required
              placeholder="Caller's name..."
              className={INPUT_CLS}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Company</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={200}
                placeholder="Optional"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={50}
                placeholder="Optional"
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div>
            <label className={LABEL_CLS}>What&apos;s It About *</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              rows={3}
              required
              placeholder="Quoting a repair, asking about a job, complaint..."
              className={`${INPUT_CLS} resize-none`}
            />
          </div>

          <button
            type="button"
            onClick={() => setImportant((v) => !v)}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 transition-all text-left ${
              important
                ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <span className={`material-symbols-outlined text-xl ${important ? 'text-red-500' : 'text-slate-400'}`}>
              {important ? 'flag' : 'outlined_flag'}
            </span>
            <span className="min-w-0">
              <span className={`block text-xs font-black uppercase ${important ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
                Important
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">Highlights the entry so nobody misses it</span>
            </span>
          </button>

          <WorkOrderPicker value={workOrder} onChange={setWorkOrder} label="Related Work Order" />

          {/* Follow-up task */}
          <div className={`rounded-xl border-2 transition-all ${withTask ? 'border-primary/50' : 'border-slate-200 dark:border-slate-700'}`}>
            <button
              type="button"
              onClick={toggleTask}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
            >
              <span className={`material-symbols-outlined text-xl ${withTask ? 'text-primary' : 'text-slate-400'}`}>
                {withTask ? 'check_box' : 'check_box_outline_blank'}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-black uppercase text-slate-600 dark:text-slate-300">Create a follow-up task</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">Someone needs to do something about this call</span>
              </span>
            </button>
            {withTask && (
              <div className="px-4 pb-4 flex flex-col gap-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                <div>
                  <label className={LABEL_CLS}>Task *</label>
                  <input
                    type="text"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    maxLength={200}
                    required={withTask}
                    placeholder="What needs to happen..."
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>Assign To</label>
                  <select
                    value={taskAssigneeId}
                    onChange={(e) => setTaskAssigneeId(e.target.value)}
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
                    <label className={LABEL_CLS}>Priority</label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value)}
                      className={INPUT_CLS}
                    >
                      {TASK_PRIORITY_LIST.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Due Date</label>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className={CANCEL_BTN_CLS}>Cancel</button>
            <button
              type="submit"
              disabled={saving || !callerName.trim() || !body.trim() || (withTask && !taskTitle.trim())}
              className={SUBMIT_BTN_CLS}
            >
              {saving ? 'Logging...' : 'Log Call'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
