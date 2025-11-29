import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Navigation from '../components/Navigation';
import { MapPin, Train, Bus, Zap, School, Loader2, Search, Navigation as NavigationIcon, Clock, DollarSign, CheckCircle, AlertCircle, PersonStanding, Bike, Car } from 'lucide-react';

// API endpoint for backend queries
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

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

// Component to handle map view updates
const MapViewController = ({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center && zoom) {
      map.setView(center, zoom, { animate: true });
    }
  }, [center, zoom, map]);
  
  return null;
};

export default function InteractiveMap() {
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
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [schoolFilter, setSchoolFilter] = useState('all'); // all, primary, secondary, jc
  const [mapCenter, setMapCenter] = useState([1.3521, 103.8198]);
  const [mapZoom, setMapZoom] = useState(12);
  const [selectedLocation, setSelectedLocation] = useState(null); // For clicked search results

  // Route planning state
  const [routeStart, setRouteStart] = useState(null);
  const [routeEnd, setRouteEnd] = useState(null);
  const [routePolyline, setRoutePolyline] = useState([]);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState(null);
  const [routeEtaMinutes, setRouteEtaMinutes] = useState(null);
  const [nearestTransit, setNearestTransit] = useState({ mrt: null, bus: null });
  const [routeMode, setRouteMode] = useState('walking');
  const [toastMessage, setToastMessage] = useState(null);

  const singaporeCenter = [1.3521, 103.8198];

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    fetchMapData();
  }, []);

  const fetchMapData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [mrtRes, schoolsRes, busStopsRes, evRes] = await Promise.all([
        fetch(`${API_URL}/map/mrt-stations`),
        fetch(`${API_URL}/map/schools`),
        fetch(`${API_URL}/map/bus-stops`),
        fetch(`${API_URL}/map/ev-charging`)
      ]);

      if (mrtRes.ok) {
        const mrtData = await mrtRes.json();
        setMrtStations(mrtData);
      }

      if (schoolsRes.ok) {
        const schoolsData = await schoolsRes.json();
        // Log first school to see the data structure
        if (schoolsData.length > 0) {

        }
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

  // Haversine distance in meters
  const haversine = (lat1, lon1, lat2, lon2) => {
    const toRad = (deg) => deg * Math.PI / 180;
    const R = 6371000; // meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Build/update route when start and end are set
  useEffect(() => {
    if (routeStart && routeEnd) {
      const poly = [
        [routeStart.latitude, routeStart.longitude],
        [routeEnd.latitude, routeEnd.longitude]
      ];
      setRoutePolyline(poly);

      const dist = haversine(
        routeStart.latitude,
        routeStart.longitude,
        routeEnd.latitude,
        routeEnd.longitude
      );
      setRouteDistanceMeters(Math.round(dist));
      
      let speed;
      switch(routeMode) {
        case 'walking': speed = 83.33; break;
        case 'cycling': speed = 250; break;
        case 'driving': speed = 666.67; break;
        default: speed = 83.33; break;
      }
      setRouteEtaMinutes(Math.max(1, Math.round(dist / speed)));

      // Center roughly between start and end
      const midLat = (routeStart.latitude + routeEnd.latitude) / 2;
      const midLng = (routeStart.longitude + routeEnd.longitude) / 2;
      setMapCenter([midLat, midLng]);
      setMapZoom(13);
    } else {
      setRoutePolyline([]);
      setRouteDistanceMeters(null);
      setRouteEtaMinutes(null);
      setNearestTransit({ mrt: null, bus: null });
    }
  }, [routeStart, routeEnd, routeMode]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = [];

    // Search MRT stations
    mrtStations.forEach(station => {
      if (station.stn_name?.toLowerCase().includes(query) || 
          station.stn_no?.toLowerCase().includes(query)) {
        results.push({
          ...station,
          type: 'MRT Station',
          displayName: station.stn_name,
          subtitle: `Station Code: ${station.stn_no}`,
          color: 'red'
        });
      }
    });

    // Search schools
    schools.forEach(school => {
      if (school.school_name?.toLowerCase().includes(query)) {
        results.push({
          ...school,
          type: 'School',
          displayName: school.school_name,
          subtitle: school.mainlevel_code || 'School',
          color: 'green'
        });
      }
    });

    // Search bus stops
    busStops.forEach(bus => {
      if (bus.description?.toLowerCase().includes(query) || 
          bus.bus_stop_code?.includes(query)) {
        results.push({
          ...bus,
          type: 'Bus Stop',
          displayName: bus.description,
          subtitle: `Code: ${bus.bus_stop_code}`,
          color: 'blue'
        });
      }
    });

    // Search EV charging
    evChargingSpots.forEach(ev => {
      if (ev.name?.toLowerCase().includes(query) || 
          ev.building_name?.toLowerCase().includes(query)) {
        results.push({
          ...ev,
          type: 'EV Charging',
          displayName: ev.name,
          subtitle: ev.building_name || 'EV Charging Station',
          color: 'yellow'
        });
      }
    });

    setSearchResults(results.slice(0, 10)); // Limit to 10 results
    setShowSearchResults(true);
  }, [searchQuery, mrtStations, schools, busStops, evChargingSpots]);

  // Handle search result click
  const handleSearchResultClick = (result) => {

    if (result.latitude && result.longitude) {
      const newCenter = [result.latitude, result.longitude];

      setMapCenter(newCenter);
      setMapZoom(17);
      setSelectedLocation(result); // Set the selected location to show its popup
      setSearchQuery('');
      setShowSearchResults(false);
    }
  };

  const createLocation = (type, entity) => {
    switch (type) {
      case 'MRT Station':
        return {
          type,
          name: entity.stn_name || entity.displayName,
          latitude: entity.latitude,
          longitude: entity.longitude,
          subtitle: entity.stn_no || entity.line_code || ''
        };
      case 'School':
        return {
          type,
          name: entity.school_name || entity.displayName,
          latitude: entity.latitude,
          longitude: entity.longitude,
          subtitle: entity.address || ''
        };
      case 'Bus Stop':
        return {
          type,
          name: entity.description || entity.displayName,
          latitude: entity.latitude,
          longitude: entity.longitude,
          subtitle: entity.bus_stop_code || entity.road_name || ''
        };
      case 'EV Charging':
        return {
          type,
          name: entity.name || entity.displayName,
          latitude: entity.latitude,
          longitude: entity.longitude,
          subtitle: entity.building_name || ''
        };
      default:
        return null;
    }
  };

  // Nearest transit fetchers
  const findNearest = async (from, kind) => {
    if (!from) return;
    try {
      const typeMap = { mrt: 'mrt', bus: 'bus' };
      const type = typeMap[kind];
      const url = `/api/map/nearby?lat=${from.latitude}&lng=${from.longitude}&type=${encodeURIComponent(type)}&radius=1500`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch nearest');
      const data = await res.json();
      const best = data && data.length ? data[0] : null;
      setNearestTransit(prev => ({ ...prev, [kind]: best }));
    } catch (e) {
      console.error('Nearest fetch failed', e);
    }
  };

  // Filter data based on filters
  const getFilteredSchools = () => {
    if (schoolFilter === 'all') return schools;
    
    const filtered = schools.filter(school => {
      const level = school.mainlevel_code?.toUpperCase() || '';
      if (schoolFilter === 'primary') return level === 'PRIMARY';
      if (schoolFilter === 'secondary') return level === 'SECONDARY';
      if (schoolFilter === 'jc') return level === 'JUNIOR COLLEGE' || level === 'PRE-UNIVERSITY';
      return true;
    });
    

    return filtered;
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

        {/* Route Planner */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <NavigationIcon className="w-5 h-5 text-purple-600" /> Route Planner
          </h3>
          
          {/* Travel Mode Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Travel Mode</label>
            <div className="flex gap-2">
              {[
                { id: 'walking', label: 'Walking', icon: PersonStanding },
                { id: 'cycling', label: 'Cycling', icon: Bike },
                { id: 'driving', label: 'Driving', icon: Car }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setRouteMode(mode.id)}
                  className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                    routeMode === mode.id
                      ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                      : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                  }`}
                >
                  <mode.icon className="w-4 h-4" />
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Start</div>
              <div className="text-sm text-gray-800">
                {routeStart ? (
                  <>
                    <span className="font-medium">{routeStart.name}</span>
                    {routeStart.subtitle && <span className="text-gray-500"> — {routeStart.subtitle}</span>}
                  </>
                ) : 'Select any marker and click “Set as Start”'}
              </div>
            </div>
            <div className="p-3 rounded border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Destination</div>
              <div className="text-sm text-gray-800">
                {routeEnd ? (
                  <>
                    <span className="font-medium">{routeEnd.name}</span>
                    {routeEnd.subtitle && <span className="text-gray-500"> — {routeEnd.subtitle}</span>}
                  </>
                ) : 'Select any marker and click “Set as Destination”'}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <button
              onClick={() => { setRouteStart(null); setRouteEnd(null); setSelectedLocation(null); setRoutePolyline([]); setMapCenter([1.3521, 103.8198]); setMapZoom(12); setNearestTransit({mrt:null,bus:null}); }}
              className="px-4 py-2 rounded bg-gray-100 text-gray-800 hover:bg-gray-200"
            >
              Clear Route
            </button>
            <button
              onClick={() => { if (routeStart && routeEnd) { const s=routeStart; setRouteStart(routeEnd); setRouteEnd(s);} }}
              disabled={!routeStart || !routeEnd}
              className={`px-4 py-2 rounded ${routeStart && routeEnd ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
            >
              Swap Start/Destination
            </button>
            {routeStart && !routeEnd && (
              <>
                <button
                  onClick={() => findNearest(routeStart, 'mrt')}
                  className="px-4 py-2 rounded bg-red-100 text-red-700 hover:bg-red-200"
                >
                  Find nearest MRT
                </button>
                <button
                  onClick={() => findNearest(routeStart, 'bus')}
                  className="px-4 py-2 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                >
                  Find nearest Bus Stop
                </button>
              </>
            )}
          </div>

          {(routeDistanceMeters || nearestTransit.mrt || nearestTransit.bus) && (
            <div className="mt-4 space-y-4">
              {routeDistanceMeters && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded border border-purple-200 bg-purple-50">
                    <div className="text-xs text-purple-700 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Distance
                    </div>
                    <div className="text-lg font-semibold text-purple-800">{(routeDistanceMeters/1000).toFixed(2)} km</div>
                    <div className="text-xs text-purple-700">Straight line</div>
                  </div>
                  
                  <div className="p-3 rounded border border-blue-200 bg-blue-50">
                    <div className="text-xs text-blue-700 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Travel Time
                    </div>
                    <div className="text-lg font-semibold text-blue-800">
                      {routeMode === 'walking' && `${Math.ceil(routeDistanceMeters / 83.33)} min`}
                      {routeMode === 'cycling' && `${Math.ceil(routeDistanceMeters / 250)} min`}
                      {routeMode === 'driving' && `${Math.ceil(routeDistanceMeters / 666.67)} min`}
                    </div>
                    <div className="text-xs text-blue-700 capitalize">{routeMode}</div>
                  </div>
                  
                  <div className="p-3 rounded border border-green-200 bg-green-50">
                    <div className="text-xs text-green-700 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Est. Cost
                    </div>
                    <div className="text-lg font-semibold text-green-800">
                      {routeMode === 'walking' && 'Free'}
                      {routeMode === 'cycling' && 'Free'}
                      {routeMode === 'driving' && `$${(routeDistanceMeters / 1000 * 0.22).toFixed(2)}`}
                    </div>
                    <div className="text-xs text-green-700">
                      {routeMode === 'driving' ? 'Fuel + ERP' : 'No cost'}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Transit suggestions */}
              {(nearestTransit.mrt || nearestTransit.bus) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {nearestTransit.mrt && (
                  <div className="p-3 rounded border border-red-200 bg-red-50">
                    <div className="text-xs text-red-700 flex items-center gap-1">
                      <Train className="w-3 h-3" /> Nearest MRT
                    </div>
                    <div className="text-sm font-medium text-red-800">{nearestTransit.mrt.stn_name}</div>
                    <button
                      onClick={() => {
                        setRouteEnd(createLocation('MRT Station', nearestTransit.mrt));
                        showToast(`Set ${nearestTransit.mrt.stn_name} as destination`, 'success');
                      }}
                      className="mt-2 px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700 flex items-center gap-1"
                    >
                      <NavigationIcon className="w-3 h-3" />
                      Set as Destination
                    </button>
                  </div>
                )}
                {nearestTransit.bus && (
                  <div className="p-3 rounded border border-blue-200 bg-blue-50">
                    <div className="text-xs text-blue-700 flex items-center gap-1">
                      <Bus className="w-3 h-3" /> Nearest Bus Stop
                    </div>
                    <div className="text-sm font-medium text-blue-800">{nearestTransit.bus.description || 'Bus Stop'} ({nearestTransit.bus.bus_stop_code})</div>
                    <button
                      onClick={() => {
                        setRouteEnd(createLocation('Bus Stop', nearestTransit.bus));
                        showToast(`Set bus stop ${nearestTransit.bus.bus_stop_code} as destination`, 'success');
                      }}
                      className="mt-2 px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"
                    >
                      <NavigationIcon className="w-3 h-3" />
                      Set as Destination
                    </button>
                  </div>
                )}
              </div>
              )}
            </div>
          )}
        </div>

        {/* Search Bar and Reset Button */}
        <div className="mb-4 flex gap-3">
          <div className="flex-1 relative">
            <div className="relative">
              <input
                type="text"
                placeholder="Search for MRT stations, schools, bus stops, or EV charging stations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearchResults(false);
                  }}
                  className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          
          {/* Reset View Button */}
          <button
            onClick={() => {
              setMapCenter([1.3521, 103.8198]);
              setMapZoom(12);
              setSelectedLocation(null);
              setSchoolFilter('all');
              // Clear any active route
              setRouteStart(null);
              setRouteEnd(null);
              setRoutePolyline([]);
              setRouteDistanceMeters(null);
              setRouteEtaMinutes(null);
              setNearestTransit({ mrt: null, bus: null });
            }}
            disabled={!selectedLocation && schoolFilter === 'all'}
            className={`px-6 py-3 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              selectedLocation || schoolFilter !== 'all'
                ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <span>↻</span> Reset View
          </button>
        </div>
        
        <div className="relative">

          {/* Search Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute z-50 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  onClick={() => handleSearchResultClick(result)}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-3 h-3 rounded-full bg-${result.color}-500`}></span>
                        <p className="font-semibold text-gray-800">{result.displayName}</p>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{result.subtitle}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        <span className={`px-2 py-0.5 bg-${result.color}-100 text-${result.color}-700 rounded text-xs font-medium`}>
                          {result.type}
                        </span>
                      </p>
                    </div>
                    <MapPin className="w-4 h-4 text-gray-400 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {showSearchResults && searchResults.length === 0 && searchQuery && (
            <div className="absolute z-50 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4">
              <p className="text-gray-500 text-center">No results found for "{searchQuery}"</p>
            </div>
          )}
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Search className="w-5 h-5 text-gray-600" /> Filters
          </h3>
          {/* School Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">School Level</label>
            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">All Schools</option>
              <option value="primary">Primary Schools</option>
              <option value="secondary">Secondary Schools</option>
              <option value="jc">Junior Colleges</option>
            </select>
          </div>
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
            <MapViewController center={mapCenter} zoom={mapZoom} />
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
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => {
                          setRouteStart(createLocation('MRT Station', station));
                          showToast(`Set ${station.stn_name} as starting point`, 'success');
                        }}
                        className="px-3 py-1.5 text-xs rounded bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Set as Start
                      </button>
                      <button
                        onClick={() => {
                          setRouteEnd(createLocation('MRT Station', station));
                          showToast(`Set ${station.stn_name} as destination`, 'success');
                        }}
                        className="px-3 py-1.5 text-xs rounded bg-gray-100 text-gray-800 hover:bg-gray-200 flex items-center gap-1"
                      >
                        <NavigationIcon className="w-3 h-3" />
                        Set as Destination
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Schools Layer */}
            {selectedLayers.schools && getFilteredSchools().map((school, idx) => (
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
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => {
                            setRouteStart(createLocation('School', school));
                            showToast(`Set ${school.school_name} as starting point`, 'success');
                          }}
                          className="px-3 py-1.5 text-xs rounded bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Set as Start
                        </button>
                        <button
                          onClick={() => {
                            setRouteEnd(createLocation('School', school));
                            showToast(`Set ${school.school_name} as destination`, 'success');
                          }}
                          className="px-3 py-1.5 text-xs rounded bg-gray-100 text-gray-800 hover:bg-gray-200 flex items-center gap-1"
                        >
                          <NavigationIcon className="w-3 h-3" />
                          Set as Destination
                        </button>
                      </div>
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
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => {
                          setRouteStart(createLocation('Bus Stop', busStop));
                          showToast(`Set bus stop ${busStop.bus_stop_code} as starting point`, 'success');
                        }}
                        className="px-3 py-1.5 text-xs rounded bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Set as Start
                      </button>
                      <button
                        onClick={() => {
                          setRouteEnd(createLocation('Bus Stop', busStop));
                          showToast(`Set bus stop ${busStop.bus_stop_code} as destination`, 'success');
                        }}
                        className="px-3 py-1.5 text-xs rounded bg-gray-100 text-gray-800 hover:bg-gray-200 flex items-center gap-1"
                      >
                        <NavigationIcon className="w-3 h-3" />
                        Set as Destination
                      </button>
                    </div>
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
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => {
                            setRouteStart(createLocation('EV Charging', evSpot));
                            showToast(`Set ${evSpot.name} as starting point`, 'success');
                          }}
                          className="px-3 py-1.5 text-xs rounded bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Set as Start
                        </button>
                        <button
                          onClick={() => {
                            setRouteEnd(createLocation('EV Charging', evSpot));
                            showToast(`Set ${evSpot.name} as destination`, 'success');
                          }}
                          className="px-3 py-1.5 text-xs rounded bg-gray-100 text-gray-800 hover:bg-gray-200 flex items-center gap-1"
                        >
                          <NavigationIcon className="w-3 h-3" />
                          Set as Destination
                        </button>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Route polyline */}
            {routePolyline.length === 2 && (
              <Polyline
                positions={routePolyline}
                pathOptions={{ color: '#7C3AED', weight: 4, opacity: 0.85 }}
              />
            )}

            {/* Selected Location Marker (from search results) */}
            {selectedLocation && selectedLocation.latitude && selectedLocation.longitude && (
              <Marker
                position={[selectedLocation.latitude, selectedLocation.longitude]}
                icon={createCustomIcon(
                  selectedLocation.type === 'MRT Station' ? '#DC2626' :
                  selectedLocation.type === 'School' ? '#16A34A' :
                  selectedLocation.type === 'Bus Stop' ? '#2563EB' : '#EAB308',
                  selectedLocation.type === 'MRT Station' ? 'train' :
                  selectedLocation.type === 'School' ? 'school' :
                  selectedLocation.type === 'Bus Stop' ? 'bus' : 'zap'
                )}
                eventHandlers={{
                  popupclose: () => setSelectedLocation(null)
                }}
              >
                <Popup autoOpen={true}>
                  <div className="p-2 max-w-xs">
                    <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                      {selectedLocation.type === 'MRT Station' && <Train className="w-5 h-5 text-red-600" />}
                      {selectedLocation.type === 'School' && <School className="w-5 h-5 text-green-600" />}
                      {selectedLocation.type === 'Bus Stop' && <Bus className="w-5 h-5 text-blue-600" />}
                      {selectedLocation.type === 'EV Charging' && <Zap className="w-5 h-5 text-yellow-600" />}
                      {selectedLocation.displayName}
                    </h3>
                    <p className="text-sm text-gray-700 mb-1">{selectedLocation.subtitle}</p>
                    
                    {/* MRT specific details */}
                    {selectedLocation.type === 'MRT Station' && selectedLocation.line_code && (
                      <p className="text-xs text-gray-600">Line: {selectedLocation.line_code}</p>
                    )}
                    
                    {/* School specific details */}
                    {selectedLocation.type === 'School' && (
                      <>
                        {selectedLocation.address && <p className="text-sm text-gray-700 mb-1">{selectedLocation.address}</p>}
                        {selectedLocation.postal_code && <p className="text-sm text-gray-600">Postal: {selectedLocation.postal_code}</p>}
                        {selectedLocation.mainlevel_code && <p className="text-xs text-gray-600">Level: {selectedLocation.mainlevel_code}</p>}
                      </>
                    )}
                    
                    {/* Bus Stop specific details */}
                    {selectedLocation.type === 'Bus Stop' && (
                      <>
                        {selectedLocation.bus_stop_code && <p className="text-sm text-gray-600">Code: {selectedLocation.bus_stop_code}</p>}
                        {selectedLocation.road_name && <p className="text-sm text-gray-600">Road: {selectedLocation.road_name}</p>}
                      </>
                    )}
                    
                    {/* EV Charging specific details */}
                    {selectedLocation.type === 'EV Charging' && (
                      <>
                        {selectedLocation.building_name && <p className="text-sm text-gray-700 mb-1">{selectedLocation.building_name}</p>}
                        {selectedLocation.connector_types && <p className="text-xs text-gray-500 mt-1">Type: {selectedLocation.connector_types}</p>}
                      </>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => {
                          setRouteStart(createLocation(selectedLocation.type, selectedLocation));
                          showToast(`Set ${selectedLocation.displayName} as starting point`, 'success');
                        }}
                        className="px-3 py-1.5 text-xs rounded bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Set as Start
                      </button>
                      <button
                        onClick={() => {
                          setRouteEnd(createLocation(selectedLocation.type, selectedLocation));
                          showToast(`Set ${selectedLocation.displayName} as destination`, 'success');
                        }}
                        className="px-3 py-1.5 text-xs rounded bg-gray-100 text-gray-800 hover:bg-gray-200 flex items-center gap-1"
                      >
                        <NavigationIcon className="w-3 h-3" />
                        Set as Destination
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}
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
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className={`fixed top-24 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
            toastMessage.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {toastMessage.type === 'success' ? 
                <CheckCircle className="w-5 h-5" /> : 
                <AlertCircle className="w-5 h-5" />
              }
              <span className="font-medium">{toastMessage.message}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
