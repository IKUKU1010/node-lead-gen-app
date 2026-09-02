import { config } from '../config.js';
import { logger, extractDomain } from '../utils/helpers.js';
import axios from 'axios';
import { Lead } from '../types.js';

/**
 * Apify Enricher - Uses Apify actors to enrich lead data
 * 
 * Available Apify Actors for lead generation:
 * 1. Google Maps Scraper - Find businesses with contact info
 * 2. Email Finder - Find emails for domains
 * 3. LinkedIn Contact Scraper - Get professional contact info
 * 4. Company Enrichment - Get detailed company information
 */
export class ApifyEnricher {
  constructor() {
    this.apiKey = config.apifyApiKey;
    this.baseUrl = 'https://api.apify.com/v2';
    
    // Default actor IDs (you can replace with your own or use the official ones)
    // These are examples - you'll need to get the actual actor IDs from Apify
    this.actors = {
      googleMaps: 'moJRLRc6A4Hk5sXJ4', // Example Google Maps Scraper actor
      emailFinder: 'T6bJZ6wR1s7QZ3Y0', // Example Email Finder actor
      companyEnrichment: 'K9vX5qM2pL8nR4s6' // Example Company Enrichment actor
    };
  }

  /**
   * Enrich a lead using Apify actors
   */
  async enrich(lead) {
    if (!this.apiKey) {
      logger.debug('Apify: no API key configured — skipping');
      return lead;
    }

    try {
      // 1. If we have a website, try to find emails
      if (lead.website) {
        const enriched = await this._enrichWithEmailFinder(lead);
        if (enriched) {
          lead = enriched;
        }
      }

      // 2. If we have a company name, try to enrich company data
      if (lead.company && (!lead.email || !lead.phone)) {
        const enriched = await this._enrichWithCompanyData(lead);
        if (enriched) {
          lead = enriched;
        }
      }

      // 3. If we have location data, try Google Maps enrichment
      if (lead.company && (lead.city || lead.address)) {
        const enriched = await this._enrichWithGoogleMaps(lead);
        if (enriched) {
          lead = enriched;
        }
      }

      return lead;
    } catch (error) {
      logger.error(`Apify enrichment failed: ${error.message}`);
      return lead;
    }
  }

  /**
   * Use Email Finder actor to find emails for a domain
   */
  async _enrichWithEmailFinder(lead) {
    const domain = extractDomain(lead.website);
    if (!domain) return null;

    logger.info(`Apify: Searching emails for domain ${domain}`);

    try {
      const response = await this._runActor(this.actors.emailFinder, {
        domain: domain,
        limit: 3
      });

      if (response && response.emails && response.emails.length > 0) {
        const email = response.emails[0];
        if (!lead.email) {
          lead.email = email.email || '';
        }
        if (!lead.fullName && email.name) {
          lead.fullName = email.name;
        }
        if (!lead.title && email.title) {
          lead.title = email.title;
        }
        if (lead.email && (lead.phone || lead.fullName)) {
          lead.confidence = 'high';
        }
        lead.apifyData.emailFinder = response;
        return lead;
      }
    } catch (error) {
      logger.debug(`Apify Email Finder error: ${error.message}`);
    }

    return null;
  }

  /**
   * Use Company Enrichment actor to get company details
   */
  async _enrichWithCompanyData(lead) {
    logger.info(`Apify: Enriching company data for ${lead.company}`);

    try {
      const response = await this._runActor(this.actors.companyEnrichment, {
        companyName: lead.company,
        domain: lead.website ? extractDomain(lead.website) : undefined
      });

      if (response) {
        if (!lead.phone && response.phone) {
          lead.phone = response.phone;
        }
        if (!lead.address && response.address) {
          lead.address = response.address;
        }
        if (!lead.city && response.city) {
          lead.city = response.city;
        }
        if (!lead.state && response.state) {
          lead.state = response.state;
        }
        if (!lead.country && response.country) {
          lead.country = response.country;
        }
        if (lead.phone && lead.email) {
          lead.confidence = 'high';
        }
        lead.apifyData.companyData = response;
        return lead;
      }
    } catch (error) {
      logger.debug(`Apify Company Enrichment error: ${error.message}`);
    }

    return null;
  }

  /**
   * Use Google Maps Scraper actor to find business details
   */
  async _enrichWithGoogleMaps(lead) {
    const location = lead.city || lead.address || 'United States';
    logger.info(`Apify: Searching Google Maps for ${lead.company} in ${location}`);

    try {
      const response = await this._runActor(this.actors.googleMaps, {
        searchString: `${lead.company} ${location}`,
        maxResults: 1
      });

      if (response && response.results && response.results.length > 0) {
        const result = response.results[0];
        if (!lead.phone && result.phone) {
          lead.phone = result.phone;
        }
        if (!lead.address && result.address) {
          lead.address = result.address;
        }
        if (!lead.city && result.city) {
          lead.city = result.city;
        }
        if (!lead.website && result.website) {
          lead.website = result.website;
        }
        if (lead.phone && lead.email) {
          lead.confidence = 'high';
        }
        lead.apifyData.googleMaps = response;
        return lead;
      }
    } catch (error) {
      logger.debug(`Apify Google Maps error: ${error.message}`);
    }

    return null;
  }

  /**
   * Run an Apify actor with given input
   */
  async _runActor(actorId, input) {
    try {
      // Start the actor run
      const startResponse = await axios.post(
        `${this.baseUrl}/acts/${actorId}/runs`,
        {
          input: input,
          contentType: 'application/json',
          build: 'latest'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: config.timeout
        }
      );

      const runId = startResponse.data.data.id;
      
      // Wait for the run to complete
      const run = await this._waitForRun(runId);
      
      if (run && run.status === 'SUCCEEDED') {
        // Fetch the output
        const outputResponse = await axios.get(
          `${this.baseUrl}/acts/${actorId}/runs/${runId}/dataset/items`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`
            },
            timeout: config.timeout
          }
        );

        return outputResponse.data.length > 0 ? outputResponse.data[0] : null;
      }

      return null;
    } catch (error) {
      logger.debug(`Apify actor run error: ${error.message}`);
      return null;
    }
  }

  /**
   * Wait for an actor run to complete
   */
  async _waitForRun(runId, maxAttempts = 30) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/runs/${runId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`
            },
            timeout: config.timeout
          }
        );

        const status = response.data.data.status;
        if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'ABORTED') {
          return response.data.data;
        }

        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        logger.debug(`Error checking run status: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return null;
  }
}