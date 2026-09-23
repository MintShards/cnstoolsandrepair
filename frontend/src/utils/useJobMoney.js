import { useState, useEffect, useCallback } from 'react';
import { billsAPI, paymentsAPI } from '../services/api';

/**
 * One fetch of a work order's bills and payments per dialog, shared by the
 * job accounting block and the per-tool subtotals. `enabled` is the admin
 * gate — other roles never call the admin-only routes. Void bills are left
 * out by the API's default filter.
 */
export default function useJobMoney(jobId, enabled, refreshTick) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const [b, p] = await Promise.all([
        billsAPI.list({ repair_id: jobId, limit: 200 }),
        paymentsAPI.list({ repair_id: jobId, limit: 200 }),
      ]);
      setData({ bills: b.bills, payments: p.payments });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [jobId, enabled]);

  useEffect(() => { load(); }, [load, refreshTick]);

  return { bills: data?.bills || [], payments: data?.payments || [], loaded: Boolean(data), failed };
}
