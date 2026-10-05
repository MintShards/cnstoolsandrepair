import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { billsAPI, paymentsAPI } from '../../services/api';
import TabHeader from '../sales/TabHeader';
import { BTN_PRIMARY } from '../sales/ui';
import { formatMoney, round2 } from '../../utils/money';
import BillsView from './BillsView';
import PaymentsView from './PaymentsView';
import ProfitLossView from './ProfitLossView';
import JournalView from './JournalView';

const VIEWS = [
  { id: 'out',     icon: 'receipt_long', label: 'Money Out',     short: 'Out',     sub: 'Supplier bills' },
  { id: 'in',      icon: 'payments',     label: 'Money In',      short: 'In',      sub: 'Customer payments' },
  { id: 'pnl',     icon: 'trending_up',  label: 'Profit & Loss', short: 'P&L',     sub: 'By completed repair' },
  { id: 'journal', icon: 'menu_book',    label: 'Journal',       short: 'Journal', sub: 'Every money event' },
];
const VIEW_IDS = VIEWS.map((v) => v.id);

function monthLabel(ym) {
  if (!ym) return 'This month';
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
}

// The API returns per-currency maps; the shop works in CAD only, so the
// cells read the CAD figure and nothing else.
function netByCurrency(inTotals, outTotals) {
  return { CAD: round2((inTotals?.CAD || 0) - (outTotals?.CAD || 0)) };
}

function MoneyStack({ totals, loaded, tone = '' }) {
  if (!loaded) return <span className="text-slate-400">—</span>;
  return <span className={tone}>{formatMoney(totals?.CAD ?? 0)}</span>;
}

/**
 * One cell of the month overview. It is a real button only when it leads
 * somewhere (Money in and Money out switch views, Unpaid bills opens that
 * list); Net is plain, so keyboard users never land on a control that does
 * nothing. The cells share one card; the grid draws the hairlines between
 * them, so a cell carries only its border colour.
 */
function Cell({ label, sub, red, active, onClick, children }) {
  const clickable = Boolean(onClick);
  const cls = `block w-full text-left min-w-0 px-3 py-2.5 min-h-[44px] border-slate-200 dark:border-slate-700/60 transition-colors ${
    active
      ? 'bg-primary/5 dark:bg-primary/10'
      : red
        ? `bg-red-50 dark:bg-red-900/10 ${clickable ? 'hover:bg-red-100 dark:hover:bg-red-900/20' : ''}`
        : clickable ? 'hover:bg-slate-100 dark:hover:bg-slate-800' : ''
  } ${clickable ? 'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60' : ''}`;
  const labelTone = active
    ? 'text-primary dark:text-blue-300'
    : red ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400';
  const body = (
    <>
      <span className={`block text-[10px] font-bold uppercase tracking-wider truncate ${labelTone}`}>{label}</span>
      <span className="block text-base sm:text-xl font-black leading-tight truncate text-slate-900 dark:text-white">{children}</span>
      <span className={`block text-[11px] leading-4 truncate ${red ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>{sub || ' '}</span>
    </>
  );
  if (!clickable) return <div className={cls}>{body}</div>;
  return (
    <button type="button" onClick={onClick} aria-pressed={active === undefined ? undefined : active} className={cls}>
      {body}
    </button>
  );
}

/**
 * Cash Flow (admin only): money in and money out under one roof, the profit
 * on each completed repair, and the money journal. The header carries the
 * view switcher and the log button, the card under it is this month at a
 * glance, and each view below brings its own toolbar, figures and list.
 */
export default function CashFlowSection({ refreshCounts, focusTick }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState(() => {
    // A deep link to a record picks its side; otherwise the URL, then memory.
    if (searchParams.get('bill')) return 'out';
    if (searchParams.get('payment')) return 'in';
    const fromUrl = searchParams.get('view');
    if (VIEW_IDS.includes(fromUrl)) return fromUrl;
    const remembered = localStorage.getItem('ws_cash_view');
    return VIEW_IDS.includes(remembered) ? remembered : 'out';
  });
  // A deep link to a bill or payment (the Journal's reference pills, the
  // calendar) lands on the side that shows it, whatever view is open.
  const billParam = searchParams.get('bill');
  const paymentParam = searchParams.get('payment');
  useEffect(() => {
    if (billParam) setView('out');
    else if (paymentParam) setView('in');
  }, [billParam, paymentParam]);
  const [summary, setSummary] = useState({ bills: null, payments: null });
  // Bumped by the header button; the mounted view opens its log form.
  const [createTick, setCreateTick] = useState(0);

  const loadSummary = useCallback(async () => {
    try {
      const [bills, payments] = await Promise.all([billsAPI.summary(), paymentsAPI.summary()]);
      setSummary({ bills, payments });
    } catch {
      // Cells keep their dashes; the lists report their own errors.
    }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => {
    if (focusTick > 0) loadSummary();
  }, [focusTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMutated = useCallback(() => {
    loadSummary();
    refreshCounts();
  }, [loadSummary, refreshCounts]);

  // `chip` lands Money Out on a specific bills list (?chip=overdue from the
  // Unpaid cell, the sidebar alert or Needs Attention); BillsView owns it.
  const selectView = (id, chip) => {
    setView(id);
    localStorage.setItem('ws_cash_view', id);
    const next = new URLSearchParams(searchParams);
    next.set('view', id);
    next.delete('bill');
    next.delete('payment');
    if (chip) next.set('chip', chip);
    else if (id === 'in') next.delete('chip');
    setSearchParams(next, { replace: true });
  };

  const bills = summary.bills;
  const payments = summary.payments;
  const loaded = Boolean(bills && payments);
  const net = loaded ? netByCurrency(payments.month_total, bills.month_total) : null;
  const netCad = net ? (net.CAD ?? 0) : 0;
  const overdue = bills?.overdue_count ?? 0;
  const canLog = view === 'out' || view === 'in';

  return (
    <div>
      <TabHeader
        title="Cash Flow"
        subtitle="Money in and out, the profit on each repair, and the money journal"
        action={(
          // Phones: the switcher takes its own full-width row under the title
          // and the log button the row after it; sm+ keeps both beside the
          // title, hugging the right when the row (or the cluster itself) has
          // to wrap. The full labels wait for lg: with the sidebar rail a
          // tablet's main column is ~460px, where "Money Out / Money In /
          // Profit & Loss / Journal" ran past the card.
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-auto sm:justify-end">
            <div className="flex w-full sm:w-auto sm:inline-flex rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden" role="group" aria-label="Cash Flow view">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => selectView(v.id)}
                  aria-pressed={view === v.id}
                  title={v.sub}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2.5 min-h-11 sm:min-h-0 text-sm font-bold whitespace-nowrap transition-colors ${
                    view === v.id
                      ? 'bg-primary text-white'
                      : 'bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{v.icon}</span>
                  <span className="lg:hidden">{v.short}</span>
                  <span className="hidden lg:inline">{v.label}</span>
                </button>
              ))}
            </div>
            {canLog && (
              <button
                onClick={() => setCreateTick((t) => t + 1)}
                className={`${BTN_PRIMARY} w-full sm:w-auto`}
                title={view === 'out' ? 'Log a supplier bill or receipt' : 'Log a customer payment'}
              >
                <span className="material-symbols-outlined text-base">{view === 'out' ? 'receipt_long' : 'payments'}</span>
                {view === 'out' ? 'Log a bill' : 'Log a payment'}
              </button>
            )}
          </div>
        )}
      />

      {/* This month at a glance: one card, four cells. Money in is by
          received date, money out by bill date; unpaid is all-time. Two by
          two until the main column is wide enough for four abreast: at lg
          the sidebar rail leaves ~650px here, 160px a cell. */}
      <section aria-label={`${monthLabel(bills?.month)} at a glance`} className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/60 overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700/60">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">{monthLabel(bills?.month)}</p>
          <p className="hidden lg:block text-[11px] text-slate-400 dark:text-slate-500 truncate">Money in by received date · money out by bill date · unpaid is everything still open</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 [&>*:nth-child(even)]:border-l [&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+3)]:border-t-0 lg:[&>*:nth-child(n+2)]:border-l">
          <Cell label="Money in" active={view === 'in'} onClick={() => selectView('in')}
                sub={payments ? `${payments.month_count} payment${payments.month_count === 1 ? '' : 's'} received` : ''}>
            <MoneyStack totals={payments?.month_total} loaded={Boolean(payments)} tone="text-green-700 dark:text-green-400" />
          </Cell>
          <Cell label="Money out" active={view === 'out'} onClick={() => selectView('out')}
                sub={bills ? `${bills.month_count} bill${bills.month_count === 1 ? '' : 's'} logged` : ''}>
            <MoneyStack totals={bills?.month_total} loaded={Boolean(bills)} />
          </Cell>
          <Cell label="Net" sub={loaded ? (netCad >= 0 ? 'in minus out' : 'more out than in') : ''} red={loaded && netCad < 0}>
            <MoneyStack totals={net} loaded={loaded} tone={netCad < 0 ? 'text-red-600 dark:text-red-400' : ''} />
          </Cell>
          <Cell label="Unpaid bills" red={overdue > 0} onClick={() => selectView('out', overdue > 0 ? 'overdue' : 'unpaid')}
                sub={bills ? (overdue > 0 ? `${overdue} overdue` : `${bills.unpaid_count} open`) : ''}>
            <MoneyStack totals={bills?.unpaid_total} loaded={Boolean(bills)} />
          </Cell>
        </div>
      </section>

      {view === 'out' ? (
        <BillsView overdueCount={overdue} onMutated={onMutated} focusTick={focusTick} createTick={createTick} />
      ) : view === 'in' ? (
        <PaymentsView onMutated={onMutated} focusTick={focusTick} createTick={createTick} />
      ) : view === 'pnl' ? (
        <ProfitLossView focusTick={focusTick} />
      ) : (
        <JournalView focusTick={focusTick} />
      )}
    </div>
  );
}
