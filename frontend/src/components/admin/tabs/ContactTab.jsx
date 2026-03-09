import AdminInput from '../AdminInput';
import AdminTextarea from '../AdminTextarea';

export default function ContactTab({ formData, updateField }) {
  return (
    <div>
      <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-6">
        Contact Page Settings
      </h2>

      <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
        <div className="flex gap-3">
          <span className="material-symbols-outlined text-blue-400">info</span>
          <div className="flex-1 text-sm text-blue-300">
            <p className="font-bold mb-1">Contact Page Configuration</p>
            <p className="text-blue-400">
              Configure map embed and contact form settings. Global contact info is in the "Global Settings" tab.
            </p>
          </div>
        </div>
      </div>

      {/* Map Configuration */}
      <h3 className="text-xl font-black text-white uppercase tracking-tight mb-4">
        Map & Location
      </h3>
      <AdminTextarea
        label="Google Maps Embed URL"
        value={formData.map.embedUrl}
        onChange={(v) => updateField('map.embedUrl', v)}
        required
        rows={3}
        helperText="Get from Google Maps → Share → Embed"
      />
      <AdminInput
        label="Directions URL"
        value={formData.map.directionsUrl}
        onChange={(v) => updateField('map.directionsUrl', v)}
        required
        helperText="Link for 'Get Directions' button"
      />
      <AdminInput
        label="Service Area"
        value={formData.serviceArea}
        onChange={(v) => updateField('serviceArea', v)}
        maxLength={100}
        helperText="Example: Metro Vancouver"
      />
    </div>
  );
}
