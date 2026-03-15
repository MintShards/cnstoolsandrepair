import { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';

export default function AnnouncementBanner() {
  const { settings, loading } = useSettings();
  const [isDismissed, setIsDismissed] = useState(false);

  // Check localStorage for dismissed state on mount
  useEffect(() => {
    const dismissed = localStorage.getItem('announcementDismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  // Reset dismissed state when announcement message changes OR when banner is re-enabled
  useEffect(() => {
    if (settings?.announcement) {
      const savedMessage = localStorage.getItem('announcementMessage');
      const savedEnabled = localStorage.getItem('announcementEnabled');
      const currentEnabled = settings.announcement.enabled ? 'true' : 'false';

      // Reset if message changed
      if (savedMessage !== settings.announcement.message) {
        setIsDismissed(false);
        localStorage.removeItem('announcementDismissed');
        localStorage.setItem('announcementMessage', settings.announcement.message || '');
      }

      // Reset if admin re-enabled the banner (was disabled, now enabled)
      if (savedEnabled === 'false' && currentEnabled === 'true') {
        setIsDismissed(false);
        localStorage.removeItem('announcementDismissed');
      }

      // Track current enabled state
      localStorage.setItem('announcementEnabled', currentEnabled);
    }
  }, [settings?.announcement?.message, settings?.announcement?.enabled]);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('announcementDismissed', 'true');
  };

  // Don't render if loading, disabled, no message, or dismissed
  if (loading || !settings?.announcement?.enabled || !settings.announcement.message || isDismissed) {
    return null;
  }

  const { message, type = 'info' } = settings.announcement;

  // Banner styles by type
  const bannerStyles = {
    info: {
      bg: 'bg-primary dark:bg-primary/90',
      text: 'text-white',
      icon: 'info',
    },
    warning: {
      bg: 'bg-accent-orange dark:bg-accent-orange/90',
      text: 'text-white',
      icon: 'warning',
    },
    success: {
      bg: 'bg-green-600 dark:bg-green-700',
      text: 'text-white',
      icon: 'check_circle',
    },
  };

  const style = bannerStyles[type] || bannerStyles.info;

  return (
    <div className={`${style.bg} ${style.text} py-1 px-4 sm:px-6 sticky top-0 z-50 shadow-md animate-slideDown`}>
      <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <span className="material-symbols-outlined text-xl sm:text-2xl flex-shrink-0">
            {style.icon}
          </span>
          <p className="text-sm sm:text-base font-semibold text-center sm:text-left flex-1">
            {message}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 hover:bg-white/20 rounded-full p-1 transition-colors"
          aria-label="Dismiss announcement"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
      </div>
    </div>
  );
}
