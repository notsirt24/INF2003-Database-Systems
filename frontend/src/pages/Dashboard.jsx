import React, { useState, useEffect } from 'react';
import { Home, TrendingUp, Map, MessageSquare, Bookmark, Menu, X, Building2, DollarSign, Calendar, MapPin, Filter, RefreshCw, ArrowUpRight, ArrowDownRight, Minus, Book, Cloud } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

// API endpoint for backend queries
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function HDBDashboard() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedTown, setSelectedTown] = useState('All');
    const [selectedYear, setSelectedYear] = useState('2025');
    const [dateRange, setDateRange] = useState('12m');

    // Data states
    const [priceData, setPriceData] = useState([]);
    const [townData, setTownData] = useState([]);
    const [flatTypeData, setFlatTypeData] = useState([]);
    const [transactionVolume, setTransactionVolume] = useState([]);
    const [keyMetrics, setKeyMetrics] = useState({
        avgPrice: 0,
        priceChange: 0,
        totalTransactions: 0,
        volumeChange: 0,
        avgPSM: 0,
        psmChange: 0,
        medianPrice: 0,
        medianChange: 0
    });
    const [topBlocks, setTopBlocks] = useState([]);
    const [leaseAnalysis, setLeaseAnalysis] = useState([]);
    const [towns, setTowns] = useState(['All']);
    const [comparisonTowns, setComparisonTowns] = useState([]);
    const [showAddTownModal, setShowAddTownModal] = useState(false);

    const navItems = [
        { name: 'Home', icon: Home, path: '/' },
        { name: 'Dashboard', icon: TrendingUp, path: '/dashboard' },
        { name: 'Map', icon: Map, path: '/map' },
        { name: 'AI-Chatbot', icon: Cloud, path: '/chatbot' },
        { name: 'Watchlist', icon: Bookmark, path: '/watchlist' },
        { name: 'Reviews', icon: Book, path: '/reviews' },
    ];

    const COLORS = ['#2563eb', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

    useEffect(() => {
        fetchTowns();
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [selectedTown, selectedYear, dateRange]);

    // Add effect to refetch town comparison when comparison towns change
    useEffect(() => {
        if (selectedTown !== 'All' && comparisonTowns.length > 0) {
            fetchTownComparison();
        }
    }, [comparisonTowns]);

    const fetchTowns = async () => {
        try {
            const response = await fetch(`${API_URL}/dashboard/towns`);
            const data = await response.json();
            setTowns(['All', ...data]);
        } catch (error) {
            console.error('Error fetching towns:', error);
        }
    };

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchPriceTrends(),
                fetchTownComparison(),
                fetchFlatTypeDistribution(),
                fetchTransactionVolume(),
                fetchKeyMetrics(),
                fetchTopBlocks(),
                fetchLeaseAnalysis()
            ]);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        }
        setLoading(false);
    };

    const fetchPriceTrends = async () => {
        try {
            const response = await fetch(`${API_URL}/dashboard/price-trends?town=${selectedTown}&range=${dateRange}&year=${selectedYear}`);
            const data = await response.json();
            setPriceData(data);
        } catch (error) {
            console.error('Error fetching price trends:', error);
            setPriceData([]);
        }
    };

    const fetchTownComparison = async () => {
        try {
            let url = `${API_URL}/dashboard/town-comparison?year=${selectedYear}&range=${dateRange}`;

            // If specific town selected and we have comparison towns, send them
            if (selectedTown !== 'All' && comparisonTowns.length > 0) {
                const townsParam = comparisonTowns.join(',');
                url += `&towns=${townsParam}`;
            }

            const response = await fetch(url);
            const data = await response.json();
            setTownData(data);
        } catch (error) {
            console.error('Error fetching town comparison:', error);
            setTownData([]);
        }
    };

    // Add effect to reset comparison towns when selectedTown changes
    useEffect(() => {
        if (selectedTown !== 'All') {
            // Start with just the selected town
            setComparisonTowns([selectedTown]);
        } else {
            // Reset comparison towns when "All" is selected
            setComparisonTowns([]);
        }
    }, [selectedTown]);

    // Function to add a town for comparison
    const addTownForComparison = (town) => {
        if (comparisonTowns.length < 10 && !comparisonTowns.includes(town)) {
            setComparisonTowns([...comparisonTowns, town]);
            setShowAddTownModal(false);
        }
    };

    // Function to remove a town from comparison
    const removeTownFromComparison = (town) => {
        // Don't allow removing the originally selected town
        if (town === selectedTown) return;
        setComparisonTowns(comparisonTowns.filter(t => t !== town));
    };

    const fetchFlatTypeDistribution = async () => {
        try {
            const response = await fetch(`${API_URL}/dashboard/flat-type-distribution?town=${selectedTown}&year=${selectedYear}&range=${dateRange}`);
            const data = await response.json();
            setFlatTypeData(data);
        } catch (error) {
            console.error('Error fetching flat type distribution:', error);
            setFlatTypeData([]);
        }
    };

    const fetchTransactionVolume = async () => {
        try {
            const response = await fetch(`${API_URL}/dashboard/transaction-volume?range=${dateRange}&year=${selectedYear}`);
            const data = await response.json();
            setTransactionVolume(data);
        } catch (error) {
            console.error('Error fetching transaction volume:', error);
            setTransactionVolume([]);
        }
    };

    const fetchKeyMetrics = async () => {
        try {
            const response = await fetch(`${API_URL}/dashboard/key-metrics?town=${selectedTown}&year=${selectedYear}&range=${dateRange}`);
            const data = await response.json();
            setKeyMetrics(data);
        } catch (error) {
            console.error('Error fetching key metrics:', error);
        }
    };

    const fetchTopBlocks = async () => {
        try {
            const response = await fetch(`${API_URL}/dashboard/top-blocks?town=${selectedTown}&year=${selectedYear}&range=${dateRange}`);
            const data = await response.json();
            setTopBlocks(data);
        } catch (error) {
            console.error('Error fetching top blocks:', error);
            setTopBlocks([]);
        }
    };

    const fetchLeaseAnalysis = async () => {
        try {
            const response = await fetch(`${API_URL}/dashboard/lease-analysis?town=${selectedTown}&year=${selectedYear}&range=${dateRange}`);
            const data = await response.json();
            setLeaseAnalysis(data);
        } catch (error) {
            console.error('Error fetching lease analysis:', error);
            setLeaseAnalysis([]);
        }
    };

    const formatCurrency = (value) => {
        return `$${(value / 1000).toFixed(0)}K`;
    };

    const formatNumber = (value) => {
        return value.toLocaleString();
    };

    const MetricCard = ({ title, value, change, icon: Icon, prefix = '', suffix = '' }) => {
        const isPositive = change > 0;
        const isNegative = change < 0;

        return (
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                            <Icon className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-sm font-medium text-gray-600">{title}</span>
                    </div>
                    {change !== 0 && (
                        <div className={`flex items-center space-x-1 ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600'}`}>
                            {isPositive && <ArrowUpRight className="w-4 h-4" />}
                            {isNegative && <ArrowDownRight className="w-4 h-4" />}
                            {!isPositive && !isNegative && <Minus className="w-4 h-4" />}
                            <span className="text-sm font-bold">{Math.abs(change).toFixed(1)}%</span>
                        </div>
                    )}
                </div>
                <div className="text-3xl font-black text-gray-900">
                    {prefix}{typeof value === 'number' ? formatNumber(value) : value}{suffix}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg shadow-lg">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex items-center justify-between h-20">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center">
                                <Building2 className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                                HDB Analytics
                            </span>
                        </div>

                        <div className="hidden md:flex items-center space-x-1">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = item.path === '/dashboard';
                                return (
                                    <a
                                        key={item.name}
                                        href={item.path}
                                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span className="font-medium">{item.name}</span>
                                    </a>
                                );
                            })}
                        </div>

                        <div className="hidden md:flex items-center space-x-4">
                            <button className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300">
                                Sign In
                            </button>
                        </div>

                        <button
                            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>

                {mobileMenuOpen && (
                    <div className="md:hidden bg-white border-t border-gray-200">
                        <div className="px-6 py-4 space-y-2">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <a
                                        key={item.name}
                                        href={item.path}
                                        className="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-blue-600"
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span className="font-medium">{item.name}</span>
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                )}
            </nav>

            {/* Main Content */}
            <div className="pt-28 pb-12 px-6 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-5xl font-black text-gray-900 mb-4">Market Dashboard</h1>
                    <p className="text-xl text-gray-600">Real-time insights into Singapore's HDB resale market</p>
                </div>

                {/* Filters */}
                <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 mb-8">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center space-x-2">
                            <Filter className="w-5 h-5 text-gray-600" />
                            <span className="font-semibold text-gray-900">Filters:</span>
                        </div>

                        <select
                            value={selectedTown}
                            onChange={(e) => setSelectedTown(e.target.value)}
                            className="px-4 py-2 border-2 border-gray-300 rounded-lg font-medium focus:border-blue-500 focus:outline-none"
                        >
                            {towns.map(town => (
                                <option key={town} value={town}>{town}</option>
                            ))}
                        </select>

                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="px-4 py-2 border-2 border-gray-300 rounded-lg font-medium focus:border-blue-500 focus:outline-none"
                        >
                            <option value="All">All Years</option>
                            {['2025', '2024', '2023', '2022', '2021', '2020'].map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>

                        <div className="flex bg-gray-100 rounded-lg p-1">
                            {['6m', '12m', '24m'].map(range => (
                                <button
                                    key={range}
                                    onClick={() => setDateRange(range)}
                                    disabled={selectedYear !== 'All'}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${dateRange === range && selectedYear === 'All'
                                        ? 'bg-white shadow-md text-blue-600'
                                        : selectedYear === 'All'
                                            ? 'text-gray-600 hover:text-gray-900'
                                            : 'text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    {range === '6m' ? '6 Months' : range === '12m' ? '1 Year' : '2 Years'}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={fetchDashboardData}
                            className="ml-auto flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Key Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <MetricCard
                                title="Average Price"
                                value={keyMetrics.avgPrice}
                                change={keyMetrics.priceChange}
                                icon={DollarSign}
                                prefix="$"
                            />
                            <MetricCard
                                title="Median Price"
                                value={keyMetrics.medianPrice}
                                change={keyMetrics.medianChange}
                                icon={TrendingUp}
                                prefix="$"
                            />
                            <MetricCard
                                title="Avg Price PSM"
                                value={keyMetrics.avgPSM}
                                change={keyMetrics.psmChange}
                                icon={MapPin}
                                prefix="$"
                            />
                            <MetricCard
                                title="Transactions"
                                value={keyMetrics.totalTransactions}
                                change={keyMetrics.volumeChange}
                                icon={Calendar}
                            />
                        </div>

                        {/* Price Trends */}
                        <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 mb-8 hover:shadow-xl transition-shadow">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">Price Trends</h2>
                            <ResponsiveContainer width="100%" height={350}>
                                <AreaChart data={priceData}>
                                    <defs>
                                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis dataKey="month" stroke="#6b7280" />
                                    <YAxis stroke="#6b7280" tickFormatter={formatCurrency} />
                                    <Tooltip
                                        formatter={(value) => [`$${formatNumber(value)}`, 'Price']}
                                        contentStyle={{ borderRadius: '12px', border: '2px solid #e5e7eb' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="avgPrice"
                                        stroke="#2563eb"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorPrice)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Town Comparison & Flat Type Distribution */}
                        <div className="grid lg:grid-cols-2 gap-8 mb-8">
                            <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 hover:shadow-xl transition-shadow">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900">Town Comparison</h2>
                                    {selectedTown !== 'All' && comparisonTowns.length < 10 && (
                                        <button
                                            onClick={() => setShowAddTownModal(true)}
                                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                                        >
                                            <span>+</span>
                                            <span>Add Town</span>
                                        </button>
                                    )}
                                </div>

                                {/* Show selected towns chips when specific town is selected */}
                                {selectedTown !== 'All' && comparisonTowns.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {comparisonTowns.map(town => (
                                            <div
                                                key={town}
                                                className="flex items-center space-x-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                                            >
                                                <span>{town}</span>
                                                {town !== selectedTown && (
                                                    <button
                                                        onClick={() => removeTownFromComparison(town)}
                                                        className="hover:text-blue-900"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <div className="px-3 py-1 text-gray-500 text-sm">
                                            {comparisonTowns.length}/10 towns
                                        </div>
                                    </div>
                                )}

                                <ResponsiveContainer width="100%" height={350}>
                                    <BarChart data={townData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                        <XAxis dataKey="town" stroke="#6b7280" angle={-45} textAnchor="end" height={100} />
                                        <YAxis stroke="#6b7280" tickFormatter={formatCurrency} />
                                        <Tooltip
                                            formatter={(value) => [`$${formatNumber(value)}`, 'Avg Price']}
                                            contentStyle={{ borderRadius: '12px', border: '2px solid #e5e7eb' }}
                                        />
                                        <Bar dataKey="avgPrice" radius={[8, 8, 0, 0]}>
                                            {townData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>



                            <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 hover:shadow-xl transition-shadow">
                                <h2 className="text-2xl font-bold text-gray-900 mb-6">Flat Type Distribution</h2>
                                <ResponsiveContainer width="100%" height={350}>
                                    <PieChart>
                                        <Pie
                                            data={flatTypeData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={120}
                                            fill="#8884d8"
                                            dataKey="count"
                                        >
                                            {flatTypeData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value) => [formatNumber(value), 'Transactions']}
                                            contentStyle={{ borderRadius: '12px', border: '2px solid #e5e7eb' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Add Town Modal - place this at the end of your component, before closing div */}
                        {showAddTownModal && (
                            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-2xl font-bold text-gray-900">Add Town for Comparison</h3>
                                        <button
                                            onClick={() => setShowAddTownModal(false)}
                                            className="p-2 hover:bg-gray-100 rounded-lg"
                                        >
                                            <X className="w-6 h-6" />
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {towns
                                            .filter(town => town !== 'All' && !comparisonTowns.includes(town))
                                            .map(town => (
                                                <button
                                                    key={town}
                                                    onClick={() => addTownForComparison(town)}
                                                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors font-medium"
                                                >
                                                    {town}
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Transaction Volume */}
                        <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 mb-8 hover:shadow-xl transition-shadow">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">Transaction Volume</h2>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={transactionVolume}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis dataKey="month" stroke="#6b7280" />
                                    <YAxis stroke="#6b7280" />
                                    <Tooltip
                                        formatter={(value) => [formatNumber(value), 'Transactions']}
                                        contentStyle={{ borderRadius: '12px', border: '2px solid #e5e7eb' }}
                                    />
                                    <Bar dataKey="count" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Top Blocks & Lease Analysis */}
                        <div className="grid lg:grid-cols-2 gap-8">
                            <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 hover:shadow-xl transition-shadow">
                                <h2 className="text-2xl font-bold text-gray-900 mb-6">Top Performing Blocks</h2>
                                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                                    {topBlocks.length > 0 ? topBlocks.map((block, index) => (
                                        <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                            <div className="flex items-center space-x-3">
                                                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-lg font-bold text-sm">
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900">{block.block} {block.street}</div>
                                                    <div className="text-sm text-gray-600">{block.town}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-blue-600">${formatNumber(block.avgPrice)}</div>
                                                <div className="text-sm text-gray-600">{formatNumber(block.transactions)} sales</div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center text-gray-500 py-8">No data available</div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 hover:shadow-xl transition-shadow">
                                <h2 className="text-2xl font-bold text-gray-900 mb-6">Lease Remaining Analysis</h2>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={leaseAnalysis}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                        <XAxis
                                            dataKey="range"
                                            stroke="#6b7280"
                                            angle={-15}
                                            textAnchor="end"
                                            height={80}
                                            interval={0}
                                            tick={{ fontSize: 12 }}
                                        />
                                        <YAxis stroke="#6b7280" tickFormatter={formatCurrency} />
                                        <Tooltip
                                            formatter={(value) => [`$${formatNumber(value)}`, 'Avg Price']}
                                            contentStyle={{ borderRadius: '12px', border: '2px solid #e5e7eb' }}
                                        />
                                        <Bar dataKey="avgPrice" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}