import { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useForm } from 'react-hook-form';
import { useDropzone } from 'react-dropzone';
import { quotesAPI } from '../services/api';

// Success Modal Component
function SuccessModal({ isOpen, onClose, onNewQuote }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-modal-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-5xl text-green-600 dark:text-green-400">check_circle</span>
          </div>
          <h2 id="success-modal-title" className="text-2xl font-black uppercase mb-2">Quote Submitted!</h2>
          <p className="text-slate-600 dark:text-slate-400">
            We've received your quote request and will contact you soon with a detailed assessment.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onNewQuote}
            className="flex-1 bg-primary text-white font-black py-3 px-6 rounded-xl hover:bg-primary/90 transition-colors uppercase"
            aria-label="Submit another quote request"
          >
            Submit Another
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-black py-3 px-6 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors uppercase"
            aria-label="Close dialog"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Quote() {
  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm();
  const [tools, setTools] = useState([{ tool_type: '', tool_brand: '', tool_model: '', quantity: 1, problem_description: '' }]);
  const [collapsedTools, setCollapsedTools] = useState([false]); // First tool expanded by default
  const [photos, setPhotos] = useState([]);
  const [photoErrors, setPhotoErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const successMessageRef = useRef(null);

  // Watch all form fields for draft saving
  const watchedFields = watch();

  // Load draft on mount (ONCE)
  useEffect(() => {
    const draftKey = 'quote_draft';
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);

        // Check draft expiration (24 hours)
        const DRAFT_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const now = Date.now();

        if (draft.timestamp && (now - draft.timestamp > DRAFT_EXPIRY)) {
          console.log('Draft expired, removing from storage');
          localStorage.removeItem(draftKey);
          return;
        }

        // Load draft fields (excluding timestamp)
        Object.keys(draft).forEach(key => {
          if (key !== 'timestamp') {
            setValue(key, draft[key]);
          }
        });
      } catch (e) {
        console.error('Failed to load draft:', e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run ONLY on mount

  // Save draft on form change (debounced)
  useEffect(() => {
    const draftKey = 'quote_draft';
    const timeoutId = setTimeout(() => {
      if (Object.keys(watchedFields).length > 0) {
        // Add timestamp to draft for expiration tracking
        const draftWithTimestamp = {
          ...watchedFields,
          timestamp: Date.now()
        };
        localStorage.setItem(draftKey, JSON.stringify(draftWithTimestamp));
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [watchedFields]); // Now safe - only saves, doesn't modify form

  // Capitalization helper functions
  const capitalizeWords = (value) => {
    if (!value) return value;
    return value
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const capitalizeFirstLetters = (value) => {
    if (!value) return value;

    // Capitalize first letter and first letter after each space (without lowercasing rest)
    return value.replace(/(^|\s)([a-z])/g, (match, separator, letter) => {
      return separator + letter.toUpperCase();
    });
  };

  const capitalizeSentences = (value) => {
    if (!value) return value;

    // Capitalize first letter and after sentence-ending punctuation (. ! ?)
    return value.replace(/(^|[.!?]\s+)([a-z])/g, (match, separator, letter) => {
      return separator + letter.toUpperCase();
    });
  };

  // Tool management functions
  const addTool = () => {
    if (tools.length < 5) {
      setTools([...tools, { tool_type: '', tool_brand: '', tool_model: '', quantity: 1, problem_description: '' }]);
      setCollapsedTools([...collapsedTools, false]); // New tool starts expanded
    }
  };

  const removeTool = (index) => {
    if (tools.length > 1) {
      setTools(tools.filter((_, i) => i !== index));
      setCollapsedTools(collapsedTools.filter((_, i) => i !== index));
    }
  };

  const updateTool = (index, field, value) => {
    const updatedTools = [...tools];
    // Apply capitalization based on field
    if (field === 'tool_type' || field === 'tool_brand') {
      updatedTools[index][field] = capitalizeWords(value);
    } else if (field === 'tool_model') {
      updatedTools[index][field] = value.toUpperCase();
    } else if (field === 'problem_description') {
      updatedTools[index][field] = capitalizeSentences(value);
    } else {
      updatedTools[index][field] = value;
    }
    setTools(updatedTools);
  };

  const toggleToolCollapse = (index) => {
    const updated = [...collapsedTools];
    updated[index] = !updated[index];
    setCollapsedTools(updated);
  };

  // Phone number formatting
  const formatPhoneNumber = (value) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;

    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
      return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
    }
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp']
    },
    maxFiles: 5,
    maxSize: 5242880, // 5MB
    onDrop: (acceptedFiles, rejectedFiles) => {
      setPhotoErrors([]);
      const errors = [];

      // Check for file size errors
      rejectedFiles.forEach(({ file, errors: fileErrors }) => {
        fileErrors.forEach(error => {
          if (error.code === 'file-too-large') {
            errors.push(`${file.name} is too large (max 5MB)`);
          } else if (error.code === 'file-invalid-type') {
            errors.push(`${file.name} is not a valid image format`);
          }
        });
      });

      // Check for max files limit
      const totalFiles = photos.length + acceptedFiles.length;
      if (totalFiles > 5) {
        errors.push(`Maximum 5 photos allowed (you selected ${totalFiles})`);
        setPhotoErrors(errors);
        return;
      }

      if (errors.length > 0) {
        setPhotoErrors(errors);
      } else {
        setPhotos(prev => [...prev, ...acceptedFiles].slice(0, 5));
      }
    }
  });

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoErrors([]);
  };

  const handleKeyDownRemovePhoto = (e, index) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removePhoto(index);
    }
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setSubmitStatus(null);
    setUploadProgress(0);

    let progressInterval = null;

    try {
      // Validate tools before submission
      const hasInvalidTools = tools.some(tool =>
        !tool.tool_type || !tool.tool_brand || !tool.tool_model || !tool.quantity || !tool.problem_description || tool.problem_description.length < 10
      );

      if (hasInvalidTools) {
        setSubmitStatus({
          type: 'error',
          message: 'Please fill in all tool fields. Problem description must be at least 10 characters.'
        });
        setIsSubmitting(false);
        return;
      }

      const formData = new FormData();
      formData.append('company_name', data.company_name || '');
      formData.append('contact_person', data.contact_person);
      formData.append('email', data.email);
      formData.append('phone', data.phone);

      // Send tools as JSON array
      formData.append('tools', JSON.stringify(tools));

      // Generate idempotency key for duplicate prevention
      const idempotencyKey = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      formData.append('idempotency_key', idempotencyKey);

      photos.forEach((photo) => {
        formData.append('photos', photo);
      });

      // Simulate upload progress (since we don't have real progress from API)
      progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const response = await quotesAPI.create(formData);

      // Clear progress interval
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      setUploadProgress(100);

      // Clear draft from localStorage
      localStorage.removeItem('quote_draft');

      // Check if email notification failed
      if (response.email_sent === false) {
        setSubmitStatus({
          type: 'warning',
          message: 'Quote submitted successfully, but email notification failed. We will contact you soon. For urgent matters, please call us.'
        });
      }

      // Show success modal
      setShowSuccessModal(true);
      reset();
      setPhotos([]);
      setTools([{ tool_type: '', tool_brand: '', tool_model: '', quantity: 1, problem_description: '' }]);
      setCollapsedTools([false]);
    } catch (error) {
      // Clear progress interval on error
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

      setSubmitStatus({
        type: 'error',
        message: error.response?.data?.detail || 'Failed to submit quote. Please try again.'
      });

      // Focus on error message for screen readers
      setTimeout(() => {
        if (successMessageRef.current) {
          successMessageRef.current.focus();
        }
      }, 100);
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const handleNewQuote = () => {
    setShowSuccessModal(false);
    reset();
    setPhotos([]);
    setTools([{ tool_type: '', tool_brand: '', tool_model: '', quantity: 1, problem_description: '' }]);
    setCollapsedTools([false]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <Helmet>
        <title>Request Free Pneumatic Tool Repair Quote | CNS Tools Surrey BC</title>
        <meta
          name="description"
          content="Request a free quote for industrial pneumatic tool repair in Surrey, BC. Upload photos, describe your tool issue, and get professional repair assessment. Fast turnaround for automotive, fleet, manufacturing, and construction industries."
        />
        <meta
          name="keywords"
          content="free tool repair quote, pneumatic tool quote Surrey, industrial tool repair estimate, air tool repair quote BC, tool repair assessment"
        />
        <link rel="canonical" href="https://cnstoolsandrepair.com/quote" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://cnstoolsandrepair.com/quote" />
        <meta property="og:title" content="Request Free Pneumatic Tool Repair Quote | CNS Tools Surrey BC" />
        <meta property="og:description" content="Get a free quote for industrial pneumatic tool repair in Surrey, BC. Upload photos, describe your tool issue, and get professional assessment." />
        <meta property="og:image" content="https://cnstoolsandrepair.com/og-image.jpg" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://cnstoolsandrepair.com/quote" />
        <meta name="twitter:title" content="Request Free Pneumatic Tool Repair Quote | CNS Tools Surrey BC" />
        <meta name="twitter:description" content="Get a free quote for industrial pneumatic tool repair in Surrey, BC. Upload photos, describe your tool issue, and get professional assessment." />
        <meta name="twitter:image" content="https://cnstoolsandrepair.com/og-image.jpg" />
      </Helmet>

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        onNewQuote={handleNewQuote}
      />

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
                <label htmlFor="company_name" className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">
                  Company Name
                </label>
                <input
                  id="company_name"
                  {...register('company_name')}
                  onChange={(e) => {
                    const capitalized = capitalizeWords(e.target.value);
                    setValue('company_name', capitalized);
                  }}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Enter Company Name"
                  aria-required="false"
                  aria-invalid={errors.company_name ? 'true' : 'false'}
                  aria-describedby={errors.company_name ? 'company_name-error' : undefined}
                />
                {errors.company_name && (
                  <p id="company_name-error" className="text-red-500 text-sm mt-1" role="alert">
                    {errors.company_name.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="contact_person" className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">
                  Contact Person *
                </label>
                <input
                  id="contact_person"
                  {...register('contact_person', { required: 'Contact person is required' })}
                  onChange={(e) => {
                    const capitalized = capitalizeFirstLetters(e.target.value);
                    setValue('contact_person', capitalized);
                  }}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Enter Name"
                  aria-required="true"
                  aria-invalid={errors.contact_person ? 'true' : 'false'}
                  aria-describedby={errors.contact_person ? 'contact_person-error' : undefined}
                />
                {errors.contact_person && (
                  <p id="contact_person-error" className="text-red-500 text-sm mt-1" role="alert">
                    {errors.contact_person.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">
                    Email *
                  </label>
                  <input
                    id="email"
                    type="email"
                    {...register('email', {
                      required: 'Email is required',
                      pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' }
                    })}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Enter Email"
                    aria-required="true"
                    aria-invalid={errors.email ? 'true' : 'false'}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                  />
                  {errors.email && (
                    <p id="email-error" className="text-red-500 text-sm mt-1" role="alert">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">
                    Phone *
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    {...register('phone', {
                      required: 'Phone is required'
                    })}
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value);
                      setValue('phone', formatted);
                    }}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Enter Phone"
                    aria-required="true"
                    aria-invalid={errors.phone ? 'true' : 'false'}
                    aria-describedby={errors.phone ? 'phone-error' : undefined}
                  />
                  {errors.phone && (
                    <p id="phone-error" className="text-red-500 text-sm mt-1" role="alert">
                      {errors.phone.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tools Information */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black uppercase tracking-tight">Tools</h3>
              <button
                type="button"
                onClick={addTool}
                disabled={tools.length >= 5}
                className="flex items-center gap-2 bg-primary text-white font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Add another tool"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Add Tool
              </button>
            </div>

            {tools.map((tool, index) => (
              <div key={index} className="mb-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden transition-all">
                {/* Collapsible Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => toggleToolCollapse(index)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">
                      {collapsedTools[index] ? 'expand_more' : 'expand_less'}
                    </span>
                    {collapsedTools[index] && tool.tool_type ? (
                      <div className="font-bold text-slate-700 dark:text-slate-300">
                        Tool {index + 1} - {tool.tool_type}
                        {tool.tool_brand && ` (${tool.tool_brand}${tool.tool_model ? ' ' + tool.tool_model : ''})`}
                        {tool.quantity > 1 && ` | Qty: ${tool.quantity}`}
                      </div>
                    ) : (
                      <h4 className="font-black uppercase text-sm text-slate-600 dark:text-slate-400">Tool {index + 1}</h4>
                    )}
                  </div>
                  {tools.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTool(index);
                      }}
                      className="text-red-500 hover:text-red-700 font-bold text-sm uppercase flex items-center gap-1 ml-4"
                      aria-label={`Remove tool ${index + 1}`}
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      Remove
                    </button>
                  )}
                </div>

                {/* Collapsible Content */}
                {!collapsedTools[index] && (
                  <div className="p-6 pt-0 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">
                          Tool Type *
                        </label>
                        <input
                          type="text"
                          value={tool.tool_type}
                          onChange={(e) => updateTool(index, 'tool_type', e.target.value)}
                          className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                          placeholder="Enter Tool Type"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">
                          Brand *
                        </label>
                        <input
                          type="text"
                          value={tool.tool_brand}
                          onChange={(e) => updateTool(index, 'tool_brand', e.target.value)}
                          className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                          placeholder="Enter Tool Brand"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">
                          Model *
                        </label>
                        <input
                          type="text"
                          value={tool.tool_model}
                          onChange={(e) => updateTool(index, 'tool_model', e.target.value)}
                          className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                          placeholder="Enter Tool Model"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">
                          Quantity *
                        </label>
                        <input
                          type="number"
                          value={tool.quantity}
                          onChange={(e) => updateTool(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                          placeholder="Enter Quantity"
                          min="1"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-2 uppercase text-slate-700 dark:text-slate-300">
                        Problem Description *
                      </label>
                      <textarea
                        value={tool.problem_description}
                        onChange={(e) => updateTool(index, 'problem_description', e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                        rows={4}
                        placeholder="Enter Problem Description"
                        minLength={10}
                        required
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Photo Upload */}
          <div className="mb-8">
            <h3 className="text-lg font-black mb-4 uppercase tracking-tight">Photos (Optional)</h3>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-slate-300 dark:border-slate-700 hover:border-primary'
              }`}
              role="button"
              aria-label="Upload photos of your tool"
              tabIndex={0}
            >
              <input {...getInputProps()} aria-label="File upload input" />
              <span className="material-symbols-outlined text-3xl text-slate-400 mb-1 block" aria-hidden="true">
                cloud_upload
              </span>
              <p className="font-bold text-slate-600 dark:text-slate-400">
                {isDragActive ? 'Drop photos here' : 'Click or drag photos here'}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">Max 5 photos, 5MB each (JPG, PNG, WebP)</p>
            </div>

            {/* Photo validation errors */}
            {photoErrors.length > 0 && (
              <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
                <p className="font-bold text-red-800 dark:text-red-200 mb-2">Upload Error:</p>
                <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300">
                  {photoErrors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-4 mt-4" role="list" aria-label="Uploaded photos">
                {photos.map((photo, index) => (
                  <div
                    key={index}
                    className="relative group"
                    role="listitem"
                    tabIndex={0}
                    onKeyDown={(e) => handleKeyDownRemovePhoto(e, index)}
                    aria-label={`Photo ${index + 1}, press Delete or Backspace to remove`}
                  >
                    <img
                      src={URL.createObjectURL(photo)}
                      alt={`Tool photo ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 transition-opacity"
                      aria-label={`Remove photo ${index + 1}`}
                    >
                      <span className="material-symbols-outlined text-sm" aria-hidden="true">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {isSubmitting && uploadProgress > 0 && (
            <div className="mb-6" role="status" aria-live="polite">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Uploading...</span>
                <span className="text-sm font-bold text-primary">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                  aria-valuenow={uploadProgress}
                  aria-valuemin="0"
                  aria-valuemax="100"
                />
              </div>
            </div>
          )}

          {/* Submit Status */}
          {submitStatus && (
            <div
              ref={successMessageRef}
              tabIndex={-1}
              className={`p-4 rounded-lg mb-6 ${
                submitStatus.type === 'success'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                  : submitStatus.type === 'warning'
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
              }`}
              role="alert"
              aria-live="assertive"
            >
              {submitStatus.message}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-white font-black py-4 rounded-xl shadow-xl shadow-primary/30 active:scale-95 transition-transform uppercase disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            aria-label={isSubmitting ? 'Submitting quote request' : 'Submit quote request'}
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined animate-spin" aria-hidden="true">refresh</span>
                Submitting...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" aria-hidden="true">send</span>
                Submit Quote Request
              </>
            )}
          </button>
        </form>
      </div>
    </main>
    </>
  );
}
