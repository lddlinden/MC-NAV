import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { io } from 'socket.io-client';

delete L.Icon.Default.prototype._iconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => { if (coords) map.setView(coords, map.getZoom()); }, [coords, map]);
  return null;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('mc_token'));
  const [positions, setPositions] = useState([]);
  const [stats, setStats] = useState({ total_distance: 0 });
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mapType, setMapType] = useState('osm');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fieldLabels = {
    '66': 'MC Batteri (V)', '67': 'Internt Batteri (V)', '239': 'Tändning',
    'sp': 'Hastighet (km/h)', 'sat': 'Satelliter', 'alt': 'Höjd (m)', '241': 'GSM Signal'
  };

  const formatValue = (key, val) => {
    if (key === '66' || key === '67') return (val / 1000).toFixed(2) + ' V';
    if (key === '239') return val === 1 ? <span style={{color: '#4cc9f0'}}>PÅ</span> : <span style={{color: '#e63946'}}>AV</span>;
    return val;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: e.target.user.value, password: e.target.pass.value }) });
    const data = await res.json();
    if (data.token) { localStorage.setItem('mc_token', data.token); setToken(data.token); } else { alert('Fel inloggning'); }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/update-password', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ newPassword }) });
      const data = await res.json();
      setPasswordStatus(data.message || data.error);
      if (res.ok) { setNewPassword(''); setTimeout(() => setShowPasswordChange(false), 2000); }
    } catch (err) { setPasswordStatus('Kunde inte uppdatera lösenord'); }
  };

  useEffect(() => {
    if (!token) return;
    fetch(`/api/history?start=${startDate}&end=${endDate}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => { if (Array.isArray(data)) { setPositions(data); if (data.length > 0) setSelectedPoint(data[data.length - 1]); } else { console.error('History data is not an array:', data); setPositions([]); } })
      .catch(err => console.error('Failed to fetch history:', err));
  }, [token, startDate, endDate]);

  useEffect(() => {
    if (!token) return;
    fetch('/api/stats/distance?days=7', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => setStats(data || { total_distance: 0 }))
      .catch(err => console.error('Failed to fetch stats:', err));
  }, [token]);

  useEffect(() => {
    let socket;
    const connectSocket = () => {
      socket = io(window.location.origin, { reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 10000, reconnectionAttempts: Infinity, auth: { token } });
      socket.on('connect', () => console.log('Socket.io connected'));
      socket.on('connect_error', (error) => console.error('Socket.io connection error:', error));
      socket.on('position-update', (newPos) => { setPositions(prev => [...prev, newPos]); setSelectedPoint(newPos); });
    };
    if (token) connectSocket();
    return () => { if (socket) socket.disconnect(); };
  }, [token]);

  const polylineCoords = positions.map(p => [p.lat, p.lng]);
  const latestPos = positions.length > 0 ? [positions[positions.length - 1].lat, positions[positions.length - 1].lng] : [56.8, 14.8];
  const handleLogout = () => { localStorage.removeItem('mc_token'); setToken(null); };

  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#f4f4f9' }}>
        <div style={{ background: '#fff', padding: '40px', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '30px', textAlign: 'center', color: '#1a1a2e' }}>MC Tracker</h1>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1a1a2e' }}>Användarnamn</label>
              <input type="text" name="user" placeholder="användare" required style={{ width: '100%', padding: '12px', border: '2px solid #e0e0e0', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1a1a2e' }}>Lösenord</label>
              <input type="password" name="pass" placeholder="••••••••" required style={{ width: '100%', padding: '12px', border: '2px solid #e0e0e0', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" style={{ width: '100%', padding: '12px', background: '#0f3460', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer' }}>Logga in</button>
          </form>
        </div>
      </div>
    );
  }

  const getLatestData = () => selectedPoint?.raw_data?.state?.reported || selectedPoint;
  const batteryVoltage = getLatestData()?.['66'] ? (getLatestData()['66'] / 1000).toFixed(2) : '--';
  const internalBattery = getLatestData()?.['67'] ? (getLatestData()['67'] / 1000).toFixed(2) : '--';
  const ignition = getLatestData()?.['239'];
  const speed = getLatestData()?.['sp'] || 0;
  const altitude = getLatestData()?.['alt'] || 0;
  const satellites = getLatestData()?.['sat'] || 0;
  const gsmSignal = getLatestData()?.['241'] || 0;
  const lastUpdate = selectedPoint?.ts ? new Date(selectedPoint.ts).toLocaleString('sv-SE') : 'Ingen data';

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100vh', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#f4f4f9' }}>
      {/* Header */}
      <div style={{ 
        background: '#0f3460', color: '#fff', padding: '10px 20px', 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {isMobile && (
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>&#9776;</button>
          )}
          <h1 style={{ fontSize: isMobile ? '1rem' : '1.5rem', margin: 0 }}>MC Tracker</h1>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: '#94a3b8' }}>DISTANS (7 DAGAR)</div>
            <div style={{ fontSize: isMobile ? '1rem' : '1.2rem', fontWeight: 'bold' }}>{(stats.total_distance / 1000).toFixed(2)} km</div>
          </div>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '5px', borderRadius: '4px', border: 'none' }} />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '5px', borderRadius: '4px', border: 'none' }} />
        </div>
      </div>

      {/* Sidebar */}
      <div style={{ 
        width: isMobile ? (sidebarOpen ? '100%' : '0') : '320px',
        height: isMobile ? 'auto' : 'calc(100vh - 60px)',
        background: '#1a1a2e', color: '#fff', padding: '15px',
        overflowY: 'auto', transition: 'width 0.3s ease',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #30304d' }}>
          <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Status</h2>
          {isMobile && <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>&times;</button>}
        </div>

        {/* Telemetri */}
        <div style={{ marginBottom: '15px' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: 0 }}>TELEMETRI</h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div><strong>Batterispänning:</strong> {batteryVoltage} V</div>
            <div><strong>Internt batteri:</strong> {internalBattery} V</div>
            <div><strong>Tändning:</strong> {formatValue('239', ignition)}</div>
            <div><strong>Hastighet:</strong> {speed} km/h</div>
            <div><strong>Höjd:</strong> {altitude} m</div>
            <div><strong>Satelliter:</strong> {satellites}</div>
            <div><strong>GSM Signal:</strong> {'&#9642;'.repeat(gsmSignal)}</div>
            <div style={{ marginTop: '10px', color: '#4cc9f0' }}>Senaste data: {lastUpdate}</div>
          </div>
        </div>

        {/* Lösenordsbyte */}
        <div style={{ marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #30304d' }}>
          <button onClick={() => setShowPasswordChange(!showPasswordChange)} style={{ background: 'none', border: '1px solid #30304d', color: '#94a3b8', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
            &#9881; {showPasswordChange ? 'Avbryt lösenordsbyte' : 'Byt lösenord'}
          </button>
          {showPasswordChange && (
            <form onSubmit={handlePasswordUpdate} style={{ marginTop: '10px', display: 'flex', gap: '5px' }}>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nytt lösenord" style={{ padding: '5px', borderRadius: '4px', border: 'none', flexGrow: 1 }} required />
              <button type="submit" style={{ background: '#4cc9f0', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '5px 10px' }}>Spara</button>
            </form>
          )}
          {passwordStatus && <div style={{ fontSize: '0.7rem', marginTop: '5px', color: '#4cc9f0' }}>{passwordStatus}</div>}
        </div>

        {/* Historikfilter */}
        <div style={{ marginBottom: '15px' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: 0 }}>FILTRERA HISTORIK</h3>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: '100%', padding: '5px', borderRadius: '4px', border: 'none', marginBottom: '5px' }} />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: '100%', padding: '5px', borderRadius: '4px', border: 'none' }} />
        </div>

        {/* Logout */}
        <button onClick={handleLogout} style={{ width: '100%', background: '#e63946', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>Logga ut</button>
      </div>

      {/* Kartvy */}
      <div style={{ flexGrow: 1, position: 'relative', height: isMobile ? 'auto' : 'calc(100vh - 60px)' }}>
        <MapContainer center={latestPos} zoom={13} style={{ height: '100%', width: '100%' }}>
          {mapType === 'osm' && (
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
          )}
          {mapType === 'satellite' && (
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution='&copy; Esri' />
          )}
          <RecenterMap coords={latestPos} />
          {polylineCoords.length > 0 && <Polyline positions={polylineCoords} color="#4cc9f0" weight={4} opacity={0.7} />}
          {polylineCoords.length > 0 && (
            <Marker position={latestPos}>
              <Popup><strong>Senaste position</strong><br />{new Date(selectedPoint?.ts).toLocaleTimeString()}</Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Karttyp-växlare */}
        <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '5px' }}>
          <button onClick={() => setMapType('osm')} style={{ background: mapType === 'osm' ? '#0f3460' : 'rgba(255,255,255,0.7)', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>OSM</button>
          <button onClick={() => setMapType('satellite')} style={{ background: mapType === 'satellite' ? '#0f3460' : 'rgba(255,255,255,0.7)', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Satellit</button>
        </div>
      </div>
    </div>
  );
}

export default App;
