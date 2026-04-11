import { Fragment } from 'react';
import { REPAIR_STATUSES, MAIN_STAGES, getStepInfo } from '../../../constants/repairStatuses';

export const StatusBadge = ({ status, count }) => {
  const cfg = REPAIR_STATUSES[status] || { label: status, color: 'bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-700/60 dark:text-slate-300 dark:border-slate-500', dot: 'bg-slate-400 dark:bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {count && <span className="opacity-70">{count}×</span>}
      {cfg.label}
    </span>
  );
};

export const StepBadge = ({ status }) => {
  const info = getStepInfo(status);
  if (!info) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 text-sm text-slate-500 dark:text-slate-400 font-mono tabular-nums">
      {info.current}/{info.total}
    </span>
  );
};

export const ProgressStepper = ({ status, compact = false }) => {
  const cfg = REPAIR_STATUSES[status];
  const currentStep = cfg?.step;

  if (currentStep === null) {
    return null;
  }

  const shortLabels = ['Received', 'Diagnosed', 'Quoted', 'Approved', 'Parts', 'In Repair', 'Ready', 'Invoiced'];

  if (compact) {
    return (
      <div className="py-2">
        <div className="flex items-center gap-0">
          {MAIN_STAGES.map((stage, i) => {
            const step = i + 1;
            const isCompleted = step < currentStep;
            const isCurrent = step === currentStep;
            const stageCfg = REPAIR_STATUSES[stage];
            return (
              <Fragment key={stage}>
                {i > 0 && (
                  <div className={`h-0.5 flex-1 min-w-[4px] transition-all duration-300 ${isCompleted ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
                )}
                <div
                  title={stageCfg?.label}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-all duration-300 relative
                    ${isCurrent
                      ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                      : isCompleted
                        ? 'bg-blue-500/80 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border border-slate-300 dark:border-slate-700'
                    }`}
                >
                  {isCurrent && (
                    <span className="absolute inset-0 rounded-full ring-2 ring-blue-400/25 animate-pulse" />
                  )}
                  {isCompleted ? (
                    <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>check</span>
                  ) : (
                    step
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>
        <p className="text-[10px] font-bold text-blue-500 dark:text-blue-400 mt-1.5 text-center">
          Step {currentStep}: {shortLabels[currentStep - 1]}
        </p>
      </div>
    );
  }

  return (
    <div className="py-3">
      {/* Step circles + connectors */}
      <div className="flex items-center gap-0">
        {MAIN_STAGES.map((stage, i) => {
          const step = i + 1;
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;
          const stageCfg = REPAIR_STATUSES[stage];
          return (
            <Fragment key={stage}>
              {i > 0 && (
                <div className={`h-1 flex-1 min-w-[8px] transition-all duration-300 ${isCompleted ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
              )}
              <div
                title={stageCfg?.label}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300 relative
                  ${isCurrent
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                    : isCompleted
                      ? 'bg-blue-500/80 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border border-slate-300 dark:border-slate-700'
                  }`}
              >
                {isCurrent && (
                  <span className="absolute inset-0 rounded-full ring-4 ring-blue-400/25 animate-pulse" />
                )}
                {isCompleted ? (
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>
                ) : (
                  step
                )}
              </div>
            </Fragment>
          );
        })}
      </div>
      {/* Labels row */}
      <div className="flex items-start mt-1.5 gap-0">
        {MAIN_STAGES.map((stage, i) => {
          const step = i + 1;
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;
          return (
            <Fragment key={stage}>
              {i > 0 && <div className="flex-1 min-w-[8px]" />}
              <div className={`w-8 flex flex-col items-center flex-shrink-0`}>
                <span className={`text-[9px] font-bold text-center leading-tight mt-0.5 ${
                  isCurrent ? 'text-blue-500 dark:text-blue-400' : isCompleted ? 'text-slate-400 dark:text-slate-500' : 'text-slate-400 dark:text-slate-600'
                }`}>
                  {shortLabels[i]}
                </span>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
};
