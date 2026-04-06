import { useState, useEffect } from 'react';
import { quotesAPI, repairsAPI } from '../../../services/api';
import { useToast } from '../../../pages/admin/RepairTracker';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function RepairRequestsTab({ onConvertSuccess }) {
  const showToast = useToast();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('quotesPageSize');
    return saved ? parseInt(saved) : 10;
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [convertingId, setConvertingId] = useState(null);
  const [convertConfirm, setConvertConfirm] = useState(null);

  useEffect(() => {
    fetchQuotes();
  }, [statusFilter]);

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      const params = statusFilter ? { status: statusFilter } : {};
      const data = await quotesAPI.list(params);
      setQuotes(data);
    } catch {
      showToast('error', 'Failed to load repair requests');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (quoteId, newStatus) => {
    try {
      await quotesAPI.update(quoteId, { status: newStatus });
      showToast('success', 'Status updated successfully');
      setQuotes(quotes.map(q => q.id === quoteId ? { ...q, status: newStatus } : q));
      if (selectedQuote?.id === quoteId) {
        setSelectedQuote({ ...selectedQuote, status: newStatus });
      }
    } catch {
      showToast('error', 'Failed to update status');
    }
  };

  const handleConvertClick = (quote) => {
    setConvertConfirm(quote);
  };

  const handleConvertConfirm = async () => {
    if (!convertConfirm) return;
    setConvertingId(convertConfirm.id);
    try {
      await repairsAPI.convertFromRequest(convertConfirm.id);
      setQuotes(quotes.map(q => q.id === convertConfirm.id ? { ...q, status: 'converted' } : q));
      showToast('success', `Request ${convertConfirm.request_number} converted to Work Order. Find it in the Repair Jobs tab.`);
      setConvertConfirm(null);
      setSelectedQuote(null);
      if (onConvertSuccess) onConvertSuccess();
    } catch (error) {
      showToast('error', error.response?.data?.detail || 'Failed to convert repair request');
      setConvertConfirm(null);
    } finally {
      setConvertingId(null);
    }
  };

  const handleDeleteClick = (quote) => {
    setDeleteConfirmId(quote);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    try {
      await quotesAPI.delete(deleteConfirmId.id);
      showToast('success', 'Repair request deleted successfully');
      setQuotes(quotes.filter(q => q.id !== deleteConfirmId.id));
      setDeleteConfirmId(null);
      if (selectedQuote?.id === deleteConfirmId.id) setSelectedQuote(null);
    } catch {
      showToast('error', 'Failed to delete repair request');
      setDeleteConfirmId(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-700', label: 'Pending' },
      in_progress: { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-700', label: 'In Progress' },
      quoted: { bg: 'bg-purple-900/30', text: 'text-purple-400', border: 'border-purple-700', label: 'Quote Provided' },
      completed: { bg: 'bg-green-900/30', text: 'text-green-400', border: 'border-green-700', label: 'Completed' },
      converted: { bg: 'bg-cyan-900/30', text: 'text-cyan-400', border: 'border-cyan-700', label: 'Converted to WO' },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${config.bg} ${config.text} border ${config.border}`}>
        {config.label}
      </span>
    );
  };

  const filteredQuotes = quotes.filter(quote => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      quote.company_name?.toLowerCase().includes(search) ||
      quote.contact_person.toLowerCase().includes(search) ||
      quote.email.toLowerCase().includes(search) ||
      quote.request_number.toLowerCase().includes(search)
    );
  });

  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter]);

  const totalResults = filteredQuotes.length;
  const totalPages = Math.ceil(totalResults / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedQuotes = filteredQuotes.slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
    localStorage.setItem('quotesPageSize', newSize);
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...'); pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1); pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1); pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...'); pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div>
      <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-6">
        Online Repair Requests
      </h2>

      {/* Filters */}
      <div className="mb-6 p-6 bg-slate-800 rounded-lg border border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by company, contact, email, or request #"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Filter by Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="quoted">Quote Provided</option>
              <option value="completed">Completed</option>
              <option value="converted">Converted to WO</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">Requests ({totalResults})</h3>

        {loading ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
            <p className="mt-2 text-slate-400">Loading repair requests...</p>
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-slate-600">request_quote</span>
            <p className="mt-2 text-slate-400">
              {searchQuery || statusFilter ? 'No repair requests match your filters' : 'No repair requests yet'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Request #</th>
                  <th className="py-3 px-4">Company/Contact</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Tools</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {paginatedQuotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-slate-700/50 transition-colors">
                    <td className="py-3 px-4 text-slate-300 font-mono text-xs">{quote.request_number}</td>
                    <td className="py-3 px-4">
                      <div className="text-slate-300 font-bold">{quote.company_name || quote.contact_person}</div>
                      {quote.company_name && <div className="text-slate-400 text-xs">{quote.contact_person}</div>}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs">{formatDate(quote.created_at)}</td>
                    <td className="py-3 px-4 text-slate-300">
                      {quote.tools.length} tool{quote.tools.length !== 1 ? 's' : ''}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(quote.status)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedQuote(quote)}
                          className="inline-flex items-center gap-1 px-3 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          View
                        </button>
                        {quote.status !== 'converted' && (
                          <button
                            onClick={() => handleConvertClick(quote)}
                            disabled={convertingId === quote.id}
                            className="inline-flex items-center gap-1 px-3 py-2 bg-orange-700 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-sm">build</span>
                            Convert
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteClick(quote)}
                          className="inline-flex items-center gap-1 px-3 py-2 bg-red-900 hover:bg-red-800 text-red-200 rounded-lg text-xs font-bold transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalResults > 0 && (
          <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-slate-900 rounded-lg border border-slate-700">
            <div className="text-sm text-slate-400">
              Showing <span className="text-white font-bold">{startIndex + 1}</span> to{' '}
              <span className="text-white font-bold">{Math.min(endIndex, totalResults)}</span> of{' '}
              <span className="text-white font-bold">{totalResults}</span> results
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <div className="flex items-center gap-1">
                {getPageNumbers().map((page, idx) => (
                  page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-3 py-2 text-slate-500">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-2 rounded-lg font-bold text-sm transition-all ${
                        currentPage === page ? 'bg-primary text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {page}
                    </button>
                  )
                ))}
              </div>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">Show:</label>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedQuote && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedQuote(null)}
        >
          <div
            className="bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-white uppercase">
                  Repair Request {selectedQuote.request_number}
                </h3>
                <p className="text-sm text-slate-400 mt-1">Submitted {formatDate(selectedQuote.created_at)}</p>
              </div>
              <div className="flex items-center gap-3">
                {selectedQuote.status !== 'converted' && (
                  <button
                    onClick={() => { setSelectedQuote(null); handleConvertClick(selectedQuote); }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white rounded-lg text-sm font-bold transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">build</span>
                    Convert to Work Order
                  </button>
                )}
                <button onClick={() => setSelectedQuote(null)} className="text-slate-400 hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-3xl">close</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Status Update */}
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <label className="block text-sm font-bold text-slate-300 mb-2">Update Status</label>
                <select
                  value={selectedQuote.status}
                  onChange={(e) => handleStatusUpdate(selectedQuote.id, e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="quoted">Quote Provided</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              {/* Customer Info */}
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <h4 className="text-sm font-bold text-white uppercase mb-3">Customer Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {selectedQuote.company_name && (
                    <div>
                      <span className="text-slate-400">Company:</span>
                      <span className="ml-2 text-white font-bold">{selectedQuote.company_name}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400">Contact:</span>
                    <span className="ml-2 text-white">{selectedQuote.contact_person}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Email:</span>
                    <a href={`mailto:${selectedQuote.email}`} className="ml-2 text-primary hover:underline">{selectedQuote.email}</a>
                  </div>
                  <div>
                    <span className="text-slate-400">Phone:</span>
                    <a href={`tel:${selectedQuote.phone}`} className="ml-2 text-primary hover:underline">{selectedQuote.phone}</a>
                  </div>
                </div>
              </div>

              {/* Tools */}
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <h4 className="text-sm font-bold text-white uppercase mb-3">Tools ({selectedQuote.tools.length})</h4>
                <div className="space-y-3">
                  {selectedQuote.tools.map((tool, idx) => (
                    <div key={idx} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-white font-bold">Tool {idx + 1}</div>
                        <div className="text-xs text-slate-400">Qty: {tool.quantity}</div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm mb-2">
                        <div><span className="text-slate-400">Type:</span><span className="ml-2 text-white">{tool.tool_type}</span></div>
                        <div><span className="text-slate-400">Brand:</span><span className="ml-2 text-white">{tool.tool_brand}</span></div>
                        <div><span className="text-slate-400">Model:</span><span className="ml-2 text-white">{tool.tool_model}</span></div>
                      </div>
                      <div className="text-sm">
                        <span className="text-slate-400">Problem:</span>
                        <p className="mt-1 text-slate-300">{tool.problem_description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Photos */}
              {selectedQuote.photos.length > 0 && (
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                  <h4 className="text-sm font-bold text-white uppercase mb-3">Photos ({selectedQuote.photos.length})</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {selectedQuote.photos.map((photo, idx) => (
                      <div key={idx} className="aspect-square cursor-pointer group relative" onClick={() => setSelectedPhoto(photo)}>
                        <img
                          src={photo.startsWith('http') ? photo : `${API_BASE_URL}/uploads/${photo}`}
                          alt={`Tool photo ${idx + 1}`}
                          className="w-full h-full object-cover rounded-lg border border-slate-700 group-hover:border-primary transition-all"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <span className="material-symbols-outlined text-white text-3xl">zoom_in</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-slate-300 transition-colors" onClick={() => setSelectedPhoto(null)}>
            <span className="material-symbols-outlined text-4xl">close</span>
          </button>
          <img
            src={selectedPhoto.startsWith('http') ? selectedPhoto : `${API_BASE_URL}/uploads/${selectedPhoto}`}
            alt="Full size tool photo"
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Convert Confirmation Modal */}
      {convertConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setConvertConfirm(null)}>
          <div className="bg-slate-800 rounded-lg max-w-md w-full p-6 border border-orange-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center mb-4">
              <div className="bg-orange-900/30 p-3 rounded-full">
                <span className="material-symbols-outlined text-4xl text-orange-400">build</span>
              </div>
            </div>
            <h3 className="text-xl font-black text-white uppercase text-center mb-2">Convert to Work Order</h3>
            <div className="mb-6 space-y-3">
              <p className="text-slate-300 text-center">
                Convert request <span className="font-bold text-white">{convertConfirm.request_number}</span> into a tracked Work Order?
              </p>
              <div className="bg-slate-900 rounded-lg p-3 border border-slate-700 text-sm space-y-1">
                <div><span className="text-slate-400">Customer:</span><span className="ml-2 text-white">{convertConfirm.company_name || convertConfirm.contact_person}</span></div>
                <div><span className="text-slate-400">Tools:</span><span className="ml-2 text-white">{convertConfirm.tools.length}</span></div>
              </div>
              <p className="text-slate-400 text-sm text-center">
                Customer info and tool details will be copied. You can add serial numbers and additional info in the Repair Jobs tab.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConvertConfirm(null)} className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-all">
                Cancel
              </button>
              <button
                onClick={handleConvertConfirm}
                disabled={!!convertingId}
                className="flex-1 px-4 py-3 bg-orange-700 hover:bg-orange-600 text-white rounded-lg font-bold transition-all disabled:opacity-50"
              >
                {convertingId ? 'Converting...' : 'Convert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-slate-800 rounded-lg max-w-md w-full p-6 border border-red-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center mb-4">
              <div className="bg-red-900/30 p-3 rounded-full">
                <span className="material-symbols-outlined text-4xl text-red-400">warning</span>
              </div>
            </div>
            <h3 className="text-xl font-black text-white uppercase text-center mb-2">Confirm Deletion</h3>
            <div className="mb-6 space-y-3">
              <p className="text-slate-300 text-center">
                Are you sure you want to delete request <span className="font-bold text-white">{deleteConfirmId.request_number}</span>?
              </p>
              <div className="bg-slate-900 rounded-lg p-3 border border-slate-700 text-sm space-y-1">
                <div><span className="text-slate-400">Customer:</span><span className="ml-2 text-white">{deleteConfirmId.company_name || deleteConfirmId.contact_person}</span></div>
                <div><span className="text-slate-400">Tools:</span><span className="ml-2 text-white">{deleteConfirmId.tools.length}</span></div>
                <div><span className="text-slate-400">Photos:</span><span className="ml-2 text-white">{deleteConfirmId.photos.length}</span></div>
              </div>
              <p className="text-red-300 text-sm text-center font-bold">
                This action is permanent and will delete all associated photos from storage.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-all">
                Cancel
              </button>
              <button onClick={handleDeleteConfirm} className="flex-1 px-4 py-3 bg-red-900 hover:bg-red-800 text-white rounded-lg font-bold transition-all">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
