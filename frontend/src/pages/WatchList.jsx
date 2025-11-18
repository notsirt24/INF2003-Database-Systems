import React, { useEffect, useState } from 'react';
import Navigation from '../components/Navigation';
import { Link } from 'react-router-dom';
// icons rendered inline to avoid unused import lint

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function ListingCard({ property, onAddToWatchlist, onRemoveFromWatchlist, onToggleCompare, isCompared = false, actionLoading, mode = 'explore', isSaved = false }) {
  const { town, block, street_name, flat_type, resale_price, floor_area_sqm, remaining_lease_years_at_sale, block_min_price, block_max_price, merged_count } = property;
  const canAdd = typeof onAddToWatchlist === 'function';
  const canRemove = typeof onRemoveFromWatchlist === 'function';
  if (canAdd && canRemove) {
    // unexpected: both handlers provided — prefer remove button in this case
    console.debug('[ListingCard] both onAdd and onRemove provided for flat_id:', property && property.flat_id);
  }

  // Show block-level min/max range only when we have merged multiple transactions for the address.
  let displayPrice = 'Price n/a';
  if (mode === 'explore' && merged_count > 1 && block_min_price != null && block_max_price != null) {
    displayPrice = `S$ ${Number(block_min_price).toLocaleString()} - S$ ${Number(block_max_price).toLocaleString()}`;
  } else if (resale_price) {
    displayPrice = `S$ ${Number(resale_price).toLocaleString()}`;
  }
  const title = street_name ? `${block} ${street_name}` : `${block}`;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition flex flex-col">
      <div className="w-full h-48 bg-gray-100 relative">
        {/* Listing cover image served from public folder */}
        <img
          src={(process.env.PUBLIC_URL || '') + '/images/listing_cover_image.jpg'}
          alt={title}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1560184897-6b2a4f0c2fa5?q=80&w=800&auto=format&fit=crop&ixlib=rb-4.0.3&s=placeholder'; }}
        />
        {merged_count && merged_count > 1 && (
          <div
            className="absolute top-2 right-2 bg-blue-600 px-2 py-1 rounded-full text-xs font-semibold text-white shadow-lg z-10"
            title={`${merged_count} transactions`}
            aria-label={`${merged_count} transactions`}
          >
            {merged_count} transactions
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex-1">
          <div className="mb-3">
            <div className="text-sm text-gray-900 mb-1">{town || '-'} • {flat_type || '-'}</div>
            <div className="text-lg font-bold text-gray-900 mb-1">{title}</div>
            {/* merged_count badge handled in image area; no inline debug text */}
            <div className="text-lg font-extrabold text-gray-900">{displayPrice}</div>
          </div>

          <div className="flex flex-wrap gap-2 text-gray-500 text-sm">
            <div className="inline-flex items-center space-x-1 bg-gray-50 px-2 py-1 rounded-md">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 21h18M5 21V8l7-5 7 5v13" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 12h4v9h-4z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="truncate">{flat_type || '-'}</span>
            </div>
            <div className="inline-flex items-center space-x-1 bg-gray-50 px-2 py-1 rounded-md">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M4 4h16v16H4z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4 4l16 16M20 4L4 20" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="truncate">{floor_area_sqm ? `${Math.round(floor_area_sqm)} m²` : '0 m²'}</span>
            </div>
            <div className="inline-flex items-center space-x-1 bg-gray-50 px-2 py-1 rounded-md">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 7v5l3 3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="truncate">{remaining_lease_years_at_sale ? `${Math.round(remaining_lease_years_at_sale)} yrs` : '-'}</span>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end items-center space-x-3">
          {mode === 'my' ? (
            <>
              {/* compare toggle */}
              <button
                onClick={() => typeof onToggleCompare === 'function' ? onToggleCompare(property.flat_id) : null}
                disabled={actionLoading}
                aria-pressed={isCompared}
                className={`p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isCompared ? 'bg-yellow-50 text-yellow-600' : 'text-gray-400 hover:text-yellow-600'}`}
                title={isCompared ? 'Remove from comparison' : 'Compare this property'}
              >
                {/* simple compare icon */}
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 7h7v14H3zM14 3h7v18h-7z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              {canRemove ? (
                <button
                  onClick={() => onRemoveFromWatchlist(property.flat_id)}
                  disabled={actionLoading}
                  className="p-2 text-red-500 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-50"
                  title="Remove from Watchlist"
                >
                  <svg className="w-7 h-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              ) : null}
            </>
          ) : (mode === 'explore' && canAdd) ? (
            // In explore mode show a bookmark toggle: add when not saved, remove when saved
            <button
              onClick={() => isSaved ? (typeof onRemoveFromWatchlist === 'function' ? onRemoveFromWatchlist(property.flat_id) : null) : onAddToWatchlist(property)}
              disabled={actionLoading}
              className={`p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isSaved ? 'hover:bg-yellow-50' : 'text-gray-400 hover:text-green-600'}`}
              title={isSaved ? 'Remove from Watchlist' : 'Add to Watchlist'}
              aria-pressed={isSaved}
            >
              {isSaved ? (
                <svg className="w-7 h-7 text-yellow-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M6 2c-.55 0-1 .45-1 1v18l7-4 7 4V3c0-.55-.45-1-1-1H6z" />
                </svg>
              ) : (
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ) : null}
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
  const mode = 'my';
  const [actionLoading, setActionLoading] = useState(false);
  const [compareSelections, setCompareSelections] = useState([]);
  const toggleCompare = (flatId) => {
    setCompareSelections(prev => {
      if (!flatId) return prev;
      const s = Array.isArray(prev) ? prev.slice() : [];
      const idx = s.indexOf(flatId);
      if (idx >= 0) { s.splice(idx, 1); return s; }
      s.push(flatId); return s;
    });
  };
  const clearCompare = () => setCompareSelections([]);
  // no toast UI — use console logs / alerts for feedback

  // Explore listings removed from this page; this component shows only 'My Watchlist'.

  // Fetch watchlist whenever the user switches to 'my' mode
  useEffect(() => {
    if (mode !== 'my') return;

    (async () => {
      setLoading(true);
      setError(null);

      // Check both localStorage and sessionStorage for user data
      const userRaw = localStorage.getItem('user') || sessionStorage.getItem('user');
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');

      if (!userRaw) {
        setError('Not signed in. Please sign in to see your watchlist.');
        setLoading(false);
        setProperties([]);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/watchlist`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Server returned ${res.status}: ${text}`);
        }

        const data = await res.json();
        // debug server response
        try { console.debug('[WatchList] GET /watchlist response:', data); } catch (e) {}
  const myWatchlist = data.watchlist || { properties: [] };
        // dedupe by flat_id to avoid duplicate cards in UI while backend is investigated
        const propsArr = Array.isArray(myWatchlist.properties) ? myWatchlist.properties : [];
        const seen = new Set();
        const deduped = [];
        for (const p of propsArr) {
          const id = p && p.flat_id;
          if (id == null) { deduped.push(p); continue; }
          if (!seen.has(String(id))) {
            seen.add(String(id));
            deduped.push(p);
          }
        }
        setProperties(deduped);
      } catch (err) {
        console.error('Watchlist fetch error:', err);
        setError('Failed to load watchlist.');
        setProperties([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [mode]);

  const token = localStorage.getItem('token') || sessionStorage.getItem('token');

  // adding from explore removed — watchlist page only supports removal

  const removeFromWatchlist = async (flatId) => {
    if (!token) {
      alert('Please sign in to update your watchlist');
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
      console.log('Removed from watchlist');
    } catch (e) {
      console.error('Remove error:', e);
  alert('Failed to remove from watchlist');
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
          <div className="mt-6 flex items-center justify-center">
            <Link to="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Browse Listings</Link>
          </div>
        </div>
      );
    } else {
      content = (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(() => {
            try { console.debug('[WatchList:my] rendering properties flat_ids:', (properties || []).map(p => p.flat_id)); } catch(e) {}
            return properties.map((p, idx) => (
              <ListingCard 
                key={p.flat_id || idx}
                property={p}
                onRemoveFromWatchlist={removeFromWatchlist}
                onToggleCompare={toggleCompare}
                isCompared={compareSelections.includes(p.flat_id)}
                actionLoading={actionLoading}
                mode="my"
              />
            ));
          })()}
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {/* no toast UI; use console / alert for feedback */}

      <div className="pt-28 pb-12 px-6 max-w-7xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-5xl font-black text-gray-900">My Watchlist</h1>
            <p className="text-xl text-gray-600 mt-2">Saved properties you're watching.</p>
          </div>
        </div>

        {/* Comparison panel: appears when user selects listings to compare */}
        {compareSelections && compareSelections.length > 0 && (
          <section className="mb-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Compare ({compareSelections.length})</h3>
                <div className="flex items-center space-x-2">
                  <button onClick={clearCompare} className="px-3 py-1 rounded-md border text-sm text-gray-700 hover:bg-gray-100">Clear</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {properties.filter(p => compareSelections.includes(p.flat_id)).map((p) => (
                  <div key={p.flat_id} className="bg-gray-50 border rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-gray-600">{p.town} • {p.flat_type}</div>
                        <div className="text-lg font-bold">{p.block} {p.street_name}</div>
                        <div className="text-sm font-extrabold mt-2">{p.resale_price ? `S$ ${Number(p.resale_price).toLocaleString()}` : 'Price n/a'}</div>
                      </div>
                      <button onClick={() => toggleCompare(p.flat_id)} className="text-red-500 ml-2" title="Remove from compare">
                        ×
                      </button>
                    </div>

                    <div className="mt-3 text-sm text-gray-700 space-y-1">
                      <div><strong>Area:</strong> {p.floor_area_sqm ? `${Math.round(p.floor_area_sqm)} m²` : '—'}</div>
                      <div><strong>Lease left:</strong> {p.remaining_lease_years_at_sale ? `${Math.round(p.remaining_lease_years_at_sale)} yrs` : '—'}</div>
                      {p.merged_count && p.merged_count > 1 && <div><strong>Transactions:</strong> {p.merged_count}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {content}
      </div>
    </div>
  );
}
