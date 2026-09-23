import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { billsAPI, paymentsAPI } from '../../services/api';
import TabHeader from '../sales/TabHeader';
import { BTN_PRIMARY } from '../sales/ui';
import { formatMoney, totalsByCurrency, round2 } from '../../utils/money';
import BillsView from './BillsView';
import PaymentsView from './PaymentsView';

const VIEWS = [
  { id: 'out', icon: 'receipt_long', label: 'Money Out', sub: 'Supplier bills' },
  { id: 'in',  icon: 'payments',     label: 'Money In',  sub: 'Customer payments' },
];

function monthLabel(ym) {
  if (!ym) return 'This month';
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
}

function netByCurrency(inTotals, outTotals) {
  const currencies = new Set([...Object.keys(inTotals || {}), ...Object.keys(outTotals || {})]);
  const net = {};
  for (const c of currencies) net[c] = round2((inTotals?.[c] || 0) - (outTotals?.[c] || 0));
  return net;
}

/** The CAD figure large, any USD line small underneath — never a mixed sum. */
function MoneyStack({ totals, loaded, tone = '' }) {
  if (!loaded) return <span className="text-slate-400">—</span>;
  const parts = totalsByCurrency(totals);
  if (parts.length === 0) return <span className={tone}>{formatMoney(0)}</span>;
  return (
    <>
      <span className={tone}>{formatMoney(parts[0].amount, parts[0].currency)}</span>
      {parts.slice(1).map((p) => (
        <span key={p.currency} className="block text-xs font-bold text-slate-500 dark:text-slate-400">
          {p.amount < 0 ? '−' : '+'} {formatMoney(Math.abs(p.amount), p.currency)}
        </span>
      ))}
    </>
  );
}

/**
 * A summary tile. It is a real button only when it leads somewhere (Money in
 * and Money out switch views, Unpaid bills opens that list); Net is plain, so
 * keyboard users never land on a control that does nothing.
 */
function Tile({ label, sub, red, active, onClick, children }) {
  const clickable = Boolean(onClick);
  const cls = `text-left rounded-xl border px-3 py-2.5 min-h-[44px] transition-colors ${
    active
      ? 'border-primary bg-primary/5 dark:bg-primary/10'
      : red
        ? `border-red-300 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10 ${clickable ? 'hover:bg-red-100 dark:hover:bg-red-900/20' : ''}`
        : `border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/60 ${clickable ? 'hover:bg-slate-100 dark:hover:bg-slate-800' : ''}`
  }`;
  const body = (
    <>
      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      <span className="block text-base sm:text-xl font-black leading-tight truncate text-slate-900 dark:text-white">{children}</span>
      {sub && <span className={`block text-[11px] truncate ${red ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>{sub}</span>}
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
 * Cash Flow (admin only): money in and money out under one roof. Bills are
 * what the shop owes and paid (Out); payments are what customers actually
 * paid on Zoho invoices (In). The tiles are this month's picture; the two
 * views below carry the lists and their own forms.
 */
export default function CashFlowSection({ refreshCounts, focusTick }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState(() => {
    // A deep link to a record picks its side; otherwise the URL, then memory.
    if (searchParams.get('bill')) return 'out';
    if (searchParams.get('payment')) return 'in';
    const fromUrl = searchParams.get('view');
    if (fromUrl === 'in' || fromUrl === 'out') return fromUrl;
    return localStorage.getItem('ws_cash_view') === 'in' ? 'in' : 'out';
  });
  const [summary, setSummary] = useState({ bills: null, payments: null });
  // Bumped by the header button; the mounted view opens its log form.
  const [createTick, setCreateTick] = useState(0);

  const loadSummary = useCallback(async () => {
    try {
      const [bills, payments] = await Promise.all([billsAPI.summary(), paymentsAPI.summary()]);
      setSummary({ bills, payments });
    } catch {
      // Tiles keep their dashes; the lists report their own errors.
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
  // Unpaid tile, the sidebar alert or Needs Attention); BillsView owns it.
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

  return (
    <div>
      <TabHeader
        title="Cash Flow"
        subtitle="Money in and money out — customer payments and supplier bills"
        action={(
          <button
            onClick={() => setCreateTick((t) => t + 1)}
            className={`${BTN_PRIMARY} w-full sm:w-auto`}
            title={view === 'out' ? 'Log a supplier bill or receipt' : 'Log a customer payment'}
          >
            <span className="material-symbols-outlined text-base">{view === 'out' ? 'receipt_long' : 'payments'}</span>
            {view === 'out' ? 'Log a bill' : 'Log a payment'}
          </button>
        )}
      />

      {/* This month at a glance. Money in is by received date, money out by bill date. */}
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">{monthLabel(bills?.month)}</p>
        <p className="hidden md:block text-[11px] text-slate-400 dark:text-slate-500 truncate">Money in by received date · money out by bill date</p>
      </div>
      {/* Two by two until the main column is wide enough for four abreast
          (xl) — at laptop widths the sidebar rail leaves ~640px here. */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 mb-4">
        <Tile label="Money in" active={view === 'in'} onClick={() => selectView('in')}
              sub={payments ? `${payments.month_count} payment${payments.month_count === 1 ? '' : 's'} received` : ''}>
          <MoneyStack totals={payments?.month_total} loaded={Boolean(payments)} tone="text-green-700 dark:text-green-400" />
        </Tile>
        <Tile label="Money out" active={view === 'out'} onClick={() => selectView('out')}
              sub={bills ? `${bills.month_count} bill${bills.month_count === 1 ? '' : 's'} logged` : ''}>
          <MoneyStack totals={bills?.month_total} loaded={Boolean(bills)} />
        </Tile>
        <Tile label="Net" sub={loaded ? (netCad >= 0 ? 'in minus out' : 'more out than in') : ''} red={loaded && netCad < 0}>
          <MoneyStack totals={net} loaded={loaded} tone={netCad < 0 ? 'text-red-600 dark:text-red-400' : ''} />
        </Tile>
        {/* Unpaid is all-time, not this month: what the shop still owes today. */}
        <Tile label="Unpaid bills" red={overdue > 0} onClick={() => selectView('out', overdue > 0 ? 'overdue' : 'unpaid')}
              sub={bills ? (overdue > 0 ? `${overdue} overdue` : `${bills.unpaid_count} open`) : ''}>
          <MoneyStack totals={bills?.unpaid_total} loaded={Boolean(bills)} />
        </Tile>
      </div>

      {/* Money Out / Money In switcher — same segmented control as the tasks Board/List. */}
      <div className="flex w-full sm:w-auto sm:inline-flex rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden mb-4" role="group" aria-label="Money out or money in">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => selectView(v.id)}
            aria-pressed={view === v.id}
            title={v.sub}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 min-h-11 sm:min-h-0 text-sm font-bold transition-colors ${
              view === v.id
                ? 'bg-primary text-white'
                : 'bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-base">{v.icon}</span>
            {v.label}
            <span className={`hidden md:inline text-xs font-medium ${view === v.id ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>· {v.sub}</span>
          </button>
        ))}
      </div>

      {view === 'out' ? (
        <BillsView overdueCount={overdue} onMutated={onMutated} focusTick={focusTick} createTick={createTick} />
      ) : (
        <PaymentsView onMutated={onMutated} focusTick={focusTick} createTick={createTick} />
      )}
    </div>
  );
}
