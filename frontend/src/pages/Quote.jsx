import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useDropzone } from 'react-dropzone';
import { quotesAPI } from '../services/api';

export default function Quote() {
  const { register, handleSubmit, formState: { errors }, reset } = useForm();
  const [photos, setPhotos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp']
    },
    maxFiles: 5,
    maxSize: 5242880, // 5MB
    onDrop: (acceptedFiles) => {
      setPhotos(prev => [...prev, ...acceptedFiles].slice(0, 5));
    }
  });

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const formData = new FormData();
      formData.append('company_name', data.company_name);
      formData.append('contact_person', data.contact_person);
      formData.append('email', data.email);
      formData.append('phone', data.phone);
      formData.append('tool_type', data.tool_type);
      formData.append('tool_brand', data.tool_brand);
      formData.append('tool_model', data.tool_model);
      formData.append('quantity', data.quantity);
      formData.append('problem_description', data.problem_description);
      formData.append('urgency_level', data.urgency_level);

      photos.forEach((photo) => {
        formData.append('photos', photo);
      });

      await quotesAPI.create(formData);

      setSubmitStatus({ type: 'success', message: 'Quote request submitted successfully! We will contact you soon.' });
      reset();
      setPhotos([]);
    } catch (error) {
      setSubmitStatus({ type: 'error', message: error.response?.data?.detail || 'Failed to submit quote. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen px-6 py-16 bg-white dark:bg-slate-900">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">Get Started</h2>
          <h1 className="text-4xl font-black tracking-tight uppercase">Request a Quote</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-4">
            Fill out the form below and our team will get back to you with a detailed quote.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800">
          {/* Company Information */}
          <div className="mb-8">
            <h3 className="text-lg font-black mb-4 uppercase tracking-tight">Company Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">Company Name *</label>
                <input
                  {...register('company_name', { required: 'Company name is required' })}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Your Company Name"
                />
                {errors.company_name && <p className="text-red-500 text-sm mt-1">{errors.company_name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">Contact Person *</label>
                <input
                  {...register('contact_person', { required: 'Contact person is required' })}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="John Smith"
                />
                {errors.contact_person && <p className="text-red-500 text-sm mt-1">{errors.contact_person.message}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">Email *</label>
                  <input
                    type="email"
                    {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' } })}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="john@company.com"
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">Phone *</label>
                  <input
                    type="tel"
                    {...register('phone', { required: 'Phone is required' })}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="604-555-0123"
                  />
                  {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Tool Information */}
          <div className="mb-8">
            <h3 className="text-lg font-black mb-4 uppercase tracking-tight">Tool Information</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">Tool Type *</label>
                  <input
                    {...register('tool_type', { required: 'Tool type is required' })}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Impact Wrench"
                  />
                  {errors.tool_type && <p className="text-red-500 text-sm mt-1">{errors.tool_type.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">Brand *</label>
                  <input
                    {...register('tool_brand', { required: 'Brand is required' })}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Ingersoll Rand"
                  />
                  {errors.tool_brand && <p className="text-red-500 text-sm mt-1">{errors.tool_brand.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">Model *</label>
                  <input
                    {...register('tool_model', { required: 'Model is required' })}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="2135TIMAX"
                  />
                  {errors.tool_model && <p className="text-red-500 text-sm mt-1">{errors.tool_model.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">Quantity *</label>
                  <input
                    type="number"
                    {...register('quantity', { required: 'Quantity is required', min: { value: 1, message: 'Minimum 1' } })}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                    defaultValue={1}
                  />
                  {errors.quantity && <p className="text-red-500 text-sm mt-1">{errors.quantity.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">Urgency Level *</label>
                <select
                  {...register('urgency_level')}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">Problem Description *</label>
                <textarea
                  {...register('problem_description', { required: 'Problem description is required', minLength: { value: 10, message: 'Minimum 10 characters' } })}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                  rows={5}
                  placeholder="Describe the issue you're experiencing with the tool..."
                />
                {errors.problem_description && <p className="text-red-500 text-sm mt-1">{errors.problem_description.message}</p>}
              </div>
            </div>
          </div>

          {/* Photo Upload */}
          <div className="mb-8">
            <h3 className="text-lg font-black mb-4 uppercase tracking-tight">Photos (Optional)</h3>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-slate-300 dark:border-slate-700 hover:border-primary'
              }`}
            >
              <input {...getInputProps()} />
              <span className="material-symbols-outlined text-5xl text-slate-400 mb-4 block">cloud_upload</span>
              <p className="font-bold text-slate-600 dark:text-slate-400">
                {isDragActive ? 'Drop photos here...' : 'Drag & drop photos here, or click to select'}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">Max 5 photos, 5MB each</p>
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-4 mt-4">
                {photos.map((photo, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={URL.createObjectURL(photo)}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Status */}
          {submitStatus && (
            <div className={`p-4 rounded-lg mb-6 ${
              submitStatus.type === 'success'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
            }`}>
              {submitStatus.message}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-white font-black py-4 rounded-xl shadow-xl shadow-primary/30 active:scale-95 transition-transform uppercase disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined animate-spin">refresh</span>
                Submitting...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">send</span>
                Submit Quote Request
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
