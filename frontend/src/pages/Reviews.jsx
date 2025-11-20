import React, { useState, useEffect } from 'react';
import { Newspaper, Filter, Search, TrendingUp, Building2, MapPin, Calendar, Star, ThumbsUp, ThumbsDown, Minus, ChevronDown, ChevronUp, ExternalLink, X } from 'lucide-react';
import axios from 'axios';
import Navigation from '../components/Navigation';
import './Reviews.css';

// Use backend directly to avoid proxy confusion in development
const API_BASE_URL = 'http://localhost:3001';

// Singapore regions and towns
const REGIONS = {
    'Central': ['BISHAN', 'BUKIT MERAH', 'BUKIT TIMAH', 'CENTRAL AREA', 'GEYLANG', 'KALLANG/WHAMPOA', 'MARINE PARADE', 'QUEENSTOWN', 'TOA PAYOH'],
    'North': ['ANG MO KIO', 'SEMBAWANG', 'WOODLANDS', 'YISHUN'],
    'North-East': ['HOUGANG', 'PUNGGOL', 'SENGKANG', 'SERANGOON'],
    'East': ['BEDOK', 'PASIR RIS', 'TAMPINES'],
    'West': ['BUKIT BATOK', 'BUKIT PANJANG', 'CHOA CHU KANG', 'CLEMENTI', 'JURONG EAST', 'JURONG WEST'],
    'North-West': ['LIM CHU KANG', 'SEMBAWANG', 'WOODLANDS', 'ADMIRALTY']
};

export default function Reviews() {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState(null);
    const [expandedArticle, setExpandedArticle] = useState(null);
    const [selectedRegion, setSelectedRegion] = useState('All');
    const [selectedTown, setSelectedTown] = useState('');
    
    const [filters, setFilters] = useState({
        sourceType: '',
        category: '',
        search: ''
    });

    // Sentiment columns
    const [positiveArticles, setPositiveArticles] = useState([]);
    const [neutralArticles, setNeutralArticles] = useState([]);
    const [negativeArticles, setNegativeArticles] = useState([]);

    const [sortBy, setSortBy] = useState('published_at');
    const [sortOrder, setSortOrder] = useState('desc');

    useEffect(() => {
        fetchArticles();
    }, [sortBy, sortOrder]);

    useEffect(() => {
        fetchArticles();
    }, [filters, selectedRegion, selectedTown]);

    useEffect(() => {
        fetchStats();
    }, []);

    // Categorize articles by sentiment
    useEffect(() => {
        const positive = articles.filter(a => a.sentiment.label === 'positive');
        const neutral = articles.filter(a => a.sentiment.label === 'neutral');
        const negative = articles.filter(a => a.sentiment.label === 'negative');
        
        setPositiveArticles(positive);
        setNeutralArticles(neutral);
        setNegativeArticles(negative);
    }, [articles]);

    const fetchArticles = async () => {
        setLoading(true);
        setError(null);

        try {
            const params = {
                sortBy,
                order: sortOrder,
                limit: 100, // Get more articles for Kanban
                ...filters
            };

            // Add location filter based on region/town
            if (selectedTown) {
                params.location = selectedTown;
            } else if (selectedRegion !== 'All') {
                // Filter by any town in the region (backend will need to handle multiple locations)
                const towns = REGIONS[selectedRegion];
                if (towns && towns.length > 0) {
                    params.location = towns[0]; // For now, just use first town
                }
            }

            Object.keys(params).forEach(key => {
                if (!params[key]) delete params[key];
            });

            const response = await axios.get(`${API_BASE_URL}/api/news`, { params });
            setArticles(response.data.data);
        } catch (err) {
            console.error('Error fetching articles:', err);
            const serverMessage = err.response?.data?.message || err.response?.data?.error || err.message;
            setError(`Failed to load articles: ${serverMessage}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/news/stats`);
            setStats(response.data.stats);
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setFilters({
            sourceType: '',
            category: '',
            search: ''
        });
        setSelectedRegion('All');
        setSelectedTown('');
    };

    const toggleExpanded = (articleId) => {
        setExpandedArticle(expandedArticle === articleId ? null : articleId);
    };

    const getSourceColor = (sourceType) => {
        switch (sourceType) {
            case 'government': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'property_portal': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'news_media': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getCategoryIcon = (category) => {
        if (category.includes('mrt') || category.includes('infrastructure')) return '🚇';
        if (category.includes('development')) return '🏗️';
        if (category.includes('market') || category.includes('price')) return '📈';
        if (category.includes('policy')) return '📜';
        return '📰';
    };

    const getUniqueCategories = (categories) => {
        if (!categories || categories.length === 0) return [];
        
        const uniqueCategories = [];
        const seenIcons = new Set();
        
        for (const cat of categories) {
            const icon = getCategoryIcon(cat);
            if (!seenIcons.has(icon)) {
                uniqueCategories.push(cat);
                seenIcons.add(icon);
            }
        }
        
        return uniqueCategories;
    };

    const getSentimentDisplay = (sentiment) => {
        const sentimentConfig = {
            'positive': { emoji: '😊', color: 'bg-green-50 border-green-200 text-green-700', label: 'Positive' },
            'neutral': { emoji: '😐', color: 'bg-gray-50 border-gray-200 text-gray-700', label: 'Neutral' },
            'negative': { emoji: '😞', color: 'bg-red-50 border-red-200 text-red-700', label: 'Negative' }
        };
        return sentimentConfig[sentiment?.label] || sentimentConfig['neutral'];
    };

    // Mock area ratings (you can fetch this from your backend later)
    const getAreaRating = (region) => {
        const ratings = {
            'Central': { rating: 4.5, reviews: 1247, trend: 'up', avgPrice: '650k' },
            'North': { rating: 4.2, reviews: 892, trend: 'up', avgPrice: '450k' },
            'North-East': { rating: 4.7, reviews: 1543, trend: 'up', avgPrice: '550k' },
            'East': { rating: 4.3, reviews: 1034, trend: 'stable', avgPrice: '480k' },
            'West': { rating: 4.1, reviews: 967, trend: 'up', avgPrice: '420k' },
            'North-West': { rating: 4.0, reviews: 654, trend: 'stable', avgPrice: '400k' }
        };
        return ratings[region] || { rating: 0, reviews: 0, trend: 'stable', avgPrice: 'N/A' };
    };

    const renderArticleCard = (article) => {
        const isExpanded = expandedArticle === article.article_id;
        
        return (
            <div
                key={article.article_id}
                className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all mb-3 cursor-pointer"
                onClick={() => toggleExpanded(article.article_id)}
            >
                {/* Source Badge */}
                <div className="flex items-center justify-between mb-3">
                    <span className={`px-2 py-1 rounded-lg text-xs font-semibold border ${getSourceColor(article.source.type)}`}>
                        {article.source.name}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(article.published_at).toLocaleDateString('en-SG', { month: 'short', day: 'numeric' })}
                    </span>
                </div>

                {/* Title */}
                <h4 className="text-sm font-bold text-gray-900 mb-2 line-clamp-2">
                    {article.title}
                </h4>

                <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border ${getSentimentDisplay(article.sentiment).color}`}>
                        <span>{getSentimentDisplay(article.sentiment).emoji}</span>
                        <span>{getSentimentDisplay(article.sentiment).label}</span>
                    </span>
                </div>

                {/* Description - Collapsed */}
                {!isExpanded && (
                    <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                        {article.description}
                    </p>
                )}

                {/* Description - Expanded */}
                {isExpanded && (
                    <>
                        <p className="text-xs text-gray-700 mb-3 leading-relaxed">
                            {article.description}
                        </p>

                        {/* Impact Assessment */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp className="w-4 h-4 text-blue-600" />
                                <p className="text-xs font-bold text-blue-900">Property Value Impact</p>
                            </div>
                            <p className="text-xs text-blue-800">
                                <strong>📍 {article.impact_assessment.predicted_impact.replace('_', ' ').toUpperCase()}</strong>
                            </p>
                            <p className="text-xs text-gray-600 mt-1 italic">
                                (How this affects property prices)
                            </p>
                            <p className="text-xs text-blue-700 mt-1">
                                Affected Areas: {article.impact_assessment.affected_areas.slice(0, 2).join(', ')}
                            </p>
                        </div>
                    </>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-3">
                    {getUniqueCategories(article.categories).slice(0, 2).map((cat, idx) => (
                        <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium"
                        >
                            <span>{getCategoryIcon(cat)}</span>
                        </span>
                    ))}
                    {article.locations.slice(0, 1).map((loc, idx) => (
                        <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium"
                        >
                            <MapPin className="w-3 h-3" />
                            <span>{loc}</span>
                        </span>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(article.article_id);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                        {isExpanded ? (
                            <>
                                <ChevronUp className="w-3 h-3" />
                                Less
                            </>
                        ) : (
                            <>
                                <ChevronDown className="w-3 h-3" />
                                More
                            </>
                        )}
                    </button>
                    <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-gray-600 hover:text-gray-800 flex items-center gap-1"
                    >
                        <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <Navigation />
            
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3 mb-2">
                        <Newspaper className="w-10 h-10 text-blue-600" />
                        Market Intelligence
                    </h1>
                    <p className="text-gray-600">Track sentiment and insights across Singapore regions</p>
                </div>

                {/* Area Ratings Section */}
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Area Reviews & Ratings</h2>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {Object.keys(REGIONS).map(region => {
                            const data = getAreaRating(region);
                            const isSelected = selectedRegion === region;
                            
                            return (
                                <div
                                    key={region}
                                    onClick={() => {
                                        setSelectedRegion(region);
                                        setSelectedTown('');
                                    }}
                                    className={`bg-white border-2 rounded-2xl p-4 cursor-pointer transition-all hover:shadow-lg ${
                                        isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-200'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-bold text-gray-900 text-sm">{region}</h3>
                                        {data.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-600" />}
                                        {data.trend === 'stable' && <Minus className="w-4 h-4 text-gray-600" />}
                                    </div>
                                    
                                    <div className="flex items-center gap-1 mb-2">
                                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                        <span className="font-bold text-lg">{data.rating}</span>
                                        <span className="text-xs text-gray-500">({data.reviews})</span>
                                    </div>
                                    
                                    <p className="text-xs text-gray-600">Avg: ${data.avgPrice}</p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Town Selector for Selected Region */}
                    {selectedRegion !== 'All' && (
                        <div className="mt-4 bg-white border-2 border-gray-200 rounded-2xl p-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select Town in {selectedRegion}:
                            </label>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setSelectedTown('')}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        !selectedTown 
                                            ? 'bg-blue-600 text-white' 
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    All Towns
                                </button>
                                {REGIONS[selectedRegion].map(town => (
                                    <button
                                        key={town}
                                        onClick={() => setSelectedTown(town)}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            selectedTown === town 
                                                ? 'bg-blue-600 text-white' 
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        {town}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Filters Bar */}
                <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 mb-6">
                    <div className="flex items-center gap-4 flex-wrap">
                        {/* Search */}
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search articles..."
                                    value={filters.search}
                                    onChange={(e) => handleFilterChange('search', e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>

                        {/* Source Type Filter */}
                        <select
                            value={filters.sourceType}
                            onChange={(e) => handleFilterChange('sourceType', e.target.value)}
                            className="px-4 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors bg-white"
                        >
                            <option value="">All Source Types</option>
                            <option value="government">🏛️ Government</option>
                            <option value="property_portal">🏢 Property Portals</option>
                            <option value="news_media">📰 News Media</option>
                        </select>

                        {/* Sort */}
                        <select
                            value={`${sortBy}-${sortOrder}`}
                            onChange={(e) => {
                                const [field, order] = e.target.value.split('-');
                                setSortBy(field);
                                setSortOrder(order);
                            }}
                            className="px-4 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors bg-white"
                        >
                            <option value="published_at-desc">Latest First</option>
                            <option value="published_at-asc">Oldest First</option>
                            <option value="relevance_score-desc">Most Relevant</option>
                        </select>

                        {/* Clear Filters */}
                        {(Object.values(filters).some(v => v) || selectedRegion !== 'All') && (
                            <button
                                onClick={clearFilters}
                                className="px-4 py-2 bg-red-100 text-red-700 rounded-xl text-sm font-medium hover:bg-red-200 transition-colors flex items-center gap-2"
                            >
                                <X className="w-4 h-4" />
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 mt-4 pt-4 border-t-2 border-gray-100 text-sm text-gray-600">
                        <span className="flex items-center gap-2">
                            <ThumbsUp className="w-4 h-4 text-green-600" />
                            <strong className="text-green-600">{positiveArticles.length}</strong> Positive
                        </span>
                        <span className="flex items-center gap-2">
                            <Minus className="w-4 h-4 text-gray-600" />
                            <strong className="text-gray-600">{neutralArticles.length}</strong> Neutral
                        </span>
                        <span className="flex items-center gap-2">
                            <ThumbsDown className="w-4 h-4 text-red-600" />
                            <strong className="text-red-600">{negativeArticles.length}</strong> Negative
                        </span>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-blue-600"></div>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center">
                        <p className="text-red-600 font-medium mb-4">{error}</p>
                        <button
                            onClick={fetchArticles}
                            className="px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Kanban Board - 3 Columns */}
                {!loading && !error && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Positive Column */}
                        <div className={`${positiveArticles.length === 0 ? 'hidden lg:block' : ''}`}>
                            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl p-4 mb-4 sticky top-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ThumbsUp className="w-5 h-5" />
                                        <h3 className="font-bold text-lg">Positive News</h3>
                                    </div>
                                    <span className="bg-white bg-opacity-30 px-3 py-1 rounded-full text-sm font-bold">
                                        {positiveArticles.length}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {positiveArticles.length > 0 ? (
                                    positiveArticles.map(article => renderArticleCard(article))
                                ) : (
                                    <div className="bg-white border-2 border-gray-200 rounded-xl p-8 text-center">
                                        <p className="text-gray-500 text-sm">No positive articles</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Neutral Column */}
                        <div className={`${neutralArticles.length === 0 ? 'hidden lg:block' : ''}`}>
                            <div className="bg-gradient-to-br from-gray-500 to-gray-600 text-white rounded-2xl p-4 mb-4 sticky top-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Minus className="w-5 h-5" />
                                        <h3 className="font-bold text-lg">Neutral Updates</h3>
                                    </div>
                                    <span className="bg-white bg-opacity-30 px-3 py-1 rounded-full text-sm font-bold">
                                        {neutralArticles.length}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {neutralArticles.length > 0 ? (
                                    neutralArticles.map(article => renderArticleCard(article))
                                ) : (
                                    <div className="bg-white border-2 border-gray-200 rounded-xl p-8 text-center">
                                        <p className="text-gray-500 text-sm">No neutral articles</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Negative Column */}
                        <div className={`${negativeArticles.length === 0 ? 'hidden lg:block' : ''}`}>
                            <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-2xl p-4 mb-4 sticky top-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ThumbsDown className="w-5 h-5" />
                                        <h3 className="font-bold text-lg">Negative News</h3>
                                    </div>
                                    <span className="bg-white bg-opacity-30 px-3 py-1 rounded-full text-sm font-bold">
                                        {negativeArticles.length}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {negativeArticles.length > 0 ? (
                                    negativeArticles.map(article => renderArticleCard(article))
                                ) : (
                                    <div className="bg-white border-2 border-gray-200 rounded-xl p-8 text-center">
                                        <p className="text-gray-500 text-sm">No negative articles</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* No Results */}
                {!loading && !error && articles.length === 0 && (
                    <div className="bg-white border-2 border-gray-200 rounded-2xl p-12 text-center">
                        <Newspaper className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-600 text-lg mb-4">No articles found</p>
                        <button
                            onClick={clearFilters}
                            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                        >
                            Clear Filters
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}