// Global variables
let map;
let directionsService;
let directionsRenderer;
let pickupAutocomplete;
let dropoffAutocomplete;
let currentRide = null;

// Driver tracking functionality
let driverMarkers = [];
let watchId = null;

// Initialize driver tracking
function initDriverTracking() {
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            position => {
                const driverLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                updateDriverPosition(driverLocation);
            },
            error => console.error('Geolocation error:', error),
            { enableHighAccuracy: true }
        );
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

function updateDriverPosition(location) {
    // Clear existing markers
    driverMarkers.forEach(marker => marker.setMap(null));
    driverMarkers = [];

    // Add new marker
    const marker = new google.maps.Marker({
        position: location,
        map: map,
        icon: {
            url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            scaledSize: new google.maps.Size(40, 40)
        },
        title: "Your Location"
    });
    driverMarkers.push(marker);

    // Center map on driver
    map.setCenter(location);
}

// Sample driver data with real-time tracking
const drivers = [
    { 
        id: 1, 
        name: "John", 
        getLocation: () => ({ lat: 37.7749 + Math.random()*0.01, lng: -122.4194 + Math.random()*0.01 }), 
        vehicle: "Sedan", 
        rating: 4.8 
    },
    // ... other drivers
];

// Initialize the app when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    initAutocomplete();
    setupEventListeners();
});

function initMap() {
    // Default to San Francisco coordinates
    const sanFrancisco = { lat: 37.7749, lng: -122.4194 };
    
    map = new google.maps.Map(document.getElementById("map"), {
        center: sanFrancisco,
        zoom: 13,
        styles: [
            {
                featureType: "poi",
                stylers: [{ visibility: "off" }]
            }
        ]
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(map);
}

function initAutocomplete() {
    const pickupInput = document.getElementById('pickup');
    const dropoffInput = document.getElementById('dropoff');
    
    pickupAutocomplete = new google.maps.places.Autocomplete(pickupInput, {
        types: ['geocode'],
        componentRestrictions: { country: 'us' }
    });

    dropoffAutocomplete = new google.maps.places.Autocomplete(dropoffInput, {
        types: ['geocode'],
        componentRestrictions: { country: 'us' }
    });
}

function setupEventListeners() {
    document.getElementById('findRide').addEventListener('click', handleRideRequest);
}

function handleRideRequest() {
    const pickup = document.getElementById('pickup').value;
    const dropoff = document.getElementById('dropoff').value;

    if (!pickup || !dropoff) {
        alert('Please enter both pickup and dropoff locations');
        return;
    }

    // Show loading state
    const button = document.getElementById('findRide');
    button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Finding Ride';
    button.disabled = true;

    // Calculate route
    calculateAndDisplayRoute(pickup, dropoff)
        .then(route => {
            currentRide = {
                pickup: pickup,
                dropoff: dropoff,
                route: route,
                driver: findNearestDriver(route.start_location)
            };
            
            // Simulate API call delay
            setTimeout(() => {
                showDriverMatch(currentRide.driver);
                button.innerHTML = '<i class="fas fa-car mr-2"></i> Ride Found!';
            }, 1500);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Could not calculate route. Please try again.');
            button.innerHTML = '<i class="fas fa-car mr-2"></i> Find Ride';
            button.disabled = false;
        });
}

function calculateAndDisplayRoute(pickup, dropoff) {
    return new Promise((resolve, reject) => {
        directionsService.route(
            {
                origin: pickup,
                destination: dropoff,
                travelMode: google.maps.TravelMode.DRIVING
            },
            (response, status) => {
                if (status === "OK") {
                    directionsRenderer.setDirections(response);
                    resolve({
                        distance: response.routes[0].legs[0].distance.text,
                        duration: response.routes[0].legs[0].duration.text,
                        start_location: response.routes[0].legs[0].start_location
                    });
                } else {
                    reject(status);
                }
            }
        );
    });
}

function findNearestDriver(pickupLocation) {
    // Simple distance calculation (would use Haversine formula in production)
    const pickupLatLng = {
        lat: pickupLocation.lat(),
        lng: pickupLocation.lng()
    };

    // Find driver with minimum distance
    return drivers.reduce((nearest, driver) => {
        const driverDistance = calculateDistance(pickupLatLng, driver.location);
        const nearestDistance = calculateDistance(pickupLatLng, nearest.location);
        return driverDistance < nearestDistance ? driver : nearest;
    });
}

function calculateDistance(point1, point2) {
    // Simplified distance calculation
    return Math.sqrt(
        Math.pow(point1.lat - point2.lat, 2) + 
        Math.pow(point1.lng - point2.lng, 2)
    );
}

function showDriverMatch(driver) {
    // Create and show a modal with driver info
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 class="text-xl font-semibold mb-4">Driver Found!</h3>
            <div class="flex items-center mb-4">
                <div class="w-16 h-16 bg-gray-300 rounded-full mr-4 flex items-center justify-center">
                    <i class="fas fa-user text-2xl text-gray-500"></i>
                </div>
                <div>
                    <h4 class="font-medium">${driver.name}</h4>
                    <p class="text-gray-600">${driver.vehicle} • ${driver.rating} ★</p>
                </div>
            </div>
            <div class="flex justify-between">
                <button id="cancelRide" class="px-4 py-2 border border-gray-300 rounded-lg">
                    Cancel
                </button>
                <button id="confirmRide" class="px-4 py-2 bg-black text-white rounded-lg">
                    Confirm Ride
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners for modal buttons
    document.getElementById('cancelRide').addEventListener('click', () => {
        document.body.removeChild(modal);
        document.getElementById('findRide').innerHTML = '<i class="fas fa-car mr-2"></i> Find Ride';
        document.getElementById('findRide').disabled = false;
    });

    document.getElementById('confirmRide').addEventListener('click', () => {
        alert(`Your ride with ${driver.name} has been confirmed!`);
        document.body.removeChild(modal);
        // In a real app, would redirect to ride tracking page
    });
}