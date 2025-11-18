import React from 'react';
import Navigation from '../components/Navigation';
import ListOfListings from '../components/ListOfListings';

export default function Listings() {
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
        <ListOfListings showHeader={false} />
      </div>
    </div>
  );
}