import { safeGet, cleanText, logger } from '../utils/helpers.js';
import * as cheerio from 'cheerio';
import { Lead } from '../types.js';

export class YelpScraper {
  constructor() {
    this.baseUrl = 'https://www.yelp.com/search';
  }

  async search(query, location = 'New York, NY', pages = 2) {
    const leads = [];

    for (let page = 0; page < pages; page++) {
      const response = await safeGet(this.baseUrl, {
        find_desc: query,
        find_loc: location,
        start: page * 10
      });

      if (!response) break;

      const $ = cheerio.load(response.data);
      
      // Parse JSON-LD structured data
      const scripts = $('script[type="application/ld+json"]');
      
      for (const script of scripts) {
        try {
          const scriptContent = $(script).html() || '';
          let data;
          
          try {
            data = JSON.parse(scriptContent);
          } catch {
            continue;
          }

          if (Array.isArray(data)) {
            for (const item of data) {
              const lead = this._parseJsonLd(item);
              if (lead) {
                leads.push(lead);
              }
            }
          } else {
            const lead = this._parseJsonLd(data);
            if (lead) {
              leads.push(lead);
            }
          }
        } catch (error) {
          // Skip invalid JSON
        }
      }

      logger.info(`Yelp page ${page + 1}: accumulated ${leads.length} leads so far`);
    }

    return leads;
  }

  _parseJsonLd(data) {
    try {
      const type = data['@type'];
      if (!type || !['LocalBusiness', 'Restaurant', 'Store', 'Organization'].includes(type)) {
        return null;
      }

      const address = data.address || {};
      const phone = data.telephone || '';
      const website = data.url || '';

      return new Lead({
        company: cleanText(data.name || ''),
        phone: cleanText(phone),
        address: cleanText(address.streetAddress || ''),
        city: cleanText(address.addressLocality || ''),
        state: cleanText(address.addressRegion || ''),
        country: cleanText(address.addressCountry || ''),
        website: website || '',
        source: 'Yelp',
        confidence: phone ? 'medium' : 'low'
      });
    } catch (error) {
      return null;
    }
  }
}