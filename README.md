# Lead Generation AI Agent (Node.js + PM2)

A node agent automatically discovers potential clients by searching public business directories and websites, then enriches each lead with verified contact details using third-party APIs

## Features
- Multiple data sources (Yellow Pages, Yelp, Google/DuckDuckGo, websites)
- Apify enrichment for emails and company data
- Automatic deduplication
- CSV export with confidence scoring
- PM2 process management
- Auto-restart on failure
- Logging and monitoring

## Installation

```bash
# Clone or create project directory
mkdir -p /var/www/lead-agent
cd /var/www/lead-agent

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env  # Add your API keys