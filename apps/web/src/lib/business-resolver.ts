import { memoryStore } from './store';
import { BusinessProfile, Contact } from './types';

export function resolveBusinessProfile(id: string): BusinessProfile | undefined {
  const business = memoryStore.businesses.get(id) as BusinessProfile | undefined;
  if (!business) return undefined;
  const contacts: Contact[] = business.contacts || [];
  const primaryContacts: Contact[] = [];
  for (const [contact_type, value] of [['email', business.email], ['phone', business.phone]]) {
    if (!value || contacts.some((contact) => contact.contact_type === contact_type && contact.value === value)) continue;
    primaryContacts.push({ id: `${id}:${contact_type}`, business_id: id, contact_type: contact_type!,
      value, label: 'primary', confidence: business.confidence, verified: false, created_at: business.created_at });
  }
  return {
    ...business,
    contacts: [...contacts, ...primaryContacts],
    technologies: business.technologies || [],
    facts: business.facts || [],
    opportunities: memoryStore.opportunities.get(id) || [],
    activities: memoryStore.activities.filter((activity) => activity.business_id === id),
  };
}
