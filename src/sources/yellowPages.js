import { safeGet, cleanText, logger } from '../utils/helpers.js';
import * as cheerio from 'cheerio';
import { Lead } from '../types.js';

export class YellowPagesScraper {
  constructor() {
    this.baseUrl = 'https://www.yellowpages.com/search';
  }

  async search(query, location = 'United States', pages = 2) {
    const leads = [];

    for (let page = 1; page <= pages; page++) {
      const response = await safeGet(this.baseUrl, {
        search_terms: query,
        geo_location_terms: location,
        page: page
      });

      if (!response) break;

      const $ = cheerio.load(response.data);
      const cards = $('div.result');

      if (cards.length === 0) {
        logger.info(`YellowPages: no more results on page ${page}`);
        break;
      }

      for (const card of cards) {
        const lead = this._parseCard($, card);
        if (lead) {
          leads.push(lead);
        }
      }

      logger.info(`YellowPages page ${page}: found ${cards.length} listings`);
    }

    return leads;
  }

  _parseCard($, card) {
    try {
      const nameEl = $(card).find('.business-name span');
      const name = cleanText(nameEl.text());

      const phoneEl = $(card).find('.phones.phone.primary');
      const phone = cleanText(phoneEl.text());

      const addressEl = $(card).find('.street-address');
      const address = cleanText(addressEl.text());

      const cityEl = $(card).find('.locality');
      const city = cleanText(cityEl.text());

      const websiteTag = $(card).find('a.track-visit-website');
      const website = websiteTag.attr('href') || '';

      if (!name) return null;

      return new Lead({
        company: name,
        phone: phone || '',
        address: address || '',
        city: city || '',
        website: website || '',
        source: 'YellowPages',
        confidence: phone ? 'medium' : 'low'
      });
    } catch (error) {
      logger.debug(`YellowPages parse error: ${error.message}`);
      return null;
    }
  }
}