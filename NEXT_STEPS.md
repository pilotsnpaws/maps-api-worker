# Next Steps - Volunteer Map Implementation

## ✅ What's Been Completed

1. **API Endpoint**: Added `/volunteers` endpoint with filtering support
2. **Static Assets**: Enabled Cloudflare Workers Assets serving
3. **Frontend**: Created modern volunteer map with:
   - Responsive HTML interface
   - Modern Google Maps JavaScript API implementation
   - Marker clustering for performance
   - Real-time filtering controls
   - Visible volunteers list with copy-to-clipboard
4. **Assets**: Created SVG marker icons for different volunteer types
5. **Monorepo Structure**: Combined API and frontend in single deployable worker

## 🚀 Before You Can Test

### 1. Configure Google Maps API Key

**To get a Google Maps API key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. Enable "Maps JavaScript API"
4. Create credentials → API key
5. Restrict the key (optional but recommended):
   - Application restrictions: HTTP referrers
   - API restrictions: Maps JavaScript API

**Set the API key as an environment variable:**

For local development:
```bash
export GOOGLE_MAPS_API_KEY="your_actual_api_key_here"
```

For production deployment:
```bash
# Use Cloudflare secrets (recommended)
wrangler secret put GOOGLE_MAPS_API_KEY

# OR uncomment in wrangler.jsonc vars section (not recommended for production)
```

### 2. Verify Database Schema

The `/volunteers` endpoint queries these tables:
- `prod_forum.phpbb_users` (user data)
- `prod_forum.phpbb_profile_fields_data` (profile fields)

Expected column names (adjust in `src/index.ts` if different):
- User table: `user_id`, `username`, `user_lastvisit`, `user_type`
- Profile table: `pf_foster`, `pf_pilot`, `pf_flyingRadius`, `pf_airportID`, `pf_airportName`, `pf_zipCode`, `pf_lat`, `pf_lon`, `pf_city`, `pf_state`

If your column names differ, update lines 140-154 in `src/index.ts`.

### 3. Set Up Environment Variables for Local Development

```bash
# Google Maps API key (required)
export GOOGLE_MAPS_API_KEY="your_google_maps_api_key_here"

# Database connection (optional)
# Only set this if you want to use a local MySQL database
# If not set, wrangler dev will use Hyperdrive to connect to the remote database
# export WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="mysql://user:password@host:3306/database"
```

**Note**: Since the data is read-only, you can safely use the remote database via Hyperdrive for local development by omitting the `WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` variable.

## 🧪 Testing Locally

### 1. Start the development server:
```bash
npm run dev
```

### 2. Test the API endpoint:
```bash
# Test volunteers API
curl "http://localhost:8787/volunteers?lastVisitAge=365&typesToShow=all"

# Test with filtering
curl "http://localhost:8787/volunteers?lastVisitAge=90&typesToShow=pilots"
```

### 3. Test the map interface:
1. Open browser to `http://localhost:8787/`
2. Verify map loads
3. Check that markers appear
4. Test filtering controls:
   - Last Visit dropdown
   - Volunteer Type radio buttons
   - Click "Update Map" button
5. Pan/zoom the map
6. Verify "Visible Volunteers" list updates
7. Test "Copy Usernames" button

### 4. Check browser console for errors:
- Open DevTools (F12)
- Look for JavaScript errors
- Verify API calls succeed in Network tab

## 🐛 Troubleshooting

### Map doesn't load
- **Check**: Google Maps API key is set correctly
- **Check**: Browser console for errors
- **Check**: Network tab shows successful API key fetch

### No markers appear
- **Check**: `/volunteers` API returns data
- **Check**: Database connection is working
- **Check**: Users have `pf_lat` and `pf_lon` values

### Markers cluster incorrectly
- **Check**: MarkerClusterer CDN loaded successfully
- **Check**: Browser console for clustering errors

### Database query errors
- **Check**: Table/column names match your schema
- **Check**: MySQL connection string is correct
- **Check**: User has SELECT permissions

## 📦 Deployment

### 1. Set production secrets:
```bash
# Set Google Maps API key (do this before first deployment)
wrangler secret put GOOGLE_MAPS_API_KEY
# You'll be prompted to enter the key
```

### 2. Test production build locally:
```bash
npx wrangler dev --remote
```

### 3. Deploy to Cloudflare:
```bash
npm run deploy
```

### 4. Verify production:
- Visit your worker URL (e.g., `https://maps-api.your-subdomain.workers.dev/`)
- Check browser console - you should NOT see "Google Maps API key not configured" error
- Test all map functionality
- Check that Hyperdrive connection works

## 🔄 Migration from Old PHP Map

### Differences from old implementation:

**Old (PHP)**:
- XML data format from `maps_create_volunteer_locations_xml.php`
- Legacy Google Maps API
- jQuery for DOM manipulation
- Separate PHP backend

**New (Worker)**:
- JSON REST API from `/volunteers` endpoint
- Modern Google Maps JavaScript API
- Vanilla JavaScript (no jQuery)
- Integrated API + frontend in one worker

### Data format changes:

The API returns JSON instead of XML:
```json
[
  {
    "userID": 123,
    "username": "pilot123",
    "lastVisit": 1706486400,
    "lastVisitHuman": "2024-01-28 10:00:00",
    "foster": 1,
    "pilot": 1,
    "flyingRadius": 500,
    "airportID": "KJFK",
    "airportName": "John F Kennedy International",
    "zip": "11430",
    "lat": 40.6413,
    "lon": -73.7781,
    "city": "Jamaica",
    "state": "NY"
  }
]
```

## 📝 Optional Enhancements

Consider adding these features later:

1. **Distance filtering**: Implement zip code + distance filtering (requires geocoding)
2. **Advanced clustering**: Customize cluster styles
3. **User profiles**: Click marker to see full volunteer profile
4. **Export functionality**: Export visible volunteers to CSV
5. **Map layers**: Toggle different volunteer types as map layers
6. **Search**: Search for specific volunteers by username
7. **Analytics**: Track map usage with Cloudflare Analytics
8. **Caching**: Add caching headers for better performance

## 🔐 Security Considerations

1. **API Rate Limiting**: Consider adding rate limiting to prevent abuse
2. **CORS**: Currently set to `*` - restrict in production if needed
3. **Data Privacy**: Ensure volunteer location data is appropriate to display publicly
4. **API Key**: Use domain restrictions for Google Maps API key

## 📚 Additional Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript)
- [MarkerClusterer Docs](https://googlemaps.github.io/js-markerclusterer/)
- [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/)
