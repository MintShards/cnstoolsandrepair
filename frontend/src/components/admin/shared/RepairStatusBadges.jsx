import { Fragment } from 'react';
import { REPAIR_STATUSES, MAIN_STAGES, getStepInfo } from '../../../constants/repairStatuses';

export const StatusBadge = ({ status }) => {
  const cfg = REPAIR_STATUSES[status] || { label: status, color: 'bg-slate-700 text-slate-300 border-slate-600' };
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};

export const StepBadge = ({ status }) => {
  const info = getStepInfo(status);
  if (!info) return null;
  return (
    <span className="text-xs text-slate-500 font-mono tabular-nums">
      {info.current}/{info.total}
    </span>
  );
};

export const ProgressStepper = ({ status }) => {
  const cfg = REPAIR_STATUSES[status];
  const currentStep = cfg?.step;
  if (currentStep === null) {
    const offRampColors = {
      declined: 'text-red-400 border-red-700 bg-red-900/20',
      completed: 'text-green-300 border-green-600 bg-green-900/30',
      abandoned: 'text-rose-400 border-rose-700 bg-rose-900/20',
      closed: 'text-slate-400 border-slate-600 bg-slate-800/50',
    };
    return (
      <div className="flex items-center gap-2 py-2">
        <span className="text-xs text-slate-500">Status:</span>
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${offRampColors[status] || 'text-slate-400 border-slate-600 bg-slate-800/50'}`}>
          {cfg?.label || status}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-0.5 py-2 flex-wrap">
      {MAIN_STAGES.map((stage, i) => {
        const step = i + 1;
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;
        const stageCfg = REPAIR_STATUSES[stage];
        return (
          <Fragment key={stage}>
            {i > 0 && (
              <div className={`h-0.5 w-3 flex-shrink-0 ${isCompleted ? 'bg-blue-500' : 'bg-slate-700'}`} />
            )}
            <div
              title={stageCfg?.label}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all
                ${isCurrent ? 'bg-blue-500 text-white ring-2 ring-blue-400/40' :
                  isCompleted ? 'bg-blue-500/25 text-blue-400' :
                  'bg-slate-800 text-slate-600'}`}
            >
              {step}
            </div>
          </Fragment>
        );
      })}
      <span className="ml-2 text-xs text-slate-400">{cfg?.label}</span>
    </div>
  );
};
