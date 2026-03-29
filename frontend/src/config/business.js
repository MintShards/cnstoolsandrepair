/**
 * Centralized Business Information Configuration
 *
 * This serves as fallback configuration when SettingsContext API fails.
 * Primary business data is managed through Admin Settings (backend/app/routers/settings.py).
 */

export const BUSINESS_INFO = {
  // Company Details
  name: 'CNS Tool Repair',
  tagline: 'Expert Pneumatic Tool Repair & Maintenance',

  // Contact Information (fallback values)
  phone: '(604) 581-8930',
  phoneLink: '6045818930',
  email: 'contact@cnstoolrepair.com',

  // Location (fallback values)
  address: {
    street: 'Unit 65 13335 115 Ave',
    city: 'Surrey',
    province: 'BC',
    postalCode: 'V3R 0R8',
    country: 'Canada',
  },

  // Service Area
  serviceArea: 'Metro Vancouver',

  // Operating Hours
  hours: {
    weekdays: 'Monday - Friday: 9:00 AM - 4:00 PM',
    weekend: 'Saturday - Sunday: Closed',
    timezone: 'PST',
  },

  // Map Configuration
  map: {
    embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d20858.147554763895!2d-122.8638754307069!3d49.195466912791005!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x5485d7823fdd1005%3A0xe9d616f8891ef184!2sCNS%20Tools%20And%20Repair!5e0!3m2!1sen!2sca!4v1772435502604!5m2!1sen!2sca',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=CNS+Tools+And+Repair,13335+115+Ave,Surrey,BC+V3R+2X1',
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
