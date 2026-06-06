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
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
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
    const days = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)));
    fetch(`/api/stats/distance?days=${days}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => setStats(data || { total_distance: 0 }))
      .catch(err => console.error('Failed to fetch stats:', err));
  }, [token, startDate, endDate]);

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

  // Riktiga miniatyr-bilder för kartväljaren
  const osmThumb = 'url(https://a.tile.openstreetmap.org/12/2196/1347.png)';
  const satThumb = 'url(https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1347/2196)';

  // Dynamisk beräkning av antal dagar för rubriken
  const diffDays = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#f4f4f9', overflow: 'hidden' }}>
      {/* Header med Info & Hastighet */}
      <div style={{ 
        background: '#0f3460', color: '#fff', padding: '10px 15px', minHeight: '70px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)', zIndex: 3000
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
              {sidebarOpen ? '✕' : '☰'}
            </button>
            <h1 style={{ fontSize: '1.1rem', margin: 0, fontWeight: '700' }}>MC Tracker</h1>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '4px', borderRadius: '4px', border: 'none', fontSize: '0.75rem', width: '105px' }} />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '4px', borderRadius: '4px', border: 'none', fontSize: '0.75rem', width: '105px' }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '5px' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            <strong style={{ color: '#fff' }}>{(stats.total_distance / 1000).toFixed(1)} km</strong> kört senaste {diffDays} dagar
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#4cc9f0' }}>
            {speed} <span style={{ fontSize: '0.7rem' }}>km/h</span>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar som Overlay */}
        <div style={{ 
          position: 'absolute',
          top: 0,
          left: sidebarOpen ? 0 : '-350px',
          width: isMobile ? '100%' : '320px',
          height: '100%',
          background: '#1a1a2e', color: '#fff', padding: '20px',
          overflowY: 'auto', transition: 'left 0.3s ease',
          boxSizing: 'border-box',
          zIndex: 2500,
          boxShadow: sidebarOpen ? '10px 0 25px rgba(0,0,0,0.5)' : 'none',
          visibility: sidebarOpen ? 'visible' : 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #30304d' }}>
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Enhetsstatus</h2>
            {isMobile && <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>}
          </div>

          {/* Telemetri */}
          <div style={{ marginBottom: '25px' }}>
            <h3 style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Live Telemetri</h3>
            <div style={{ display: 'grid', gap: '12px', background: '#0f3460', padding: '15px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Batteri</span><strong>{batteryVoltage} V</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Backup</span><strong>{internalBattery} V</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tändning</span><strong>{formatValue('239', ignition)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Hastighet</span><strong>{speed} km/h</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Höjd</span><strong>{altitude} m</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Satelliter</span><strong>{satellites}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Signal</span>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '16px', marginBottom: '2px' }}>
                  {[1, 2, 3].map((bar) => {
                    // Mappar 0-5 signalstyrka till 3 steg
                    // 1-2: 1 pelare, 3-4: 2 pelare, 5: 3 pelare
                    const threshold = bar === 1 ? 1 : bar === 2 ? 3 : 5;
                    const isActive = gsmSignal >= threshold;
                    return (
                      <div key={bar} style={{ width: '5px', height: `${(bar / 3) * 100}%`, backgroundColor: isActive ? '#4cc9f0' : '#30304d', borderRadius: '1px', transition: 'background-color 0.3s' }} />
                    );
                  })}
                </div>
              </div>
              <div style={{ borderTop: '1px solid #30304d', paddingTop: '10px', marginTop: '5px', fontSize: '0.8rem', color: '#4cc9f0' }}>
                Senaste fix: {lastUpdate}
              </div>
            </div>
          </div>

          {/* Inställningar & Logout */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={() => setShowPasswordChange(!showPasswordChange)} style={{ background: '#30304d', border: 'none', color: '#fff', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>
              {showPasswordChange ? 'Avbryt lösenord' : 'Byt lösenord'}
            </button>
            {showPasswordChange && (
              <form onSubmit={handlePasswordUpdate} style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nytt lösenord" style={{ padding: '8px', borderRadius: '4px', border: 'none', flexGrow: 1 }} required />
                <button type="submit" style={{ background: '#4cc9f0', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '0 15px' }}>OK</button>
              </form>
            )}
            <button onClick={handleLogout} style={{ background: '#e63946', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Logga ut</button>
          </div>
        </div>

        {/* Kartvy */}
        <div style={{ flexGrow: 1, position: 'relative', zIndex: 1000 }}>
          <MapContainer center={latestPos} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={!isMobile}>
            {mapType === 'osm' && (
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
            )}
            {mapType === 'satellite' && (
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution='&copy; Esri' />
            )}
            <RecenterMap coords={latestPos} />
            {polylineCoords.length > 0 && <Polyline positions={polylineCoords} color="#4cc9f0" weight={4} opacity={0.7} />}
            {polylineCoords.length > 0 && (
              <Marker position={latestPos}>
                <Popup><strong>Nuvarande position</strong><br />{new Date(selectedPoint?.ts).toLocaleTimeString()}</Popup>
              </Marker>
            )}
          </MapContainer>

          {/* Karttyp-växlare (Miniatyrer) */}
          <div 
            onClick={() => setMapType(mapType === 'osm' ? 'satellite' : 'osm')}
            style={{ 
              position: 'absolute', top: '15px', right: '15px', zIndex: 1500,
              width: '60px', height: '60px', borderRadius: '10px',
              border: '2px solid white', boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
              cursor: 'pointer', overflow: 'hidden',
              background: mapType === 'osm' ? satThumb : osmThumb,
              backgroundSize: 'cover', backgroundPosition: 'center',
              display: 'flex', alignItems: 'flex-end'
            }}
          >
            <div style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '0.6rem', width: '100%', textAlign: 'center', padding: '2px 0' }}>
              {mapType === 'osm' ? 'Satellit' : 'Karta'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
