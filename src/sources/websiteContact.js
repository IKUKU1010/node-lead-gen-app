import { safeGet, cleanText, extractEmails, extractPhones, logger, extractDomain } from '../utils/helpers.js';
import * as cheerio from 'cheerio';
import { Lead } from '../types.js';

export class WebsiteContactScraper {
  constructor() {
    this.contactPaths = ['/contact', '/contact-us', '/about', '/about-us', '/team'];
  }

  async scrape(baseUrl) {
    const lead = new Lead({
      website: baseUrl,
      source: 'Website',
      confidence: 'low'
    });

    const urlsToTry = [baseUrl, ...this.contactPaths.map(p => baseUrl.replace(/\/$/, '') + p)];

    for (const url of urlsToTry) {
      const response = await safeGet(url);
      if (!response) continue;

      const $ = cheerio.load(response.data);
      const text = $('body').text();

      const emails = extractEmails(text);
      const phones = extractPhones(text);

      // Skip generic/noreply emails
      const realEmails = emails.filter(e => 
        !['noreply', 'no-reply', 'support@', 'info@'].some(x => e.toLowerCase().includes(x))
      );

      if (realEmails.length > 0) {
        lead.email = realEmails[0];
        lead.confidence = 'medium';
      } else if (emails.length > 0) {
        lead.email = emails[0];
      }

      if (phones.length > 0 && !lead.phone) {
        lead.phone = phones[0];
      }

      // Try schema.org JSON-LD
      const scripts = $('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse($(script).html() || '{}');
          this._extractFromJsonLd(data, lead);
        } catch {
          // Skip invalid JSON
        }
      }

      if (lead.email || lead.phone) {
        if (lead.email && lead.phone) {
          lead.confidence = 'high';
        }
        break; // Found enough information
      }
    }

    return lead;
  }

  _extractFromJsonLd(data, lead) {
    if (!data || typeof data !== 'object') return;

    if (!lead.company && data.name) {
      lead.company = cleanText(data.name);
    }

    if (!lead.phone && data.telephone) {
      lead.phone = cleanText(data.telephone);
    }

    if (!lead.email && data.email) {
      lead.email = cleanText(data.email);
    }

    const address = data.address || {};
    if (typeof address === 'object') {
      if (!lead.address && address.streetAddress) {
        lead.address = cleanText(address.streetAddress);
      }
      if (!lead.city && address.addressLocality) {
        lead.city = cleanText(address.addressLocality);
      }
      if (!lead.state && address.addressRegion) {
        lead.state = cleanText(address.addressRegion);
      }
    }
  }
}