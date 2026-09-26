import { useState, useEffect, useCallback } from 'react';
import { billsAPI, paymentsAPI, staffAPI } from '../services/api';

/**
 * One fetch of a work order's bills and payments per dialog, shared by the
 * job accounting block and the per-tool subtotals, plus the rate agreed with
 * each technician (the staff list carries it for admins only). `enabled` is
 * the admin gate — other roles never call the admin-only routes. Void bills
 * are left out by the API's default filter.
 */
export default function useJobMoney(jobId, enabled, refreshTick) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const [b, p, staff] = await Promise.all([
        billsAPI.list({ repair_id: jobId, limit: 200 }),
        paymentsAPI.list({ repair_id: jobId, limit: 200 }),
        // A failed staff fetch only costs the technician rates, not the block.
        staffAPI.list().catch(() => []),
      ]);
      // Keyed by display name — what a tool stores in assigned_technician.
      const technicianRates = {};
      for (const a of staff) {
        if (a.labour_cost_rate != null) technicianRates[a.name] = { basis: a.labour_cost_basis || 'hourly', rate: a.labour_cost_rate };
      }
      setData({ bills: b.bills, payments: p.payments, technicianRates });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [jobId, enabled]);

  useEffect(() => { load(); }, [load, refreshTick]);

  return {
    bills: data?.bills || [],
    payments: data?.payments || [],
    technicianRates: data?.technicianRates || {},
    loaded: Boolean(data),
    failed,
  };
}
