#!/bin/bash

# Lead Agent Management Script
# Usage: ./manage.sh {start|stop|restart|status|logs|reload|backup|clean}

APP_NAME="lead-agent"
PROJECT_DIR="/var/www/lead-agent"

cd $PROJECT_DIR

case "$1" in
  start)
    echo "Starting $APP_NAME..."
    pm2 start ecosystem.config.js
    pm2 status $APP_NAME
    ;;
    
  stop)
    echo "Stopping $APP_NAME..."
    pm2 stop $APP_NAME
    ;;
    
  restart)
    echo "Restarting $APP_NAME..."
    pm2 restart $APP_NAME
    ;;
    
  status)
    pm2 status $APP_NAME
    ;;
    
  logs)
    if [ "$2" == "error" ]; then
      pm2 logs $APP_NAME --err --lines 50
    else
      pm2 logs $APP_NAME --lines 50
    fi
    ;;
    
  reload)
    # Reload with new query
    QUERY="$2"
    LOCATION="${3:-United States}"
    YP_PAGES="${4:-2}"
    YELP_PAGES="${5:-2}"
    SEARCH_RESULTS="${6:-15}"
    
    if [ -z "$QUERY" ]; then
      echo "Usage: $0 reload \"query\" [location] [yp-pages] [yelp-pages] [search-results]"
      echo "Example: $0 reload \"digital marketing agency\" \"Miami, FL\" 3 2 20"
      exit 1
    fi
    
    echo "Reloading $APP_NAME with query: $QUERY"
    pm2 stop $APP_NAME
    pm2 start ecosystem.config.js -- \
      -- "$QUERY" \
      --location "$LOCATION" \
      --yp-pages "$YP_PAGES" \
      --yelp-pages "$YELP_PAGES" \
      --search-results "$SEARCH_RESULTS"
    ;;
    
  backup)
    echo "Creating backup..."
    mkdir -p backups
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    tar -czf "backups/leads_${TIMESTAMP}.tar.gz" leads_*.csv logs/*.log 2>/dev/null || echo "No files to backup"
    echo "Backup created: backups/leads_${TIMESTAMP}.tar.gz"
    ;;
    
  clean)
    echo "Cleaning old leads and logs..."
    find . -name "leads_*.csv" -mtime +7 -delete
    find logs -name "*.log" -mtime +30 -delete
    echo "Cleaned files older than 7 days (leads) and 30 days (logs)"
    ;;
    
  *)
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Lead Agent Management Script"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Usage: $0 {command} [options]"
    echo ""
    echo "Commands:"
    echo "  start                    Start the agent with PM2"
    echo "  stop                     Stop the agent"
    echo "  restart                  Restart the agent"
    echo "  status                   Show PM2 status"
    echo "  logs [error]             Show logs (add 'error' for error logs only)"
    echo "  reload \"query\" [location] [yp] [yelp] [search]  Reload with new parameters"
    echo "  backup                   Archive lead files"
    echo "  clean                    Clean old leads and logs"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 reload \"restaurants\" \"Miami, FL\" 3 2 20"
    echo "  $0 logs error"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
    ;;
esac

exit 0