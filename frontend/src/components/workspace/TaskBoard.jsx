import { useRef } from 'react';
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { TASK_STATUS_LIST, TASK_PRIORITY_RANK } from '../../constants/workspace';
import TaskCard from './TaskCard';

// Urgent first, then nearest due date (undated last), then oldest created.
function columnOrder(a, b) {
  const rank = (TASK_PRIORITY_RANK[b.priority] || 0) - (TASK_PRIORITY_RANK[a.priority] || 0);
  if (rank !== 0) return rank;
  const ad = a.due_date || '9999-12-31';
  const bd = b.due_date || '9999-12-31';
  if (ad !== bd) return ad < bd ? -1 : 1;
  return (a.created_at || '') < (b.created_at || '') ? -1 : 1;
}

function DraggableCard({ task, children }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.65 : undefined,
        zIndex: isDragging ? 30 : undefined,
        position: 'relative',
      }}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}

function BoardColumn({ status, tasks, onOpen, onClaim, claimingId, doneNote, emptyNote }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.value });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[240px] rounded-xl border transition-colors flex flex-col ${
        isOver
          ? 'border-primary/60 bg-primary/5'
          : 'border-slate-200 dark:border-slate-700/60 bg-slate-100 dark:bg-slate-800/60'
      }`}
    >
      <div className="px-3.5 py-3 border-b border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${status.dot}`} />
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{status.label}</span>
        <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
        {doneNote && <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto">{doneNote}</span>}
      </div>
      <div className="p-2.5 space-y-2.5 min-h-[160px] flex-1">
        {tasks.length === 0 ? (
          <p className="text-center text-xs text-slate-400 dark:text-slate-600 py-8">
            {isOver ? 'Drop it here' : (emptyNote || 'Nothing here')}
          </p>
        ) : (
          tasks.map((task) => (
            <DraggableCard key={task.id} task={task}>
              <TaskCard task={task} onOpen={onOpen} onClaim={onClaim} claimingId={claimingId} />
            </DraggableCard>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Monday-style status board. Dragging a card to another column updates the
 * task's status (optimistically — TasksSection rolls back on failure).
 * Dropping on Done runs the full completion path server-side, including
 * spawning the next occurrence of a recurring task.
 */
export default function TaskBoard({ tasks, onMove, onOpen, onClaim, claimingId }) {
  // A small movement threshold keeps plain clicks opening the detail modal
  // instead of starting a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  // The browser still fires a click on the card after a drag ends; without
  // this guard every drop would also pop the detail modal.
  const justDraggedRef = useRef(false);

  const byStatus = { todo: [], in_progress: [], done: [] };
  for (const task of tasks) {
    (byStatus[task.status] || byStatus.todo).push(task);
  }
  byStatus.todo.sort(columnOrder);
  byStatus.in_progress.sort(columnOrder);
  // Done holds only TODAY's completions (TasksSection filters them), already
  // sorted by completion time from the server — leave it.

  const handleOpen = (task) => {
    if (justDraggedRef.current) return;
    onOpen(task);
  };

  const handleDragStart = () => {
    justDraggedRef.current = true;
  };

  const handleDragEnd = ({ active, over }) => {
    setTimeout(() => { justDraggedRef.current = false; }, 0);
    if (!over) return;
    const task = active.data.current?.task;
    if (!task || task.status === over.id) return;
    onMove(task, over.id);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragEnd}>
      <div className="flex flex-col lg:flex-row gap-3">
        {TASK_STATUS_LIST.map((status) => (
          <BoardColumn
            key={status.value}
            status={status}
            tasks={byStatus[status.value]}
            onOpen={handleOpen}
            onClaim={onClaim}
            claimingId={claimingId}
            doneNote={status.value === 'done' ? 'today' : null}
            emptyNote={status.value === 'done' ? 'Nothing finished today yet' : null}
          />
        ))}
      </div>
    </DndContext>
  );
}
