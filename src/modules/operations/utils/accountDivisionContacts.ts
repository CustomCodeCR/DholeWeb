type DivisionalContact = { divisionIds: string[] }

/** Unassigned operational contacts belong to the entire CRM account. */
export function contactsForDivision<T extends DivisionalContact>(contacts: T[], divisionId: string): T[] {
  return contacts.filter(contact => !divisionId || !contact.divisionIds.length || contact.divisionIds.includes(divisionId))
}

/** Avoid selecting all divisions' recipients by default until a division is chosen. */
export function defaultDivisionContacts<T extends DivisionalContact>(contacts: T[], divisionId: string, hasDivisions: boolean): T[] {
  const eligible = contactsForDivision(contacts, divisionId)
  return divisionId || !hasDivisions ? eligible : eligible.filter(contact => !contact.divisionIds.length)
}

/** Counts only contacts explicitly assigned to the division; general contacts are separate. */
export function divisionContactCount<T extends DivisionalContact>(contacts: T[], divisionId: string): number {
  return contacts.filter(contact => contact.divisionIds.includes(divisionId)).length
}

/** Groups the eligible directory once per contact, even with multiple memberships. */
export function groupDivisionContacts<T extends DivisionalContact>(contacts: T[], divisionId: string) {
  const division = contacts.filter(contact => contact.divisionIds.length > 0)
  const general = contacts.filter(contact => !contact.divisionIds.length)
  return [
    { key: 'division', label: divisionId ? 'Contactos de la división' : 'Contactos de divisiones', contacts: division },
    { key: 'general', label: 'Contactos generales de la cuenta', contacts: general },
  ].filter(group => group.contacts.length > 0)
}
