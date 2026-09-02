let socket = null;
let currentRunId = null;
let logs = [];
let isRunning = false;

// Initialize Socket.IO
const initSocket = () => {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
    });
    
    socket.on('log', (data) => {
        addLog(data);
    });
    
    socket.on('complete', (data) => {
        isRunning = false;
        document.getElementById('runBtn').disabled = false;
        document.getElementById('runBtn').innerHTML = '<span class="btn-icon">▶</span> Start Lead Generation';
        
        const status = document.getElementById('status');
        status.innerHTML = `
            <div class="status-indicator ${data.success ? 'idle' : 'error'}">
                <span class="dot"></span>
                ${data.success ? '✅ Completed successfully!' : '❌ Failed: ' + data.error}
            </div>
        `;
        
        if (data.success && data.leads) {
            displayResults(data.leads, data.filename);
            document.getElementById('leadsCount').textContent = `${data.count} leads found`;
            document.getElementById('totalLeads').textContent = data.count;
            document.getElementById('lastRun').textContent = new Date().toLocaleString();
            
            // Enable download button
            const downloadBtn = document.getElementById('downloadCsvBtn');
            downloadBtn.disabled = false;
            downloadBtn.dataset.filename = data.filename;
        }
    });
};

// Add log entry
const addLog = (data) => {
    const container = document.getElementById('logContainer');
    // Remove placeholder if present
    const placeholder = container.querySelector('.log-placeholder');
    if (placeholder) {
        placeholder.remove();
    }
    
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const timestamp = new Date(data.timestamp).toLocaleTimeString();
    entry.innerHTML = `
        <span class="timestamp">[${timestamp}]</span>
        <span class="level ${data.type}">${data.type.toUpperCase()}</span>
        ${data.message}
    `;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
    
    logs.push(data);
};

// Display results
const displayResults = (leads, filename) => {
    const panel = document.getElementById('resultsPanel');
    panel.style.display = 'block';
    
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = '';
    
    leads.forEach(lead => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${lead.company || 'N/A'}</strong></td>
            <td>${lead.full_name || 'N/A'}</td>
            <td><a href="mailto:${lead.email}">${lead.email || 'N/A'}</a></td>
            <td>${lead.phone || 'N/A'}</td>
            <td><span class="confidence-badge ${lead.confidence}">${lead.confidence}</span></td>
            <td>${lead.source || 'N/A'}</td>
        `;
        tbody.appendChild(tr);
    });
};

// Submit search form
document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (isRunning) return;
    
    const query = document.getElementById('query').value.trim();
    if (!query) {
        alert('Please enter a business type to search for');
        return;
    }
    
    const location = document.getElementById('location').value.trim();
    const ypPages = document.getElementById('ypPages').value;
    const yelpPages = document.getElementById('yelpPages').value;
    const searchResults = document.getElementById('searchResults').value;
    
    // Clear previous logs
    document.getElementById('logContainer').innerHTML = '';
    logs = [];
    document.getElementById('resultsPanel').style.display = 'none';
    
    // Update UI
    isRunning = true;
    document.getElementById('runBtn').disabled = true;
    document.getElementById('runBtn').innerHTML = '<span class="btn-icon">⏳</span> Running...';
    
    const status = document.getElementById('status');
    status.innerHTML = `
        <div class="status-indicator running">
            <span class="dot"></span>
            Running...
        </div>
    `;
    
    try {
        const response = await fetch('/api/run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query,
                location,
                ypPages,
                yelpPages,
                searchResults
            })
        });
        
        const data = await response.json();
        if (data.success) {
            currentRunId = data.runId;
            if (socket) {
                socket.emit('join', currentRunId);
            }
        } else {
            throw new Error(data.error || 'Failed to start agent');
        }
    } catch (error) {
        isRunning = false;
        document.getElementById('runBtn').disabled = false;
        document.getElementById('runBtn').innerHTML = '<span class="btn-icon">▶</span> Start Lead Generation';
        status.innerHTML = `
            <div class="status-indicator error">
                <span class="dot"></span>
                Error: ${error.message}
            </div>
        `;
    }
});

// Download CSV
document.getElementById('downloadCsvBtn').addEventListener('click', function() {
    const filename = this.dataset.filename;
    if (!filename) return;
    
    window.location.href = `/download/${filename}`;
});

// Clear logs
document.getElementById('clearLogsBtn').addEventListener('click', () => {
    document.getElementById('logContainer').innerHTML = '<div class="log-placeholder">Logs cleared</div>';
    logs = [];
});

// Download logs
document.getElementById('downloadLogsBtn').addEventListener('click', () => {
    const logText = logs.map(l => `[${new Date(l.timestamp).toLocaleString()}] ${l.type.toUpperCase()}: ${l.message}`).join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0,19).replace(/:/g, '')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
});

// Load initial status
const loadStatus = async () => {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        if (data.success) {
            // Update status indicators
            document.getElementById('totalLeads').textContent = data.leadsCount || 0;
            
            const apifyStatus = document.getElementById('apifyStatus');
            if (data.config.apifyConfigured) {
                apifyStatus.textContent = '✅ Configured';
                apifyStatus.className = 'status-badge configured';
            } else {
                apifyStatus.textContent = '⚠ Not Configured';
                apifyStatus.className = 'status-badge not-configured';
            }
            
            if (data.latestLeads && data.latestLeads.length > 0) {
                displayResults(data.latestLeads, data.latestLeadFile);
                document.getElementById('leadsCount').textContent = `${data.latestLeads.length} leads found`;
                document.getElementById('lastRun').textContent = new Date().toLocaleString();
                document.getElementById('downloadCsvBtn').dataset.filename = data.latestLeadFile;
            }
        }
    } catch (error) {
        console.error('Failed to load status:', error);
    }
};

// Initialize
initSocket();
loadStatus();

// Poll status every 30 seconds
setInterval(loadStatus, 30000);