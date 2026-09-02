import { config } from '../config.js';
import axios from 'axios';
import { logger } from './logger.js';

export const sleep = () => {
  const [min, max] = config.requestDelay;
  const delay = Math.random() * (max - min) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
};

export const safeGet = async (url, params = {}, retries = config.maxRetries) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await sleep();
      const response = await axios.get(url, {
        params,
        headers: config.headers,
        timeout: config.timeout
      });
      return response;
    } catch (error) {
      logger.warn(`Attempt ${attempt}/${retries} failed for ${url}: ${error.message}`);
      if (attempt === retries) {
        logger.error(`Giving up on ${url}`);
        return null;
      }
    }
  }
  return null;
};

export const extractEmails = (text) => {
  const pattern = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(pattern) || [];
  return [...new Set(matches)];
};

export const extractPhones = (text) => {
  const pattern = /(\+?1?\s?)?(\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})/g;
  const matches = text.match(pattern) || [];
  return [...new Set(matches)];
};

export const cleanText = (text) => {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
};

export const extractDomain = (url) => {
  if (!url) return '';
  return url.replace(/https?:\/\/(www\.)?/, '').split('/')[0];
};