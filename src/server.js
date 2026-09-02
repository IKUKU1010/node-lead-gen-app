import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import { LeadGenAgent } from './orchestrator.js';
import { logger } from './utils/logger.js';
import { config } from './config.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'lead-agent-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Routes
app.get('/', (req, res) => {
  res.render('dashboard', {
    title: 'Lead Generation Agent',
    config: {
      defaultLocation: config.defaultLocation || 'United States',
      apifyKeyConfigured: !!config.apifyApiKey
    }
  });
});

app.get('/api/status', async (req, res) => {
  try {
    const files = fs.readdirSync('.')
      .filter(f => f.startsWith('leads_') && f.endsWith('.csv'))
      .sort()
      .reverse();
    
    const latestLeadFile = files.length > 0 ? files[0] : null;
    let latestLeads = [];
    
    if (latestLeadFile) {
      const content = fs.readFileSync(latestLeadFile, 'utf8');
      const lines = content.split('\n');
      if (lines.length > 1) {
        const headers = lines[0].split(',');
        latestLeads = lines.slice(1, 11)
          .filter(line => line.trim())
          .map(line => {
            const values = line.split(',');
            const obj = {};
            headers.forEach((h, i) => {
              obj[h.trim()] = values[i] ? values[i].replace(/^"|"$/g, '') : '';
            });
            return obj;
          });
      }
    }
    
    res.json({
      success: true,
      latestLeadFile,
      leadsCount: latestLeads.length,
      latestLeads,
      config: {
        apifyConfigured: !!config.apifyApiKey,
        googleConfigured: !!(config.googleApiKey && config.googleCx)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/run', async (req, res) => {
  const { query, location, ypPages, yelpPages, searchResults } = req.body;
  
  if (!query) {
    return res.status(400).json({ success: false, error: 'Query is required' });
  }
  
  // Create a run ID
  const runId = Date.now().toString();
  req.session.runId = runId;
  
  // Start the agent asynchronously
  runAgent(runId, {
    query,
    location: location || 'United States',
    ypPages: parseInt(ypPages) || 2,
    yelpPages: parseInt(yelpPages) || 2,
    searchResults: parseInt(searchResults) || 15
  });
  
  res.json({ success: true, runId });
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
  logger.info('Client connected to socket');
  
  socket.on('join', (runId) => {
    socket.join(`run-${runId}`);
    logger.info(`Client joined run-${runId}`);
  });
  
  socket.on('disconnect', () => {
    logger.info('Client disconnected');
  });
});

async function runAgent(runId, options) {
  const agent = new LeadGenAgent(options);
  const socket = io;
  
  // Override logger to emit socket events
  const originalInfo = logger.info;
  const originalError = logger.error;
  
  logger.info = function(...args) {
    originalInfo.apply(logger, args);
    socket.to(`run-${runId}`).emit('log', {
      type: 'info',
      message: args.join(' '),
      timestamp: new Date().toISOString()
    });
  };
  
  logger.error = function(...args) {
    originalError.apply(logger, args);
    socket.to(`run-${runId}`).emit('log', {
      type: 'error',
      message: args.join(' '),
      timestamp: new Date().toISOString()
    });
  };
  
  try {
    const leads = await agent.run();
    socket.to(`run-${runId}`).emit('complete', {
      success: true,
      leads: leads.map(l => l.toJSON()),
      filename: agent.outputFile,
      count: leads.length
    });
  } catch (error) {
    logger.error(`Run failed: ${error.message}`);
    socket.to(`run-${runId}`).emit('complete', {
      success: false,
      error: error.message
    });
  }
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Lead Generation Agent Web UI running on http://localhost:${PORT}`);
  console.log(`\n🌐 Open in browser: http://localhost:${PORT}`);
  console.log(`📊 Dashboard available at http://localhost:${PORT}`);
});