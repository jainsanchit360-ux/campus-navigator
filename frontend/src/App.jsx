import React, { useState, useEffect } from 'react';
import { 
  MapContainer, TileLayer, Marker, Popup, 
  Polyline, useMap, useMapEvents 
} from 'react-leaflet';
import L from 'leaflet';
import { 
  Navigation, Map as MapIcon, Calendar, Info, 
  MapPin, Crosshair 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

// Fix for default Leaflet icon issue in React
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const BACKEND_URL = 'http://127.0.0.1:8000';
const GGV_CENTER = [22.129, 82.138];

// Component to handle Map Resizing and Geolocation
function MapController({ userCoords, onLocationFound }) {
  const map = useMap();
  
  useEffect(() => {
    map.invalidateSize();
  }, [map]);

  const mapEvents = useMapEvents({
    locationfound(e) {
      onLocationFound(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  return null;
}

function App() {
  const [locations, setLocations] = useState([]);
  const [startPoint, setStartPoint] = useState('');
  const [endPoint, setEndPoint] = useState('');
  const [userCoords, setUserCoords] = useState(null);
  const [route, setRoute] = useState(null);
  const [events] = useState([
    { id: 1, title: 'Annual TechFest 2026', date: 'April 20-22', location: 'IT Dept' },
    { id: 2, title: 'Cultural Night', date: 'April 18', location: 'Auditorium' }
  ]);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/locations`).then(res => setLocations(res.data));
  }, []);

  const handleStartPointChange = (val) => {
    setStartPoint(val);
    if (val === 'current_location') {
      // Handled by MapController / map.locate() logic if needed
      // Or just a manual trigger
    }
  };

  const findRoute = async () => {
    if (!startPoint || !endPoint) return;
    
    try {
      const res = await axios.post(`${BACKEND_URL}/route`, {
        start_id: startPoint === 'current_location' ? 'main_gate' : startPoint,
        end_id: endPoint
      });
      
      const path = res.data.path;
      const coords = path.map(p => [p.latitude, p.longitude]);
      
      if (startPoint === 'current_location' && userCoords) {
        setRoute([[userCoords.lat, userCoords.lng], ...coords]);
      } else {
        setRoute(coords);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const locateUser = (map) => {
    if (map) map.locate();
  };

  return (
    <div className="App">
      <MapContainer 
        center={GGV_CENTER} 
        zoom={16} 
        className="map-container"
        zoomControl={false}
      >
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        
        <MapController 
          userCoords={userCoords} 
          onLocationFound={(latlng) => setUserCoords(latlng)} 
        />

        {locations.map(loc => (
          <Marker 
            key={loc.id} 
            position={[loc.latitude, loc.longitude]}
          >
            <Popup>
              <h3 className="font-bold">{loc.name}</h3>
              <p className="text-sm">{loc.description}</p>
            </Popup>
          </Marker>
        ))}

        {userCoords && (
          <Marker position={userCoords} icon={L.divIcon({
            className: 'user-location-marker',
            html: '<div class="user-position-dot"></div>'
          })}>
            <Popup>You are here</Popup>
          </Marker>
        )}

        {route && (
          <Polyline 
            positions={route} 
            pathOptions={{ color: '#00d2ff', weight: 8, opacity: 0.8 }} 
          />
        )}
      </MapContainer>

      {/* Sidebar Navigation */}
      <div className="sidebar glass-panel">
        <div className="flex items-center gap-3 mb-4">
          <MapIcon color="#00d2ff" size={28} />
          <h1 className="text-xl font-bold tracking-tight">GGV NAV</h1>
        </div>

        <div className="space-y-4">
          <div>
            <label>Starting Point</label>
            <select value={startPoint} onChange={(e) => handleStartPointChange(e.target.value)}>
              <option value="">Select Location</option>
              <option value="current_location">My Current Location</option>
              {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </select>
          </div>

          <div>
            <label>Destination</label>
            <select value={endPoint} onChange={(e) => setEndPoint(e.target.value)}>
              <option value="">Select Destination</option>
              {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </select>
          </div>

          <button className="route-btn" onClick={findRoute}>Find Route</button>
        </div>

        <div className="mt-8">
          <label>Campus News</label>
          <div className="space-y-3 mt-2">
            {events.map(ev => (
              <div key={ev.id} className="p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar size={14} color="#00d2ff" />
                  <span className="text-xs font-medium text-gray-400">{ev.date}</span>
                </div>
                <h3 className="text-sm font-semibold">{ev.title}</h3>
                <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">{ev.location}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Actions */}
      <div className="event-overlay glass-panel">
        <div className="flex items-center gap-2">
          <Info size={16} color="#00d2ff" />
          <p className="text-xs text-gray-200">Satellite View Active</p>
        </div>
      </div>
    </div>
  );
}

export default App;
