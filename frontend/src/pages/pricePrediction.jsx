import React, { useState, useEffect } from 'react';
import { TrendingUp, Sparkles, AlertCircle, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area } from 'recharts';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function PricePredictionSection() {
    const [predictionTown, setPredictionTown] = useState('All');
    const [predictionFlatType, setPredictionFlatType] = useState('All');
    const [yearsAhead, setYearsAhead] = useState(5);
    const [towns, setTowns] = useState(['All']);
    const [flatTypes, setFlatTypes] = useState(['All']);
    const [predictionData, setPredictionData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    useEffect(() => {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        setIsLoggedIn(!!token);
        setIsCheckingAuth(false);
    }, []);

    useEffect(() => {
        if (isLoggedIn) {
            fetchTowns();
        }
    }, [isLoggedIn]);

    useEffect(() => {
        if (isLoggedIn) {
            fetchFlatTypes();
        }
    }, [predictionTown, isLoggedIn]);

    const fetchTowns = async () => {
        try {
            const response = await fetch(`${API_URL}/dashboard/towns`);
            const data = await response.json();
            setTowns(['All', ...data]);
        } catch (error) {
            console.error('Error fetching towns:', error);
        }
    };

    const fetchFlatTypes = async () => {
        try {
            const response = await fetch(`${API_URL}/dashboard/flat-types?town=${predictionTown}`);
            const data = await response.json();
            setFlatTypes(['All', ...data]);
            setPredictionFlatType('All');
        } catch (error) {
            console.error('Error fetching flat types:', error);
        }
    };

    const generatePrediction = async () => {
        if (!isLoggedIn) return;
        
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `${API_URL}/dashboard/predict-price?town=${predictionTown}&flatType=${predictionFlatType}&yearsAhead=${yearsAhead}`
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || errorData.error || 'Failed to generate prediction');
            }

            const data = await response.json();
            setPredictionData(data);
        } catch (error) {
            console.error('Error generating prediction:', error);
            setError(error.message);
            setPredictionData(null);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        return `$${(value / 1000).toFixed(0)}K`;
    };

    const formatNumber = (value) => {
        return value.toLocaleString();
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-gray-200">
                    <p className="font-bold text-gray-900 mb-2">{label}</p>
                    {data.isHistorical ? (
                        <p className="text-blue-600 font-semibold">
                            Actual: ${formatNumber(data.price)}
                        </p>
                    ) : (
                        <>
                            <p className="text-purple-600 font-semibold">
                                Predicted: ${formatNumber(data.price)}
                            </p>
                            {data.lowerBound && data.upperBound && (
                                <p className="text-gray-600 text-sm mt-1">
                                    Range: ${formatNumber(data.lowerBound)} - ${formatNumber(data.upperBound)}
                                </p>
                            )}
                        </>
                    )}
                </div>
            );
        }
        return null;
    };

    if (isCheckingAuth) {
        return null;
    }

    return (
        <div className="relative bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-2xl p-8 mt-8 overflow-hidden min-h-[500px]">
            {/* BLUR OVERLAY - REDESIGNED WITH BETTER PADDING */}
            {!isLoggedIn && (
                <div className="absolute inset-0 z-30 backdrop-blur-sm bg-white/60 rounded-2xl flex items-center justify-center px-4 py-12">
                    <div className="text-center max-w-3xl mx-auto w-full">
                        {/* Lock Icon */}
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full mb-6 shadow-2xl">
                            <Lock className="w-10 h-10 text-white" />
                        </div>

                        {/* Main Heading */}
                        <h2 className="text-4xl md:text-5xl font-black mb-6 bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 bg-clip-text text-transparent leading-tight px-4">
                            Unlock AI Price Predictions
                        </h2>

                        {/* Description */}
                        <p className="text-lg md:text-xl text-gray-800 mb-10 font-medium leading-relaxed px-6 max-w-2xl mx-auto">
                            Create an account with us to use our AI Prediction model
                            <br className="hidden sm:block" />
                            and forecast future HDB resale prices
                        </p>

                        {/* Call-to-Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8 px-4">
                            <Link
                                to="/signup"
                                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold text-base md:text-lg hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 transform hover:scale-105"
                            >
                                Create Free Account
                            </Link>
                            <Link
                                to="/login"
                                className="px-8 py-4 bg-white border-2 border-purple-600 text-purple-600 rounded-xl font-bold text-base md:text-lg hover:bg-purple-50 transition-all duration-300"
                            >
                                Sign In
                            </Link>
                        </div>

                        {/* Feature Badges */}
                        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-sm font-semibold px-4">
                            <div className="flex items-center space-x-2 bg-white px-4 py-2.5 rounded-full shadow-md">
                                <span className="text-xl">✨</span>
                                <span className="text-green-600">Free forever</span>
                            </div>
                            <div className="flex items-center space-x-2 bg-white px-4 py-2.5 rounded-full shadow-md">
                                <span className="text-xl">🚀</span>
                                <span className="text-blue-600">Instant access</span>
                            </div>
                            <div className="flex items-center space-x-2 bg-white px-4 py-2.5 rounded-full shadow-md">
                                <span className="text-xl">🔒</span>
                                <span className="text-purple-600">Secure</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MAIN CONTENT */}
            <div className={`${!isLoggedIn ? 'pointer-events-none select-none' : ''}`}>
                <div className="flex items-center space-x-3 mb-6">
                    <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-gray-900">Price Prediction</h2>
                        <p className="text-gray-600">Forecast future HDB resale prices based on historical trends</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl p-6 mb-6 shadow-md">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Town
                            </label>
                            <select
                                value={predictionTown}
                                onChange={(e) => setPredictionTown(e.target.value)}
                                disabled={!isLoggedIn}
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg font-medium focus:border-purple-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                                {towns.map(town => (
                                    <option key={town} value={town}>{town}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Flat Type
                            </label>
                            <select
                                value={predictionFlatType}
                                onChange={(e) => setPredictionFlatType(e.target.value)}
                                disabled={!isLoggedIn}
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg font-medium focus:border-purple-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                                {flatTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Years Ahead
                            </label>
                            <select
                                value={yearsAhead}
                                onChange={(e) => setYearsAhead(parseInt(e.target.value))}
                                disabled={!isLoggedIn}
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg font-medium focus:border-purple-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(year => (
                                    <option key={year} value={year}>{year} Year{year > 1 ? 's' : ''}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-end">
                            <button
                                onClick={generatePrediction}
                                disabled={loading || !isLoggedIn}
                                className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-bold hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        <span>Calculating...</span>
                                    </>
                                ) : (
                                    <>
                                        <TrendingUp className="w-5 h-5" />
                                        <span>Predict</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6 flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-semibold text-red-900">Prediction Error</p>
                            <p className="text-red-700 text-sm mt-1">{error}</p>
                        </div>
                    </div>
                )}

                {/* Results */}
                {predictionData && (
                    <>
                        {/* Key Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-white rounded-xl p-4 shadow-md">
                                <p className="text-sm font-medium text-gray-600 mb-1">Current Price</p>
                                <p className="text-2xl font-black text-gray-900">
                                    ${formatNumber(predictionData.metadata.currentPrice)}
                                </p>
                            </div>

                            <div className="bg-white rounded-xl p-4 shadow-md">
                                <p className="text-sm font-medium text-gray-600 mb-1">
                                    Projected ({yearsAhead}Y)
                                </p>
                                <p className="text-2xl font-black text-purple-600">
                                    ${formatNumber(predictionData.metadata.projectedPrice)}
                                </p>
                            </div>

                            <div className="bg-white rounded-xl p-4 shadow-md">
                                <p className="text-sm font-medium text-gray-600 mb-1">Annual Growth</p>
                                <p className="text-2xl font-black text-green-600">
                                    {predictionData.metadata.annualGrowthRate}%
                                </p>
                            </div>

                            <div className="bg-white rounded-xl p-4 shadow-md">
                                <p className="text-sm font-medium text-gray-600 mb-1">Total Growth</p>
                                <p className="text-2xl font-black text-blue-600">
                                    {predictionData.metadata.totalGrowth}%
                                </p>
                            </div>
                        </div>

                        {/* Chart */}
                        <div className="bg-white rounded-xl p-6 shadow-md">
                            <ResponsiveContainer width="100%" height={450}>
                                <ComposedChart
                                    data={predictionData.predictions}
                                    margin={{ top: 10, right: 30, left: 20, bottom: 80 }}
                                >
                                    <defs>
                                        <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#e9d5ff" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#e9d5ff" stopOpacity={0.3} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="month"
                                        stroke="#6b7280"
                                        tick={{ fontSize: 10 }}
                                        angle={-45}
                                        textAnchor="end"
                                        height={80}
                                        interval={Math.floor(predictionData.predictions.length / 15)}
                                    />
                                    <YAxis
                                        stroke="#6b7280"
                                        tickFormatter={formatCurrency}
                                        width={80}
                                    />
                                    <Tooltip content={<CustomTooltip />} />

                                    <Area
                                        type="monotone"
                                        dataKey="upperBound"
                                        stroke="none"
                                        fill="url(#confidenceGradient)"
                                        fillOpacity={1}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="lowerBound"
                                        stroke="none"
                                        fill="#ffffff"
                                        fillOpacity={1}
                                    />

                                    <Line
                                        type="monotone"
                                        dataKey={(entry) => entry.isHistorical ? entry.price : null}
                                        stroke="#2563eb"
                                        strokeWidth={3}
                                        dot={false}
                                        name="Historical"
                                        connectNulls={false}
                                        isAnimationActive={false}
                                    />

                                    <Line
                                        type="monotone"
                                        dataKey={(entry) => !entry.isHistorical ? entry.price : null}
                                        stroke="#9333ea"
                                        strokeWidth={3}
                                        strokeDasharray="5 5"
                                        dot={false}
                                        name="Predicted"
                                        connectNulls={false}
                                        isAnimationActive={false}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>

                            <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
                                <div className="flex items-center space-x-2">
                                    <div className="w-6 h-1 bg-blue-600"></div>
                                    <span className="text-gray-600 font-medium">Historical Data</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="w-6 h-1 bg-purple-600" style={{ borderTop: '3px dashed #9333ea' }}></div>
                                    <span className="text-gray-600 font-medium">Predicted Trend</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="w-6 h-4 bg-purple-200 rounded"></div>
                                    <span className="text-gray-600 font-medium">95% Confidence Interval</span>
                                </div>
                            </div>
                        </div>

                        {/* Disclaimer */}
                        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <p className="text-sm text-yellow-800">
                                <strong>Disclaimer:</strong> This prediction is based on historical trends and linear regression modeling.
                                Actual future prices may vary due to market conditions, policy changes, and other factors.
                                Use this as a reference only and not as financial advice.
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}