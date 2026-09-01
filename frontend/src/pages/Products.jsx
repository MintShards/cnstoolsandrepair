import { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { productsAPI, productQuotesAPI, productsContentAPI } from '../services/api';
import DualCTA from '../components/sections/DualCTA';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Spaces URLs come through absolute; local dev filenames are served from /uploads
const resolveImageUrl = (url) =>
  !url ? null : url.startsWith('http') ? url : `${API_BASE_URL}/uploads/${url}`;

// Icons stay in code — the wording is editable in Admin Settings, the glyph isn't.
const CATEGORY_ICONS = {
  all: 'apps',
  air_tools: 'air',
  hydraulic: 'water_drop',
  lifting: 'forklift',
};

// Mirrors DEFAULT_PRODUCTS_CONTENT in backend/app/routers/products_content.py.
// Used until the fetch lands, and if it fails, so the page never renders blank.
const FALLBACK_CONTENT = {
  hero: {
    label: 'Tools & Equipment',
    heading: 'Tools for Sale',
    shortHeading: 'Products',
    description:
      'We supply the same JET air tools, Strongarm jacks and lifting equipment we service every ' +
      'day — so the shop that sells you the tool is the shop that can repair it. Tell us what you ' +
      'need and we’ll send pricing, including volume rates for fleets.',
    availabilityNote: 'Available to order — typically 2–5 business days',
  },
  categories: [
    { key: 'air_tools', label: 'Air Tools', heading: 'Air Tools' },
    { key: 'hydraulic', label: 'Hydraulic', heading: 'Hydraulic' },
    { key: 'lifting', label: 'Lifting', heading: 'Lifting & Material Handling' },
  ],
  allLabel: 'All Tools',
  sectionNote: 'in stock or available to order',
  quotePanel: {
    title: 'Request a Quote',
    footnote: 'We reply with pricing and lead time — usually the same business day.',
    successHeading: 'Request Sent',
    successNote: 'We’ll get back to you with pricing and lead time, usually the same business day.',
  },
  footerCta: {
    text: 'Don’t see what you need? We can order most JET, Strongarm and Hathorn products —',
    phoneLabel: 'call 778-488-0777',
    phoneNumber: '7784880777',
    messageLabel: 'send us a message',
  },
  seo: {
    title: 'Tools & Equipment for Sale | CNS Tool Repair Surrey BC',
    description:
      'Buy JET air tools, Strongarm jacks, hoists and shop equipment in Surrey, BC. Authorized ' +
      'dealer and warranty repair centre serving the Lower Mainland. Request a quote.',
    keywords:
      'buy JET tools Surrey BC, Strongarm jacks BC, air tools for sale Surrey, shop equipment ' +
      'Lower Mainland, industrial tool supplier Surrey',
  },
};

// Mirrors the repair-request form so both forms behave identically.
const formatPhoneNumber = (value) => {
  if (!value) return value;
  const stripped = value.replace(/[^\d]/g, '');
  const phoneNumber =
    stripped.length === 11 && stripped.startsWith('1') ? stripped.slice(1) : stripped;
  if (phoneNumber.length < 4) return phoneNumber;
  if (phoneNumber.length < 7) return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
  return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

const EMPTY_FORM = {
  company_name: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  notes: '',
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [content, setContent] = useState(FALLBACK_CONTENT);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');

  // Quote basket: [{ product, quantity }] keyed by product id
  const [basket, setBasket] = useState({});
  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await productsAPI.list();
        setProducts(data);
      } catch (err) {
        console.error('Failed to fetch products:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Page copy is editable in Admin Settings; the fallback keeps the page
  // readable if the request fails.
  useEffect(() => {
    const fetchContent = async () => {
      try {
        const data = await productsContentAPI.get();
        setContent({ ...FALLBACK_CONTENT, ...data });
      } catch (err) {
        console.error('Failed to fetch products page content:', err);
      }
    };
    fetchContent();
  }, []);

  const hero = content.hero || FALLBACK_CONTENT.hero;
  const quoteCopy = content.quotePanel || FALLBACK_CONTENT.quotePanel;
  const footerCta = content.footerCta || FALLBACK_CONTENT.footerCta;
  const seo = content.seo || FALLBACK_CONTENT.seo;

  const categoryLabels = useMemo(() => {
    const map = {};
    (content.categories || []).forEach((c) => {
      map[c.key] = c.heading || c.label;
    });
    return map;
  }, [content.categories]);

  const filterPills = useMemo(
    () => [
      { key: 'all', label: content.allLabel || FALLBACK_CONTENT.allLabel },
      ...(content.categories || []).map((c) => ({ key: c.key, label: c.label })),
    ],
    [content.categories, content.allLabel]
  );

  const basketItems = useMemo(() => Object.values(basket), [basket]);
  const basketCount = basketItems.reduce((sum, entry) => sum + entry.quantity, 0);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCategory !== 'all' && p.category !== activeCategory) return false;
      if (!term) return true;
      return [p.name, p.brand, p.model, p.product_group, p.spec_line]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(term));
    });
  }, [products, activeCategory, search]);

  // One section per category. Inside a section the curated display_order keeps
  // tools of the same product group (impact wrenches, bottle jacks) together.
  const groupedProducts = useMemo(() => {
    const sections = new Map();
    for (const product of visibleProducts) {
      const key = product.category;
      if (!sections.has(key)) {
        sections.set(key, {
          key,
          label: categoryLabels[key] || key,
          items: [],
        });
      }
      sections.get(key).items.push(product);
    }
    for (const section of sections.values()) {
      section.items.sort((a, b) => (a.display_order || 999) - (b.display_order || 999));
    }
    // Keep the configured pill order whatever order the API returns
    const order = filterPills.map((c) => c.key);
    return [...sections.values()].sort(
      (a, b) => order.indexOf(a.key) - order.indexOf(b.key)
    );
  }, [visibleProducts, categoryLabels, filterPills]);

  const addToBasket = useCallback((product) => {
    setBasket((prev) => {
      const existing = prev[product.id];
      return {
        ...prev,
        [product.id]: { product, quantity: existing ? existing.quantity + 1 : 1 },
      };
    });
  }, []);

  const setQuantity = useCallback((productId, quantity) => {
    setBasket((prev) => {
      if (quantity < 1) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: { ...prev[productId], quantity } };
    });
  }, []);

  // Escape-close and scroll lock while the quote panel is open
  useEffect(() => {
    if (!panelOpen) return;
    const onKeyDown = (e) => e.key === 'Escape' && setPanelOpen(false);
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [panelOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (basketItems.length === 0) {
      setError('Add at least one tool to your quote request.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        company_name: form.company_name || null,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone,
        notes: form.notes || null,
        items: basketItems.map(({ product, quantity }) => ({
          product_id: product.id,
          name: product.name,
          brand: product.brand || '',
          model: product.model || '',
          sku: product.sku || '',
          quantity,
        })),
      };
      const result = await productQuotesAPI.create(payload);
      setSubmitted(result.quote_number);
      setBasket({});
      setForm(EMPTY_FORM);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === 'string'
          ? detail
          : 'Something went wrong sending your request. Please call us at 778-488-0777.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
        <meta name="keywords" content={seo.keywords} />
        <link rel="canonical" href="https://cnstoolrepair.com/products" />

        <meta property="og:title" content={seo.title} />
        <meta property="og:description" content={seo.description} />
        <meta property="og:url" content="https://cnstoolrepair.com/products" />
        <meta property="og:type" content="website" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seo.title} />
        <meta name="twitter:description" content={seo.description} />
      </Helmet>

      <main className="relative min-h-screen px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-950">
        <div className="max-w-screen-xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-10 lg:mb-14">
            <h2 className="text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">
              {hero.label}
            </h2>
            {/* The full heading wraps to two lines on a narrow phone, so the
                shorter wording takes over there — the eyebrow above carries
                the fuller phrase either way */}
            <h1 className="text-4xl lg:text-5xl font-black tracking-tight uppercase">
              <span className="sm:hidden">{hero.shortHeading || hero.heading}</span>
              <span className="hidden sm:inline">{hero.heading}</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-3xl mx-auto text-base lg:text-lg">
              {hero.description}
            </p>
            {hero.availabilityNote && (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'wght' 600" }}>
                  local_shipping
                </span>
                {hero.availabilityNote}
              </p>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-4 mb-10 lg:mb-12">
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              {filterPills.map((cat) => {
                const isActive = activeCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setActiveCategory(cat.key)}
                    aria-pressed={isActive}
                    className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-black uppercase tracking-tight transition-all ${
                      isActive
                        ? 'bg-primary text-white shadow-md'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-base"
                      style={{ fontVariationSettings: "'wght' 600" }}
                    >
                      {CATEGORY_ICONS[cat.key] || 'category'}
                    </span>
                    {cat.label}
                  </button>
                );
              })}
            </div>

            <div className="relative max-w-md w-full mx-auto">
              <span
                className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl"
                style={{ fontVariationSettings: "'wght' 600" }}
              >
                search
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by tool, brand or model"
                aria-label="Search tools for sale"
                className="w-full rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 pl-12 pr-4 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square rounded-2xl bg-slate-200 dark:bg-slate-800" />
                  <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded mt-4" />
                  <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded mt-2" />
                  <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-800 rounded mt-2" />
                </div>
              ))}
            </div>
          ) : groupedProducts.length > 0 ? (
            <div className="space-y-14">
              {groupedProducts.map(({ key, label, items }) => (
                <section key={key}>
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-slate-200 dark:border-slate-800 pb-3 mb-6">
                    <h2 className="text-lg lg:text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                      {label}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {items.length} {items.length === 1 ? 'tool' : 'tools'}{' '}
                      {content.sectionNote ?? FALLBACK_CONTENT.sectionNote}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {items.map((product) => {
                      const inBasket = basket[product.id]?.quantity || 0;
                      const imageUrl = resolveImageUrl(product.image_url);
                      return (
                        <article
                          key={product.id}
                          className="group flex flex-col rounded-2xl border-2 border-transparent hover:border-primary/30 p-3 transition-all"
                        >
                          <div className="relative aspect-square rounded-xl bg-slate-50 dark:bg-slate-900 overflow-hidden">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={product.name}
                                className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-[1.04]"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-700">
                                <span className="material-symbols-outlined text-5xl">handyman</span>
                              </div>
                            )}
                            {product.featured && (
                              <span className="absolute top-3 left-3 rounded-full bg-accent-orange px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                                Popular
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col flex-1 pt-4">
                            <p className="text-accent-orange text-[11px] font-black uppercase tracking-[0.15em]">
                              {/* Strongarm catalogues some tools by item number only — those
                                  carry no model, and the Item # below identifies them */}
                              {[product.brand, product.model].filter(Boolean).join(' ') ||
                                categoryLabels[product.category]}
                            </p>
                            <h3 className="mt-1 text-sm font-black leading-snug text-slate-900 dark:text-white">
                              {product.name}
                            </h3>
                            {product.spec_line && (
                              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                {product.spec_line}
                              </p>
                            )}
                            {product.description && (
                              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                {product.description}
                              </p>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {product.product_group && (
                                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  {product.product_group}
                                </span>
                              )}
                              {product.sku && (
                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                  Item #{product.sku}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => addToBasket(product)}
                              className={`mt-auto pt-4 w-full text-xs font-black uppercase tracking-tight ${
                                inBasket ? 'text-green-700 dark:text-green-400' : ''
                              }`}
                            >
                              <span
                                className={`block rounded-xl px-4 py-3 transition-all ${
                                  inBasket
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-primary text-white hover:bg-primary/90'
                                }`}
                              >
                                {inBasket ? `Added (${inBasket}) — Add another` : 'Add to Quote'}
                              </span>
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <span className="material-symbols-outlined text-6xl text-slate-400">search_off</span>
              <p className="mt-4 text-slate-500">
                {products.length === 0
                  ? 'Our catalogue is being updated. Call 778-488-0777 and we’ll source what you need.'
                  : 'No tools match that search. Try a different term or category.'}
              </p>
            </div>
          )}

          {/* Anything not listed */}
          <div className="mt-16 text-center">
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              {footerCta.text}{' '}
              <a
                href={`tel:${footerCta.phoneNumber}`}
                className="text-primary font-bold hover:underline"
              >
                {footerCta.phoneLabel}
              </a>{' '}
              or{' '}
              <a href="/contact" className="text-primary font-bold hover:underline">
                {footerCta.messageLabel}
              </a>
              .
            </p>
          </div>
        </div>
      </main>

      <DualCTA backgroundColor="bg-slate-100 dark:bg-slate-900" />

      {/* Floating basket button */}
      {basketCount > 0 && !panelOpen && (
        <button
          type="button"
          onClick={() => {
            setSubmitted(null);
            setPanelOpen(true);
          }}
          /* bottom-28 clears the mobile BottomNav (96px tall) with room to spare */
          className="fixed bottom-28 right-5 lg:bottom-8 lg:right-8 z-40 inline-flex items-center gap-3 rounded-full bg-primary px-6 py-4 text-sm font-black uppercase tracking-tight text-white shadow-2xl hover:bg-primary/90 transition-all"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'wght' 600" }}>
            request_quote
          </span>
          Request Quote
          <span className="inline-flex items-center justify-center rounded-full bg-white text-primary size-6 text-xs font-black">
            {basketCount}
          </span>
        </button>
      )}

      {/* Quote panel */}
      {panelOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Request a quote"
          onClick={() => setPanelOpen(false)}
        >
          <div
            className="w-full max-w-lg h-full overflow-y-auto bg-white dark:bg-slate-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-6 py-5">
              <h2 className="text-xl font-black uppercase tracking-tight">{quoteCopy.title}</h2>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>

            {/* pb-32 keeps the submit button clear of the mobile BottomNav,
                which sits at the same z-index and would otherwise cover it
                once the basket is long enough to scroll */}
            <div className="px-6 pt-6 pb-32 lg:pb-6">
              {submitted ? (
                <div className="text-center py-10">
                  <span className="material-symbols-outlined text-6xl text-green-600">check_circle</span>
                  <h3 className="mt-4 text-2xl font-black uppercase tracking-tight">
                    {quoteCopy.successHeading}
                  </h3>
                  <p className="mt-2 text-slate-500 dark:text-slate-400">
                    Your reference is <span className="font-black text-slate-800 dark:text-slate-200">{submitted}</span>.{' '}
                    {quoteCopy.successNote}
                  </p>
                  <button
                    type="button"
                    onClick={() => setPanelOpen(false)}
                    className="mt-8 rounded-xl bg-primary px-8 py-4 text-sm font-black uppercase tracking-tight text-white hover:bg-primary/90"
                  >
                    Keep Browsing
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Items */}
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-accent-orange mb-3">
                      Your Tools ({basketItems.length})
                    </h3>
                    {basketItems.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Your list is empty — add a tool to get started.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {basketItems.map(({ product, quantity }) => (
                          <li
                            key={product.id}
                            className="flex items-center gap-3 border-l-2 border-slate-200 dark:border-slate-700 pl-3 py-1"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate text-slate-800 dark:text-slate-100">
                                {product.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {[
                                  [product.brand, product.model].filter(Boolean).join(' '),
                                  product.sku && `Item #${product.sku}`,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                aria-label={`Decrease quantity of ${product.name}`}
                                onClick={() => setQuantity(product.id, quantity - 1)}
                                className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                              >
                                −
                              </button>
                              <span className="w-8 text-center text-sm font-black">{quantity}</span>
                              <button
                                type="button"
                                aria-label={`Increase quantity of ${product.name}`}
                                onClick={() => setQuantity(product.id, quantity + 1)}
                                className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                              >
                                +
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Contact */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-accent-orange">
                      Your Details
                    </h3>

                    <input
                      type="text"
                      value={form.company_name}
                      onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                      placeholder="Company (optional)"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        value={form.first_name}
                        onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                        placeholder="First name *"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <input
                        type="text"
                        required
                        value={form.last_name}
                        onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                        placeholder="Last name *"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="Email *"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />

                    <input
                      type="tel"
                      required
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: formatPhoneNumber(e.target.value) })}
                      placeholder="Phone * (604-555-0123)"
                      maxLength={12}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />

                    <textarea
                      rows={3}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Anything else we should know? (delivery timing, volume, accessories…)"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {error && (
                    <p className="rounded-xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || basketItems.length === 0}
                    className="w-full rounded-xl bg-primary px-8 py-4 text-sm font-black uppercase tracking-tight text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Sending…' : 'Send Quote Request'}
                  </button>

                  <p className="text-center text-xs text-slate-400">
                    {quoteCopy.footnote}
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
