import { logger } from './utils/logger.js';
import { Deduplicator } from './utils/deduplicator.js';
import { Lead } from './types.js';
import { GoogleSearchSource } from './sources/googleSearch.js';
import { YellowPagesScraper } from './sources/yellowPages.js';
import { YelpScraper } from './sources/yelp.js';
import { WebsiteContactScraper } from './sources/websiteContact.js';
import { ApifyEnricher } from './enrichers/apifyEnricher.js';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';

export class LeadGenAgent {
  constructor(config) {
    this.config = config;
    this.deduplicator = new Deduplicator();
    this.google = new GoogleSearchSource();
    this.yp = new YellowPagesScraper();
    this.yelp = new YelpScraper();
    this.web = new WebsiteContactScraper();
    this.apify = new ApifyEnricher();
    this.allLeads = [];
    this.outputFile = `leads_${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}.csv`;
  }

  async run() {
    const { query, location = 'United States' } = this.config;

    logger.info('='.repeat(60));
    logger.info('Lead Gen Agent starting');
    logger.info(`Query    : ${query}`);
    logger.info(`Location : ${location}`);
    logger.info('='.repeat(60));

    // Step 1: Scrape directories
    logger.info('[ Step 1 ] Scraping Yellow Pages...');
    const ypLeads = await this.yp.search(query, location, this.config.ypPages || 2);
    await this._processLeads(ypLeads, true);

    logger.info('[ Step 1 ] Scraping Yelp...');
    const yelpLeads = await this.yelp.search(query, location, this.config.yelpPages || 2);
    await this._processLeads(yelpLeads, true);

    // Step 2: Web search → visit contact pages
    logger.info('[ Step 2 ] Running web search for company sites...');
    const searchQuery = `${query} company contact email site:.com`;
    const urls = await this.google.search(searchQuery, this.config.searchResults || 15);

    for (const url of urls) {
      const lead = await this.web.scrape(url);
      await this._processLeads([lead], true);
    }

    // Step 3: Final report
    const valid = this.allLeads.filter(lead => lead.isValid());
    
    logger.info('='.repeat(60));
    logger.info('Run complete.');
    logger.info(`Total leads collected : ${this.allLeads.length}`);
    logger.info(`Valid leads (with contact) : ${valid.length}`);
    logger.info(`High confidence : ${valid.filter(l => l.confidence === 'high').length}`);
    logger.info(`Medium confidence : ${valid.filter(l => l.confidence === 'medium').length}`);
    logger.info('='.repeat(60));

    await this._saveLeads(valid);
    console.log(`\n✅ Done! ${valid.length} leads saved to: ${this.outputFile}`);
    return valid;
  }

  async _processLeads(leads, enrich) {
    for (const lead of leads) {
      if (this.deduplicator.isDuplicate(lead)) {
        logger.debug(`Duplicate skipped: ${lead.company} / ${lead.email}`);
        continue;
      }

      let processedLead = lead;

      if (enrich) {
        // Use Apify enrichment
        processedLead = await this.apify.enrich(lead);
      }

      this.deduplicator.register(processedLead);
      this.allLeads.push(processedLead);
      
      logger.info(
        `✔ ${processedLead.company || 'N/A'} | ${processedLead.fullName || 'N/A'} | ${processedLead.email || 'N/A'} | ${processedLead.phone || 'N/A'}`
      );
    }
  }

  async _saveLeads(leads) {
    const headers = [
      'full_name', 'company', 'title', 'email', 'phone',
      'address', 'city', 'state', 'country', 'website',
      'source', 'confidence'
    ];

    const csvLines = [];
    csvLines.push(headers.join(','));

    for (const lead of leads) {
      const row = headers.map(h => {
        const value = lead.toJSON()[h] || '';
        // Escape commas and quotes
        return `"${value.replace(/"/g, '""')}"`;
      });
      csvLines.push(row.join(','));
    }

    await fs.writeFile(this.outputFile, csvLines.join('\n'), 'utf8');
    logger.info(`Saved ${leads.length} leads to ${this.outputFile}`);
  }
}