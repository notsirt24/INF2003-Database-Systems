import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayerGroup, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Navigation from '../components/Navigation';
import { MapPin, Train, Bus, Zap, School, Loader2 } from 'lucide-react';

// Fix default marker icon issue in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom marker icons for different location types
const createCustomIcon = (color, IconComponent) => {
  return L.divIcon({
    className: 'custom-icon',
    html: `
      <div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          ${getIconSVG(IconComponent)}
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

const getIconSVG = (type) => {
  switch(type) {
    case 'train':
      return '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M3 15h18M8 19v2M16 19v2M8 11V7a4 4 0 0 1 8 0v4"></path><circle cx="9" cy="15" r="1"></circle><circle cx="15" cy="15" r="1"></circle>';
    case 'bus':
      return '<path d="M8 6v6M16 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2V10a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v4c0 .4.1.8.2 1.2.3 1.1.8 2.8.8 2.8h3"></path><circle cx="7" cy="18" r="2"></circle><circle cx="17" cy="18" r="2"></circle>';
    case 'zap':
      return '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>';
    case 'school':
      return '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>';
    default:
      return '<circle cx="12" cy="12" r="10"></circle>';
  }
};

const InteractiveMap = () => {
  const [mrtStations, setMrtStations] = useState([]);
  const [schools, setSchools] = useState([]);
  const [busStops, setBusStops] = useState([]);
  const [evChargingSpots, setEvChargingSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLayers, setSelectedLayers] = useState({
    mrt: true,
    schools: true,
    busStops: false,
    evCharging: false
  });

  // Singapore center coordinates
  const singaporeCenter = [1.3521, 103.8198];

  useEffect(() => {
    fetchMapData();
  }, []);

  const fetchMapData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [mrtRes, schoolsRes, busStopsRes, evRes] = await Promise.all([
        fetch('http://localhost:3001/api/map/mrt-stations'),
        fetch('http://localhost:3001/api/map/schools'),
        fetch('http://localhost:3001/api/map/bus-stops'),
        fetch('http://localhost:3001/api/map/ev-charging')
      ]);

      if (mrtRes.ok) {
        const mrtData = await mrtRes.json();
        setMrtStations(mrtData);
      }

      if (schoolsRes.ok) {
        const schoolsData = await schoolsRes.json();
        setSchools(schoolsData);
      }

      if (busStopsRes.ok) {
        const busStopsData = await busStopsRes.json();
        setBusStops(busStopsData);
      }

      if (evRes.ok) {
        const evData = await evRes.json();
        setEvChargingSpots(evData);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching map data:', err);
      setError('Failed to load map data');
      setLoading(false);
    }
  };

  const toggleLayer = (layer) => {
    setSelectedLayers(prev => ({
      ...prev,
      [layer]: !prev[layer]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading map data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="container mx-auto px-4 pt-24 pb-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Interactive Location Map</h1>
          <p className="text-gray-600">Explore MRT stations, schools, bus stops, and EV charging locations across Singapore</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Layer Controls */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <h3 className="text-lg font-semibold mb-3">Show Layers</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => toggleLayer('mrt')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                selectedLayers.mrt 
                  ? 'border-red-500 bg-red-50 text-red-700' 
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              <Train className="w-5 h-5" />
              <span className="font-medium">MRT ({mrtStations.length})</span>
            </button>

            <button
              onClick={() => toggleLayer('schools')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                selectedLayers.schools 
                  ? 'border-green-500 bg-green-50 text-green-700' 
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              <School className="w-5 h-5" />
              <span className="font-medium">Schools ({schools.length})</span>
            </button>

            <button
              onClick={() => toggleLayer('busStops')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                selectedLayers.busStops 
                  ? 'border-blue-500 bg-blue-50 text-blue-700' 
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              <Bus className="w-5 h-5" />
              <span className="font-medium">Bus Stops ({busStops.length})</span>
            </button>

            <button
              onClick={() => toggleLayer('evCharging')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                selectedLayers.evCharging 
                  ? 'border-yellow-500 bg-yellow-50 text-yellow-700' 
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              <Zap className="w-5 h-5" />
              <span className="font-medium">EV Charging ({evChargingSpots.length})</span>
            </button>
          </div>
        </div>

        {/* Map Container */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden" style={{ height: '600px' }}>
          <MapContainer
            center={singaporeCenter}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* MRT Stations Layer */}
            {selectedLayers.mrt && mrtStations.map((station, idx) => (
              <Marker 
                key={`mrt-${idx}`}
                position={[station.latitude, station.longitude]}
                icon={createCustomIcon('#DC2626', 'train')}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                      <Train className="w-5 h-5 text-red-600" />
                      {station.stn_name}
                    </h3>
                    <p className="text-sm text-gray-600">Station Code: {station.stn_no}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {station.latitude.toFixed(6)}, {station.longitude.toFixed(6)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Schools Layer */}
            {selectedLayers.schools && schools.map((school, idx) => (
              school.latitude && school.longitude && (
                <Marker 
                  key={`school-${idx}`}
                  position={[school.latitude, school.longitude]}
                  icon={createCustomIcon('#16A34A', 'school')}
                >
                  <Popup>
                    <div className="p-2 max-w-xs">
                      <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                        <School className="w-5 h-5 text-green-600" />
                        {school.school_name}
                      </h3>
                      <p className="text-sm text-gray-700 mb-1">{school.address}</p>
                      {school.postal_code && (
                        <p className="text-sm text-gray-600">Postal: {school.postal_code}</p>
                      )}
                      {school.mainlevel_code && (
                        <p className="text-xs text-gray-500 mt-1">Level: {school.mainlevel_code}</p>
                      )}
                      {school.zone_code && (
                        <p className="text-xs text-gray-500">Zone: {school.zone_code}</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )
            ))}

            {/* Bus Stops Layer */}
            {selectedLayers.busStops && busStops.map((busStop, idx) => (
              <Marker 
                key={`bus-${idx}`}
                position={[busStop.latitude, busStop.longitude]}
                icon={createCustomIcon('#2563EB', 'bus')}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                      <Bus className="w-5 h-5 text-blue-600" />
                      {busStop.description || 'Bus Stop'}
                    </h3>
                    {busStop.road_name && (
                      <p className="text-sm text-gray-600">{busStop.road_name}</p>
                    )}
                    {busStop.bus_stop_code && (
                      <p className="text-sm text-gray-500">Code: {busStop.bus_stop_code}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {busStop.latitude.toFixed(6)}, {busStop.longitude.toFixed(6)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* EV Charging Spots Layer */}
            {selectedLayers.evCharging && evChargingSpots.map((evSpot, idx) => (
              <Marker 
                key={`ev-${idx}`}
                position={[evSpot.latitude, evSpot.longitude]}
                icon={createCustomIcon('#EAB308', 'zap')}
              >
                <Popup>
                  <div className="p-2 max-w-xs">
                    <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-600" />
                      {evSpot.name}
                    </h3>
                    {evSpot.building_name && (
                      <p className="text-sm text-gray-700 mb-1">{evSpot.building_name}</p>
                    )}
                    {evSpot.street_name && evSpot.block && (
                      <p className="text-sm text-gray-600">{evSpot.block} {evSpot.street_name}</p>
                    )}
                    {evSpot.postal_code && (
                      <p className="text-sm text-gray-600">Postal: {evSpot.postal_code}</p>
                    )}
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      {evSpot.num_chargers && (
                        <p className="text-sm text-gray-700">
                          <strong>{evSpot.num_chargers}</strong> charging outlet{evSpot.num_chargers > 1 ? 's' : ''}
                        </p>
                      )}
                      {evSpot.connector_types && (
                        <p className="text-xs text-gray-500 mt-1">
                          Type: {evSpot.connector_types}
                        </p>
                      )}
                      {evSpot.rated_power && (
                        <p className="text-xs text-gray-500">
                          Power: {evSpot.rated_power} kW
                        </p>
                      )}
                      {evSpot.is_public && (
                        <p className="text-xs text-green-600 mt-1">✓ Publicly accessible</p>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-lg shadow-md p-4 mt-4">
          <h3 className="text-lg font-semibold mb-3">Legend</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                <Train className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-gray-700">MRT Station</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <School className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-gray-700">School</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                <Bus className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-gray-700">Bus Stop</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-gray-700">EV Charging</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveMap;
