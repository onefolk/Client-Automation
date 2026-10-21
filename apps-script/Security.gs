/**
 * OneFolk Outreach OS — Security, Identity & Authentication Layer
 * Bound Google Apps Script for Spreadsheet: 1U3JxQUcxSyqfZySnHNdLIwExtr3ikfcYlj0a3YY7ATM
 */

const DEFAULT_AUTHORIZED_ADMINS = [
  'contact.onefolk@gmail.com',
  'giridharane01@gmail.com'
];

/**
 * Returns the list of authorized administrator email addresses.
 */
function getAuthorizedAdmins() {
  const custom = getProp('AUTHORIZED_ADMINS');
  if (!custom) {
    return DEFAULT_AUTHORIZED_ADMINS;
  }
  return custom.split(',').map(s => normalizeKey(s)).filter(Boolean);
}

/**
 * Verifies whether an email belongs to an authorized OneFolk administrator.
 */
function isAuthorizedAdmin(email) {
  if (!email) return false;
  const normalized = normalizeKey(email);
  const admins = getAuthorizedAdmins();
  return admins.includes(normalized);
}

/**
 * Retrieves the authenticated Google user email from current session.
 * Checks both getActiveUser() and getEffectiveUser() as a fallback.
 */
function getAuthenticatedUserEmail() {
  try {
    const active = Session.getActiveUser().getEmail();
    if (active) return normalizeKey(active);
  } catch (e) {
    Logger.log('getActiveUser error: ' + e);
  }
  try {
    const effective = Session.getEffectiveUser().getEmail();
    if (effective) return normalizeKey(effective);
  } catch (e) {
    Logger.log('getEffectiveUser error: ' + e);
  }
  return '';
}

/**
 * Strict server-side authorization barrier. Throws error if user is unauthorized.
 */
function assertAuthorizedAdmin() {
  const email = getAuthenticatedUserEmail();
  if (!email || !isAuthorizedAdmin(email)) {
    throw new Error('Access Denied: Google account [' + (email || 'anonymous') + '] is not authorized to access OneFolk Outreach OS.');
  }
  return email;
}

/**
 * Sanitizes cell input to prevent CSV/Spreadsheet formula injection.
 */
function sanitizeCellValue(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/^[=+\-@\t\r]/.test(s)) {
    return "'" + s;
  }
  return s;
}

/**
 * Escapes HTML characters for safe rendering.
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
