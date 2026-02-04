// Global variables
let map;
let polylines = [];
let infoWindows = [];

// Initialize the map
async function initMap() {
  // Create map centered on US
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 5,
    center: { lat: 39.8283, lng: -98.5795 }, // Center of contiguous US
    mapTypeId: 'terrain',
    mapId: 'DEMO_MAP_ID' // Required for advanced markers
  });

  // Set up event listeners
  document.getElementById('updateBtn').addEventListener('click', loadTrips);

  // Add radio button change listeners
  document.querySelectorAll('input[name="lastPostAge"]').forEach(radio => {
    radio.addEventListener('change', loadTrips);
  });

  // Load initial data
  await loadTrips();
}

// Make initMap global for Google Maps callback
window.initMap = initMap;

// Load trips from API
async function loadTrips() {
  try {
    // Get selected filter
    const lastPostAge = document.querySelector('input[name="lastPostAge"]:checked').value;
    
    // Build API URL with query parameter
    const apiUrl = `/api/trips?updated_last_days=${lastPostAge}`;
    
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
  
  // Create polyline
  const polyline = new google.maps.Polyline({
    path: path,
    geodesic: true,
    strokeColor: strokeColor,
    strokeOpacity: 0.7,
    strokeWeight: 2,
    map: map
  });
  
  // Calculate distance using Google Maps geometry library
  const distance = google.maps.geometry.spherical.computeLength(polyline.getPath());
  const distanceMiles = (distance * 0.000621371).toFixed(0); // meters to miles
  const distanceNM = (distance * 0.000539957).toFixed(0); // meters to nautical miles
  
  // Create info window content
  const contentString = `
    <div style="padding: 10px; max-width: 300px;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px;">
        <a href="https://www.pilotsnpaws.org/forum/viewtopic.php?t=${trip.topic_id}" target="_blank" style="color: #0066cc; text-decoration: none;">
          ${escapeHtml(trip.topic_title)}
        </a>
      </h3>
      <p style="margin: 5px 0; font-size: 12px;">
        <strong>From:</strong> ${escapeHtml(trip.sendCity || trip.pnp_sendZip)}<br>
        <strong>To:</strong> ${escapeHtml(trip.recCity || trip.pnp_recZip)}
      </p>
      <p style="margin: 5px 0; font-size: 12px;">
        <strong>Distance:</strong> ${distanceMiles} miles / ${distanceNM} nm
      </p>
      <p style="margin: 5px 0; font-size: 11px; color: #666;">
        <strong>Last updated:</strong> ${escapeHtml(trip.last_post_human || trip.last_post)}
      </p>
    </div>
  `;
  
  const infoWindow = new google.maps.InfoWindow({
    content: contentString
  });
  
  // Add click listener to show info window at midpoint
  polyline.addListener('click', (event) => {
    // Close all other info windows
    infoWindows.forEach(iw => iw.close());
    
    // Open this info window at click position
    infoWindow.setPosition(event.latLng);
    infoWindow.open(map);
  });
  
  // Store references
  polylines.push(polyline);
  infoWindows.push(infoWindow);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
