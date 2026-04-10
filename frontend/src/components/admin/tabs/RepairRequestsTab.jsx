import { useState, useEffect } from 'react';
import { quotesAPI, repairsAPI } from '../../../services/api';
import { useToast } from '../../../pages/admin/RepairTracker';
import PaginationBar from '../shared/PaginationBar';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const getErrorMessage = (err, fallback) => {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.message || fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg || JSON.stringify(d)).join('; ');
  return fallback;
};

export default function RepairRequestsTab({ onConvertSuccess, onCountUpdate }) {
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
      if (onCountUpdate) onCountUpdate(data.filter(q => q.status === 'pending').length);
    } catch {
      showToast('error', 'Failed to load repair requests');
    } finally {
      setLoading(false);
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
      setQuotes(prev => prev.map(q => q.id === convertConfirm.id ? { ...q, status: 'converted' } : q));
      showToast('success', `Request ${convertConfirm.request_number} converted to Work Order. Find it in the Repair Jobs tab.`);
      setConvertConfirm(null);
      setSelectedQuote(null);
      if (onConvertSuccess) onConvertSuccess();
    } catch (error) {
      const detail = error.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map(d => d.msg).join(', ')
        : (detail || 'Failed to convert repair request');
      showToast('error', msg);
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
    } catch (err) {
      console.error('handleDeleteConfirm failed:', err);
      showToast('error', getErrorMessage(err, 'Failed to delete repair request'));
      setDeleteConfirmId(null);
      return;
    }
    showToast('success', 'Repair request deleted successfully');
    const deletedId = deleteConfirmId.id;
    setQuotes(prev => prev.filter(q => q.id !== deletedId));
    setDeleteConfirmId(null);
    if (selectedQuote?.id === deletedId) setSelectedQuote(null);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-900/30', text: 'text-yellow-300', border: 'border-yellow-700/60', dot: 'bg-yellow-400', label: 'Pending' },
      converted: { bg: 'bg-cyan-900/30', text: 'text-cyan-300', border: 'border-cyan-700/60', dot: 'bg-cyan-400', label: 'Converted to WO' },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${config.bg} ${config.text} border ${config.border}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
        {config.label}
      </span>
    );
  };

  const filteredQuotes = quotes.filter(quote => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      quote.company_name?.toLowerCase().includes(search) ||
      `${quote.first_name} ${quote.last_name}`.toLowerCase().includes(search) ||
      quote.email.toLowerCase().includes(search) ||
      quote.request_number.toLowerCase().includes(search)
    );
  });

  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter]);

  const totalResults = filteredQuotes.length;
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


  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">Online Repair Requests</h2>
          <p className="text-xs text-slate-500 mt-0.5">Customer-submitted requests awaiting conversion to Work Orders</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-base pointer-events-none">search</span>
          <input
            type="text"
            placeholder="Search company, contact, email, request #…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-base pointer-events-none">filter_list</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all appearance-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="converted">Converted to WO</option>
          </select>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/60 shadow-lg shadow-black/20 overflow-hidden">
        {/* Card Header */}
        <div className="px-5 py-3.5 border-b border-slate-700/60 bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-sm">inbox</span>
            </div>
            <span className="text-sm font-bold text-white">Repair Requests</span>
            {!loading && (
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/50">
                {totalResults}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
            <p className="mt-2 text-slate-400 text-sm">Loading repair requests…</p>
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 bg-slate-700/40 rounded-2xl flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl text-slate-500">request_quote</span>
            </div>
            <p className="text-white font-bold mb-1">
              {searchQuery || statusFilter ? 'No matching requests' : 'No repair requests yet'}
            </p>
            <p className="text-slate-500 text-sm text-center">
              {searchQuery || statusFilter ? 'Try adjusting your search or filter.' : 'Customer-submitted requests will appear here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-800/50 border-b border-slate-700/60">
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Request #</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Company / Contact</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Submitted</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Tools</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {paginatedQuotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-slate-700/30 transition-colors group">
                    <td className="py-3.5 px-4 font-mono text-xs text-white font-bold">{quote.request_number}</td>
                    <td className="py-3.5 px-4">
                      <div className="text-white font-bold text-sm">{quote.company_name || `${quote.first_name} ${quote.last_name}`}</div>
                      {quote.company_name && <div className="text-slate-400 text-xs mt-0.5">{quote.first_name} {quote.last_name}</div>}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-xs">{formatDate(quote.created_at)}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-slate-300 text-sm">
                        <span className="material-symbols-outlined text-slate-500 text-sm">build</span>
                        {quote.tools.length} tool{quote.tools.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(quote.status)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedQuote(quote)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          View
                        </button>
                        {quote.status !== 'converted' && (
                          <button
                            onClick={() => handleConvertClick(quote)}
                            disabled={convertingId === quote.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-900/30 hover:bg-orange-900/50 border border-orange-700/50 text-orange-300 hover:text-orange-200 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-sm">build_circle</span>
                            Convert
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteClick(quote)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-900/20 hover:bg-red-900/40 border border-red-800/30 hover:border-red-700/50 text-red-400 hover:text-red-300 rounded-lg text-xs font-bold transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
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
        {!loading && (
          <PaginationBar
            currentPage={currentPage}
            totalItems={totalResults}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}

          />
        )}
      </div>

      {/* Detail Modal */}
      {selectedQuote && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-slate-800 rounded-2xl max-w-5xl w-full my-8 border border-slate-700/50 shadow-2xl shadow-black/50 animate-fadeInScale overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="h-0.5 bg-gradient-to-r from-primary via-blue-400 to-primary/30" />
            {/* Header */}
            <div className="sticky top-0 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700/60 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-xl">request_quote</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Repair Request <span className="text-primary font-mono">{selectedQuote.request_number}</span></h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500">Submitted {formatDate(selectedQuote.created_at)}</span>
                    {getStatusBadge(selectedQuote.status)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedQuote.status !== 'converted' && (
                  <button
                    onClick={() => { setSelectedQuote(null); handleConvertClick(selectedQuote); }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-900/40 hover:bg-orange-900/60 border border-orange-700/50 text-orange-300 hover:text-orange-200 rounded-xl text-sm font-bold transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">build_circle</span>
                    Convert to WO
                  </button>
                )}
                <button
                  onClick={() => setSelectedQuote(null)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Customer */}
              <div className="bg-slate-900/60 rounded-xl border border-slate-700/60 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/60 bg-slate-800/40">
                  <span className="material-symbols-outlined text-slate-400" style={{fontSize:'14px'}}>person</span>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Customer</h4>
                </div>
                <div className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    {selectedQuote.company_name && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-slate-500" style={{fontSize:'13px'}}>business</span>
                          <span className="text-xs text-slate-500">Company:</span>
                          <span className="text-sm text-white font-bold">{selectedQuote.company_name}</span>
                        </div>
                        <span className="text-slate-700 text-xs select-none">|</span>
                      </>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-slate-500" style={{fontSize:'13px'}}>person</span>
                      <span className="text-xs text-slate-500">Contact:</span>
                      <span className="text-sm text-white">{selectedQuote.first_name} {selectedQuote.last_name}</span>
                    </div>
                    <span className="text-slate-700 text-xs select-none">|</span>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-slate-500" style={{fontSize:'13px'}}>mail</span>
                      <span className="text-xs text-slate-500">Email:</span>
                      <a href={`mailto:${selectedQuote.email}`} className="text-sm text-primary hover:underline">{selectedQuote.email}</a>
                    </div>
                    <span className="text-slate-700 text-xs select-none">|</span>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-slate-500" style={{fontSize:'13px'}}>phone</span>
                      <span className="text-xs text-slate-500">Phone:</span>
                      <a href={`tel:${selectedQuote.phone}`} className="text-sm text-primary hover:underline">{selectedQuote.phone}</a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tools */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-slate-400 text-base">build</span>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Tools ({selectedQuote.tools.length})</h4>
                </div>
                <div className="space-y-3">
                  {selectedQuote.tools.map((tool, idx) => (
                    <div key={idx} className="bg-slate-900/60 rounded-xl border border-slate-700/60 overflow-hidden shadow-sm">
                      {/* Tool header */}
                      <div className="p-4 bg-slate-800/40 border-b border-slate-700/60">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-700/60 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-black text-slate-400">
                              {idx + 1}
                            </div>
                            <div>
                              <div className="font-bold text-white text-sm">{tool.tool_brand} {tool.tool_model}</div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {tool.tool_type}{tool.quantity > 1 && ` × ${tool.quantity}`}
                              </div>
                            </div>
                          </div>
                          {tool.quantity === 1 ? null : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/60 border border-slate-600/50 text-slate-400 font-bold flex-shrink-0">×{tool.quantity}</span>
                          )}
                        </div>
                      </div>
                      {/* Problem description */}
                      <div className="px-4 py-3">
                        <p className="text-xs text-slate-500 uppercase tracking-wide font-bold mb-1">Problem Description</p>
                        <p className="text-sm text-slate-300 leading-relaxed">{tool.problem_description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Photos */}
              {selectedQuote.photos.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-slate-400 text-base">photo_library</span>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Photos ({selectedQuote.photos.length})</h4>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {selectedQuote.photos.map((photo, idx) => (
                      <div key={idx} className="aspect-square cursor-pointer group relative rounded-xl overflow-hidden border border-slate-700/60 hover:border-primary/50 transition-all" onClick={() => setSelectedPhoto(photo)}>
                        <img
                          src={photo.startsWith('http') ? photo : `${API_BASE_URL}/uploads/${photo}`}
                          alt={`Tool photo ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="material-symbols-outlined text-white text-2xl">zoom_in</span>
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
          <button className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800/80 text-white hover:text-slate-300 transition-colors" onClick={() => setSelectedPhoto(null)}>
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
          <img
            src={selectedPhoto.startsWith('http') ? selectedPhoto : `${API_BASE_URL}/uploads/${selectedPhoto}`}
            alt="Full size tool photo"
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Convert Confirmation Modal */}
      {convertConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700/50 max-w-md w-full shadow-2xl shadow-black/40 animate-[fadeInScale_0.2s_ease-out] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="h-0.5 bg-gradient-to-r from-orange-500 via-orange-400 to-orange-500/30" />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-orange-900/40 border border-orange-700/40 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-orange-400 text-xl">build_circle</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">Convert to Work Order</h3>
                  <p className="text-xs text-slate-500 mt-0.5">This will create a tracked repair job</p>
                </div>
                <button
                  onClick={() => setConvertConfirm(null)}
                  className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
              <div className="space-y-3 mb-5">
                <p className="text-slate-300 text-sm">
                  Convert <span className="font-mono font-bold text-white">{convertConfirm.request_number}</span> into a tracked Work Order?
                </p>
                <div className="bg-slate-900/60 rounded-xl border border-slate-700/60 p-3 text-xs space-y-1.5">
                  <div className="flex gap-2"><span className="text-slate-500 w-16">Customer</span><span className="text-slate-300 font-medium">{convertConfirm.company_name || `${convertConfirm.first_name} ${convertConfirm.last_name}`}</span></div>
                  <div className="flex gap-2"><span className="text-slate-500 w-16">Tools</span><span className="text-slate-300">{convertConfirm.tools.length} tool{convertConfirm.tools.length !== 1 ? 's' : ''}</span></div>
                </div>
                <p className="text-slate-500 text-xs">Customer info and tool details will be copied. Add serial numbers and notes in the Repair Jobs tab.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConvertConfirm(null)} className="flex-1 px-4 py-2.5 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 text-white rounded-xl font-bold text-sm transition-all">
                  Cancel
                </button>
                <button
                  onClick={handleConvertConfirm}
                  disabled={!!convertingId}
                  className="flex-1 px-4 py-2.5 bg-orange-900/50 hover:bg-orange-900/70 border border-orange-700/50 text-orange-200 rounded-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">build_circle</span>
                  {convertingId ? 'Converting…' : 'Convert to WO'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700/50 max-w-md w-full shadow-2xl shadow-black/40 animate-[fadeInScale_0.2s_ease-out] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="h-0.5 bg-gradient-to-r from-red-500 via-red-400 to-red-500/30" />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-red-900/40 border border-red-700/40 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-red-400 text-xl">delete_forever</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">Delete Request</h3>
                  <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone</p>
                </div>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
              <div className="space-y-3 mb-5">
                <p className="text-slate-300 text-sm">
                  Permanently delete <span className="font-mono font-bold text-white">{deleteConfirmId.request_number}</span>?
                </p>
                <div className="bg-slate-900/60 rounded-xl border border-slate-700/60 p-3 text-xs space-y-1.5">
                  <div className="flex gap-2"><span className="text-slate-500 w-16">Customer</span><span className="text-slate-300 font-medium">{deleteConfirmId.company_name || `${deleteConfirmId.first_name} ${deleteConfirmId.last_name}`}</span></div>
                  <div className="flex gap-2"><span className="text-slate-500 w-16">Tools</span><span className="text-slate-300">{deleteConfirmId.tools.length}</span></div>
                  <div className="flex gap-2"><span className="text-slate-500 w-16">Photos</span><span className="text-slate-300">{deleteConfirmId.photos.length}</span></div>
                </div>
                <p className="text-red-400/80 text-xs font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  All associated photos will be permanently deleted from storage.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-4 py-2.5 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 text-white rounded-xl font-bold text-sm transition-all">
                  Cancel
                </button>
                <button onClick={handleDeleteConfirm} className="flex-1 px-4 py-2.5 bg-red-900/60 hover:bg-red-800/80 border border-red-700/50 text-red-200 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-sm">delete_forever</span>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
