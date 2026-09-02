import { config } from '../config.js';
import { safeGet, logger } from '../utils/helpers.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

export class GoogleSearchSource {
  constructor() {
    this.baseUrl = 'https://www.googleapis.com/customsearch/v1';
  }

  async search(query, num = 10) {
    if (config.googleApiKey && config.googleCx) {
      return this._searchGoogleApi(query, num);
    } else {
      logger.info('No Google API key — falling back to DuckDuckGo HTML search');
      return this._searchDuckDuckGo(query, num);
    }
  }

  async _searchGoogleApi(query, num) {
    const urls = [];
    for (let start = 1; start <= num; start += 10) {
      const response = await safeGet(this.baseUrl, {
        key: config.googleApiKey,
        cx: config.googleCx,
        q: query,
        num: Math.min(10, num - urls.length),
        start: start
      });

      if (!response) break;

      const data = response.data;
      const items = data.items || [];
      for (const item of items) {
        urls.push(item.link);
      }

      if (urls.length >= num) break;
    }

    logger.info(`Google API returned ${urls.length} URLs for query: ${query}`);
    return urls.slice(0, num);
  }

  async _searchDuckDuckGo(query, num) {
    const url = 'https://html.duckduckgo.com/html/';
    const response = await safeGet(url, { q: query });

    if (!response) return [];

    const $ = cheerio.load(response.data);
    const urls = [];

    $('a.result__url').each((_, element) => {
      const href = $(element).attr('href');
      if (href && href.startsWith('http')) {
        urls.push(href);
      }
    });

    const limited = urls.slice(0, num);
    logger.info(`DuckDuckGo returned ${limited.length} URLs for query: ${query}`);
    return limited;
  }
}