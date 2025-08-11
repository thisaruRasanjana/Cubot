#!/bin/bash

# Stop any existing nginx processes
sudo pkill nginx 2>/dev/null || true

# Start nginx with our custom configuration
sudo nginx -c "/Users/thisaruramanayake/Downloads/cubot web/nginx-config/nginx.conf" -g "daemon off;"
