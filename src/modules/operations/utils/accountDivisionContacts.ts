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
