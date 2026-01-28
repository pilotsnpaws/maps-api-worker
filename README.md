# Maps API Worker

A Cloudflare Worker that provides REST API endpoints and serves interactive maps for Pilots N Paws volunteer and trip data.

## Features

- **REST API**: Query trip and volunteer data with flexible filtering
- **Interactive Maps**: Modern volunteer location map with real-time filtering
- **Monorepo Architecture**: API and frontend in one deployable unit

## Quick Start

### Local Development

1. Set up environment variables:
```bash
# Google Maps API key (required)
export GOOGLE_MAPS_API_KEY="your_google_maps_api_key_here"

# Database connection (optional - only needed if you want to use a local MySQL database)
# If not set, the worker will use Hyperdrive to connect to the remote database
# export WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="mysql://user:password@host:3306/database"
```

2. Start dev server:
```bash
npm run dev
```

3. Access:
   - Volunteer Map: http://localhost:8787/
   - API: http://localhost:8787/trips or http://localhost:8787/volunteers

## API Endpoints

### GET /trips

Returns trip data from the database.

#### Parameters

- `last_post_before`: Returns trips with a last post date before the specified date
- `last_post_after`: Returns trips with a last post date after the specified date
- `updated_last_days`: Returns trips updated within the specified number of days (default: 3)

#### Example
```bash
curl "http://localhost:8787/trips?updated_last_days=7"
```

### GET /volunteers

Returns volunteer location data with filtering options.

#### Parameters

- `lastVisitAge`: Number of days since last visit (default: 365)
- `typesToShow`: Filter by type - `all`, `pilots`, `fosters`, `both`
- `zipCode`: Filter by zip code (optional)
- `distance`: Distance in miles from zip code (optional)

#### Example
```bash
curl "http://localhost:8787/volunteers?lastVisitAge=90&typesToShow=pilots"
```

## Project Structure

```
maps-api-worker/
├── src/
│   └── index.ts              # API endpoints and routing
├── public/                   # Static assets (served by worker)
│   ├── index.html           # Volunteer map page
│   ├── css/map.css          # Map styling
│   ├── js/volunteer-map.js  # Map logic
│   └── images/              # Marker icons
├── test/
│   └── index.spec.ts        # Tests
└── wrangler.jsonc           # Worker configuration
```

## Deployment

### Set Production Secrets

Before deploying, set the Google Maps API key as a secret:

```bash
# Set as secret (recommended - not visible in wrangler.jsonc)
wrangler secret put GOOGLE_MAPS_API_KEY
# You'll be prompted to enter the key

# OR set in wrangler.jsonc vars (not recommended for sensitive keys)
# Edit wrangler.jsonc and uncomment the GOOGLE_MAPS_API_KEY line
```

### Deploy

```bash
npm run deploy
```

## Technology

- **Runtime**: Cloudflare Workers
- **Database**: MySQL via Cloudflare Hyperdrive
- **Frontend**: Vanilla JavaScript + Google Maps API
- **Clustering**: @googlemaps/markerclusterer (CDN)
- **Testing**: Vitest + @cloudflare/vitest-pool-workers
