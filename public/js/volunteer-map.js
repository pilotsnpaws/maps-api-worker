// Global variables
let map;
let clusterer;
let allMarkers = [];
let infoWindow;
let isInitialLoad = true;

// Center of continental US
const CENTER_OF_US = { lat: 39.5, lng: -98.35 };

// Small random offset to prevent exact overlaps
const MIN_OFFSET = 0.999965;
const MAX_OFFSET = 1.000035;

/**
 * Initialize the map - called by Google Maps API callback
 */
window.initMap = function() {
  console.log('Initializing map...');
  
  // Create the map with mapId required for AdvancedMarkerElement
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 5,
    center: CENTER_OF_US,
    mapId: 'VOLUNTEER_MAP', // Required for AdvancedMarkerElement
    maxZoom: 16,
    zoomControl: true,
    zoomControlOptions: {
      position: google.maps.ControlPosition.RIGHT_BOTTOM
    },
    streetViewControl: false,
    scaleControl: true,
    mapTypeControl: false,
  }); 

  // Create a single InfoWindow to reuse
  infoWindow = new google.maps.InfoWindow();

  // Position custom controls on the map
  map.controls[google.maps.ControlPosition.TOP_LEFT].push(
    document.getElementById('optionsBox')
  );
  map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(
    document.getElementById('legend')
  );
  map.controls[google.maps.ControlPosition.TOP_RIGHT].push(
    document.getElementById('mappedVolunteers')
  );

  // Set up event listeners
  document.getElementById('updateBtn').addEventListener('click', updateVolunteers);
  document.getElementById('copyBtn').addEventListener('click', copyUsernames);
  
  // Update visible volunteers when map bounds change
  map.addListener('idle', updateMappedVolunteersList);

  // Load initial data
  updateVolunteers();
};

/**
 * Fetch and display volunteers from the API
 */
async function updateVolunteers() {
  console.log('Updating volunteers...');
  
  // Get filter values
  const lastVisitAge = document.getElementById('lastVisitAge').value;
  const typesToShow = document.querySelector('input[name="typesToShow"]:checked').value;
  const zipCode = document.getElementById('zipCode').value.trim();
  const distance = document.getElementById('distance').value;
  
  // Build API URL
  let apiUrl = `/api/volunteers?lastVisitAge=${lastVisitAge}&typesToShow=${typesToShow}`;
  if (zipCode) {
    apiUrl += `&zipCode=${encodeURIComponent(zipCode)}&distance=${distance}`;
  }

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const volunteers = await response.json();
    console.log(`Received ${volunteers.length} volunteers`);
    
    // Clear existing markers
    clearMarkers();
    
    // Create bounds for auto-zoom
    const bounds = new google.maps.LatLngBounds();
    
    // Create markers for each volunteer
    volunteers.forEach(volunteer => {
      const marker = createVolunteerMarker(volunteer);
      if (marker) {
        allMarkers.push(marker);
        bounds.extend(marker.position);
      }
    });
    
    // Add markers to clusterer
    if (clusterer) {
      clusterer.clearMarkers();
    }
    clusterer = new markerClusterer.MarkerClusterer({ map, markers: allMarkers });
    
    // Fit map to show all markers (skip on initial load to preserve default view)
    if (allMarkers.length > 0 && !isInitialLoad) {
      map.fitBounds(bounds);
    }
    isInitialLoad = false;
    
    // Update the visible volunteers list
    updateMappedVolunteersList();
    
  } catch (error) {
    console.error('Error fetching volunteers:', error);
    alert('Error loading volunteers. Please try again.');
  }
}

/**
 * Create a marker for a volunteer
 */
function createVolunteerMarker(volunteer) {
  // Skip if no coordinates
  if (!volunteer.lat || !volunteer.lon) {
    return null;
  }
  
  // Add small random offset to prevent exact overlaps
  const lat = parseFloat(volunteer.lat) * (Math.random() * (MAX_OFFSET - MIN_OFFSET) + MIN_OFFSET);
  const lon = parseFloat(volunteer.lon) * (Math.random() * (MAX_OFFSET - MIN_OFFSET) + MIN_OFFSET);
  
  const position = { lat, lng: lon };
  
  // Determine marker icon based on volunteer type
  let iconUrl, pilotInfo = '';
  
  const isFoster = volunteer.foster == 1;
  const isPilot = volunteer.pilot == 1;
  
  if (isFoster && isPilot) {
    iconUrl = '/images/icon_plane_house_small.svg';
    pilotInfo = `Flying distance: <b>${volunteer.flyingRadius || 'N/A'} nm</b><br>Airport: <b>${volunteer.airportID || ''} - ${volunteer.airportName || ''}</b><br>`;
  } else if (isFoster) {
    iconUrl = '/images/icon_house_small.svg';
  } else if (isPilot) {
    iconUrl = '/images/icon_plane_blue_small.svg';
    pilotInfo = `Flying distance: <b>${volunteer.flyingRadius || 'N/A'} nm</b><br>Airport: <b>${volunteer.airportID || ''} - ${volunteer.airportName || ''}</b><br>`;
  } else {
    iconUrl = '/images/icon_volunteer.svg';
  }
  
  // Create marker image element for AdvancedMarkerElement
  const iconSize = iconUrl === '/images/icon_volunteer.svg' ? 20 : 32;
  const img = document.createElement('img');
  img.src = iconUrl;
  img.width = iconSize;
  img.height = iconSize;
  img.style.cursor = 'pointer';
  
  // Create marker using AdvancedMarkerElement
  const marker = new google.maps.marker.AdvancedMarkerElement({
    position,
    map: null, // Will be added via clusterer
    content: img
  });
  
  // Store additional data on marker
  marker.volunteerData = {
    username: volunteer.username,
    userID: volunteer.userID,
    lastVisitHuman: volunteer.lastVisitHuman,
    airportID: volunteer.airportID || '',
    city: volunteer.city || '',
    state: volunteer.state || ''
  };
  
  // Create info window content
  const infoContent = `
    <div style="white-space:nowrap; margin:0 0 10px 10px;">
      Username: <a href="https://pilotsnpaws.org/forum/memberlist.php?mode=viewprofile&u=${volunteer.userID}" target="_blank">${volunteer.username}</a><br>
      <img align="right" style="vertical-align:top;" src="${iconUrl}" width="${iconSize}" height="${iconSize}">
      ${pilotInfo}
      Last visit: ${volunteer.lastVisitHuman}<br>
    </div>
  `;
  
  // Add click listener to show info window (AdvancedMarkerElement uses 'gmp-click')
  marker.addListener('gmp-click', () => {
    infoWindow.setContent(infoContent);
    infoWindow.open({ map, anchor: marker });
  });
  
  return marker;
}

/**
 * Clear all markers from the map
 */
function clearMarkers() {
  if (clusterer) {
    clusterer.clearMarkers();
  }
  allMarkers.forEach(marker => marker.map = null);
  allMarkers = [];
}

/**
 * Update the list of volunteers visible in current map bounds
 */
function updateMappedVolunteersList() {
  console.log('Updating visible volunteers list...');
  
  const bounds = map.getBounds();
  if (!bounds) return;
  
  const visibleVolunteers = [];
  const visibleUsernames = [];
  
  allMarkers.forEach(marker => {
    if (bounds.contains(marker.position)) {
      const data = marker.volunteerData;
      visibleVolunteers.push(data);
      visibleUsernames.push(data.username);
    }
  });
  
  // Update count
  document.getElementById('volunteerCount').textContent = `(${visibleVolunteers.length})`;
  
  // Update volunteers list
  const listContainer = document.getElementById('volunteersList');
  listContainer.innerHTML = '';
  
  visibleVolunteers.forEach(volunteer => {
    const div = document.createElement('div');
    div.className = 'volunteer-item';
    
    const airportLink = volunteer.airportID 
      ? `<a href="http://www.aopa.org/airports/${volunteer.airportID}" target="_blank">${volunteer.airportID}</a>`
      : '';
      
    div.innerHTML = `
      ${airportLink} 
      <a href="https://pilotsnpaws.org/forum/memberlist.php?mode=viewprofile&u=${volunteer.userID}" target="_blank">${volunteer.username}</a>
    `;
    listContainer.appendChild(div);
  });
  
  // Update hidden usernames for copying
  const hiddenContainer = document.getElementById('hiddenUsernames');
  hiddenContainer.textContent = visibleUsernames.join('\n');
}

/**
 * Copy visible volunteer usernames to clipboard
 */
async function copyUsernames() {
  const text = document.getElementById('hiddenUsernames').textContent;
  
  if (!text) {
    alert('No volunteers visible on map');
    return;
  }
  
  try {
    await navigator.clipboard.writeText(text);
    
    // Visual feedback
    const btn = document.getElementById('copyBtn');
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    btn.style.backgroundColor = '#4CAF50';
    
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.backgroundColor = '';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
    alert('Failed to copy to clipboard');
  }
}
