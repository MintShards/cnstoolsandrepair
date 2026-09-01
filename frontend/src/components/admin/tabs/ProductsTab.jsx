import { useState, useEffect, useMemo, useRef } from 'react';
import { productsAPI, productQuotesAPI } from '../../../services/api';
import { formatDatePacific } from '../../../utils/dateFormat';
import AdminInput from '../AdminInput';
import AdminTextarea from '../AdminTextarea';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// Must match ProductCategory in backend/app/models/product.py
const CATEGORIES = [
  { value: 'air_tools', label: 'Air Tools' },
  { value: 'hydraulic', label: 'Hydraulic' },
  { value: 'lifting', label: 'Lifting' },
];

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

const EMPTY_PRODUCT = {
  name: '',
  category: 'air_tools',
  brand: '',
  model: '',
  product_group: '',
  spec_line: '',
  description: '',
  sku: '',
  featured: false,
  active: true,
  display_order: 999,
};

const QUOTE_STATUSES = ['new', 'quoted', 'won', 'closed'];

const STATUS_STYLES = {
  new: 'bg-blue-900/30 text-blue-300 border-blue-700',
  quoted: 'bg-amber-900/30 text-amber-300 border-amber-700',
  won: 'bg-green-900/30 text-green-300 border-green-700',
  closed: 'bg-slate-700 text-slate-400 border-slate-600',
};

// save_upload_file() returns a full Spaces URL in production, a bare filename in dev
function imageSrc(url) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE_URL}/uploads/${url}`;
}

export default function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // null = form closed. Otherwise the product being edited (no id = new).
  const [editing, setEditing] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const fileInputRef = useRef(null);

  const [expandedQuote, setExpandedQuote] = useState(null);

  useEffect(() => {
    fetchProducts();
    fetchQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showNotification = (text, type = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      // false = include hidden products so admins can re-activate them
      const data = await productsAPI.list(false);
      setProducts(data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      showNotification('Failed to load products: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotes = async () => {
    try {
      const data = await productQuotesAPI.list({ limit: 25 });
      setQuotes(data);
    } catch (error) {
      // Non-fatal — the products list is the main job of this tab
      console.error('Failed to fetch quote requests:', error);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (!term) return true;
      return [p.name, p.brand, p.model, p.sku, p.product_group]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(term));
    });
  }, [products, search, categoryFilter]);

  const openNew = () => {
    setEditing({ ...EMPTY_PRODUCT });
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openEdit = (product) => {
    setEditing({ ...product });
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeForm = () => {
    setEditing(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateField = (field, value) => {
    setEditing((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImageFile(null);
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      showNotification('Invalid file type. Only JPG, PNG, and WebP are allowed.', 'error');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showNotification('File too large. Maximum size is 5MB.', 'error');
      e.target.value = '';
      return;
    }

    setImageFile(file);
  };

  const handleSave = async () => {
    if (!editing.name?.trim()) {
      showNotification('Product name is required', 'error');
      return;
    }

    setSaving(true);

    try {
      const formData = new FormData();
      formData.append('name', editing.name.trim());
      formData.append('category', editing.category);
      formData.append('brand', editing.brand || '');
      formData.append('model', editing.model || '');
      formData.append('product_group', editing.product_group || '');
      formData.append('spec_line', editing.spec_line || '');
      formData.append('description', editing.description || '');
      formData.append('sku', editing.sku || '');
      formData.append('featured', editing.featured ? 'true' : 'false');
      formData.append('active', editing.active ? 'true' : 'false');
      formData.append('display_order', String(Number(editing.display_order) || 999));
      if (imageFile) formData.append('image', imageFile);

      if (editing.id) {
        await productsAPI.update(editing.id, formData);
        showNotification('Product updated');
      } else {
        await productsAPI.create(formData);
        showNotification('Product added');
      }

      closeForm();
      await fetchProducts();
    } catch (error) {
      console.error('Failed to save product:', error);
      showNotification('Failed to save: ' + (error.response?.data?.detail || error.message), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Soft delete — the product stays in the database, just hidden from the site
  const handleDelete = async (product) => {
    if (!confirm(`Hide "${product.name}" from the Tools for Sale page?`)) return;

    try {
      await productsAPI.delete(product.id);
      showNotification('Product hidden from the website');
      await fetchProducts();
    } catch (error) {
      console.error('Failed to delete product:', error);
      showNotification('Failed to hide product: ' + error.message, 'error');
    }
  };

  // Quick toggles straight from the table (no need to open the form)
  const toggleFlag = async (product, field) => {
    try {
      const formData = new FormData();
      formData.append(field, product[field] ? 'false' : 'true');
      await productsAPI.update(product.id, formData);
      await fetchProducts();
    } catch (error) {
      console.error(`Failed to toggle ${field}:`, error);
      showNotification('Update failed: ' + error.message, 'error');
    }
  };

  const updateQuoteStatus = async (quoteId, status) => {
    try {
      await productQuotesAPI.updateStatus(quoteId, status);
      setQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, status } : q)));
    } catch (error) {
      console.error('Failed to update quote status:', error);
      showNotification('Failed to update request: ' + error.message, 'error');
    }
  };

  const newQuoteCount = quotes.filter((q) => q.status === 'new').length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            Tools for Sale
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Products shown on the public <span className="font-mono text-slate-300">/products</span> page.
            No prices are displayed — customers request a quote.
          </p>
        </div>
        <button
          onClick={openNew}
          className="bg-primary text-white font-black px-6 py-3 rounded-lg shadow-lg hover:bg-blue-600 transition-all uppercase text-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined">add</span>
          Add Product
        </button>
      </div>

      {notification && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            notification.type === 'success'
              ? 'bg-green-900/20 border-green-700 text-green-300'
              : 'bg-red-900/20 border-red-700 text-red-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined">
              {notification.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <p>{notification.text}</p>
          </div>
        </div>
      )}

      {/* Add / Edit form */}
      {editing && (
        <div className="mb-8 p-6 bg-slate-800 rounded-lg border border-primary/50">
          <h3 className="text-lg font-bold text-white mb-4">
            {editing.id ? 'Edit Product' : 'New Product'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <AdminInput
              label="Product Name"
              value={editing.name}
              onChange={(v) => updateField('name', v)}
              placeholder='JET 1" Impact Wrench'
              maxLength={250}
              required
            />
            <div className="mb-4">
              <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">
                Category<span className="text-red-400 ml-1">*</span>
              </label>
              <select
                value={editing.category}
                onChange={(e) => updateField('category', e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary transition-colors"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <AdminInput
              label="Brand"
              value={editing.brand}
              onChange={(v) => updateField('brand', v)}
              placeholder="JET"
              maxLength={60}
            />
            <AdminInput
              label="Model"
              value={editing.model}
              onChange={(v) => updateField('model', v)}
              placeholder="IW1SHD6"
              maxLength={60}
            />

            <AdminInput
              label="Product Group"
              value={editing.product_group}
              onChange={(v) => updateField('product_group', v)}
              placeholder="Impact Wrenches"
              maxLength={80}
              helperText="Sub-heading used to group the catalogue"
            />
            <AdminInput
              label="Item Number"
              value={editing.sku}
              onChange={(v) => updateField('sku', v)}
              placeholder="400360"
              maxLength={40}
              helperText='Supplier SKU. Shown on the card as "Item #" so customers can quote it'
            />
          </div>

          <AdminInput
            label="Spec Line"
            value={editing.spec_line}
            onChange={(v) => updateField('spec_line', v)}
            placeholder='1" drive · 1,600 ft-lb · 6" extended anvil'
            maxLength={160}
            helperText="Short spec summary shown under the product name"
          />

          <AdminTextarea
            label="Description"
            value={editing.description}
            onChange={(v) => updateField('description', v)}
            placeholder="One or two lines on what the tool is for."
            rows={3}
            maxLength={600}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <div className="mb-4">
              <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">
                Photo
              </label>
              <div className="flex items-center gap-4">
                {(imageFile || editing.image_url) && (
                  <img
                    src={imageFile ? URL.createObjectURL(imageFile) : imageSrc(editing.image_url)}
                    alt="Preview"
                    className="w-20 h-20 object-contain rounded-lg border border-slate-600 bg-white p-1 shrink-0"
                  />
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-slate-300
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-bold
                    file:bg-primary file:text-white
                    file:cursor-pointer file:transition-all
                    hover:file:bg-blue-600"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                JPG, PNG or WebP • Max 5MB • Uploading a new photo replaces the old one
              </p>
            </div>

            <AdminInput
              label="Display Order"
              value={String(editing.display_order ?? 999)}
              onChange={(v) => updateField('display_order', v.replace(/\D/g, ''))}
              placeholder="999"
              maxLength={4}
              helperText="Lower numbers appear first (default 999)"
            />
          </div>

          <div className="flex flex-wrap gap-6 mb-6">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={!!editing.featured}
                onChange={(e) => updateField('featured', e.target.checked)}
                className="size-4 accent-primary"
              />
              Featured (shows a &ldquo;Popular&rdquo; badge and sorts first)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={!!editing.active}
                onChange={(e) => updateField('active', e.target.checked)}
                className="size-4 accent-primary"
              />
              Visible on the website
            </label>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-white font-black px-6 py-3 rounded-lg shadow-lg hover:bg-blue-600 transition-all uppercase text-sm disabled:bg-slate-600 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : editing.id ? 'Save Changes' : 'Add Product'}
            </button>
            <button
              onClick={closeForm}
              disabled={saving}
              className="bg-slate-700 text-slate-200 font-bold px-6 py-3 rounded-lg hover:bg-slate-600 transition-all uppercase text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${
              categoryFilter === 'all'
                ? 'bg-primary text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            All ({products.length})
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategoryFilter(c.value)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${
                categoryFilter === c.value
                  ? 'bg-primary text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {c.label} ({products.filter((p) => p.category === c.value).length})
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, brand, model or SKU..."
          className="flex-1 min-w-[220px] px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-colors text-sm"
        />
      </div>

      {/* Product list */}
      <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">
          Products ({filtered.length}
          {filtered.length !== products.length ? ` of ${products.length}` : ''})
        </h3>

        {loading ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
            <p className="mt-2 text-slate-400">Loading products...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-slate-600">inventory_2</span>
            <p className="mt-2 text-slate-400">
              {products.length === 0 ? 'No products yet — add your first one above' : 'No products match this filter'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3 px-3">Photo</th>
                  <th className="py-3 px-3">Product</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">SKU</th>
                  <th className="py-3 px-3 text-center">Featured</th>
                  <th className="py-3 px-3 text-center">Visible</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filtered.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-700/50 transition-colors">
                    <td className="py-3 px-3">
                      {product.image_url ? (
                        <img
                          src={imageSrc(product.image_url)}
                          alt=""
                          className="w-14 h-14 object-contain rounded-lg border border-slate-600 bg-white p-1"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg border border-slate-600 bg-slate-900 flex items-center justify-center">
                          <span className="material-symbols-outlined text-slate-600">no_photography</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <p className="text-white font-semibold">{product.name}</p>
                      <p className="text-xs text-slate-400">
                        {[product.brand, product.model, product.product_group].filter(Boolean).join(' · ')}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {CATEGORY_LABELS[product.category] || product.category}
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-mono text-xs">{product.sku || '—'}</td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => toggleFlag(product, 'featured')}
                        title={product.featured ? 'Remove featured badge' : 'Mark as featured'}
                        className={`material-symbols-outlined transition-colors ${
                          product.featured ? 'text-accent-orange' : 'text-slate-600 hover:text-slate-400'
                        }`}
                      >
                        {product.featured ? 'star' : 'star_outline'}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => toggleFlag(product, 'active')}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border transition-colors ${
                          product.active
                            ? 'bg-green-900/30 text-green-400 border-green-700'
                            : 'bg-slate-700 text-slate-400 border-slate-600'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {product.active ? 'visibility' : 'visibility_off'}
                        </span>
                        {product.active ? 'Live' : 'Hidden'}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEdit(product)}
                        className="inline-flex items-center gap-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-all mr-2"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                        Edit
                      </button>
                      {product.active && (
                        <button
                          onClick={() => handleDelete(product)}
                          className="inline-flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">visibility_off</span>
                          Hide
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Incoming quote requests */}
      <div className="mt-8 p-6 bg-slate-800 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-3">
          Quote Requests
          {newQuoteCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-primary text-white text-xs font-black">
              {newQuoteCount} new
            </span>
          )}
        </h3>
        <p className="text-sm text-slate-400 mb-4">
          Requests submitted from the Tools for Sale page. Notifications also go to{' '}
          <span className="font-mono text-slate-300">sales@cnstoolrepair.com</span>.
        </p>

        {quotes.length === 0 ? (
          <p className="text-slate-400 text-sm py-4">No quote requests yet.</p>
        ) : (
          <div className="divide-y divide-slate-700">
            {quotes.map((quote) => (
              <div key={quote.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() => setExpandedQuote(expandedQuote === quote.id ? null : quote.id)}
                    className="flex items-center gap-3 text-left"
                  >
                    <span className="material-symbols-outlined text-slate-400">
                      {expandedQuote === quote.id ? 'expand_less' : 'expand_more'}
                    </span>
                    <span>
                      <span className="text-white font-semibold font-mono text-sm">{quote.quote_number}</span>
                      <span className="text-slate-300 text-sm ml-3">
                        {quote.company_name || `${quote.first_name} ${quote.last_name}`}
                      </span>
                      <span className="text-slate-500 text-xs ml-3">
                        {quote.items.length} item{quote.items.length === 1 ? '' : 's'} ·{' '}
                        {formatDatePacific(quote.created_at)}
                      </span>
                    </span>
                  </button>
                  <select
                    value={quote.status}
                    onChange={(e) => updateQuoteStatus(quote.id, e.target.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase border ${
                      STATUS_STYLES[quote.status] || STATUS_STYLES.closed
                    }`}
                  >
                    {QUOTE_STATUSES.map((s) => (
                      <option key={s} value={s} className="bg-slate-800 text-white">
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {expandedQuote === quote.id && (
                  <div className="mt-3 ml-9 text-sm space-y-2">
                    <p className="text-slate-300">
                      {quote.first_name} {quote.last_name} ·{' '}
                      <a href={`mailto:${quote.email}`} className="text-primary hover:underline">
                        {quote.email}
                      </a>{' '}
                      ·{' '}
                      <a href={`tel:${quote.phone}`} className="text-primary hover:underline">
                        {quote.phone}
                      </a>
                    </p>
                    <ul className="text-slate-400 space-y-1">
                      {quote.items.map((item, idx) => (
                        <li key={idx}>
                          • {item.quantity}× {item.name}
                          {item.sku && <span className="font-mono text-xs text-slate-500"> (SKU {item.sku})</span>}
                        </li>
                      ))}
                    </ul>
                    {quote.notes && (
                      <p className="text-slate-400 italic border-l-2 border-slate-600 pl-3">{quote.notes}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
