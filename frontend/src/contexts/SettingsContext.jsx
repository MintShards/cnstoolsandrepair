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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        headline: BUSINESS_INFO.tagline || 'Expert Pneumatic Tool Repair & Maintenance',
        subheadline: 'B2B industrial repair services in Surrey, BC.',
        industries: BUSINESS_INFO.industries || [],
      },
      services: [
        {
          title: 'Pneumatic Tool Repair',
          description: 'Complete diagnostics and repair services for industrial pneumatic tools including impact wrenches, grinders, drills, and air ratchets.',
          icon: 'build',
        },
        {
          title: 'Hydraulic Repair',
          description: 'Diagnostics and repair for hydraulic jacks, two-stage jacks, rams, pumps, and bottle jacks used in automotive and industrial operations.',
          icon: 'compress',
        },
        {
          title: 'Lifting Equipment',
          description: 'Inspection, safety testing, and repair for chain hoists, lever hoists, and other lifting equipment used in industrial workplaces.',
          icon: 'engineering',
        },
        {
          title: 'Electric Tool Repair',
          description: 'Professional repair services for heavy-duty electric tools used in automotive, construction, and manufacturing environments.',
          icon: 'power',
        },
        {
          title: 'Tool Maintenance',
          description: 'Preventative maintenance and servicing to extend the life and performance of your pneumatic and electric tools.',
          icon: 'settings',
        },
        {
          title: 'New/Used Tool Sales',
          description: 'Quality new and used industrial tools available for automotive, manufacturing, and construction applications.',
          icon: 'inventory_2',
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
      social: BUSINESS_INFO.social || {},
      socialMedia: [],  // Empty array as default for new dynamic social media
      defaultMarkupPercentage: 30.0,
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
