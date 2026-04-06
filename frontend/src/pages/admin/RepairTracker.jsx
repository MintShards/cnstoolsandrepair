import { useState, useCallback, createContext, useContext } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import CustomersTab from '../../components/admin/tabs/CustomersTab';
import RepairRequestsTab from '../../components/admin/tabs/RepairRequestsTab';
import RepairJobsTab from '../../components/admin/tabs/RepairJobsTab';

// ── TOAST SYSTEM ─────────────────────────────────────────────
export const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[80] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-xl text-sm font-bold max-w-sm transition-all ${
            t.type === 'success'
              ? 'bg-green-900/95 border-green-600 text-green-200'
              : 'bg-red-900/95 border-red-600 text-red-200'
          }`}
        >
          <span className="material-symbols-outlined text-lg flex-shrink-0">
            {t.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span className="flex-1">{t.text}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      ))}
    </div>
  );
}

export default function RepairTracker() {
  const [activeTab, setActiveTab] = useState('customers');
  const [preselectedCustomer, setPreselectedCustomer] = useState(null);
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((type, text) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const tabs = [
    { id: 'customers', label: 'Customers', icon: 'group' },
    { id: 'requests', label: 'Repair Requests', icon: 'inbox' },
    { id: 'jobs', label: 'Repair Jobs', icon: 'build_circle' },
  ];

  const handleNewJobFromCustomer = (customer) => {
    setPreselectedCustomer(customer);
    setActiveTab('jobs');
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId !== 'jobs') {
      setPreselectedCustomer(null);
    }
  };

  return (
    <ToastContext.Provider value={showToast}>
      <AdminLayout title="Repair Tracker">
        {/* Tab Navigation */}
        <div className="mb-6">
          <nav className="flex gap-2 bg-slate-900 rounded-2xl border border-slate-800 p-2 w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-xl">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          {activeTab === 'customers' && (
            <CustomersTab onNewJob={handleNewJobFromCustomer} />
          )}
          {activeTab === 'requests' && (
            <RepairRequestsTab onConvertSuccess={() => handleTabChange('jobs')} />
          )}
          {activeTab === 'jobs' && (
            <RepairJobsTab
              preselectedCustomer={preselectedCustomer}
              onPreselectedCustomerUsed={() => setPreselectedCustomer(null)}
            />
          )}
        </div>
      </AdminLayout>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}
