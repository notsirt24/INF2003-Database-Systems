import React, { useState } from 'react';
import Navigation from '../components/Navigation';
import ListOfListings from '../components/ListOfListings';
import { Search, Filter, X, ArrowUpDown } from 'lucide-react';

export default function Listings() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    town: '',
    flatType: '',
    priceMin: '',
    priceMax: '',
    leaseMin: ''
  });
  const [sortBy, setSortBy] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({
      town: '',
      flatType: '',
      priceMin: '',
      priceMax: '',
      leaseMin: ''
    });
    setSortBy('newest');
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== '').length + (searchTerm ? 1 : 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <Navigation />
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 pt-28">
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-5xl font-black text-gray-900">Explore Listings</h1>
            <p className="text-xl text-gray-600 mt-2">Browse recent resale transactions — click the bookmark to save properties to your watchlist.</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          {/* Search Bar */}
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by location, block, or street name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filter Toggle and Sort */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Filter className="h-4 w-4" />
                <span>Filters</span>
                {activeFiltersCount > 0 && (
                  <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* Sort Dropdown */}
              <div className="flex items-center space-x-2">
                <ArrowUpDown className="h-4 w-4 text-gray-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="lease-high">Lease: Most Years Left</option>
                  <option value="lease-low">Lease: Least Years Left</option>
                  <option value="area-large">Area: Largest First</option>
                  <option value="area-small">Area: Smallest First</option>
                </select>
              </div>
            </div>

            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center space-x-1 text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
                <span>Clear all</span>
              </button>
            )}
          </div>

          {/* Expandable Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Town Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Town</label>
                  <select
                    value={filters.town}
                    onChange={(e) => handleFilterChange('town', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Towns</option>
                    <option value="BEDOK">Bedok</option>
                    <option value="BISHAN">Bishan</option>
                    <option value="CLEMENTI">Clementi</option>
                    <option value="HOUGANG">Hougang</option>
                    <option value="JURONG WEST">Jurong West</option>
                    <option value="PASIR RIS">Pasir Ris</option>
                    <option value="PUNGGOL">Punggol</option>
                    <option value="SENGKANG">Sengkang</option>
                    <option value="TAMPINES">Tampines</option>
                    <option value="TOA PAYOH">Toa Payoh</option>
                    <option value="WOODLANDS">Woodlands</option>
                    <option value="YISHUN">Yishun</option>
                  </select>
                </div>

                {/* Flat Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Flat Type</label>
                  <select
                    value={filters.flatType}
                    onChange={(e) => handleFilterChange('flatType', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Types</option>
                    <option value="2 ROOM">2 Room</option>
                    <option value="3 ROOM">3 Room</option>
                    <option value="4 ROOM">4 Room</option>
                    <option value="5 ROOM">5 Room</option>
                    <option value="EXECUTIVE">Executive</option>
                  </select>
                </div>

                {/* Price Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Price</label>
                  <input
                    type="number"
                    placeholder="e.g. 300000"
                    value={filters.priceMin}
                    onChange={(e) => handleFilterChange('priceMin', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Price</label>
                  <input
                    type="number"
                    placeholder="e.g. 800000"
                    value={filters.priceMax}
                    onChange={(e) => handleFilterChange('priceMax', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Minimum Lease Years */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Lease (years)</label>
                  <input
                    type="number"
                    placeholder="e.g. 80"
                    value={filters.leaseMin}
                    onChange={(e) => handleFilterChange('leaseMin', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <ListOfListings 
          showHeader={false} 
          searchTerm={searchTerm}
          filters={filters}
          sortBy={sortBy}
        />
      </div>
    </div>
  );
}