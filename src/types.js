export class Lead {
  constructor(data = {}) {
    this.fullName = data.fullName || '';
    this.company = data.company || '';
    this.title = data.title || '';
    this.email = data.email || '';
    this.phone = data.phone || '';
    this.address = data.address || '';
    this.city = data.city || '';
    this.state = data.state || '';
    this.country = data.country || '';
    this.website = data.website || '';
    this.source = data.source || '';
    this.confidence = data.confidence || 'low';
    this.apifyData = data.apifyData || {};
  }

  isValid() {
    const hasIdentity = Boolean(this.fullName || this.company);
    const hasContact = Boolean(this.email || this.phone);
    return hasIdentity && hasContact;
  }

  toJSON() {
    return {
      full_name: this.fullName,
      company: this.company,
      title: this.title,
      email: this.email,
      phone: this.phone,
      address: this.address,
      city: this.city,
      state: this.state,
      country: this.country,
      website: this.website,
      source: this.source,
      confidence: this.confidence
    };
  }
}