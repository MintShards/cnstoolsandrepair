import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { paymentsAPI } from '../../services/api';
import { useToast } from '../admin/shared/ToastProvider';
import { apiErrorMessage } from '../../utils/apiError';
import usePollWhileVisible from '../../utils/usePollWhileVisible';
import TabHeader from '../sales/TabHeader';
import SortableTh from '../sales/SortableTh';
import useSort from '../sales/useSort';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../sales/pageSize';
import { FILTER_INPUT } from '../sales/ui';
import PaginationBar from '../admin/shared/PaginationBar';
import { PAYMENT_METHODS } from '../../constants/bills';
import { formatMoney } from '../../utils/money';
import { formatYmd } from '../../utils/dateFormat';
import WorkOrderChip from './WorkOrderChip';
import PaymentFormModal from './PaymentFormModal';

const POLL_MS = 60000;
const FIRST_DIRS = { received_date: 'desc', amount: 'desc', created_at: 'desc' };
// Rows and cards open on Enter/Space too; the ring only shows for keyboard focus.
const ROW_FOCUS = 'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary/60';

/**
 * Money in: customer payments on Zoho invoices, entered when the money
 * lands. Rows open the edit form (no lifecycle — a payment is a fact).
 * Amounts stay neutral in the rows; green is the Money in tile's colour and
 * the Paid pill's, not every inflow's.
 */
export default function PaymentsView({ onMutated, focusTick, createTick }) {
  const showToast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [month, setMonth] = useState('');
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  // undefined = closed, null = create, object = edit that payment
  const [formPayment, setFormPayment] = useState(undefined);

  const { sortBy, sortDir, handleSort } = useSort('received_date', 'desc', FIRST_DIRS, () => setCurrentPage(1));

  useEffect(() => {
    const handle = setTimeout(() => { setQDebounced(q.trim()); setCurrentPage(1); }, 300);
    return () => clearTimeout(handle);
  }, [q]);

  const load = useCallback(async (withSpinner = false) => {
    if (withSpinner) setLoading(true);
    try {
      const { payments, total: t } = await paymentsAPI.list({
        month: month || undefined,
        q: qDebounced || undefined,
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      setRows(payments);
      setTotal(t);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to load payments.'));
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, [month, qDebounced, currentPage, pageSize, sortBy, sortDir, showToast]);

  useEffect(() => { load(true); }, [load]);
  usePollWhileVisible(() => load(false), POLL_MS);
  useEffect(() => {
    if (focusTick > 0) load(false);
  }, [focusTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // The host's Log a payment button. The ref remembers the tick this view
  // mounted with, so switching Money Out → Money In after an earlier click
  // does not reopen the form.
  const seenTick = useRef(createTick);
  useEffect(() => {
    if (createTick === seenTick.current) return;
    seenTick.current = createTick;
    setFormPayment(null);
  }, [createTick]);

  // Deep link: ?section=cash-flow&payment=<id> (calendar day log, work order
  // dialog). A dead link is dropped from the URL so a reload doesn't repeat
  // the error.
  const paymentParam = searchParams.get('payment');
  useEffect(() => {
    if (!paymentParam || formPayment?.id === paymentParam) return;
    paymentsAPI.get(paymentParam).then(setFormPayment).catch(() => {
      showToast('error', 'That payment could not be found — it may have been deleted.');
      const next = new URLSearchParams(searchParams);
      next.delete('payment');
      setSearchParams(next, { replace: true });
    });
  }, [paymentParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeForm = () => {
    setFormPayment(undefined);
    if (searchParams.get('payment')) {
      const next = new URLSearchParams(searchParams);
      next.delete('payment');
      setSearchParams(next, { replace: true });
    }
  };

  const afterMutation = () => {
    closeForm();
    load(false);
    onMutated();
  };

  const columns = [
    { field: 'received_date', label: 'Received', cls: 'px-3 lg:px-4' },
    { field: 'customer_name', label: 'From',     cls: 'px-3 lg:px-4' },
    { field: 'amount',        label: 'Amount',   cls: 'px-3 lg:px-4 text-right' },
  ];
  const filtered = Boolean(month || qDebounced);

  return (
    <div>
      <TabHeader>
        <div>
          <input
            type="month"
            value={month}
            onChange={(e) => { setMonth(e.target.value); setCurrentPage(1); }}
            aria-label="Month (by received date)"
            title="Month, by received date"
            className={FILTER_INPUT}
          />
        </div>
        <div className="sm:hidden" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search customer, Zoho invoice #, WO, reference…"
          className={`${FILTER_INPUT} sm:flex-1 sm:min-w-[220px]`}
          aria-label="Search payments"
        />
      </TabHeader>

      <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
            <p className="mt-3 text-slate-500 dark:text-slate-400">Loading payments...</p>
          </div>
        ) : !loading && rows.length === 0 ? (
          <div className="text-center py-16 px-4">
            <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 block mb-3">payments</span>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              {filtered ? 'No payments match these filters.' : 'No payments logged yet. Tap Log a payment when money lands.'}
            </p>
          </div>
        ) : (
          <>
            {/* Phones: one card per payment. The card body is a real button;
                the work-order chip is a link, so it sits beside it. */}
            <ul className="sm:hidden divide-y divide-slate-200 dark:divide-slate-700/40">
              {rows.map((p) => (
                <li key={p.id} className="px-3 py-3">
                  <button type="button" onClick={() => setFormPayment(p)} className={`block w-full text-left rounded-lg ${ROW_FOCUS}`}>
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-bold text-slate-900 dark:text-white truncate">{p.customer_name}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                          <span className="font-mono">{p.payment_number}</span>
                          {p.zoho_invoice_number && ` · Zoho ${p.zoho_invoice_number}`}
                        </span>
                      </span>
                      <span className="font-black text-slate-900 dark:text-white whitespace-nowrap">{formatMoney(p.amount, p.currency)}</span>
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-bold">{formatYmd(p.received_date)}</span>
                      {p.payment_method && <span>· {PAYMENT_METHODS[p.payment_method]}</span>}
                      {p.payment_reference && <span>· {p.payment_reference}</span>}
                    </span>
                  </button>
                  {p.repair_id && p.request_number && (
                    <div className="mt-1.5">
                      <WorkOrderChip repairId={p.repair_id} requestNumber={p.request_number} />
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-base text-left">
                <thead className="text-sm uppercase text-slate-500 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/60">
                  <tr>
                    {columns.slice(0, 2).map((col) => (
                      <SortableTh key={col.field} {...col} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    ))}
                    <th className="py-3 px-3 lg:px-4 font-bold hidden lg:table-cell whitespace-nowrap">Zoho invoice</th>
                    <th className="py-3 px-3 lg:px-4 font-bold hidden xl:table-cell whitespace-nowrap">Paid by</th>
                    <SortableTh {...columns[2]} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40">
                  {rows.map((p) => (
                    <tr
                      key={p.id}
                      tabIndex={0}
                      onClick={() => setFormPayment(p)}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return; // the chip handles its own keys
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFormPayment(p); }
                      }}
                      className={`cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors ${ROW_FOCUS}`}
                    >
                      <td className="py-3 px-3 lg:px-4 whitespace-nowrap font-bold text-slate-900 dark:text-white">{formatYmd(p.received_date)}</td>
                      {/* w-full max-w-0: absorbs the leftover width and truncates,
                          so the table never outgrows its container. */}
                      <td className="py-3 px-3 lg:px-4 w-full max-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate">{p.customer_name}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-mono">{p.payment_number}</span>
                          {p.zoho_invoice_number && <span className="lg:hidden">· Zoho {p.zoho_invoice_number}</span>}
                          {p.repair_id && p.request_number && <WorkOrderChip repairId={p.repair_id} requestNumber={p.request_number} />}
                          {p.notes && <span className="truncate max-w-[200px]" title={p.notes}>· {p.notes}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-3 lg:px-4 whitespace-nowrap hidden lg:table-cell text-slate-700 dark:text-slate-300">{p.zoho_invoice_number || <span className="text-slate-400">—</span>}</td>
                      <td className="py-3 px-3 lg:px-4 whitespace-nowrap hidden xl:table-cell text-slate-700 dark:text-slate-300">
                        {[PAYMENT_METHODS[p.payment_method], p.payment_reference].filter(Boolean).join(' · ') || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-3 px-3 lg:px-4 whitespace-nowrap text-right font-black text-slate-900 dark:text-white">{formatMoney(p.amount, p.currency)}</td>
                    </tr>
                  ))}
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
          itemLabel="payments"
        />
      </div>

      {formPayment !== undefined && (
        <PaymentFormModal
          payment={formPayment}
          onSaved={afterMutation}
          onDeleted={afterMutation}
          onClose={closeForm}
        />
      )}
    </div>
  );
}
