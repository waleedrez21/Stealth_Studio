// Only the exact company domain qualifies. Similar domains and subdomains do not.
export function approvedCoachEmail(email, coachEmails = []) {
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalized) return false;
  return coachEmails.includes(normalized) || /^[^@\s]+@stealthgpt\.ai$/.test(normalized);
}
