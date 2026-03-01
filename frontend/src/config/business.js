/**
 * Centralized Business Information Configuration
 *
 * This serves as fallback configuration when SettingsContext API fails.
 * Primary business data is managed through Admin Settings (backend/app/routers/settings.py).
 */

export const BUSINESS_INFO = {
  // Company Details
  name: 'CNS Tools and Repair',
  tagline: 'Expert Pneumatic Tool Repair & Calibration',

  // Contact Information (fallback values)
  phone: '(604) 555-0123',
  phoneLink: '6045550123',
  email: 'info@cnstools.com',

  // Location (fallback values)
  address: {
    street: 'Unit 65, 13335 115 Ave',
    city: 'Surrey',
    province: 'BC',
    postalCode: 'V3R 2X1',
    country: 'Canada',
  },

  // Service Area
  serviceArea: 'Metro Vancouver',

  // Operating Hours
  hours: {
    weekdays: 'Monday - Friday: 8:00 AM - 5:00 PM',
    weekend: 'Saturday - Sunday: Closed',
    timezone: 'PST',
  },

  // Map Configuration
  map: {
    embedUrl: 'https://maps.app.goo.gl/kaFxXdqKxd5fBmSn7',
    directionsUrl: 'https://maps.app.goo.gl/zm4yDK4ZPMYStw6X7',
  },

  // Business Claims
  claims: {
    toolTypesServiced: '20+',
    averageTurnaround: 'Quality',
    responseTime: 'Professional',
    technicians: 'Factory-Trained',
    clientCount: '100+',
  },

  // Industries Served
  industries: ['Automotive', 'Fleet Maintenance', 'Manufacturing', 'Metal Fabrication', 'Construction', 'Oil & Gas'],

  // Social Media (optional)
  social: {
    // facebook: '',
    // linkedin: '',
    // instagram: '',
  },
};

// Helper function to format full address
export const getFullAddress = () => {
  const { street, city, province, postalCode, country } = BUSINESS_INFO.address;
  return `${street}${postalCode ? ', ' + postalCode : ''}, ${city}, ${province}, ${country}`;
};

// Helper function to format hours for display
export const getFormattedHours = () => {
  return `${BUSINESS_INFO.hours.weekdays} ${BUSINESS_INFO.hours.timezone}`;
};
