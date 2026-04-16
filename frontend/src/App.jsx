import React, { useState, useEffect, useRef } from 'react';
import { 
  MapContainer, TileLayer, Marker, Popup, 
  Polyline, useMap, useMapEvents 
} from 'react-leaflet';
import L from 'leaflet';
import { 
  Navigation, Map as MapIcon, Calendar, Info, 
  MapPin, Crosshair, Target, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

// Fix for default Leaflet icon issue
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

function MapActions({ onLocationFound }) {
  const map = useMap();
  useEffect(() => { map.invalidateSize(); }, [map]);
  return null;
}

function App() {
  const [locations, setLocations] = useState([]);
  const [startPoint, setStartPoint] = useState('');
  const [endPoint, setEndPoint] = useState('');
  const [userCoords, setUserCoords] = useState(null);
  const [route, setRoute] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const watchId = useRef(null);

  const [events] = useState([
    { id: 1, title: 'Annual TechFest 2026', date: 'April 20-22', location: 'IT Dept' },
    { id: 2, title: 'Cultural Night', date: 'April 18', location: 'Auditorium' }
  ]);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/locations`).then(res => setLocations(res.data));
    
    // Start watching position in real-time
    if ("geolocation" in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserCoords({ lat: latitude, lng: longitude });
          console.log("Location Updated:", latitude, longitude);
        },
        (err) => console.error(err),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }

    return () => {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  const findRoute = async () => {
    if (!startPoint || !endPoint) return;
    
    const requestData = {
      start_id: startPoint,
      end_id: endPoint
    };

    if (startPoint === 'current_location') {
      if (!userCoords) {
        alert("Waiting for GPS signal...");
        return;
      }
      requestData.start_coords = [userCoords.lat, userCoords.lng];
    }

    try {
      const res = await axios.post(`${BACKEND_URL}/route`, requestData);
      setRoute(res.data.path);
      
      // Auto-zoom to fit route
      if (mapInstance && res.data.path.length > 0) {
        mapInstance.fitBounds(res.data.path, { padding: [50, 50] });
      }
    } catch (err) {
      console.error(err);
      alert("Error finding road route. Campus data might be incomplete for OSRM.");
    }
  };

  const handleFindMe = () => {
    if (userCoords && mapInstance) {
      mapInstance.flyTo([userCoords.lat, userCoords.lng], 18);
    }
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
        
        <MapActions onLocationFound={() => {}} />

        {locations.map(loc => (
          <Marker key={loc.id} position={[loc.latitude, loc.longitude]}>
            <Popup>
              <div className="p-2">
                <h3 className="font-bold text-lg text-blue-600">{loc.name}</h3>
                <p className="text-sm text-gray-700">{loc.description}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {userCoords && (
          <Marker 
            position={[userCoords.lat, userCoords.lng]} 
            icon={L.divIcon({
              className: 'user-location-marker',
              html: '<div class="user-position-dot"></div>'
            })}
          >
            <Popup>You are here (Live Tracked)</Popup>
          </Marker>
        )}

        {route && (
          <Polyline 
            positions={route} 
            pathOptions={{ color: '#00d2ff', weight: 8, opacity: 0.9, lineJoin: 'round' }} 
          />
        )}
      </MapContainer>

      {/* Sidebar UI */}
      <div className="sidebar glass-panel shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }}>
            <Activity color="#00d2ff" size={32} />
          </motion.div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            GGV LIVE
          </h1>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-xs uppercase font-bold text-blue-400">Where are you?</label>
            <select className="mt-1" value={startPoint} onChange={(e) => setStartPoint(e.target.value)}>
              <option value="">Choose Origin</option>
              <option value="current_location">📍 Live Location (Active)</option>
              {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase font-bold text-blue-400">Destination</label>
            <select className="mt-1" value={endPoint} onChange={(e) => setEndPoint(e.target.value)}>
              <option value="">Go to...</option>
              {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </select>
          </div>

          <button className="route-btn transform active:scale-95 transition-all" onClick={findRoute}>
            NAVIGATE ON ROAD
          </button>
        </div>

        {/* Live News */}
        <div className="mt-10">
          <label className="text-xs uppercase font-bold text-blue-400">Campus Pulse</label>
          <div className="space-y-3 mt-3">
            {events.map(ev => (
              <div key={ev.id} className="p-3 bg-white/5 rounded-xl border border-white/10 hover:border-blue-500/50 transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar size={12} color="#00d2ff" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase">{ev.date}</span>
                </div>
                <h3 className="text-sm font-bold text-white">{ev.title}</h3>
                <p className="text-[10px] text-blue-400/80 font-medium uppercase">{ev.location}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modern Control HUD */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-[1000]">
        <button className="locate-btn glass-panel w-14 h-14" onClick={handleFindMe}>
          <Target size={28} color="#00d2ff" />
        </button>
      </div>

      <div className="event-overlay glass-panel py-2 px-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <p className="text-[10px] font-bold text-white uppercase tracking-widest">OSRM ROAD NETWORK READY</p>
        </div>
      </div>
    </div>
  );
}

export default App;
