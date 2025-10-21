import React, { useEffect, useState } from 'react';
import Navigation from '../components/Navigation';
// icons rendered inline to avoid unused import lint

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function ListingCard({ property }) {
  const { flat_id, town, block, street_name, flat_type, resale_price, floor_area_sqm, remaining_lease_years_at_sale, postal_code } = property;

  const displayPrice = resale_price ? `S$ ${Number(resale_price).toLocaleString()}` : 'Price n/a';
  const title = street_name ? `${block} ${street_name}` : `${block}`;
  const subtitle = postal_code ? `${postal_code}` : town || '';

  return (
    <div className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition">
      <div className="flex">
        <div className="w-40 h-28 bg-gray-100 flex-shrink-0">
          {/* Placeholder image (replace with real image URL if available) */}
          <img
            src="https://images.unsplash.com/photo-1560184897-6b2a4f0c2fa5?q=80&w=800&auto=format&fit=crop&ixlib=rb-4.0.3&s=placeholder"
            alt={title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="p-4 flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500">{subtitle} • {flat_type || 'N/A'}</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-extrabold text-gray-900">{displayPrice}</div>
              <div className="text-xs text-gray-500">Flat ID: {flat_id}</div>
            </div>
          </div>

            {floor_area_sqm && <p className="mt-2 text-sm text-gray-600">{Math.round(floor_area_sqm)} sqm • {remaining_lease_years_at_sale ? Math.round(remaining_lease_years_at_sale) + ' yrs remaining' : ''}</p>}


          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center space-x-4 text-gray-500 text-sm">
              <div className="flex items-center space-x-1">
                <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 7h18M3 12h18M3 17h18" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span>{flat_type || '-'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 10h18M3 14h18" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span>{Math.round(floor_area_sqm || 0)} sqm</span>
              </div>
              <div className="flex items-center space-x-1">
                <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v20" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span>{remaining_lease_years_at_sale ? Math.round(remaining_lease_years_at_sale) + ' yrs' : '-'}</span>
              </div>
            </div>

            <div>
              <button className="px-3 py-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg text-sm">View</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Listings will be loaded from backend /api/listings; no local fallback

export default function WatchList() {
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('my'); // 'my' or 'explore'
  const [listings, setListings] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  // simple toast state
  const [toasts, setToasts] = useState([]);

  const pushToast = (message, type = 'info', ttl = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttl);
  };

  useEffect(() => {
    const fetchWatchlist = async () => {
      setLoading(true);
      setError(null);

      const userRaw = localStorage.getItem('user');
      const token = localStorage.getItem('token');

      if (!userRaw) {
        setError('Not signed in. Please sign in to see your watchlist.');
        setLoading(false);
        return;
      }

  // user info available in localStorage but not required client-side for fetching

      try {
        // Call secure endpoint that returns only the authenticated user's watchlist
        const res = await fetch(`${API_URL}/watchlist`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Server returned ${res.status}: ${text}`);
        }

        const data = await res.json();
        // Expect { success: true, watchlist: { user_id, properties: [...] } }
        const myWatchlist = data.watchlist || { properties: [] };

        if (!Array.isArray(myWatchlist.properties)) {
          setProperties([]);
        } else {
          setProperties(myWatchlist.properties);
        }
      } catch (err) {
        console.error('Watchlist fetch error:', err);
        setError('Failed to load watchlist.');
      } finally {
        setLoading(false);
      }
    };

    fetchWatchlist();
    // also preload recent listings for 'Explore' mode
    const fetchListings = async () => {
      try {
        const resp = await fetch(`${API_URL}/listings?limit=30`);
        if (!resp.ok) throw new Error(`Failed to load listings (${resp.status})`);
        const json = await resp.json();
  const fetched = json.listings || [];
  setListings(fetched);
      } catch (e) {
        console.error('Listing fetch error:', e);
  // on error, show empty list (no local fallback)
  setListings([]);
      }
    };
    fetchListings();
  }, []);

  const token = localStorage.getItem('token');

  const addToWatchlist = async (item) => {
    if (!token) return alert('Please sign in to save to your watchlist');
    setActionLoading(true);
    try {
      const resp = await fetch(`${API_URL}/watchlist/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ flat_id: item.flat_id, town: item.town, block: item.block, street_name: item.street_name, flat_type: item.flat_type })
      });
      const json = await resp.json();
      if (!json.success) throw new Error(json.message || 'Failed');
      setProperties(json.watchlist.properties || []);
  pushToast('Added to watchlist', 'success');
    } catch (e) {
      console.error('Add error:', e);
  pushToast('Failed to add to watchlist', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const removeFromWatchlist = async (flatId) => {
    if (!token) {
      pushToast('Please sign in to update your watchlist', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const resp = await fetch(`${API_URL}/watchlist/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ flat_id: flatId })
      });
      const json = await resp.json();
      if (!json.success) throw new Error(json.message || 'Failed');
      setProperties(json.watchlist ? (json.watchlist.properties || []) : []);
  pushToast('Removed from watchlist', 'success');
    } catch (e) {
      console.error('Remove error:', e);
  pushToast('Failed to remove from watchlist', 'error');
    } finally {
      setActionLoading(false);
    }
  };
  // prepare content to render (avoid nested ternaries to prevent accidental double-render)
  let content = null;

  if (loading) {
    content = (
      <div className="flex items-center justify-center py-24">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  } else if (error) {
    content = <div className="p-6 bg-white border-2 border-red-100 rounded-2xl text-red-600">{error}</div>;
  } else if (mode === 'my') {
    if (!properties || properties.length === 0) {
      content = (
        <div className="p-10 bg-white border-2 border-gray-200 rounded-2xl text-center text-gray-600">
          <p className="text-lg font-medium">You don't have any saved properties yet.</p>
          <p className="mt-2">Find resale listings and add them to your watchlist.</p>
          <div className="mt-6 flex items-center justify-center space-x-3">
            <button onClick={() => setMode('explore')} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Explore Listings</button>
            <button onClick={() => { setMode('explore'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-4 py-2 bg-white border rounded-lg">Explore &amp; Scroll</button>
          </div>

          {listings && listings.length > 0 && (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              {listings.slice(0, 3).map((l) => (
                <div key={l.flat_id} className="bg-gray-50 p-3 border rounded-lg text-left">
                  <div className="text-sm font-semibold">{l.block} {l.street_name}</div>
                  <div className="text-xs text-gray-500">{l.town} • {l.flat_type}</div>
                  <div className="text-sm font-bold mt-2">{l.resale_price ? `S$ ${Number(l.resale_price).toLocaleString()}` : 'Price n/a'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    } else {
      content = (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((p, idx) => (
            <div key={p.flat_id || idx}>
              <ListingCard property={p} />
              <div className="mt-2 flex justify-end">
                <button onClick={() => removeFromWatchlist(p.flat_id)} disabled={actionLoading} className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm">Remove</button>
              </div>
            </div>
          ))}
        </div>
      );
    }
  } else {
    // explore mode
    content = (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map((l, i) => (
          <div key={l.flat_id || i}>
            <ListingCard property={l} />
            <div className="mt-2 flex justify-between items-center">
              <div className="text-sm text-gray-500">{new Date(l.contract_date).toLocaleDateString()}</div>
              <button onClick={() => addToWatchlist(l)} disabled={actionLoading} className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm">Add</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {/* Toast container */}
      <div className="fixed top-6 right-6 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className={`px-4 py-2 rounded shadow-md text-sm ${t.type === 'success' ? 'bg-green-500 text-white' : t.type === 'error' ? 'bg-red-500 text-white' : 'bg-gray-800 text-white'}`}>
            {t.message}
          </div>
        ))}
      </div>

      <div className="pt-28 pb-12 px-6 max-w-7xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-black text-gray-900">{mode === 'explore' ? 'Explore Listings' : 'My Watchlist'}</h1>
            <p className="text-gray-600 mt-2">{mode === 'explore' ? 'Browse recent resale transactions and add items to your watchlist.' : `Saved properties you're watching. We'll track price changes and let you set alerts.`}</p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setMode('my')}
              className={`px-4 py-2 rounded-lg ${mode === 'my' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>
              My Watchlist
            </button>
            <button
              onClick={() => setMode('explore')}
              className={`px-4 py-2 rounded-lg ${mode === 'explore' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>
              Explore Listings
            </button>
          </div>
        </div>

        {content}
      </div>
    </div>
  );
}
