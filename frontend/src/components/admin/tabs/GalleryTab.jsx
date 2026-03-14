import { useState, useEffect, useRef } from 'react';
import { galleryAPI } from '../../../services/api';

// Constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function GalleryTab() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [statusMessage, setStatusMessage] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      const data = await galleryAPI.list(false); // Get all photos including inactive
      setPhotos(data);
    } catch (error) {
      console.error('Failed to fetch gallery photos:', error);
      setStatusMessage({ type: 'error', text: 'Failed to load photos' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);

    // Validate file types
    const invalidFiles = files.filter(file => !ALLOWED_FILE_TYPES.includes(file.type));

    if (invalidFiles.length > 0) {
      setStatusMessage({
        type: 'error',
        text: `Invalid file type. Only JPG, PNG, and WebP are allowed.`
      });
      return;
    }

    // Validate file sizes
    const oversizedFiles = files.filter(file => file.size > MAX_FILE_SIZE);

    if (oversizedFiles.length > 0) {
      setStatusMessage({
        type: 'error',
        text: `File(s) too large. Maximum size is 5MB.`
      });
      return;
    }

    setSelectedFiles(files);
    setStatusMessage(null);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setStatusMessage({ type: 'error', text: 'Please select at least one file' });
      return;
    }

    setUploading(true);
    setStatusMessage(null);

    try {
      // Upload all files in parallel
      const uploadPromises = selectedFiles.map(file => galleryAPI.upload(file, 0));
      await Promise.all(uploadPromises);

      setStatusMessage({
        type: 'success',
        text: `Successfully uploaded ${selectedFiles.length} photo${selectedFiles.length > 1 ? 's' : ''}`
      });
      setSelectedFiles([]);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh photo list
      await fetchPhotos();
    } catch (error) {
      console.error('Upload failed:', error);
      setStatusMessage({ type: 'error', text: 'Upload failed. Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photoId, filename) => {
    if (!confirm(`Delete photo "${filename}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await galleryAPI.delete(photoId);
      setStatusMessage({ type: 'success', text: 'Photo deleted successfully' });
      await fetchPhotos();
    } catch (error) {
      console.error('Delete failed:', error);
      setStatusMessage({ type: 'error', text: 'Failed to delete photo' });
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div>
      <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-6">
        Gallery Page Content
      </h2>

      {/* Status Message */}
      {statusMessage && (
        <div className={`mb-6 p-4 rounded-lg border ${
          statusMessage.type === 'success'
            ? 'bg-green-900/20 border-green-700 text-green-300'
            : 'bg-red-900/20 border-red-700 text-red-300'
        }`}>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined">
              {statusMessage.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <p>{statusMessage.text}</p>
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className="mb-8 p-6 bg-slate-800 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">Upload Photos</h3>

        <div className="space-y-4">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              onChange={handleFileSelect}
              className="block w-full text-sm text-slate-300
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-bold
                file:bg-primary file:text-white
                file:cursor-pointer file:transition-all
                hover:file:bg-blue-600"
            />
            <p className="mt-2 text-xs text-slate-400">
              Accepts JPG, PNG, WebP • Max 5MB per file • Select multiple files for batch upload
            </p>
          </div>

          {selectedFiles.length > 0 && (
            <div className="text-sm text-slate-300">
              <p className="font-bold">{selectedFiles.length} file(s) selected:</p>
              <ul className="mt-2 space-y-1 text-slate-400">
                {selectedFiles.map((file, idx) => (
                  <li key={idx}>• {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
            className="bg-primary text-white font-black px-6 py-3 rounded-lg shadow-lg
              hover:bg-blue-600 transition-all uppercase text-sm
              disabled:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined animate-spin">refresh</span>
                Uploading...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined">cloud_upload</span>
                Upload Photos
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Photo List Section */}
      <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">
          Uploaded Photos ({photos.length})
        </h3>

        {loading ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
            <p className="mt-2 text-slate-400">Loading photos...</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-slate-600">photo_library</span>
            <p className="mt-2 text-slate-400">No photos uploaded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Preview</th>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Upload Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {photos.map((photo) => (
                  <tr key={photo.id} className="hover:bg-slate-700/50 transition-colors">
                    <td className="py-3 px-4">
                      <img
                        src={`${API_BASE_URL}/uploads/${photo.image_url}`}
                        alt="Thumbnail"
                        className="w-16 h-16 object-cover rounded-lg border border-slate-600"
                      />
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono text-xs">
                      {photo.image_url}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {formatDate(photo.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                        photo.active
                          ? 'bg-green-900/30 text-green-400 border border-green-700'
                          : 'bg-slate-700 text-slate-400 border border-slate-600'
                      }`}>
                        <span className="material-symbols-outlined text-sm">
                          {photo.active ? 'visibility' : 'visibility_off'}
                        </span>
                        {photo.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDelete(photo.id, photo.image_url)}
                        className="inline-flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700
                          text-white rounded-lg text-xs font-bold transition-all"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
