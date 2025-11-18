import React, { useEffect, useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function ListingCardMini({ property, onAddToWatchlist, onRemoveFromWatchlist, actionLoading, mode = 'explore', isSaved = false }) {
  const { town, block, street_name, flat_type, resale_price, block_min_price, block_max_price, merged_count } = property || {};
  const title = street_name ? `${block} ${street_name}` : `${block}`;
  let displayPrice = 'Price n/a';
  if (mode === 'explore' && merged_count > 1 && block_min_price != null && block_max_price != null) {
    displayPrice = `S$ ${Number(block_min_price).toLocaleString()} - S$ ${Number(block_max_price).toLocaleString()}`;
  } else if (resale_price) {
    displayPrice = `S$ ${Number(resale_price).toLocaleString()}`;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition flex flex-col">
      <div className="w-full h-40 bg-gray-100 relative">
        <img
          src={(process.env.PUBLIC_URL || '') + '/images/listing_cover_image.jpg'}
          alt={title}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1560184897-6b2a4f0c2fa5?q=80&w=800&auto=format&fit=crop&ixlib=rb-4.0.3&s=placeholder'; }}
        />
        {merged_count && merged_count > 1 && (
          <div className="absolute top-2 right-2 bg-blue-600 px-2 py-1 rounded-full text-xs font-semibold text-white shadow-lg z-10" title={`${merged_count} transactions`} aria-label={`${merged_count} transactions`}>
            {merged_count} transactions
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1">
        <div className="flex-1">
          <div className="mb-2">
            <div className="text-sm text-gray-900 mb-1">{town || '-'} • {flat_type || '-'}</div>
            <div className="text-lg font-bold text-gray-900 mb-1">{title}</div>
            <div className="text-sm font-extrabold text-gray-900">{displayPrice}</div>
          </div>
        </div>

        <div className="pt-3 flex justify-end">
          {mode === 'explore' && (isSaved ? (
            <button onClick={() => onRemoveFromWatchlist && onRemoveFromWatchlist(property.flat_id)} disabled={actionLoading} className="p-2 rounded-full hover:bg-yellow-50" title="Remove from Watchlist">
              <svg className="w-6 h-6 text-yellow-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 2c-.55 0-1 .45-1 1v18l7-4 7 4V3c0-.55-.45-1-1-1H6z"/></svg>
            </button>
          ) : (
            <button onClick={() => onAddToWatchlist && onAddToWatchlist(property)} disabled={actionLoading} className="p-2 rounded-full text-gray-400 hover:text-green-600" title="Add to Watchlist">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ListOfListings({ showHeader = true }) {
  const [listings, setListings] = useState([]);
  const [properties, setProperties] = useState([]); // user's saved props
  const [actionLoading, setActionLoading] = useState(false);
  const [columns, setColumns] = useState(3);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 4; // as requested: max 4 rows per page

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${API_URL}/listings?limit=30`);
        if (!resp.ok) throw new Error(`Failed to load listings (${resp.status})`);
        const json = await resp.json();
        setListings(json.listings || []);
      } catch (e) {
        console.error('ListOfListings fetch error:', e);
        setListings([]);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) return; // not signed in
      try {
        const res = await fetch(`${API_URL}/watchlist`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        const props = (data.watchlist && data.watchlist.properties) || [];
        setProperties(Array.isArray(props) ? props : []);
      } catch (e) {
        console.error('ListOfListings watchlist fetch error:', e);
      }
    })();
  }, []);

  const addToWatchlist = async (item) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return alert('Please sign in to save to your watchlist');
    setActionLoading(true);
    try {
      const resp = await fetch(`${API_URL}/watchlist/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ flat_id: item.flat_id, metadata: { resale_price: item.resale_price } })
      });
      const json = await resp.json();
      if (!json.success) throw new Error(json.message || 'Failed');
      setProperties(json.watchlist.properties || []);
    } catch (e) {
      console.error('addToWatchlist error:', e);
      alert('Failed to add to watchlist');
    } finally { setActionLoading(false); }
  };

  const removeFromWatchlist = async (flatId) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return alert('Please sign in to update your watchlist');
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
    } catch (e) {
      console.error('removeFromWatchlist error:', e);
      alert('Failed to remove from watchlist');
    } finally { setActionLoading(false); }
  };

  // grouping logic (same as WatchList explore) -> produce representatives
  const groups = {};
  for (const l of listings) {
    const blk = (l.block || l.block_no || 'Unknown').toString();
    const street = (l.street_name || '').toString();
    const townName = (l.town || '').toString();
    const key = `${blk}|||${street}|||${townName}`;
    if (!groups[key]) groups[key] = { block: blk, street, townName, items: [] };
    groups[key].items.push(l);
  }

  const groupEntries = Object.keys(groups).map(k => {
    const g = groups[k];
    const prices = g.items.map(x => Number(x.resale_price) || 0).filter(v => v > 0);
    const min = prices.length ? Math.min(...prices) : null;
    const max = prices.length ? Math.max(...prices) : null;
    let rep = g.items[0];
    try {
      const sorted = g.items.slice().sort((a, b) => {
        const ta = a.contract_date ? new Date(a.contract_date).getTime() : 0;
        const tb = b.contract_date ? new Date(b.contract_date).getTime() : 0;
        return tb - ta;
      });
      if (sorted && sorted.length) rep = sorted[0];
    } catch (e) {}
    const annotated = { ...rep, block_min_price: min, block_max_price: max, merged_count: g.items.length };
    return { key: k, listing: annotated };
  });

  const displayListings = groupEntries.map(g => g.listing);
  const savedSet = new Set((properties || []).map(p => p.flat_id));

  // responsive column count based on window width to match Tailwind breakpoints
  useEffect(() => {
    function calcCols() {
      const w = window.innerWidth;
      if (w >= 1024) return 3; // lg
      if (w >= 768) return 2; // md
      return 1; // sm
    }
    function update() { setColumns(calcCols()); }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // compute pagination
  const itemsPerPage = rowsPerPage * Math.max(1, columns);
  const totalPages = Math.max(1, Math.ceil(displayListings.length / itemsPerPage));

  // clamp current page if listings change
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [displayListings.length, totalPages]);

  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const pagedListings = displayListings.slice(startIdx, endIdx);

  return (
    <section className="py-12 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        {showHeader && (
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-black text-gray-900">Explore Listings</h2>
              <p className="text-sm text-gray-600 mt-1">Browse recent resale transactions — click the bookmark to save properties to your watchlist.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pagedListings.map((l, i) => (
            <ListingCardMini
              key={l.flat_id || i}
              property={l}
              onAddToWatchlist={addToWatchlist}
              onRemoveFromWatchlist={removeFromWatchlist}
              actionLoading={actionLoading}
              mode="explore"
              isSaved={savedSet.has(l.flat_id)}
            />
          ))}
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center space-x-3">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded-md border ${currentPage === 1 ? 'text-gray-400 border-gray-200' : 'text-gray-700 border-gray-300 hover:bg-gray-100'}`}
            >
              &lt;
            </button>

            {Array.from({ length: totalPages }).map((_, idx) => {
              const page = idx + 1;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  aria-current={currentPage === page}
                  className={`px-3 py-1 rounded-md border ${currentPage === page ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                >
                  {page}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded-md border ${currentPage === totalPages ? 'text-gray-400 border-gray-200' : 'text-gray-700 border-gray-300 hover:bg-gray-100'}`}
            >
              &gt;
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
