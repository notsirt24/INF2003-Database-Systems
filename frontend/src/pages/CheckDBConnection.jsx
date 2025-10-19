import React, { useState } from 'react';
import { Database, CheckCircle, XCircle, Loader, RefreshCw, Home, ChevronDown, ChevronUp, Table } from 'lucide-react';

export default function CheckDBConnection() {
  const [pgStatus, setPgStatus] = useState({ status: 'idle', message: '', tables: [] });
  const [mongoStatus, setMongoStatus] = useState({ status: 'idle', message: '', collections: [] });
  const [loading, setLoading] = useState(false);
  const [expandedPgTable, setExpandedPgTable] = useState(null);
  const [expandedMongoCollection, setExpandedMongoCollection] = useState(null);

  const testPostgreSQL = async () => {
    setPgStatus({ status: 'loading', message: 'Loading PostgreSQL data...', tables: [] });
    
    try {
      const response = await fetch('http://localhost:5000/api/test-postgres');
      const data = await response.json();
      
      if (response.ok) {
        setPgStatus({ 
          status: 'success', 
          message: 'PostgreSQL connected successfully!', 
          tables: data.tables || []
        });
      } else {
        setPgStatus({ 
          status: 'error', 
          message: data.error || 'Failed to connect to PostgreSQL', 
          tables: []
        });
      }
    } catch (error) {
      setPgStatus({ 
        status: 'error', 
        message: `Connection error: ${error.message}`, 
        tables: []
      });
    }
  };

  const testMongoDB = async () => {
    setMongoStatus({ status: 'loading', message: 'Loading MongoDB data...', collections: [] });
    
    try {
      const response = await fetch('http://localhost:5000/api/test-mongodb');
      const data = await response.json();
      
      if (response.ok) {
        setMongoStatus({ 
          status: 'success', 
          message: 'MongoDB connected successfully!', 
          collections: data.collections || []
        });
      } else {
        setMongoStatus({ 
          status: 'error', 
          message: data.error || 'Failed to connect to MongoDB', 
          collections: []
        });
      }
    } catch (error) {
      setMongoStatus({ 
        status: 'error', 
        message: `Connection error: ${error.message}`, 
        collections: []
      });
    }
  };

  const loadTableData = async (tableName) => {
    if (expandedPgTable === tableName) {
      setExpandedPgTable(null);
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/postgres-table/${tableName}`);
      const data = await response.json();
      
      if (response.ok) {
        const updatedTables = pgStatus.tables.map(table => 
          table.name === tableName ? { ...table, data: data.rows, columns: data.columns } : table
        );
        setPgStatus({ ...pgStatus, tables: updatedTables });
        setExpandedPgTable(tableName);
      }
    } catch (error) {
      console.error('Error loading table data:', error);
    }
  };

  const loadCollectionData = async (collectionName) => {
    if (expandedMongoCollection === collectionName) {
      setExpandedMongoCollection(null);
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/mongodb-collection/${collectionName}`);
      const data = await response.json();
      
      if (response.ok) {
        const updatedCollections = mongoStatus.collections.map(collection => 
          collection.name === collectionName ? { ...collection, data: data.documents } : collection
        );
        setMongoStatus({ ...mongoStatus, collections: updatedCollections });
        setExpandedMongoCollection(collectionName);
      }
    } catch (error) {
      console.error('Error loading collection data:', error);
    }
  };

  const testAllConnections = async () => {
    setLoading(true);
    await Promise.all([testPostgreSQL(), testMongoDB()]);
    setLoading(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'loading':
        return <Loader className="w-6 h-6 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'error':
        return <XCircle className="w-6 h-6 text-red-500" />;
      default:
        return <Database className="w-6 h-6 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'loading':
        return 'border-blue-200 bg-blue-50';
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Database className="w-8 h-8 text-purple-600" />
              <h1 className="text-2xl font-bold text-gray-900">Database Connection Test</h1>
            </div>
            <a 
              href="/" 
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Test All Button */}
        <div className="text-center mb-8">
          <button
            onClick={testAllConnections}
            disabled={loading}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg hover:shadow-xl"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            <span className="font-semibold">Load Database Tables & Data</span>
          </button>
        </div>

        {/* PostgreSQL Section */}
        <div className={`border-2 rounded-xl p-6 mb-6 transition-all ${getStatusColor(pgStatus.status)}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              {getStatusIcon(pgStatus.status)}
              <h2 className="text-2xl font-bold text-gray-900">PostgreSQL Database</h2>
            </div>
            <button
              onClick={testPostgreSQL}
              disabled={pgStatus.status === 'loading'}
              className="p-2 bg-white rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 text-gray-600 ${pgStatus.status === 'loading' ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          <p className="text-sm text-gray-700 mb-4">{pgStatus.message}</p>

          {pgStatus.tables.length > 0 && (
            <div className="space-y-3">
              {pgStatus.tables.map((table) => (
                <div key={table.name} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => loadTableData(table.name)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <Table className="w-5 h-5 text-purple-600" />
                      <span className="font-semibold text-gray-900">{table.name}</span>
                      <span className="text-sm text-gray-500">({table.count} column)</span>
                    </div>
                    {expandedPgTable === table.name ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  
                  {expandedPgTable === table.name && table.data && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              {table.columns.map((col) => (
                                <th key={col} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {table.data.slice(0, 10).map((row, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                {table.columns.map((col) => (
                                  <td key={col} className="px-3 py-2 whitespace-nowrap text-gray-900">
                                    {row[col] !== null && row[col] !== undefined 
                                      ? String(row[col]).substring(0, 50) 
                                      : '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {table.data.length > 10 && (
                          <p className="text-xs text-gray-500 mt-2 text-center">
                            Showing first 10 of {table.data.length} rows
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MongoDB Section */}
        <div className={`border-2 rounded-xl p-6 transition-all ${getStatusColor(mongoStatus.status)}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              {getStatusIcon(mongoStatus.status)}
              <h2 className="text-2xl font-bold text-gray-900">MongoDB Database</h2>
            </div>
            <button
              onClick={testMongoDB}
              disabled={mongoStatus.status === 'loading'}
              className="p-2 bg-white rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 text-gray-600 ${mongoStatus.status === 'loading' ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          <p className="text-sm text-gray-700 mb-4">{mongoStatus.message}</p>

          {mongoStatus.collections.length > 0 && (
            <div className="space-y-3">
              {mongoStatus.collections.map((collection) => (
                <div key={collection.name} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => loadCollectionData(collection.name)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <Table className="w-5 h-5 text-green-600" />
                      <span className="font-semibold text-gray-900">{collection.name}</span>
                      <span className="text-sm text-gray-500">({collection.count} documents)</span>
                    </div>
                    {expandedMongoCollection === collection.name ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  
                  {expandedMongoCollection === collection.name && collection.data && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <div className="space-y-3">
                        {collection.data.slice(0, 5).map((doc, idx) => (
                          <div key={idx} className="bg-white p-3 rounded border border-gray-200">
                            <pre className="text-xs overflow-x-auto text-gray-900">
                              {JSON.stringify(doc, null, 2)}
                            </pre>
                          </div>
                        ))}
                        {collection.data.length > 5 && (
                          <p className="text-xs text-gray-500 text-center">
                            Showing first 5 of {collection.data.length} documents
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}