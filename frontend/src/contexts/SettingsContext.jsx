import { createContext, useContext, useState, useEffect } from 'react';
import { settingsAPI } from '../services/api';
import { BUSINESS_INFO } from '../config/business';

const SettingsContext = createContext();

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await settingsAPI.get();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load business settings from API:', err);
      setError(err.message);
      // Fallback to static config if API fails
      setSettings(convertStaticConfigToAPIFormat());
    } finally {
      setLoading(false);
    }
  };

  // Convert static config to API format for backward compatibility
  const convertStaticConfigToAPIFormat = () => {
    return {
      contact: {
        phone: BUSINESS_INFO.phone,
        phoneLink: BUSINESS_INFO.phoneLink,
        email: BUSINESS_INFO.email,
        address: {
          street: BUSINESS_INFO.address.street,
          city: BUSINESS_INFO.address.city,
          province: BUSINESS_INFO.address.province,
          postalCode: BUSINESS_INFO.address.postalCode || '',
          country: BUSINESS_INFO.address.country,
        },
      },
      hours: {
        weekdays: BUSINESS_INFO.hours.weekdays,
        weekend: BUSINESS_INFO.hours.weekend,
        timezone: BUSINESS_INFO.hours.timezone,
      },
      hero: {
        headline: BUSINESS_INFO.tagline || 'Expert Pneumatic Tool Repair & Calibration',
        subheadline: 'B2B industrial repair services in Surrey, BC.',
        industries: BUSINESS_INFO.industries || [],
      },
      services: [
        {
          title: 'Pneumatic Tool Repair',
          description: 'Complete diagnostic and repair services for all types of pneumatic tools.',
          icon: 'build',
        },
        {
          title: 'Tool Calibration',
          description: 'Precision calibration services for specialty pneumatic tools.',
          icon: 'tune',
        },
        {
          title: 'Equipment Rental',
          description: 'Quality pneumatic tools available for rent while your equipment is being repaired.',
          icon: 'handshake',
        },
        {
          title: 'Used Tool Sales',
          description: 'Quality refurbished pneumatic tools available for purchase.',
          icon: 'sell',
        },
      ],
      announcement: {
        enabled: false,
        message: '',
        type: 'info',
      },
      serviceArea: BUSINESS_INFO.serviceArea || 'Metro Vancouver',
      map: {
        embedUrl: BUSINESS_INFO.map?.embedUrl || '',
        directionsUrl: BUSINESS_INFO.map?.directionsUrl || '',
      },
      claims: {
        toolTypesServiced: BUSINESS_INFO.claims?.toolTypesServiced || '20+',
        averageTurnaround: BUSINESS_INFO.claims?.averageTurnaround || '3-7 Day',
        responseTime: BUSINESS_INFO.claims?.responseTime || 'Same-day',
        technicians: BUSINESS_INFO.claims?.technicians || 'Factory-Trained',
      },
    };
  };

  // Refresh settings (useful for admin panel after update)
  const refreshSettings = async () => {
    await loadSettings();
  };

  const value = {
    settings,
    loading,
    error,
    refreshSettings,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
