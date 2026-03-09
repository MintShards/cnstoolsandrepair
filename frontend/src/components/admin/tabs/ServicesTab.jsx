import AdminInput from '../AdminInput';
import AdminTextarea from '../AdminTextarea';

export default function ServicesTab({ formData, addService, removeService, updateService }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">
          Services Page Content
        </h2>
        <button
          onClick={addService}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined">add</span>
          Add Service
        </button>
      </div>

      <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
        <div className="flex gap-3">
          <span className="material-symbols-outlined text-blue-400">info</span>
          <div className="flex-1 text-sm text-blue-300">
            <p className="font-bold mb-1">Services Management</p>
            <p className="text-blue-400">
              These services appear on the Services page. Tools catalog management coming soon.
            </p>
          </div>
        </div>
      </div>

      {formData.services.map((service, index) => (
        <div
          key={index}
          className="mb-6 p-6 bg-slate-800 rounded-lg border border-slate-700"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Service {index + 1}</h3>
            <button
              onClick={() => removeService(index)}
              className="flex items-center gap-1 px-3 py-1 bg-red-900/20 hover:bg-red-900/40 text-red-300 text-sm font-bold rounded transition-colors"
            >
              <span className="material-symbols-outlined text-base">delete</span>
              Remove
            </button>
          </div>
          <AdminInput
            label="Title"
            value={service.title}
            onChange={(v) => updateService(index, 'title', v)}
            required
            maxLength={200}
          />
          <AdminTextarea
            label="Description"
            value={service.description}
            onChange={(v) => updateService(index, 'description', v)}
            required
            maxLength={1000}
            rows={3}
          />
          <AdminInput
            label="Icon (Material Symbol name)"
            value={service.icon}
            onChange={(v) => updateService(index, 'icon', v)}
            required
            maxLength={50}
            helperText="See: fonts.google.com/icons"
          />
        </div>
      ))}

      {formData.services.length === 0 && (
        <div className="p-8 text-center bg-slate-800 rounded-lg border border-slate-700">
          <span className="material-symbols-outlined text-6xl text-slate-600 mb-4">
            build
          </span>
          <p className="text-slate-400 mb-2">No services added yet.</p>
          <p className="text-sm text-slate-500">Click "Add Service" to create your first service.</p>
        </div>
      )}
    </div>
  );
}
