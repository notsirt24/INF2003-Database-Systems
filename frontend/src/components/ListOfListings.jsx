import React, { useEffect, useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function ListingCardMini({ property, onAddToWatchlist, onRemoveFromWatchlist, actionLoading, mode = 'explore', isSaved = false }) {
  const { town, block, street_name, flat_type, resale_price, block_min_price, block_max_price, merged_count, floor_area_sqm, remaining_lease_years_at_sale } = property || {};
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
            <div className="text-sm text-gray-900 mb-1">{town || '-'}</div>
            <div className="text-lg font-bold text-gray-900 mb-1">{title}</div>
            <div className="text-sm font-extrabold text-gray-900 mb-2">{displayPrice}</div>
          </div>

          <div className="flex flex-wrap gap-1 text-gray-500 text-xs mb-2">
            <div className="inline-flex items-center space-x-1 bg-gray-50 px-2 py-1 rounded-md">
              <svg className="w-3 h-3 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 21h18M5 21V8l7-5 7 5v13" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 12h4v9h-4z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="truncate">{flat_type || '-'}</span>
            </div>
            <div className="inline-flex items-center space-x-1 bg-gray-50 px-2 py-1 rounded-md">
              <svg className="w-3 h-3 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M4 4h16v16H4z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4 4l16 16M20 4L4 20" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="truncate">{floor_area_sqm ? `${Math.round(floor_area_sqm)} m²` : '0 m²'}</span>
            </div>
            <div className="inline-flex items-center space-x-1 bg-gray-50 px-2 py-1 rounded-md">
              <svg className="w-3 h-3 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 7v5l3 3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="truncate">{remaining_lease_years_at_sale ? `${Math.round(remaining_lease_years_at_sale)} yrs` : '-'}</span>
            </div>
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

export default function ListOfListings({ showHeader = true, searchTerm = '', filters = {}, sortBy = 'newest' }) {
  const [listings, setListings] = useState([]);
  const [properties, setProperties] = useState([]); // user's saved props
  const [actionLoading, setActionLoading] = useState(false);
  const [columns, setColumns] = useState(3);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 4; // as requested: max 4 rows per page

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${API_URL}/listings?limit=100000`); // Increased limit for better filtering
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

  // Apply search and filters
  const filteredListings = listings.filter(listing => {
    // Search term filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (listing.town || '').toLowerCase().includes(searchLower) ||
        (listing.block || listing.block_no || '').toString().toLowerCase().includes(searchLower) ||
        (listing.street_name || '').toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Town filter
    if (filters.town && (listing.town || '').toUpperCase() !== filters.town.toUpperCase()) {
      return false;
    }

    // Flat type filter
    if (filters.flatType && (listing.flat_type || '').toUpperCase() !== filters.flatType.toUpperCase()) {
      return false;
    }

    // Price range filters
    const price = Number(listing.resale_price) || 0;
    if (filters.priceMin && price < Number(filters.priceMin)) {
      return false;
    }
    if (filters.priceMax && price > Number(filters.priceMax)) {
      return false;
    }

    // Minimum lease filter
    const lease = Number(listing.remaining_lease_years_at_sale) || 0;
    if (filters.leaseMin && lease < Number(filters.leaseMin)) {
      return false;
    }

    return true;
  });

  // grouping logic (same as WatchList explore) -> produce representatives
  const groups = {};
  for (const l of filteredListings) {
    const blk = (l.block || l.block_no || 'Unknown').toString();
    const street = (l.street_name || '').toString();
    const townName = (l.town || '').toString();
    const flatType = (l.flat_type || '').toString();
    const key = `${blk}|||${street}|||${townName}|||${flatType}`;
    if (!groups[key]) groups[key] = { block: blk, street, townName, flatType, items: [] };
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

  let displayListings = groupEntries.map(g => g.listing);

  // Apply sorting
  displayListings.sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        const dateA = a.contract_date ? new Date(a.contract_date).getTime() : 0;
        const dateB = b.contract_date ? new Date(b.contract_date).getTime() : 0;
        return dateB - dateA;
      
      case 'oldest':
        const dateA2 = a.contract_date ? new Date(a.contract_date).getTime() : 0;
        const dateB2 = b.contract_date ? new Date(b.contract_date).getTime() : 0;
        return dateA2 - dateB2;
      
      case 'price-low':
        const priceA = Number(a.resale_price) || 0;
        const priceB = Number(b.resale_price) || 0;
        return priceA - priceB;
      
      case 'price-high':
        const priceA2 = Number(a.resale_price) || 0;
        const priceB2 = Number(b.resale_price) || 0;
        return priceB2 - priceA2;
      
      case 'lease-high':
        const leaseA = Number(a.remaining_lease_years_at_sale) || 0;
        const leaseB = Number(b.remaining_lease_years_at_sale) || 0;
        return leaseB - leaseA;
      
      case 'lease-low':
        const leaseA2 = Number(a.remaining_lease_years_at_sale) || 0;
        const leaseB2 = Number(b.remaining_lease_years_at_sale) || 0;
        return leaseA2 - leaseB2;
      
      case 'area-large':
        const areaA = Number(a.floor_area_sqm) || 0;
        const areaB = Number(b.floor_area_sqm) || 0;
        return areaB - areaA;
      
      case 'area-small':
        const areaA2 = Number(a.floor_area_sqm) || 0;
        const areaB2 = Number(b.floor_area_sqm) || 0;
        return areaA2 - areaB2;
      
      default:
        return 0;
    }
  });
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

  // Reset to first page when search term or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, sortBy]);

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

        {/* Results count */}
        <div className="mb-4 text-sm text-gray-600">
          {displayListings.length === 0 ? (
            'No listings found'
          ) : (
            `Showing ${displayListings.length} listing${displayListings.length === 1 ? '' : 's'}`
          )}
        </div>

        {displayListings.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500 text-lg">No properties match your search criteria.</p>
            <p className="text-gray-400 text-sm mt-2">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <>
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
              <div className="mt-8 flex items-center justify-center space-x-2">

                {/* Prev Button */}
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 rounded-md border 
                    ${currentPage === 1 ? 'text-gray-400 border-gray-200' : 'text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                >
                  &lt;
                </button>

                {/* Page Numbers */}
                {(() => {
                  const pages = [];
                  const last = totalPages;

                  const addPage = (p) => {
                    pages.push(
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`px-3 py-1 rounded-md border 
                          ${currentPage === p ? 'bg-blue-600 text-white border-blue-600' 
                                              : 'text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                      >
                        {p}
                      </button>
                    );
                  };

                  // Always show page 1
                  addPage(1);

                  // Show "..." when far from beginning
                  if (currentPage > 4) {
                    pages.push(<span key="start-ellipsis" className="px-2">...</span>);
                  }

                  // Middle window
                  const start = Math.max(2, currentPage - 1);
                  const end   = Math.min(last - 1, currentPage + 1);

                  for (let p = start; p <= end; p++) {
                    if (p !== 1 && p !== last) addPage(p);
                  }

                  // Show "..." before last page
                  if (currentPage < last - 3) {
                    pages.push(<span key="end-ellipsis" className="px-2">...</span>);
                  }

                  // Always show last page
                  if (last > 1) addPage(last);

                  return pages;
                })()}

                {/* Next Button */}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 rounded-md border 
                    ${currentPage === totalPages ? 'text-gray-400 border-gray-200' : 'text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                >
                  &gt;
                </button>

              </div>
            )}

            
          </>
        )}
      </div>
    </section>
  );
}
