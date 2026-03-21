import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { contactFormAPI } from '../../services/api';

export default function ContactForm() {
  const { register, handleSubmit, formState: { errors }, reset } = useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      await contactFormAPI.submit(data);

      setSubmitStatus({
        type: 'success',
        message: 'Thank you for contacting us! We will get back to you soon.'
      });
      reset();
    } catch (error) {
      const isRateLimit = error.response?.status === 429;
      const errorMessage = error.response?.data?.detail || 'Failed to send message. Please try again.';

      setSubmitStatus({
        type: 'error',
        message: isRateLimit
          ? `⏳ ${errorMessage}`
          : errorMessage
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-950">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">Send Us a Message</h2>
          <h3 className="text-3xl lg:text-4xl font-black tracking-tight uppercase">Contact Form</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-4">
            Fill out the form below and we&apos;ll get back to you as soon as possible.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-slate-100 dark:bg-slate-900 p-6 sm:p-8 lg:p-10 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg">
          {/* Success/Error Messages */}
          {submitStatus && (
            <div className={`mb-6 p-4 rounded-xl border ${
              submitStatus.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
              <div className="flex gap-3">
                <span className={`material-symbols-outlined ${
                  submitStatus.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {submitStatus.type === 'success' ? 'check_circle' : 'error'}
                </span>
                <p className={`text-sm font-medium ${
                  submitStatus.type === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                }`}>
                  {submitStatus.message}
                </p>
              </div>
            </div>
          )}

          {/* Name & Email Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <div>
              <label className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">
                Name *
              </label>
              <input
                {...register('name', {
                  required: 'Name is required',
                  minLength: { value: 2, message: 'Name must be at least 2 characters' }
                })}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                placeholder="John Smith"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">
                Email *
              </label>
              <input
                type="email"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^\S+@\S+$/i,
                    message: 'Invalid email address'
                  }
                })}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                placeholder="john@company.com"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>
          </div>

          {/* Phone & Subject Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <div>
              <label className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">
                Phone *
              </label>
              <input
                type="tel"
                {...register('phone', {
                  required: 'Phone number is required',
                  minLength: { value: 10, message: 'Phone number must be at least 10 digits' }
                })}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                placeholder="604-555-0123"
              />
              {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">
                Subject *
              </label>
              <input
                {...register('subject', {
                  required: 'Subject is required',
                  minLength: { value: 3, message: 'Subject must be at least 3 characters' }
                })}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                placeholder="Inquiry about services"
              />
              {errors.subject && <p className="text-red-500 text-sm mt-1">{errors.subject.message}</p>}
            </div>
          </div>

          {/* Message */}
          <div className="mb-6">
            <label className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">
              Message *
            </label>
            <textarea
              {...register('message', {
                required: 'Message is required',
                minLength: { value: 10, message: 'Message must be at least 10 characters' },
                maxLength: { value: 2000, message: 'Message must be less than 2000 characters' }
              })}
              rows={6}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow resize-none"
              placeholder="Tell us about your needs..."
            />
            {errors.message && <p className="text-red-500 text-sm mt-1">{errors.message.message}</p>}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-white font-black px-8 py-4 rounded-xl shadow-xl shadow-primary/30 hover:bg-primary/90 active:scale-[0.98] transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined animate-spin">refresh</span>
                Sending...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">send</span>
                Send Message
              </span>
            )}
          </button>

          <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-4">
            * Required fields
          </p>
        </form>
      </div>
    </section>
  );
}
