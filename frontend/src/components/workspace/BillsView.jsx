import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { billsAPI, suppliersAPI } from '../../services/api';
import { useToast } from '../admin/shared/ToastProvider';
import { apiErrorMessage } from '../../utils/apiError';
import usePollWhileVisible from '../../utils/usePollWhileVisible';
import TabHeader from '../sales/TabHeader';
import SortableTh from '../sales/SortableTh';
import useSort from '../sales/useSort';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../sales/pageSize';
import { FILTER_INPUT } from '../sales/ui';
import PaginationBar from '../admin/shared/PaginationBar';
import {
  BILL_CHIPS, BILL_CHIP_IDS, BILL_CATEGORIES, isBillOverdue, linkedWorkOrders,
} from '../../constants/bills';
import { formatMoney } from '../../utils/money';
import { getTodayPacific, formatYmd, daysSinceYmd } from '../../utils/dateFormat';
import WorkOrderChip from './WorkOrderChip';
import BillStatusPill from './BillStatusPill';
import BillFormModal from './BillFormModal';
import BillDetailModal from './BillDetailModal';

const POLL_MS = 60000;
// Later-clicked columns start with their useful direction.
const FIRST_DIRS = { bill_date: 'desc', total: 'desc', created_at: 'desc' };

const EMPTY_COPY = {
  unpaid: 'Nothing unpaid — nice.',
  overdue: 'Nothing overdue.',
  disputed: 'No disputed bills.',
  paid: 'No paid bills yet.',
  all: 'No bills logged yet. Tap Log bill to add the first one.',
};

function chipParams(chipId) {
  return (BILL_CHIPS.find((c) => c.id === chipId) || BILL_CHIPS[0]).params;
}

function DueText({ bill, today, className = '' }) {
  if (!bill.due_date) return <span className={`text-slate-400 dark:text-slate-600 ${className}`}>No due date</span>;
  const overdue = isBillOverdue(bill, today);
  const days = overdue ? daysSinceYmd(bill.due_date) : 0;
  return (
    <span className={`${overdue ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'} ${className}`}>
      {formatYmd(bill.due_date)}
      {overdue && (
        <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide">
          Overdue{days > 0 ? ` · ${days}d` : ''}
        </span>
      )}
    </span>
  );
}

function AttachmentCount({ bill }) {
  const n = bill.attachments?.length || 0;
  if (!n) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-slate-500 dark:text-slate-400" title={`${n} attachment${n === 1 ? '' : 's'}`}>
      <span className="material-symbols-outlined text-sm">attach_file</span>{n}
    </span>
  );
}

/**
 * Money out: the bills list with its filters, the log/edit form and the
 * detail modal. Unpaid is the working view; chips narrow it; rows open the
 * detail. Polling and focus catch-up follow TasksSection.
 */
export default function BillsView({ overdueCount, onMutated, focusTick, createTick }) {
  const showToast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [chip, setChip] = useState(() => {
    const saved = localStorage.getItem('ws_bills_chip');
    return BILL_CHIP_IDS.includes(saved) ? saved : 'unpaid';
  });
  const [month, setMonth] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);

  // undefined = closed, null = create, object = edit that bill
  const [formBill, setFormBill] = useState(undefined);
  const [detailBill, setDetailBill] = useState(null);
  const [returnToDetail, setReturnToDetail] = useState(false);

  const { sortBy, sortDir, handleSort } = useSort('due_date', 'asc', FIRST_DIRS, () => setCurrentPage(1));
  const today = getTodayPacific();

  const selectChip = (id) => {
    setChip(id);
    localStorage.setItem('ws_bills_chip', id);
    setCurrentPage(1);
  };

  useEffect(() => {
    const handle = setTimeout(() => { setQDebounced(q.trim()); setCurrentPage(1); }, 300);
    return () => clearTimeout(handle);
  }, [q]);

  const load = useCallback(async (withSpinner = false) => {
    if (withSpinner) setLoading(true);
    try {
      const { bills, total: t } = await billsAPI.list({
        ...chipParams(chip),
        month: month || undefined,
        supplier_id: supplierId || undefined,
        q: qDebounced || undefined,
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      setRows(bills);
      setTotal(t);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to load bills.'));
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, [chip, month, supplierId, qDebounced, currentPage, pageSize, sortBy, sortDir, showToast]);

  useEffect(() => { load(true); }, [load]);
  usePollWhileVisible(() => load(false), POLL_MS);
  useEffect(() => {
    if (focusTick > 0) load(false);
  }, [focusTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // The host's Log bill button.
  useEffect(() => {
    if (createTick > 0) { setReturnToDetail(false); setFormBill(null); }
  }, [createTick]);

  const loadSuppliers = useCallback(async () => {
    try {
      setSuppliers(await suppliersAPI.getAll());
    } catch {
      // The picker degrades to typed vendor names.
    }
  }, []);
  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  const afterMutation = useCallback(() => {
    load(false);
    onMutated();
  }, [load, onMutated]);

  // Deep link: ?section=cash-flow&bill=<id> (from the calendar's day log).
  const billParam = searchParams.get('bill');
  useEffect(() => {
    if (!billParam || detailBill?.id === billParam) return;
    billsAPI.get(billParam).then(setDetailBill).catch(() => {
      showToast('error', 'That bill could not be found.');
    });
  }, [billParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeDetail = () => {
    setDetailBill(null);
    if (searchParams.get('bill')) {
      const next = new URLSearchParams(searchParams);
      next.delete('bill');
      setSearchParams(next, { replace: true });
    }
  };

  const handleFormSaved = (saved) => {
    setFormBill(undefined);
    if (returnToDetail) setDetailBill(saved);
    setReturnToDetail(false);
    afterMutation();
  };

  const handleDetailChanged = (updated) => {
    if (updated) setDetailBill(updated);
    afterMutation();
  };

  const columns = [
    { field: 'due_date',      label: 'Due',       cls: 'px-3 lg:px-4' },
    { field: 'supplier_name', label: 'Bill',      cls: 'px-3 lg:px-4' },
    { field: 'bill_date',     label: 'Bill date', cls: 'px-3 lg:px-4 hidden xl:table-cell' },
    { field: 'total',         label: 'Total',     cls: 'px-3 lg:px-4 text-right' },
    { field: 'status',        label: 'Status',    cls: 'px-3 lg:px-4' },
  ];

  const filtered = Boolean(month || supplierId || qDebounced);

  return (
    <div>
      <TabHeader>
        {/* Chips take the whole phone row and scroll sideways; sm+ they sit
            inline with the other filters. */}
        <div className="col-span-2 sm:col-span-1 flex gap-1.5 overflow-x-auto sm:overflow-visible pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {BILL_CHIPS.map((c) => {
            const active = chip === c.id;
            const badge = c.id === 'overdue' && overdueCount > 0 ? overdueCount : null;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => selectChip(c.id)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 min-h-11 sm:min-h-0 rounded-xl text-sm font-bold border transition-colors ${
                  active
                    ? 'bg-primary text-white border-primary'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {c.label}
                {badge != null && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>{badge}</span>
                )}
              </button>
            );
          })}
        </div>
        <div>
          <input
            type="month"
            value={month}
            onChange={(e) => { setMonth(e.target.value); setCurrentPage(1); }}
            aria-label="Month (by bill date)"
            title="Month, by bill date"
            className={FILTER_INPUT}
          />
        </div>
        <select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setCurrentPage(1); }} className={FILTER_INPUT} aria-label="Supplier">
          <option value="">All suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search bill #, supplier, invoice #, part, notes…"
          className={`${FILTER_INPUT} sm:flex-1 sm:min-w-[220px]`}
          aria-label="Search bills"
        />
      </TabHeader>

      <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
            <p className="mt-3 text-slate-500 dark:text-slate-400">Loading bills...</p>
          </div>
        ) : !loading && rows.length === 0 ? (
          <div className="text-center py-16 px-4">
            <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 block mb-3">receipt_long</span>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              {filtered ? 'No bills match these filters.' : EMPTY_COPY[chip]}
            </p>
          </div>
        ) : (
          <>
            {/* Phones: one card per bill */}
            <ul className="sm:hidden divide-y divide-slate-200 dark:divide-slate-700/40">
              {rows.map((bill) => {
                const overdue = isBillOverdue(bill, today);
                const jobs = linkedWorkOrders(bill);
                return (
                  <li key={bill.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setDetailBill(bill)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailBill(bill); } }}
                      className={`px-3 py-3 cursor-pointer transition-colors ${overdue ? 'bg-red-50 dark:bg-red-900/10' : 'hover:bg-slate-100 dark:hover:bg-slate-700/30'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate">{bill.supplier_name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            <span className="font-mono">{bill.bill_number}</span>
                            {bill.vendor_invoice_number && ` · ${bill.vendor_invoice_number}`}
                            {` · ${BILL_CATEGORIES[bill.category] || bill.category}`}
                          </p>
                        </div>
                        <p className="font-black text-slate-900 dark:text-white whitespace-nowrap">{formatMoney(bill.total, bill.currency)}</p>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <BillStatusPill status={bill.status} small />
                        <DueText bill={bill} today={today} className="font-bold" />
                        <AttachmentCount bill={bill} />
                        {jobs.map((j) => <WorkOrderChip key={j.repair_id} repairId={j.repair_id} requestNumber={j.request_number} />)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* sm+: the table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-base text-left">
                <thead className="text-sm uppercase text-slate-500 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/60">
                  <tr>
                    {columns.map((col) => (
                      <SortableTh key={col.field} {...col} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40">
                  {rows.map((bill) => {
                    const overdue = isBillOverdue(bill, today);
                    const jobs = linkedWorkOrders(bill);
                    return (
                      <tr
                        key={bill.id}
                        onClick={() => setDetailBill(bill)}
                        className={`cursor-pointer transition-colors ${
                          overdue
                            ? 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700/30'
                        }`}
                      >
                        <td className="py-3 px-3 lg:px-4 whitespace-nowrap">
                          <DueText bill={bill} today={today} className="font-bold" />
                        </td>
                        {/* w-full max-w-0: this cell absorbs whatever width the
                            fixed columns leave and truncates, so the table never
                            grows past its container (same trick as TaskList). */}
                        <td className="py-3 px-3 lg:px-4 w-full max-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate">{bill.supplier_name}</div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono">{bill.bill_number}</span>
                            {bill.vendor_invoice_number && <span>· {bill.vendor_invoice_number}</span>}
                            <span>· {BILL_CATEGORIES[bill.category] || bill.category}</span>
                            <AttachmentCount bill={bill} />
                            {jobs.map((j) => <WorkOrderChip key={j.repair_id} repairId={j.repair_id} requestNumber={j.request_number} />)}
                          </div>
                        </td>
                        <td className="py-3 px-3 lg:px-4 whitespace-nowrap hidden xl:table-cell text-slate-700 dark:text-slate-300">
                          {formatYmd(bill.bill_date)}
                        </td>
                        <td className="py-3 px-3 lg:px-4 whitespace-nowrap text-right font-black text-slate-900 dark:text-white">
                          {formatMoney(bill.total, bill.currency)}
                        </td>
                        <td className="py-3 px-3 lg:px-4 whitespace-nowrap">
                          <BillStatusPill status={bill.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        <PaginationBar
          currentPage={currentPage}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          itemLabel="bills"
        />
      </div>

      {formBill !== undefined && (
        <BillFormModal
          bill={formBill}
          suppliers={suppliers}
          onSuppliersChange={loadSuppliers}
          onSaved={handleFormSaved}
          onClose={() => { setFormBill(undefined); setReturnToDetail(false); }}
        />
      )}
      {detailBill && formBill === undefined && (
        <BillDetailModal
          bill={detailBill}
          suppliers={suppliers}
          onEdit={(bill) => { setReturnToDetail(true); setFormBill(bill); }}
          onChanged={handleDetailChanged}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}
