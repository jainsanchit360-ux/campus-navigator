import React, { useState, useEffect } from 'react';
import { 
  MapContainer, TileLayer, Marker, Popup, 
  Polyline, useMap, useMapEvents 
} from 'react-leaflet';
import L from 'leaflet';
import { 
  Navigation, Map as MapIcon, Calendar, Info, 
  MapPin, Crosshair, Target
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

// Component to handle Map Actions (Locate, FlyTo)
function MapActions({ onLocationFound }) {
  const map = useMap();
  
  useEffect(() => {
    map.invalidateSize();
  }, [map]);

  useMapEvents({
    locationfound(e) {
      onLocationFound(e.latlng);
      map.flyTo(e.latlng, 18);
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
  const [mapInstance, setMapInstance] = useState(null);
  const [events] = useState([
    { id: 1, title: 'Annual TechFest 2026', date: 'April 20-22', location: 'IT Dept' },
    { id: 2, title: 'Cultural Night', date: 'April 18', location: 'Auditorium' }
  ]);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/locations`).then(res => setLocations(res.data));
  }, []);

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

  const handleLocateMe = () => {
    if (mapInstance) mapInstance.locate();
  };

  return (
    <div className="App">
      <MapContainer 
        center={GGV_CENTER} 
        zoom={16} 
        className="map-container"
        zoomControl={false}
        ref={setMapInstance}
      >
        <TileLayer
          attribution='&copy; Google Maps'
          url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          maxZoom={20}
        />
        
        <MapActions onLocationFound={(latlng) => setUserCoords(latlng)} />

        {locations.map(loc => (
          <Marker 
            key={loc.id} 
            position={[loc.latitude, loc.longitude]}
          >
            <Popup>
              <div className="p-1">
                <h3 className="font-bold text-lg">{loc.name}</h3>
                <p className="text-sm text-gray-600">{loc.description}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {userCoords && (
          <Marker position={userCoords} icon={L.divIcon({
            className: 'user-location-marker',
            html: '<div class="user-position-dot"></div>'
          })}>
            <Popup>Current Position</Popup>
          </Marker>
        )}

        {route && (
          <Polyline 
            positions={route} 
            pathOptions={{ color: '#00d2ff', weight: 10, opacity: 0.9 }} 
          />
        )}
      </MapContainer>

      {/* Sidebar Navigation */}
      <div className="sidebar glass-panel">
        <div className="flex items-center gap-3 mb-6">
          <MapIcon color="#00d2ff" size={32} />
          <h1 className="text-2xl font-bold tracking-tight">GGV NAV</h1>
        </div>

        <div className="space-y-5">
          <div>
            <label>Start Point</label>
            <select value={startPoint} onChange={(e) => setStartPoint(e.target.value)}>
              <option value="">Select Origin</option>
              <option value="current_location">📍 My Current Location</option>
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

          <button className="route-btn shadow-lg" onClick={findRoute}>
            Find Campus Route
          </button>
        </div>

        <div className="mt-10">
          <label>Ongoing Events</label>
          <div className="space-y-4 mt-3">
            {events.map(ev => (
              <div key={ev.id} className="p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all cursor-default">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={14} color="#00d2ff" />
                  <span className="text-xs font-semibold text-gray-400 uppercase">{ev.date}</span>
                </div>
                <h3 className="text-md font-bold">{ev.title}</h3>
                <p className="text-xs text-blue-400 mt-1 uppercase tracking-widest">{ev.location}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Find Me Button */}
      <button 
        className="locate-btn glass-panel flex flex-col gap-1 text-[10px] font-bold" 
        onClick={handleLocateMe}
        style={{ bottom: '40px', right: '20px', width: '60px', height: '60px' }}
      >
        <Target size={24} color="#00d2ff" />
        FIND ME
      </button>

      {/* Tech Status */}
      <div className="event-overlay glass-panel">
        <div className="flex items-center gap-2">
          <Info size={16} color="#00d2ff" />
          <p className="text-xs font-medium text-gray-200 uppercase tracking-tighter">Google Hybrid View (Free)</p>
        </div>
      </div>
    </div>
  );
}

export default App;
