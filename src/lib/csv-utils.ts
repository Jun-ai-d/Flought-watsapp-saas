export const extractPhoneFromRow = (row: any): string => {
  const keys = Object.keys(row);
  
  // 1. Check for recognizable phone-related column headers
  const headerMatch = keys.find(k => {
    const lower = k.toLowerCase();
    return lower === 'phone' || lower.includes('phone') || lower.includes('mobile') || lower.includes('whatsapp') || lower.includes('cell');
  });
  
  if (headerMatch && row[headerMatch]) {
    return String(row[headerMatch]).trim();
  }

  // 2. Fallback: Search all values in the row for something that resembles a phone number
  for (const k of keys) {
    const val = String(row[k]).trim();
    const strippedVal = val.replace(/[\s\-(\)+x.]/g, ''); // Remove spaces, hyphens, parens, +, x, dots
    
    // If it has between 8 and 20 digits, it's likely a phone number
    if (strippedVal.length >= 8 && strippedVal.length <= 20 && /^\d+$/.test(strippedVal)) {
      return val;
    }

    // Edge case: If the CSV had no headers, PapaParse uses the first row's data as the keys.
    // So the key itself might be the phone number (for the first row) or row[k] for subsequent rows.
    const strippedKey = k.replace(/[\s\-(\)+x.]/g, '');
    if (strippedKey.length >= 8 && strippedKey.length <= 20 && /^\d+$/.test(strippedKey)) {
       return val; 
    }
  }
  
  return '';
};

export const extractNameFromRow = (row: any): string => {
  const keys = Object.keys(row);
  
  // 1. Check for recognizable name-related column headers
  const headerMatch = keys.find(k => {
    const lower = k.toLowerCase();
    return lower === 'name' || lower.includes('name') || lower.includes('first') || lower.includes('customer');
  });
  
  if (headerMatch && row[headerMatch]) {
    return String(row[headerMatch]).trim();
  }

  // 2. Fallback: just grab the first column value that has text (letters) and isn't a number
  for (const k of keys) {
    const val = String(row[k]).trim();
    if (val && /[a-zA-Z]{2,}/.test(val) && !/\d{5,}/.test(val)) {
      return val;
    }
  }
  
  return 'Unknown Customer';
};

/**
 * Validates if a phone number matches international WhatsApp format.
 * - Must start with an optional '+'
 * - Must contain only digits after the '+'
 * - Must be between 8 and 15 digits long
 */
export const isValidWhatsAppFormat = (phone: string): boolean => {
  if (!phone) return false;
  const stripped = phone.replace(/[\s\-(\).]/g, ''); // Allow stripping standard visual separators
  return /^\+?[1-9]\d{7,14}$/.test(stripped);
};
