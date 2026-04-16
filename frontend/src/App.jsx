import React, { useState, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
  Search, Navigation, MapPin, Crosshair, 
  Book, Monitor, Building, Home, Calendar, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const BACKEND_URL = 'http://127.0.0.1:8000';

const ICON_MAP = {
  academic: Monitor,
  admin: Building,
  residential: Home,
  landmark: MapPin
};

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [locations, setLocations] = useState([]);
  const [startPoint, setStartPoint] = useState('');
  const [endPoint, setEndPoint] = useState('');
  const [events] = useState([
    { id: 1, title: 'Annual TechFest 2026', date: 'April 20-22', location: 'IT Dept' },
    { id: 2, title: 'Cultural Night', date: 'April 18', location: 'Auditorium' }
  ]);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/locations`).then(res => setLocations(res.data));

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://demotiles.maplibre.org/style.json', // Basic OSM style
      center: [82.1375, 22.1311], 
      zoom: 15.5,
      pitch: 50,
      bearing: -15,
      antialias: true
    });

    map.current.on('load', () => {
      // Add 3D Building Extrusion Layer
      map.current.addLayer({
        'id': '3d-buildings',
        'source': 'maplibre-search-results', // We use OSM data if available, but for now we extrude locations
        'type': 'fill-extrusion',
        'paint': {
          'fill-extrusion-color': '#2a2a3a',
          'fill-extrusion-height': 20,
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.6
        }
      });
    });

    return () => map.current.remove();
  }, []);

  useEffect(() => {
    if (!map.current || locations.length === 0) return;

    locations.forEach(loc => {
      const el = document.createElement('div');
      el.className = 'marker-container';
      el.innerHTML = `<div style="background: rgba(0,210,255,0.2); border: 2px solid #00d2ff; padding: 8px; border-radius: 50%; box-shadow: 0 0 10px #00d2ff;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00d2ff" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>
                      </div>`;

      new maplibregl.Marker(el)
        .setLngLat([loc.longitude, loc.latitude])
        .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(`<h3>${loc.name}</h3><p>${loc.description}</p>`))
        .addTo(map.current);
    });
  }, [locations]);

  const findRoute = async () => {
    if (!startPoint || !endPoint) return;
    
    try {
      const res = await axios.post(`${BACKEND_URL}/route`, {
        start_id: startPoint,
        end_id: endPoint
      });
      
      const coords = res.data.path.map(p => [p.longitude, p.latitude]);
      
      if (map.current.getSource('route')) {
        map.current.getSource('route').setData({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords }
        });
      } else {
        map.current.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }
        });
        
        map.current.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#00d2ff',
            'line-width': 8,
            'line-blur': 4,
            'line-opacity': 0.8
          }
        });
      }

      // Fly to bounds
      const bounds = coords.reduce((acc, curr) => acc.extend(curr), new maplibregl.LngLatBounds(coords[0], coords[0]));
      map.current.fitBounds(bounds, { padding: 50 });

    } catch (err) {
      console.error(err);
    }
  };

  const locateMe = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const { longitude, latitude } = pos.coords;
      map.current.flyTo({ center: [longitude, latitude], zoom: 17 });
      
      new maplibregl.Marker({ color: '#ff0000' })
        .setLngLat([longitude, latitude])
        .addTo(map.current);
    });
  };

  return (
    <div className="App">
      <div ref={mapContainer} className="map-container" />

      {/* Sidebar Navigation */}
      <div className="sidebar glass-panel">
        <div className="flex items-center gap-3 mb-4">
          <Navigation color="#00d2ff" fill="#00d2ff" />
          <h1 className="text-xl font-bold tracking-tight">GGV NAV</h1>
        </div>

        <div className="space-y-4">
          <div>
            <label>Starting Point</label>
            <select value={startPoint} onChange={(e) => setStartPoint(e.target.value)}>
              <option value="">Select Location</option>
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

      {/* Locate Me Button */}
      <button className="locate-btn glass-panel" onClick={locateMe}>
        <Crosshair size={24} color="#00d2ff" />
      </button>

      {/* Info Hover */}
      <div className="event-overlay glass-panel">
        <div className="flex items-center gap-2">
          <Info size={16} color="#00d2ff" />
          <p className="text-xs text-gray-200">Campus is active. Standard routing is available.</p>
        </div>
      </div>
    </div>
  );
}

export default App;
