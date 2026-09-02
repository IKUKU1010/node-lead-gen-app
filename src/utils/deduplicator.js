export class Deduplicator {
  constructor() {
    this.seenEmails = new Set();
    this.seenPhones = new Set();
    this.seenCompanies = new Set();
  }

  isDuplicate(lead) {
    const keyEmail = lead.email ? lead.email.toLowerCase() : null;
    const keyPhone = lead.phone ? lead.phone.replace(/\D/g, '') : null;
    const keyCompany = lead.company ? lead.company.toLowerCase().trim() : null;

    if (keyEmail && this.seenEmails.has(keyEmail)) return true;
    if (keyPhone && keyPhone.length >= 10 && this.seenPhones.has(keyPhone)) return true;
    if (keyCompany && this.seenCompanies.has(keyCompany)) return true;
    return false;
  }

  register(lead) {
    if (lead.email) {
      this.seenEmails.add(lead.email.toLowerCase());
    }
    if (lead.phone) {
      this.seenPhones.add(lead.phone.replace(/\D/g, ''));
    }
    if (lead.company) {
      this.seenCompanies.add(lead.company.toLowerCase().trim());
    }
  }
}