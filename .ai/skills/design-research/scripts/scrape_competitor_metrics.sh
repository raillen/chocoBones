#!/usr/bin/env sh
URL="https://example.com"
echo "Scraping competitor landing metrics for ..."
curl -sL "" | grep -iEo "<title>[^<]+</title>" || echo "No title tag found"
