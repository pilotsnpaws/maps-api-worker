// Global variables
let map;
let polylines = [];
let infoWindows = [];
let currentInfoWindow = null;

// Global function to close current InfoWindow
function closeInfoWindow() {
  if (currentInfoWindow) {
    currentInfoWindow.close();
    currentInfoWindow = null;
  }
}

// Initialize the map
async function initMap() {
  // Create map centered on US
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 5,
    maxZoom: 16,
    center: { lat: 39.8283, lng: -98.5795 }, // Center of contiguous US
    mapTypeId: 'terrain',
    mapId: 'TRIP_MAP' // Required for advanced markers
  });

  // Position custom controls on the map
  map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(
    document.getElementById('optionsBox')
  );
  map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(
    document.getElementById('legend')
  );

  // Set up event listeners
  document.getElementById('updateBtn').addEventListener('click', loadTrips);

  // Add checkbox change listener for active trips filter
  document.getElementById('showActiveOnly').addEventListener('change', loadTrips);

  // Add radio button change listeners
  document.querySelectorAll('input[name="lastPostAge"]').forEach(radio => {
    radio.addEventListener('change', loadTrips);
  });

  // Add map click listener to close InfoWindow
  map.addListener('click', () => {
    closeInfoWindow();
  });

  // Load initial data
  await loadTrips();
}

// Make initMap global for Google Maps callback
window.initMap = initMap;

// Load trips from API
async function loadTrips() {
  try {
    // Get selected filters
    const lastPostAge = document.querySelector('input[name="lastPostAge"]:checked').value;
    const showActiveOnly = document.getElementById('showActiveOnly').checked;
    
    // Build API URL with query parameters
    let apiUrl = `/api/trips?updated_last_days=${lastPostAge}`;
    if (showActiveOnly) {
      apiUrl += `&trip_status=active`;
    } else {
      apiUrl += `&trip_status=all`;
    }
    
    // Fetch data
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const trips = await response.json();
    console.log(`Loaded ${trips.length} trips`);
    
    // Clear existing polylines and info windows
    clearMap();
    
    // Add trips to map
    trips.forEach(trip => addTripToMap(trip));
    
  } catch (error) {
    console.error('Error loading trips:', error);
    alert('Failed to load trip data. Please try again.');
  }
}

// Clear all polylines and info windows from the map
function clearMap() {
  polylines.forEach(polyline => polyline.setMap(null));
  polylines = [];
  
  infoWindows.forEach(infoWindow => infoWindow.close());
  infoWindows = [];
}

// Calculate bearing between two points (for determining East/West)
function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360; // Normalize to 0-360
}

// Determine if trip is eastbound or westbound
function isEastbound(bearing) {
  // Eastbound: bearing between 45° and 135° (roughly east)
  // or between 315° and 45° (northeast/east/southeast quadrants)
  return (bearing >= 45 && bearing <= 135);
}

// Add a trip to the map
function addTripToMap(trip) {
  // Parse coordinates
  const sendLat = parseFloat(trip.sendLat);
  const sendLon = parseFloat(trip.sendLon);
  const recLat = parseFloat(trip.recLat);
  const recLon = parseFloat(trip.recLon);
  
  // Skip if coordinates are invalid
  if (isNaN(sendLat) || isNaN(sendLon) || isNaN(recLat) || isNaN(recLon)) {
    console.warn('Invalid coordinates for trip:', trip);
    return;
  }
  
  // Create path
  const path = [
    { lat: sendLat, lng: sendLon },
    { lat: recLat, lng: recLon }
  ];
  
  // Calculate bearing and determine direction
  const bearing = calculateBearing(sendLat, sendLon, recLat, recLon);
  const eastbound = isEastbound(bearing);
  
  // Set color based on direction
  // Eastbound: green #00AD6E, Westbound: purple #8D00DE
  const strokeColor = eastbound ? '#00AD6E' : '#8D00DE';
  
  // Create invisible buffer line for easier clicking
  const bufferLine = new google.maps.Polyline({
    path: path,
    geodesic: true,
    strokeColor: '#FFFFFF',
    strokeOpacity: 0.001, // Nearly invisible but still clickable
    strokeWeight: 10, // Wider hit area
    map: map
  });

  // Create visible polyline
  const polyline = new google.maps.Polyline({
    path: path,
    geodesic: true,
    strokeColor: strokeColor,
    strokeOpacity: 0.7,
    strokeWeight: 4, // Increased from 2 to 4 for better visibility
    map: map
  });
  
  // Calculate distance using Google Maps geometry library
  const distance = google.maps.geometry.spherical.computeLength(polyline.getPath());
  const distanceMiles = (distance * 0.000621371).toFixed(0); // meters to miles
  const distanceNM = (distance * 0.000539957).toFixed(0); // meters to nautical miles
  
  // Create info window popup content with compact design
  const statusColor = trip.trip_status === 'Open' ? '#28a745' : 
                      trip.trip_status === 'Filled' ? '#ffc107' : 
                      trip.trip_status === 'Done' ? '#6c757d' : '#666';
  
  const contentString = `
    <div data-testid="trip-popup" style="padding: 0 28px 12px 12px; max-width: 280px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <h3 style="margin: 0 0 4px 0; font-size: 14px; line-height: 1.3;">
        <a data-testid="trip-popup-title" href="https://www.pilotsnpaws.org/forum/viewtopic.php?t=${trip.topic_id}" target="_blank" tabindex="-1" class="trip-popup-title" style="color: #0066cc; text-decoration: none; font-weight: 600;">
          ${escapeHtml(decodeHtmlEntities(trip.topic_title))}
        </a>
        <button onclick="closeInfoWindow()" tabindex="-1" style="float: right; background: none; border: none; font-size: 16px; cursor: pointer; color: #666; padding: 0; margin: 0;">✕</button>
      </h3>
      
      <div data-testid="trip-popup-route" style="display: flex; align-items: center; margin: 8px 0 6px 0; font-size: 12px; color: #333;">
        <span style="font-weight: 500;">${escapeHtml(trip.sendCity || trip.pnp_sendZip)}</span>
        <span style="margin: 0 6px; color: #999;">→</span>
        <span style="font-weight: 500;">${escapeHtml(trip.recCity || trip.pnp_recZip)}</span>
      </div>
      
      <div style="display: flex; align-items: center; gap: 12px; margin: 8px 0; font-size: 11px;">
        <span data-testid="trip-popup-status" style="display: inline-flex; align-items: center; padding: 2px 8px; background: ${statusColor}15; color: ${statusColor}; border-radius: 12px; font-weight: 500;">
          ${escapeHtml(trip.trip_status)}
        </span>
        <span data-testid="trip-popup-distance" style="color: #555;">
          <strong>${distanceMiles}</strong> mi / <strong>${distanceNM}</strong> nm
        </span>
      </div>
      
      <div data-testid="trip-popup-date" style="font-size: 10px; color: #888; margin-top: 6px; border-top: 1px solid #eee; padding-top: 6px;">
        ${escapeHtml(trip.last_post_human || trip.last_post)}
      </div>
    </div>
  `;
  
  const infoWindow = new google.maps.InfoWindow({
    content: contentString
  });
  
  // Add click listener to show info window at midpoint
  const clickHandler = (event) => {
    // Close all other info windows
    infoWindows.forEach(iw => iw.close());
    
    // Track current info window
    currentInfoWindow = infoWindow;
    
    // Open this info window at click position
    infoWindow.setPosition(event.latLng);
    infoWindow.open(map);
  };

  // Attach to both lines for maximum click coverage
  bufferLine.addListener('click', clickHandler);
  polyline.addListener('click', clickHandler);
  
  // Store references
  polylines.push(polyline);
  polylines.push(bufferLine); // Store buffer line for cleanup
  infoWindows.push(infoWindow);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Decode HTML entities (like &amp; to &)
function decodeHtmlEntities(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.innerHTML = text;
  return div.textContent || div.innerText || '';
}
