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
    street: 'Surrey, BC, Canada',
    city: 'Surrey',
    province: 'BC',
    postalCode: '',
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
    embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d83327.28123825047!2d-122.90733839999999!3d49.1913462!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x5485d9c5644e2a21%3A0x9a1b6a0c0c5e5e5e!2sSurrey%2C%20BC!5e0!3m2!1sen!2sca!4v1234567890',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=Surrey,BC,Canada',
  },

  // Business Claims
  claims: {
    toolTypesServiced: '20+',
    averageTurnaround: '3-7 Day',
    responseTime: 'Same-day',
    technicians: 'Factory-Trained',
    clientCount: '100+',
  },

  // Industries Served
  industries: ['Automotive', 'Railway', 'Construction', 'Manufacturing'],

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
