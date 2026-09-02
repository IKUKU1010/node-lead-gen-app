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
git clone https://github.com/IKUKU1010/node-lead-gen-app.git

or

git config --global http.version HTTP/1.1
git clone https://github.com/IKUKU1010/node-lead-gen-app.git

# Step 1: Install dependencies

cd /var/www/lead-agent-web
npm install

# Step 2: Configure .env

cp .env.example .env
nano .env  # Add your API keys

# Step 3: Create directories if not existing

mkdir -p logs backups

# Step 4: Start with PM2

pm2 start ecosystem.config.js

# Step 5: Check status

pm2 status

# Step 6: View logs

pm2 logs lead-agent-web

# Step 7: Access in browser

# Open your browser and go to: http://your-server-ip:3000