import AdminInput from '../AdminInput';
import AdminTextarea from '../AdminTextarea';
import AdminToggle from '../AdminToggle';
import AdminSelect from '../AdminSelect';

export default function GlobalTab({ formData, updateField, addBrand, removeBrand, updateBrand, handleBrandLogoUpload }) {
  return (
    <div>
      <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-6">
        Global Settings
      </h2>

      <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
        <div className="flex gap-3">
          <span className="material-symbols-outlined text-blue-400">info</span>
          <div className="flex-1 text-sm text-blue-300">
            <p className="font-bold mb-1">Global Settings</p>
            <p className="text-blue-400">
              These settings appear across multiple pages (header, footer, contact sections).
            </p>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <h3 className="text-xl font-black text-white uppercase tracking-tight mb-4">
        Contact Information
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AdminInput
          label="Phone Number"
          value={formData.contact.phone}
          onChange={(v) => updateField('contact.phone', v)}
          required
          maxLength={20}
          helperText="Display format: (604) 555-0123"
        />
        <AdminInput
          label="Phone Link"
          value={formData.contact.phoneLink}
          onChange={(v) => updateField('contact.phoneLink', v)}
          required
          maxLength={20}
          helperText="Digits only: 6045550123"
        />
        <div className="md:col-span-2">
          <AdminInput
            label="Email Address"
            value={formData.contact.email}
            onChange={(v) => updateField('contact.email', v)}
            type="email"
            required
            helperText="Business email address"
          />
        </div>
      </div>

      {/* Address */}
      <h3 className="text-xl font-black text-white uppercase tracking-tight mt-8 mb-4">
        Address
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <AdminInput
            label="Street Address"
            value={formData.contact.address.street}
            onChange={(v) => updateField('contact.address.street', v)}
            required
            maxLength={200}
          />
        </div>
        <AdminInput
          label="City"
          value={formData.contact.address.city}
          onChange={(v) => updateField('contact.address.city', v)}
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <AdminInput
            label="Province"
            value={formData.contact.address.province}
            onChange={(v) => updateField('contact.address.province', v)}
            required
            maxLength={50}
          />
          <AdminInput
            label="Postal Code"
            value={formData.contact.address.postalCode}
            onChange={(v) => updateField('contact.address.postalCode', v)}
            maxLength={20}
          />
        </div>
      </div>

      {/* Business Hours */}
      <h3 className="text-xl font-black text-white uppercase tracking-tight mt-8 mb-4">
        Business Hours
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AdminInput
          label="Weekdays"
          value={formData.hours.weekdays}
          onChange={(v) => updateField('hours.weekdays', v)}
          required
          maxLength={200}
          placeholder="Monday - Friday: 8:00 AM - 5:00 PM"
        />
        <AdminInput
          label="Weekend"
          value={formData.hours.weekend}
          onChange={(v) => updateField('hours.weekend', v)}
          required
          maxLength={200}
          placeholder="Saturday - Sunday: Closed"
        />
        <AdminInput
          label="Timezone"
          value={formData.hours.timezone}
          onChange={(v) => updateField('hours.timezone', v)}
          maxLength={10}
          placeholder="PST"
        />
      </div>

      {/* Social Media */}
      <h3 className="text-xl font-black text-white uppercase tracking-tight mt-8 mb-4">
        Social Media Links
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AdminInput
          label="Facebook URL"
          value={formData.social?.facebook || ''}
          onChange={(v) => updateField('social.facebook', v)}
          maxLength={500}
          placeholder="https://facebook.com/..."
        />
        <AdminInput
          label="LinkedIn URL"
          value={formData.social?.linkedin || ''}
          onChange={(v) => updateField('social.linkedin', v)}
          maxLength={500}
          placeholder="https://linkedin.com/company/..."
        />
        <AdminInput
          label="Instagram URL"
          value={formData.social?.instagram || ''}
          onChange={(v) => updateField('social.instagram', v)}
          maxLength={500}
          placeholder="https://instagram.com/..."
        />
      </div>

      {/* Announcement Banner */}
      <h3 className="text-xl font-black text-white uppercase tracking-tight mt-8 mb-4">
        Announcement Banner
      </h3>
      <AdminToggle
        label="Enable Banner"
        value={formData.announcement.enabled}
        onChange={(v) => updateField('announcement.enabled', v)}
        helperText="Show announcement banner at top of website"
      />
      {formData.announcement.enabled && (
        <>
          <AdminTextarea
            label="Message"
            value={formData.announcement.message}
            onChange={(v) => updateField('announcement.message', v)}
            maxLength={500}
            rows={2}
            helperText="Announcement text to display"
          />
          <AdminSelect
            label="Banner Type"
            value={formData.announcement.type}
            onChange={(v) => updateField('announcement.type', v)}
            options={[
              { value: 'info', label: 'Info (Blue)' },
              { value: 'warning', label: 'Warning (Orange)' },
              { value: 'success', label: 'Success (Green)' },
            ]}
            helperText="Visual style of the banner"
          />
        </>
      )}

      {/* Brands */}
      <h3 className="text-xl font-black text-white uppercase tracking-tight mt-8 mb-4">
        Brands We Service
      </h3>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-400">
          {formData.brands.length} brand{formData.brands.length !== 1 ? 's' : ''} total
        </p>
        <button
          onClick={addBrand}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined">add</span>
          Add Brand
        </button>
      </div>

      {formData.brands.length > 0 && (
        <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
          <div className="flex gap-3">
            <span className="material-symbols-outlined text-blue-400">info</span>
            <div className="flex-1 text-sm text-blue-300">
              <p className="font-bold mb-1">Managing Brand Visibility</p>
              <p className="text-blue-400">
                Click the eye icon to enable/disable brands. Only enabled brands with logos show on your website.
              </p>
            </div>
          </div>
        </div>
      )}

      {formData.brands.length === 0 && (
        <div className="p-8 text-center bg-slate-800 rounded-lg border border-slate-700">
          <span className="material-symbols-outlined text-6xl text-slate-600 mb-4">
            business
          </span>
          <p className="text-slate-400 mb-2">No brands added yet.</p>
        </div>
      )}

      {/* Brand Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {formData.brands
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((brand) => {
            const actualIndex = formData.brands.findIndex(b => b === brand);
            const hasLogo = brand.logoUrl && brand.logoUrl.trim() !== '';
            const isActive = brand.active !== false;
            const showInCarousel = hasLogo && isActive;

            return (
              <div
                key={actualIndex}
                className={`relative p-3 rounded-lg border transition-all ${
                  showInCarousel
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-slate-900/50 border-slate-800 opacity-60'
                }`}
              >
                {/* Action Buttons */}
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={() => updateBrand(actualIndex, 'active', !isActive)}
                    className={`p-1.5 rounded transition-colors ${
                      isActive
                        ? 'hover:bg-orange-900/20 text-slate-400 hover:text-orange-400'
                        : 'hover:bg-green-900/20 text-slate-400 hover:text-green-400'
                    }`}
                    title={isActive ? 'Disable brand' : 'Enable brand'}
                  >
                    <span className="material-symbols-outlined text-base">
                      {isActive ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                  <button
                    onClick={() => removeBrand(actualIndex)}
                    className="p-1.5 hover:bg-red-900/20 text-slate-400 hover:text-red-400 rounded transition-colors"
                    title="Delete brand"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>

                {/* Logo */}
                <div className="flex justify-center mb-2">
                  {brand.logoUrl ? (
                    <img
                      src={brand.logoUrl}
                      alt={brand.name || 'Brand logo'}
                      className="h-10 w-16 object-contain bg-white p-1 rounded"
                    />
                  ) : (
                    <div className="h-10 w-16 bg-slate-700 rounded flex items-center justify-center">
                      <span className="material-symbols-outlined text-slate-500 text-sm">image</span>
                    </div>
                  )}
                </div>

                {/* Brand Name */}
                <h4 className="text-xs font-bold text-white text-center truncate px-6 mb-2">
                  {brand.name || 'Unnamed Brand'}
                </h4>

                {/* Status Indicators */}
                <div className="flex items-center justify-center gap-1 mb-2 flex-wrap">
                  {showInCarousel && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/30 text-green-400" title="Visible">
                      ✓
                    </span>
                  )}
                  {!isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/30 text-red-400" title="Disabled">
                      ✕
                    </span>
                  )}
                  {brand.authorized && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary-300" title="Authorized">
                      ★
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500" title="Display order">
                    #{brand.displayOrder}
                  </span>
                </div>

                {/* Expandable Details */}
                <details className="group">
                  <summary className="cursor-pointer text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-wider list-none flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-xs group-open:rotate-90 transition-transform">
                      chevron_right
                    </span>
                    Edit
                  </summary>

                  <div className="mt-2 pt-2 border-t border-slate-700 space-y-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Name</label>
                      <input
                        type="text"
                        value={brand.name}
                        onChange={(e) => updateBrand(actualIndex, 'name', e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:border-primary focus:outline-none"
                        placeholder="Brand name"
                        maxLength={100}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Logo</label>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml"
                        onChange={(e) => handleBrandLogoUpload(actualIndex, e.target.files[0])}
                        className="block w-full text-[10px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                      />
                    </div>

                    <div className="flex items-center justify-between p-1.5 bg-slate-900 rounded">
                      <label className="text-[10px] font-bold text-slate-400">Authorized</label>
                      <button
                        type="button"
                        onClick={() => updateBrand(actualIndex, 'authorized', !brand.authorized)}
                        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
                          brand.authorized ? 'bg-primary' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${
                            brand.authorized ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Order</label>
                      <input
                        type="number"
                        value={brand.displayOrder}
                        onChange={(e) => updateBrand(actualIndex, 'displayOrder', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:border-primary focus:outline-none"
                        min="0"
                      />
                    </div>
                  </div>
                </details>
              </div>
            );
          })}
      </div>
    </div>
  );
}
