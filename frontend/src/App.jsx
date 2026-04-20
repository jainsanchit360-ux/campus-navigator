import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, Compass, Navigation2, Target, Calendar, ChevronUp, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

// ─── Fix Leaflet default icon paths ──────────────────────────────────────────
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon   from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl:       markerIcon,
  shadowUrl:     markerShadow,
  iconSize:    [25, 41],
  iconAnchor:  [12, 41],
  popupAnchor: [1, -34],
  shadowSize:  [41, 41],
});

// ─── Config ───────────────────────────────────────────────────────────────────
const GGV_CENTER  = [22.12758, 82.13758]; // Centered on Administrative Block
const BACKEND_URL = `http://${window.location.hostname}:8000`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function getBearing(lat1, lng1, lat2, lng2) {
  const y = Math.sin((lng2-lng1)*Math.PI/180)*Math.cos(lat2*Math.PI/180);
  const x = Math.cos(lat1*Math.PI/180)*Math.sin(lat2*Math.PI/180)
           - Math.sin(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.cos((lng2-lng1)*Math.PI/180);
  return (Math.atan2(y,x)*180/Math.PI + 360) % 360;
}
const DIRS = ['North','North-East','East','South-East','South','South-West','West','North-West'];
const getDir = (b) => DIRS[Math.round(b/45)%8];

// ─── Custom blue-dot icon ─────────────────────────────────────────────────────
const userIcon = L.divIcon({
  className: '',
  html: `<div class="user-dot-outer"><div class="user-dot-inner"></div></div>`,
  iconSize:   [24, 24],
  iconAnchor: [12, 12],
});

// ─── Map centering helper ─────────────────────────────────────────────────────
function MapController({ userCoords, isNavigating }) {
  const map = useMap();
  const last = useRef(0);
  useEffect(() => {
    if (!isNavigating || !userCoords) return;
    const now = Date.now();
    if (now - last.current < 3000) return;
    last.current = now;
    map.flyTo([userCoords.lat, userCoords.lng], 19, { animate: true, duration: 1.5 });
  }, [userCoords, isNavigating, map]);
  return null;
}

// ─── Custom Dropdown ──────────────────────────────────────────────────────────
function CustomDropdown({ label, value, options, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref  = useRef(null);
  const selected = options.find(o => o.id === value);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', marginBottom: 16 }}>
      <div className="dd-label">{label}</div>
      <div className="dd-trigger" onClick={() => setOpen(o => !o)}>
        <span>{selected ? selected.name : placeholder}</span>
        <span style={{ opacity: 0.5 }}>▾</span>
      </div>
      {open && (
        <div className="dd-list">
          {options.length === 0
            ? <div className="dd-item">Loading…</div>
            : options.map(o => (
                <div key={o.id} className="dd-item" onClick={() => { onChange(o.id); setOpen(false); }}>
                  {o.name}
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [locations,      setLocations]      = useState([]);
  const [startPoint,     setStartPoint]     = useState('');
  const [endPoint,       setEndPoint]       = useState('');
  const [userCoords,     setUserCoords]     = useState(null);
  const [route,          setRoute]          = useState(null);
  const [isNavigating,   setIsNavigating]   = useState(false);
  const [instruction,    setInstruction]    = useState('');
  const [distToNext,     setDistToNext]     = useState(0);
  const [error,          setError]          = useState('');
  const [gpsError,       setGpsError]       = useState('');
  const [totalDist,      setTotalDist]      = useState(0);

  const mapRef   = useRef(null);
  const watchRef = useRef(null);

  // ── load locations once on mount ──────────────────────────────────────────
  useEffect(() => {
    axios.get(`${BACKEND_URL}/locations`)
      .then(r => setLocations(r.data))
      .catch(() => setError('Could not load campus data. Is the backend running?'));
  }, []);

  // ── GPS watch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsError('GPS not supported on this device.');
      return;
    }
    watchRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setGpsError('');
        setUserCoords({ lat: coords.latitude, lng: coords.longitude, heading: coords.heading || 0 });
      },
      (err) => {
        if (err.code === 1) setGpsError('GPS permission denied. Enable location in browser settings.');
        else if (err.code === 2) setGpsError('GPS signal unavailable. Try moving outdoors.');
        else setGpsError('GPS timeout. Retrying…');
        console.warn('GPS:', err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchRef.current);
  }, []);

  // ── proximity check during navigation ─────────────────────────────────────
  const checkProximity = useCallback((lat, lng, r) => {
    if (!r || r.length < 2) return;

    // Find the first waypoint that is still ahead (>10m away)
    let nextIdx = -1;
    for (let i = 0; i < r.length; i++) {
      if (getDistance(lat, lng, r[i][0], r[i][1]) > 10) { nextIdx = i; break; }
    }

    if (nextIdx === -1) {
      setInstruction('🎉 You have arrived at your destination!');
      setDistToNext(0);
      return;
    }

    const next = r[nextIdx];
    const dist = Math.round(getDistance(lat, lng, next[0], next[1]));
    const bearing = getBearing(lat, lng, next[0], next[1]);
    const dir = getDir(bearing);

    // Look ahead one more point to give a turn instruction
    const stepNum = nextIdx + 1;
    const total   = r.length;
    setDistToNext(dist);
    setInstruction(
      dist < 20
        ? `⚠️ Turn coming up – head ${dir}`
        : `Head ${dir} · Step ${stepNum} of ${total}`
    );
  }, []);

  useEffect(() => {
    if (isNavigating && userCoords && route) checkProximity(userCoords.lat, userCoords.lng, route);
  }, [userCoords, isNavigating, route, checkProximity]);

  // ── find route ────────────────────────────────────────────────────────────
  async function findRoute() {
    setError('');
    if (!endPoint) { setError('Please select a destination.'); return; }

    // --- Safety checks ---
    let startCoords;
    if (startPoint === 'current_location') {
      if (!userCoords) { setError('Waiting for GPS signal…'); return; }
      startCoords = [userCoords.lat, userCoords.lng];
    } else if (startPoint) {
      const loc = locations.find(l => l.id === startPoint);
      if (!loc) { setError('Start location not found.'); return; }
      startCoords = [loc.latitude, loc.longitude];
    }

    const dest = locations.find(l => l.id === endPoint);
    if (!dest) { setError('Destination not found.'); return; }
    const endCoords = [dest.latitude, dest.longitude];

    try {
      const res = await axios.post(`${BACKEND_URL}/route`, {
        start_id:     startPoint === 'current_location' ? null : (startPoint || null),
        end_id:       endPoint,
        start_coords: startPoint === 'current_location' ? startCoords : null,
      });
      setRoute(res.data.path);   // backend returns [[lat,lng], ...]
      setIsNavigating(false);

      // Fit map to route
      if (mapRef.current) {
        const bounds = L.latLngBounds(res.data.path);
        mapRef.current.fitBounds(bounds, { padding: [60, 60] });
      }
    } catch {
      // Fallback: straight line
      if (startCoords) {
        setRoute([startCoords, endCoords]);
        if (mapRef.current) mapRef.current.fitBounds(L.latLngBounds([startCoords, endCoords]), { padding: [60,60] });
      } else {
        setError('Route failed. Try with a specific start location.');
      }
    }
  }

  function handleFindMe() {
    if (userCoords && mapRef.current) {
      mapRef.current.flyTo([userCoords.lat, userCoords.lng], 18, { animate: true, duration: 1.5 });
    }
  }

  const startNavigation = () => {
    if (!route || route.length < 2) return;

    // Calculate total route distance for display
    let d = 0;
    for (let i = 1; i < route.length; i++) {
      d += getDistance(route[i-1][0], route[i-1][1], route[i][0], route[i][1]);
    }
    setTotalDist(Math.round(d));

    setIsNavigating(true);

    // Immediately fire first instruction
    if (userCoords) {
      checkProximity(userCoords.lat, userCoords.lng, route);
    } else {
      setInstruction('📍 Follow the cyan line on the map');
    }
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="app-root">
      {/* ── MAP ── */}
      <MapContainer
        center={GGV_CENTER}
        zoom={17}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        ref={mapRef}
      >
        <TileLayer
          attribution="&copy; Google Maps"
          url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
          subdomains={['mt0','mt1','mt2','mt3']}
          maxZoom={20}
        />

        <MapController userCoords={userCoords} isNavigating={isNavigating} />

        {/* Campus markers */}
        {locations.map(loc => (
          <Marker key={loc.id} position={[loc.latitude, loc.longitude]}>
            <Popup>
              <div className="popup-box">
                <strong>{loc.name}</strong>
                <p>{loc.description}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* User dot */}
        {userCoords && (
          <Marker position={[userCoords.lat, userCoords.lng]} icon={userIcon} zIndexOffset={1000}>
            <Popup>📍 You are here</Popup>
          </Marker>
        )}

        {/* Route polyline */}
        {route && (
          <Polyline
            positions={route}
            pathOptions={{ color: '#00FFFF', weight: 7, opacity: 0.85, lineJoin: 'round' }}
          />
        )}
      </MapContainer>

      {/* ── SIDEBAR ── */}
      {!isNavigating && (
        <div className="sidebar">
          <div className="sidebar-drag-handle" />

          <div className="sidebar-brand">
            <Compass size={28} className="brand-icon" />
            <span className="brand-title">GGV NAVIGATOR</span>
          </div>

          {error && <div className="error-banner">{error}</div>}
      {gpsError && <div className="gps-banner">{gpsError}</div>}

          <CustomDropdown
            label="STARTING POINT"
            value={startPoint}
            options={[{id:'current_location', name:'📍 My Live Location'}, ...locations]}
            onChange={setStartPoint}
            placeholder="Select start…"
          />

          <CustomDropdown
            label="DESTINATION"
            value={endPoint}
            options={locations}
            onChange={setEndPoint}
            placeholder="Select destination…"
          />

          <button className="btn-route" onClick={findRoute}>
            FIND ROUTE
          </button>

          {route && (
            <motion.button
              className="btn-nav"
              initial={{ opacity:0, y:8 }}
              animate={{ opacity:1, y:0 }}
              onClick={startNavigation}
            >
              <Navigation2 size={18} /> LAUNCH NAVIGATION
            </motion.button>
          )}
        </div>
      )}

      {/* ── NAV OVERLAY ── */}
      <AnimatePresence>
        {isNavigating && (
          <motion.div
            className="nav-overlay"
            initial={{ y:-100, opacity:0 }}
            animate={{ y:0,    opacity:1 }}
            exit={{   y:-100, opacity:0 }}
          >
            <div className="nav-card">
              <div className="nav-icon-box">
                <Navigation2 size={36} className="nav-icon" />
              </div>
              <div className="nav-text">
                <div className="nav-label">NAVIGATION ACTIVE</div>
                <div className="nav-instruction">{instruction || 'Calculating route…'}</div>
                <div className="nav-meta">
                  {distToNext > 0 && <span className="nav-distance">{distToNext} m</span>}
                  {totalDist > 0 && <span className="nav-total">Total: {(totalDist/1000).toFixed(2)} km</span>}
                </div>
                {!userCoords && <div className="nav-nogps">⚠️ GPS not active — check browser location permissions</div>}
              </div>
              <button className="nav-close" onClick={() => setIsNavigating(false)}>
                <X size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HUD ── */}
      <div className="hud">
        <button className="hud-btn" title="Find me" onClick={handleFindMe}>
          <Target size={26} />
        </button>
      </div>

      {/* ── STATUS PILL ── */}
      <div className="status-pill">
        <span className={`status-dot ${userCoords ? 'active' : 'waiting'}`} />
        <span className="status-text">
          {isNavigating ? 'NAVIGATING' : userCoords ? 'GPS READY' : 'NO GPS'}
        </span>
      </div>
    </div>
  );
}
