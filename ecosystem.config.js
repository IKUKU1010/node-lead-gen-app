module.exports = {
  apps: [{
    name: 'lead-agent-web',
    script: 'src/server.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_file: 'logs/combined.log',
    time: true,
    
    restart_delay: 4000,
    min_uptime: '10s',
    max_restarts: 10
  }]
};