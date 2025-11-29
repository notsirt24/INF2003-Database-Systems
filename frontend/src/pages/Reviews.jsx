import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Newspaper, Search, TrendingUp, MapPin, Calendar, Star, ThumbsUp, ThumbsDown, Minus, ChevronDown, ChevronUp, ExternalLink, X } from 'lucide-react';
import axios from 'axios';
import Navigation from '../components/Navigation';
import './Reviews.css';

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
    // Tab state
    const [activeTab, setActiveTab] = useState('news'); // 'news', 'community', or 'my-reviews'

    // News articles state
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState(null);
    const [expandedArticle, setExpandedArticle] = useState(null);

    // Lemon8 reviews state
    const [lemon8Reviews, setLemon8Reviews] = useState([]);
    const [lemon8Loading, setLemon8Loading] = useState(false);
    const [lemon8Error, setLemon8Error] = useState(null);
    const [expandedReview, setExpandedReview] = useState(null);

    // Add Review Modal State
    const [showAddReviewModal, setShowAddReviewModal] = useState(false);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    
    // Authentication State
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [loginForm, setLoginForm] = useState({ username: '', password: '' });
    const [showLoginModal, setShowLoginModal] = useState(false);
    
    // User Reviews Management State
    const [showUserReviewsModal, setShowUserReviewsModal] = useState(false);
    const [userReviews, setUserReviews] = useState([]);
    const [editingReview, setEditingReview] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    
    // Enhanced Form State
    const [showAreaInput, setShowAreaInput] = useState(false);
    const [newAreaName, setNewAreaName] = useState('');
    const [selectedRegionForNewArea, setSelectedRegionForNewArea] = useState('');
    
    // Custom Amenity State
    const [showCustomAmenityInput, setShowCustomAmenityInput] = useState(false);
    const [newAmenityName, setNewAmenityName] = useState('');
    
    // Like state management
    const [likedReviews, setLikedReviews] = useState(new Set());
    
    const [reviewForm, setReviewForm] = useState({
        title: '',
        content: '',
        estate: '',
        rating: 3, // Default to neutral
        author_name: '',
        author_handle: '',
        image: null,
        imagePreview: '',
        amenities: [],
        photos: [],
        postAnonymously: false
    });
    
    // Reset form to initial state
    const resetForm = () => {
        setReviewForm({
            title: '',
            content: '',
            estate: '',
            rating: 3,
            author_name: '',
            author_handle: '',
            image: null,
            imagePreview: '',
            amenities: [],
            photos: [],
            postAnonymously: false
        });
    };
    
    // Predefined areas by region
    const SINGAPORE_AREAS = {
        'Central': ['Bishan', 'Bukit Merah', 'Bukit Timah', 'Central Area', 'Geylang', 'Kallang/Whampoa', 'Marine Parade', 'Queenstown', 'Toa Payoh'],
        'North': ['Ang Mo Kio', 'Sembawang', 'Woodlands', 'Yishun'],
        'North-East': ['Hougang', 'Punggol', 'Sengkang', 'Serangoon'],
        'East': ['Bedok', 'Pasir Ris', 'Tampines'],
        'West': ['Bukit Batok', 'Bukit Panjang', 'Choa Chu Kang', 'Clementi', 'Jurong East', 'Jurong West'],
        'North-West': ['Lim Chu Kang', 'Admiralty']
    };
    
    // Suggested amenities
    const SUGGESTED_AMENITIES = [
        'MRT Station', 'Bus Stop', 'Shopping Mall', 'Supermarket', 'Food Court', 'Hawker Centre',
        'Coffee Shop', 'Restaurant', 'Park', 'Playground', 'Gym', 'Swimming Pool', 'Library',
        'School', 'Clinic', 'Hospital', 'Bank', 'ATM', 'Post Office', 'Pharmacy'
    ];

    // Shared filter state
    const [selectedRegion, setSelectedRegion] = useState('All');
    const [selectedTown, setSelectedTown] = useState('');

    const [filters, setFilters] = useState({
        sourceType: '',
        category: '',
        search: ''
    });

    // Sentiment columns for news
    const [positiveArticles, setPositiveArticles] = useState([]);
    const [neutralArticles, setNeutralArticles] = useState([]);
    const [negativeArticles, setNegativeArticles] = useState([]);

    // Sentiment columns for Lemon8
    const [positiveLemon8, setPositiveLemon8] = useState([]);
    const [neutralLemon8, setNeutralLemon8] = useState([]);
    const [negativeLemon8, setNegativeLemon8] = useState([]);



    const [sortBy, setSortBy] = useState('published_at');
    const [sortOrder, setSortOrder] = useState('desc');

    // Fetch news articles
    useEffect(() => {
        if (activeTab === 'news') {
            fetchArticles();
        }
    }, [sortBy, sortOrder, filters, selectedRegion, selectedTown, activeTab]);

    // Fetch Lemon8 reviews
    useEffect(() => {
        if (activeTab === 'community') {
            fetchLemon8Reviews();
        }
    }, [filters.search, selectedRegion, selectedTown, activeTab]);

    useEffect(() => {
        fetchStats();
    }, []);

    // Categorize news articles by sentiment
    useEffect(() => {
        const positive = articles.filter(a => a.sentiment.label === 'positive');
        const neutral = articles.filter(a => a.sentiment.label === 'neutral');
        const negative = articles.filter(a => a.sentiment.label === 'negative');

        setPositiveArticles(positive);
        setNeutralArticles(neutral);
        setNegativeArticles(negative);
    }, [articles]);

    // Categorize Lemon8 reviews by sentiment
    useEffect(() => {
        console.log('Lemon8 reviews:', lemon8Reviews.length, lemon8Reviews.slice(0, 2));
        
        // Handle different sentiment field formats
        const positive = lemon8Reviews.filter(r => 
            r.sentiment === 'positive' || 
            r.sentiment === 'POSITIVE' ||
            (r.sentiment && r.sentiment.toLowerCase && r.sentiment.toLowerCase() === 'positive')
        );
        const neutral = lemon8Reviews.filter(r => 
            r.sentiment === 'neutral' || 
            r.sentiment === 'NEUTRAL' ||
            (r.sentiment && r.sentiment.toLowerCase && r.sentiment.toLowerCase() === 'neutral') ||
            !r.sentiment  // If no sentiment field, treat as neutral
        );
        const negative = lemon8Reviews.filter(r => 
            r.sentiment === 'negative' || 
            r.sentiment === 'NEGATIVE' ||
            (r.sentiment && r.sentiment.toLowerCase && r.sentiment.toLowerCase() === 'negative')
        );

        console.log('Sentiment counts:', { positive: positive.length, neutral: neutral.length, negative: negative.length });
        console.log('Sample review structure:', lemon8Reviews[0]);

        setPositiveLemon8(positive);
        setNeutralLemon8(neutral);
        setNegativeLemon8(negative);
    }, [lemon8Reviews]);

    const fetchArticles = async () => {
        setLoading(true);
        setError(null);

        try {
            const params = {
                sortBy,
                order: sortOrder,
                limit: 100,
                ...filters
            };

            // Add location filter based on region/town
            if (selectedTown) {
                params.location = selectedTown;
            } else if (selectedRegion !== 'All') {
                const towns = REGIONS[selectedRegion];
                if (towns && towns.length > 0) {
                    params.location = towns[0];
                }
            }

            Object.keys(params).forEach(key => {
                if (!params[key]) delete params[key];
            });

            const response = await axios.get(`/api/news`, { params });
            setArticles(response.data.data);
        } catch (err) {
            console.error('Error fetching articles:', err);
            const serverMessage = err.response?.data?.message || err.response?.data?.error || err.message;
            setError(`Failed to load articles: ${serverMessage}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchLemon8Reviews = async () => {
        setLemon8Loading(true);
        setLemon8Error(null);

        try {
            const params = {
                limit: 100
            };

            // Add location filter
            if (selectedTown) {
                params.estate = selectedTown;
            } else if (selectedRegion !== 'All') {
                const towns = REGIONS[selectedRegion];
                if (towns && towns.length > 0) {
                    params.estate = towns[0];
                }
            }

            // Add search filter
            if (filters.search) {
                params.search = filters.search;
            }

            Object.keys(params).forEach(key => {
                if (!params[key]) delete params[key];
            });

            const response = await axios.get(`/api/reviews/lemon8`, { params });
            setLemon8Reviews(response.data.data || []);
        } catch (err) {
            console.error('Error fetching Lemon8 reviews:', err);
            const serverMessage = err.response?.data?.message || err.response?.data?.error || err.message;
            setLemon8Error(`Failed to load reviews: ${serverMessage}`);
        } finally {
            setLemon8Loading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await axios.get(`/api/news/stats`);
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

    const handleReviewFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        if (type === 'checkbox') {
            // Handle amenities checkboxes
            setReviewForm(prev => ({
                ...prev,
                amenities: {
                    ...prev.amenities,
                    [name]: checked
                }
            }));
        } else {
            // Handle regular form fields
            setReviewForm(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    // Authentication Functions
    useEffect(() => {
        const loadUser = () => {
            // Check global user authentication first
            const globalUser = sessionStorage.getItem('user') || localStorage.getItem('user');
            // Then check local user authentication
            const savedUser = localStorage.getItem('currentUser');
            
            if (globalUser) {
                const parsedGlobalUser = JSON.parse(globalUser);
                setCurrentUser(parsedGlobalUser);
                setIsLoggedIn(true);
            } else if (savedUser) {
                const parsedLocalUser = JSON.parse(savedUser);
                setCurrentUser(parsedLocalUser);
                setIsLoggedIn(true);
            } else {
                setCurrentUser(null);
                setIsLoggedIn(false);
            }
        };
        
        loadUser();
        
        // Listen for storage changes and user changes
        window.addEventListener('storage', loadUser);
        window.addEventListener('userChanged', loadUser);
        
        return () => {
            window.removeEventListener('storage', loadUser);
            window.removeEventListener('userChanged', loadUser);
        };
    }, []);

    // Force body scroll lock when modals are open
    useEffect(() => {
        // Force body scroll lock when modals are open
        if (showLoginModal || showAddReviewModal || showUserReviewsModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        
        if (showLoginModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showLoginModal, isLoggedIn, currentUser]);
    
    const handleLogin = (e) => {
        e.preventDefault();
        if (loginForm.username && loginForm.password) {
            const user = {
                id: Date.now(),
                username: loginForm.username,
                loginTime: new Date().toISOString(),
                email: `${loginForm.username}@example.com`
            };
            setCurrentUser(user);
            setIsLoggedIn(true);
            
            // Save to both local and global storage
            localStorage.setItem('currentUser', JSON.stringify(user));
            localStorage.setItem('user', JSON.stringify(user));
            sessionStorage.setItem('user', JSON.stringify(user));
            
            setShowLoginModal(false);
            setLoginForm({ username: '', password: '' });
            
            // Notify other components
            window.dispatchEvent(new Event('userChanged'));
            
            alert(`Welcome, ${user.username}!`);
        } else {
            alert('Please enter both username and password.');
        }
    };
    
    const handleLogout = () => {
        setCurrentUser(null);
        setIsLoggedIn(false);
        setUserReviews([]);
        
        // Clear all user data from storage
        localStorage.removeItem('currentUser');
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('token');
        
        // Notify other components
        window.dispatchEvent(new Event('userChanged'));
        

        alert('You have been logged out.');
    };
    
    const requireLogin = (callback) => {
        if (!isLoggedIn) {
            window.location.href = '/login';
            return false;
        }
        callback();
        return true;
    };
    
    const removePhoto = (index) => {
        setReviewForm(prev => ({
            ...prev,
            photos: prev.photos.filter((_, i) => i !== index)
        }));
    };
    
    const handleAmenityToggle = (amenity) => {
        setReviewForm(prev => {
            const currentAmenities = Array.isArray(prev.amenities) ? prev.amenities : [];
            return {
                ...prev,
                amenities: currentAmenities.includes(amenity)
                    ? currentAmenities.filter(a => a !== amenity)
                    : [...currentAmenities, amenity]
            };
        });
    };

    const handleAddCustomAmenity = () => {
        const currentAmenities = Array.isArray(reviewForm.amenities) ? reviewForm.amenities : [];
        if (newAmenityName.trim() && !currentAmenities.includes(newAmenityName.trim())) {
            setReviewForm(prev => ({
                ...prev,
                amenities: [...currentAmenities, newAmenityName.trim()]
            }));
            setNewAmenityName('');
            setShowCustomAmenityInput(false);
        }
    };

    const handleRemoveAmenity = (amenity) => {
        setReviewForm(prev => {
            const currentAmenities = Array.isArray(prev.amenities) ? prev.amenities : [];
            return {
                ...prev,
                amenities: currentAmenities.filter(a => a !== amenity)
            };
        });
    };
    
    const handleAddNewArea = () => {
        if (newAreaName && selectedRegionForNewArea) {
            SINGAPORE_AREAS[selectedRegionForNewArea].push(newAreaName);
            setReviewForm(prev => ({ ...prev, estate: newAreaName }));
            setNewAreaName('');
            setSelectedRegionForNewArea('');
            setShowAreaInput(false);
        }
    };
    
    // User Reviews Management Functions
    const fetchUserReviews = async () => {
        try {
            if (!isLoggedIn || !currentUser?.email) {
                setUserReviews([]);
                return;
            }
            // Fetch user's reviews from database using their email
            const response = await axios.get(`/api/reviews/user/${encodeURIComponent(currentUser.email)}`);
            
            if (response.data.success) {
                setUserReviews(response.data.data || []);
            } else {
                setUserReviews([]);
            }
        } catch (error) {
            console.error('Error fetching user reviews:', error);
            setUserReviews([]);
        }
    };

    const handleEditReview = (review) => {
        // Determine if this was posted anonymously
        const wasAnonymous = review.author_name === 'Anonymous';
        
        // Populate the form with review data for editing
        setReviewForm({
            title: review.title || '',
            content: review.content || '',
            estate: review.estate || '',
            rating: review.rating || 3,
            author_name: wasAnonymous ? (currentUser?.username || 'User') : review.author_name,
            author_handle: review.account_handle || currentUser?.email || '',
            image: null,
            imagePreview: review.imageUrl || '',
            amenities: Array.isArray(review.amenities_mentioned) ? review.amenities_mentioned : [],
            photos: [],
            postAnonymously: wasAnonymous
        });
        
        setEditingReview(review);
        setShowUserReviewsModal(false);
        setShowAddReviewModal(true);
    };

    const handleDeleteReview = async (reviewId) => {
        if (!reviewId) {
            alert('Invalid review ID');
            return;
        }

        const confirmed = window.confirm('Are you sure you want to delete this review? This action cannot be undone.');
        
        if (!confirmed) return;

        try {
            const response = await axios.delete(`/api/reviews/user/${reviewId}`);
            
            if (response.data.success) {
                alert('Review deleted successfully!');
                // Refresh the reviews list
                fetchUserReviews();
                fetchLemon8Reviews(); // Also refresh the main reviews to remove it from display
            } else {
                alert('Failed to delete review: ' + (response.data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error deleting review:', error);
            alert('Failed to delete review. Please try again.');
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setReviewForm(prev => ({
                    ...prev,
                    image: file,
                    imagePreview: event.target.result
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmitReview = async (e) => {
        e.preventDefault();
        setIsSubmittingReview(true);

        try {
            if (!isLoggedIn || !currentUser) {
                alert('Please log in to submit a review.');
                setShowAddReviewModal(false);
                window.location.href = '/login';
                return;
            }
            
            const reviewData = {
                title: reviewForm.title,
                content: reviewForm.content,
                estate: reviewForm.estate,
                rating: reviewForm.rating,
                author_name: reviewForm.postAnonymously ? 'Anonymous' : (currentUser?.username || currentUser?.name || 'User'),
                account_handle: currentUser?.email || 'user@example.com', // Always use real email for filtering
                userId: currentUser.id,
                amenities: reviewForm.amenities,
                photos: reviewForm.photos,
                sentiment: reviewForm.rating <= 2 ? 'negative' : reviewForm.rating >= 4 ? 'positive' : 'neutral',
                postAnonymously: reviewForm.postAnonymously
            };

            let response;
            
            if (editingReview) {
                // Update existing review
                response = await axios.put(`/api/reviews/user/${editingReview._id}`, reviewData);
                alert('Review updated successfully!');
            } else {
                // Create new review
                response = await axios.post('/api/reviews/lemon8', reviewData);
                alert('Review submitted successfully!');
            }

            if (response.data.success) {
                
                // Reset form
                setReviewForm({
                    title: '',
                    content: '',
                    estate: '',
                    rating: 3,
                    author_name: '',
                    author_handle: '',
                    image: null,
                    imagePreview: '',
                    amenities: [],
                    photos: [],
                    postAnonymously: false
                });
                
                // Reset editing state
                setEditingReview(null);
                
                // Close modal
                setShowAddReviewModal(false);
                
                // Refresh reviews
                fetchLemon8Reviews();
                fetchUserReviews();
                

            }
        } catch (err) {
            console.error('Error submitting review:', err);
            // Handle error (you can add error notification here)
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const toggleExpanded = (articleId) => {
        setExpandedArticle(expandedArticle === articleId ? null : articleId);
    };

    const toggleExpandedReview = (reviewId) => {
        setExpandedReview(expandedReview === reviewId ? null : reviewId);
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
        return sentimentConfig[sentiment?.label || sentiment] || sentimentConfig['neutral'];
    };

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
            
            {/* Add Review Modal - Debug: showAddReviewModal = {showAddReviewModal ? 'TRUE' : 'FALSE'} */}
            {showAddReviewModal && (
                <div 
                    style={{ 
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 99999,
                        padding: '20px'
                    }} 
                    onClick={(e) => {

                        if (e.target === e.currentTarget) setShowAddReviewModal(false);
                    }}
                >
                    <div 
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            width: '100%',
                            maxWidth: '800px',
                            maxHeight: '90vh',
                            overflow: 'auto',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#374151', margin: 0 }}>
                                    {editingReview ? 'Edit Review' : 'Add Community Review'}
                                </h3>
                                <button
                                    onClick={() => {
                                        resetForm();
                                        setEditingReview(null);
                                        setShowAddReviewModal(false);
                                    }}
                                    style={{ 
                                        background: 'none', 
                                        border: 'none', 
                                        fontSize: '24px', 
                                        color: '#9CA3AF',
                                        cursor: 'pointer',
                                        padding: '4px'
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                            
                            {/* Test visibility */}
                            <div style={{ 
                                backgroundColor: '#FEE2E2', 
                                border: '1px solid #FECACA', 
                                color: '#DC2626', 
                                padding: '12px', 
                                borderRadius: '6px', 
                                marginBottom: '16px',
                                fontSize: '14px'
                            }}>
                                🔍 DEBUG: Modal is rendering! If you can see this, the modal form is working properly.
                            </div>
                            
                            <form onSubmit={handleSubmitReview} className="space-y-6">
                                {/* Title */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Review Title *
                                    </label>
                                    <input
                                        type="text"
                                        name="title"
                                        value={reviewForm.title}
                                        onChange={handleReviewFormChange}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="e.g., Great location with excellent amenities"
                                    />
                                </div>
                                
                                {/* Estate */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Housing Estate *
                                    </label>
                                    <input
                                        type="text"
                                        name="estate"
                                        value={reviewForm.estate}
                                        onChange={handleReviewFormChange}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="e.g., Punggol, Tampines, Jurong West"
                                    />
                                </div>
                                
                                {/* Rating */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Overall Rating * ({reviewForm.rating}/5)
                                    </label>
                                    <input
                                        type="range"
                                        name="rating"
                                        min="1"
                                        max="5"
                                        step="0.1"
                                        value={reviewForm.rating}
                                        onChange={handleReviewFormChange}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                                        <span>1 (Poor)</span>
                                        <span>3 (Average)</span>
                                        <span>5 (Excellent)</span>
                                    </div>
                                </div>
                                
                                {/* Content */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Review Content *
                                    </label>
                                    <textarea
                                        name="content"
                                        value={reviewForm.content}
                                        onChange={handleReviewFormChange}
                                        required
                                        rows={4}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Share your experience about living in this area..."
                                    />
                                </div>
                                
                                {/* Author */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Your Name
                                    </label>
                                    <input
                                        type="text"
                                        name="author"
                                        value={reviewForm.author}
                                        onChange={handleReviewFormChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Anonymous (optional)"
                                    />
                                </div>
                                
                                {/* Area Selection with Add New Option */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Housing Area *
                                    </label>
                                    {!showAreaInput ? (
                                        <div className="space-y-2">
                                            <select
                                                name="estate"
                                                value={reviewForm.estate}
                                                onChange={handleReviewFormChange}
                                                required
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            >
                                                <option value="">Select an area</option>
                                                {Object.entries(SINGAPORE_AREAS).map(([region, areas]) => (
                                                    <optgroup key={region} label={region}>
                                                        {areas.map(area => (
                                                            <option key={area} value={area}>{area}</option>
                                                        ))}
                                                    </optgroup>
                                                ))}\n                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => setShowAreaInput(true)}
                                                className="text-sm text-blue-600 hover:text-blue-800"
                                            >
                                                + Add new area
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex gap-2">
                                                <select
                                                    value={selectedRegionForNewArea}
                                                    onChange={(e) => setSelectedRegionForNewArea(e.target.value)}
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                >
                                                    <option value="">Select Region</option>
                                                    {Object.keys(SINGAPORE_AREAS).map(region => (
                                                        <option key={region} value={region}>{region}</option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="text"
                                                    value={newAreaName}
                                                    onChange={(e) => setNewAreaName(e.target.value)}
                                                    placeholder="Enter area name"
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleAddNewArea}
                                                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                                                >
                                                    Add
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowAreaInput(false);
                                                        setNewAreaName('');
                                                        setSelectedRegionForNewArea('');
                                                    }}
                                                    className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Rating with Stars */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Overall Rating * ({reviewForm.rating}/5 - {reviewForm.rating <= 2 ? 'Negative' : reviewForm.rating >= 4 ? 'Positive' : 'Neutral'})
                                    </label>
                                    <div className="flex items-center gap-2 mb-2">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <button
                                                key={star}
                                                type="button"
                                                onClick={() => setReviewForm(prev => ({ ...prev, rating: star }))}
                                                className={`text-2xl transition-colors ${
                                                    star <= reviewForm.rating 
                                                        ? 'text-yellow-500' 
                                                        : 'text-gray-300 hover:text-yellow-400'
                                                }`}
                                            >
                                                ★
                                            </button>
                                        ))}
                                        <span className="ml-2 text-sm text-gray-600">
                                            {reviewForm.rating <= 2 && '😞 Not satisfied'}\n                                            {reviewForm.rating === 3 && '😐 Neutral'}\n                                            {reviewForm.rating >= 4 && '😊 Satisfied'}
                                        </span>
                                    </div>
                                </div>
                                
                                {/* Photos Upload */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Add Photos (Optional - Max 5)
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleImageUpload}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    {reviewForm.photos.length > 0 && (
                                        <div className="mt-2 grid grid-cols-3 gap-2">
                                            {reviewForm.photos.map((photo, index) => (
                                                <div key={index} className="relative">
                                                    <img 
                                                        src={photo} 
                                                        alt={`Preview ${index + 1}`} 
                                                        className="w-20 h-20 object-cover rounded border"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removePhoto(index)}
                                                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs hover:bg-red-700"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Nearby Amenities (Optional) */}
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <div className="flex items-center mb-3">
                                        <span className="text-blue-600 mr-2">📍</span>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Nearby Amenities (Optional)
                                        </label>
                                    </div>
                                    
                                    {/* Suggested Amenities Grid */}
                                    <div className="grid grid-cols-3 gap-3 mb-4">
                                        {SUGGESTED_AMENITIES.map(amenity => (
                                            <label key={amenity} className="flex items-center space-x-2 cursor-pointer hover:bg-white p-2 rounded transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={Array.isArray(reviewForm.amenities) && reviewForm.amenities.includes(amenity)}
                                                    onChange={() => handleAmenityToggle(amenity)}
                                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                                />
                                                <span className="text-sm text-gray-700">
                                                    {amenity}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                    
                                    {/* Add Custom Amenity */}
                                    <div className="border-t border-gray-200 pt-3">
                                        {!showCustomAmenityInput ? (
                                            <button
                                                type="button"
                                                onClick={() => setShowCustomAmenityInput(true)}
                                                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center"
                                            >
                                                <span className="mr-1">+</span> Add custom amenity
                                            </button>
                                        ) : (
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    type="text"
                                                    value={newAmenityName}
                                                    onChange={(e) => setNewAmenityName(e.target.value)}
                                                    placeholder="e.g., Dog Park, Night Market"
                                                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    onKeyPress={(e) => e.key === 'Enter' && handleAddCustomAmenity()}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddCustomAmenity}
                                                    disabled={!newAmenityName.trim()}
                                                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Add
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowCustomAmenityInput(false);
                                                        setNewAmenityName('');
                                                    }}
                                                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Selected Amenities Summary */}
                                    {Array.isArray(reviewForm.amenities) && reviewForm.amenities.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-gray-200">
                                            <div className="flex flex-wrap gap-1">
                                                {reviewForm.amenities.map(amenity => (
                                                    <span
                                                        key={amenity}
                                                        className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                                                    >
                                                        {amenity}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveAmenity(amenity)}
                                                            className="ml-1 text-blue-600 hover:text-blue-800"
                                                            title="Remove amenity"
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Image Upload */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Add Photo (Optional)
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    {reviewForm.imagePreview && (
                                        <div className="mt-2">
                                            <img 
                                                src={reviewForm.imagePreview} 
                                                alt="Preview" 
                                                className="w-32 h-32 object-cover rounded-lg border"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setReviewForm(prev => ({ ...prev, image: null, imagePreview: '' }))}
                                                className="mt-1 text-sm text-red-600 hover:text-red-800"
                                            >
                                                Remove Image
                                            </button>
                                        </div>
                                    )}
                                </div>
                                

                                
                                {/* Buttons */}
                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            resetForm();
                                            setEditingReview(null);
                                            setShowAddReviewModal(false);
                                        }}
                                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                    >
                                        {editingReview ? 'Update Review' : 'Submit Review'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            
            {/* User Reviews Management Modal */}
            {/* User Reviews Modal - Debug: showUserReviewsModal = {showUserReviewsModal ? 'TRUE' : 'FALSE'} */}
            {showUserReviewsModal && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" 
                    style={{ zIndex: 99999, display: 'flex !important' }}
                >
                    <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-800">My Reviews</h3>
                                    <p className="text-sm text-gray-500">
                                        {userReviews.length > 0 
                                            ? `You have ${userReviews.length} review${userReviews.length === 1 ? '' : 's'}`
                                            : 'No reviews yet'
                                        }
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowUserReviewsModal(false)}
                                    className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                                >
                                    ×
                                </button>
                            </div>
                            
                            {userReviews.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="text-6xl mb-4">📝</div>
                                    <h4 className="text-xl font-semibold text-gray-700 mb-2">No Reviews Yet</h4>
                                    <p className="text-gray-500 mb-6">You haven't created any reviews yet. Start by adding your first review!</p>
                                    <button
                                        onClick={() => {
                                            resetForm();
                                            setEditingReview(null);
                                            setShowUserReviewsModal(false);
                                            setShowAddReviewModal(true);
                                        }}
                                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                                    >
                                        Add Your First Review
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {userReviews.map((review, index) => (
                                        <div key={review._id || index} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex-1">
                                                    <h4 className="text-lg font-semibold text-gray-900 mb-2">{review.title}</h4>
                                                    <div className="flex items-center gap-4 mb-2">
                                                        <div className="flex items-center gap-1">
                                                            <MapPin className="w-4 h-4 text-gray-500" />
                                                            <span className="text-sm text-gray-600">{review.estate}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                                            <span className="text-sm font-medium">{review.rating}/5</span>
                                                        </div>
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                            review.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                                                            review.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                                                            'bg-yellow-100 text-yellow-700'
                                                        }`}>
                                                            {review.sentiment}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500">
                                                        Created: {new Date(review.created_at).toLocaleDateString()} {new Date(review.created_at).toLocaleTimeString()}
                                                        {review.updated_at && (
                                                            <span> • Updated: {new Date(review.updated_at).toLocaleDateString()}</span>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2 ml-4">
                                                    <button
                                                        onClick={() => handleEditReview(review)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Edit Review"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteReview(review._id)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete Review"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <p className="text-gray-700 mb-4 leading-relaxed">
                                                {review.content}
                                            </p>
                                            
                                            {review.amenities_mentioned && Array.isArray(review.amenities_mentioned) && review.amenities_mentioned.length > 0 && (
                                                <div className="border-t border-gray-100 pt-3">
                                                    <p className="text-xs font-medium text-gray-500 mb-2">Nearby Amenities:</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {review.amenities_mentioned.map((amenity, idx) => (
                                                            <span 
                                                                key={idx}
                                                                className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                                                            >
                                                                {amenity}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            <div className="mt-6 flex justify-center">
                                <button
                                    onClick={() => {
                                        resetForm();
                                        setEditingReview(null);
                                        setShowUserReviewsModal(false);
                                        setShowAddReviewModal(true);
                                    }}
                                    className="px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
                                >
                                    <span className="text-lg">+</span>
                                    Add New Review
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Login Modal - Debug: showLoginModal = {showLoginModal ? 'true' : 'false'} */}
            {showLoginModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
                    <div 
                        className="bg-white rounded-xl w-full max-w-md"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-2xl font-bold text-gray-800">Login Required</h3>
                                <button
                                    onClick={() => {

                                        setShowLoginModal(false);
                                    }}
                                    className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                                >
                                    ×
                                </button>
                            </div>
                            
                            <p className="text-gray-600 mb-6">
                                Please log in to add reviews and manage your content.
                            </p>
                            
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Username
                                    </label>
                                    <input
                                        type="text"
                                        value={loginForm.username}
                                        onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Enter your username"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        value={loginForm.password}
                                        onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Enter your password"
                                    />
                                </div>
                                
                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowLoginModal(false)}
                                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                    >
                                        Login
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
};

const renderLemon8Card = (review) => {
    const isExpanded = expandedReview === review._id;
    const isCommunityPost = review.is_community_post || review.source === 'community';

    const handleCardClick = (e) => {
        // If clicking on interactive elements, don't open Lemon8 post
        if (e.target.closest('button') || e.target.closest('a')) {
            return;
        }
        
        // Don't navigate for community posts
        if (isCommunityPost) {
            return;
        }
        
        // Open Lemon8 post in new tab
        let targetUrl;
        if (review.url || review.post_url) {
            targetUrl = review.url || review.post_url;
        } else if (review.title) {
            // Create a Lemon8 search URL based on the title
            const searchQuery = encodeURIComponent(review.title);
            targetUrl = `https://www.lemon8-app.com/search?q=${searchQuery}`;
        } else {
            // Fallback to general Lemon8 site
            targetUrl = 'https://www.lemon8-app.com';
        }
        
        if (targetUrl) {
            window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
    };

    const handleLike = (reviewId) => (e) => {
        e.stopPropagation();
        const wasLiked = likedReviews.has(reviewId);
        const newLikedReviews = new Set(likedReviews);
        
        if (wasLiked) {
            newLikedReviews.delete(reviewId);
        } else {
            newLikedReviews.add(reviewId);
        }
        
        setLikedReviews(newLikedReviews);
        
        // Update the review in the local state
        setLemon8Reviews(prev => prev.map(r => {
            if (r._id === reviewId) {
                return {
                    ...r,
                    likes_count: wasLiked ? (r.likes_count || 1) - 1 : (r.likes_count || 0) + 1
                };
            }
            return r;
        }));
    };

    return (
        <div
            key={review._id}
            className={`bg-white border-2 border-gray-200 rounded-xl p-4 hover:shadow-xl transition-all mb-3 relative ${
                isCommunityPost ? 'hover:border-green-300' : 'hover:border-purple-300 cursor-pointer group'
            }`}
            onClick={handleCardClick}
            title={isCommunityPost ? 'Community Review' : `Click to ${review.url || review.post_url ? 'view original post' : 'search'} on Lemon8`}
        >
            {/* Source Badge */}
            <div className="flex items-center justify-between mb-3">
                <span className={`px-2 py-1 rounded-lg text-xs font-semibold border ${
                    isCommunityPost 
                        ? 'bg-green-100 text-green-700 border-green-200' 
                        : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                }`}>
                    {isCommunityPost ? '👥 Community' : '🍋 Lemon8'}
                </span>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                        {isCommunityPost ? review.author_name || 'Anonymous' : `@${review.account_handle || 'Community'}`}
                    </span>
                    {!isCommunityPost && (
                        <span className="text-xs text-blue-500 opacity-70 group-hover:opacity-100 transition-opacity">
                            🔗 Click to view
                        </span>
                    )}
                </div>
            </div>

            {/* Title */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 line-clamp-2">
                {review.title}
            </h4>

            {/* Sentiment Badge */}
            <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border ${getSentimentDisplay(review.sentiment).color}`}>
                    <span>{getSentimentDisplay(review.sentiment).emoji}</span>
                    <span className="capitalize">{review.sentiment}</span>
                </span>
                {review.ai_confidence && (
                    <span className="text-xs text-gray-500">
                        {Math.round(review.ai_confidence * 100)}% confident
                    </span>
                )}
            </div>

            {/* Preview */}
            {!isExpanded && (
                <p className="text-xs text-gray-600 mb-3 line-clamp-3">
                    {review.content}
                </p>
            )}

            {/* Expanded Content */}
            {isExpanded && (
                <>
                    <p className="text-xs text-gray-700 mb-3 leading-relaxed">
                        {review.full_text || review.content}
                    </p>

                    {/* Key Points */}
                    {review.key_points && review.key_points.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                            <p className="text-xs font-bold text-blue-900 mb-2">Key Points:</p>
                            <ul className="text-xs text-blue-800 space-y-1">
                                {review.key_points.map((point, idx) => (
                                    <li key={idx}>• {point}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            )}

            {/* Amenities Mentioned */}
            {review.amenities_mentioned && (
                (Array.isArray(review.amenities_mentioned) && review.amenities_mentioned.length > 0) ||
                (typeof review.amenities_mentioned === 'object' && Object.values(review.amenities_mentioned).some(arr => arr && arr.length > 0))
            ) && (
                <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Amenities Mentioned:</p>
                    <div className="flex flex-wrap gap-1">
                        {/* Handle simple array format (community posts) */}
                        {Array.isArray(review.amenities_mentioned) && review.amenities_mentioned.map((amenity, idx) => (
                            <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs flex items-center gap-1">
                                🏠 {amenity}
                            </span>
                        ))}
                        
                        {/* Handle categorized format (Lemon8 posts) */}
                        {typeof review.amenities_mentioned === 'object' && !Array.isArray(review.amenities_mentioned) && (
                            <>
                                {review.amenities_mentioned.transport?.slice(0, 3).map((amenity, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs flex items-center gap-1">
                                        🚇 {amenity}
                                    </span>
                                ))}
                                {review.amenities_mentioned.shopping?.slice(0, 3).map((amenity, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs flex items-center gap-1">
                                        🛍️ {amenity}
                                    </span>
                                ))}
                                {review.amenities_mentioned.food?.slice(0, 3).map((amenity, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs flex items-center gap-1">
                                        🍴 {amenity}
                                    </span>
                                ))}
                                {review.amenities_mentioned.recreation?.slice(0, 3).map((amenity, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs flex items-center gap-1">
                                        🏃 {amenity}
                                    </span>
                                ))}
                                {review.amenities_mentioned.education?.slice(0, 3).map((amenity, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs flex items-center gap-1">
                                        🏫 {amenity}
                                    </span>
                                ))}
                                {review.amenities_mentioned.healthcare?.slice(0, 3).map((amenity, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs flex items-center gap-1">
                                        🏥 {amenity}
                                    </span>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Estate Tag */}
            {review.estate && (
                <div className="mb-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-medium">
                        <MapPin className="w-3 h-3" />
                        {review.estate}
                    </span>
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleExpandedReview(review._id);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                >
                    {isExpanded ? (
                        <>
                            <ChevronUp className="w-3 h-3" />
                            Show Less
                        </>
                    ) : (
                        <>
                            <ChevronDown className="w-3 h-3" />
                            Show More
                        </>
                    )}
                </button>

                {isCommunityPost ? (
                    /* Community Post Actions */
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleLike(review._id)}
                            className={`flex items-center gap-1 text-xs transition-colors px-2 py-1 rounded ${
                                likedReviews.has(review._id) 
                                    ? 'text-red-600 bg-red-50' 
                                    : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                            }`}
                        >
                            <ThumbsUp className="w-3 h-3" />
                            <span>{review.likes_count || 0}</span>
                        </button>
                    </div>
                ) : (
                    /* Lemon8 External Link */
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 group-hover:text-purple-600 transition-colors">
                            Click to view on Lemon8
                        </span>
                        <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-purple-600 transition-colors" />
                    </div>
                )}
            </div>
            </div >
        );
    };

return (
    <>

        
        {showAddReviewModal && createPortal(
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                zIndex: 2147483647,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
            }}>
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '20px',
                    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
                    width: '100%',
                    maxWidth: '800px',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    color: 'black'
                }}>
                    {/* Header */}
                    <div style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        padding: '30px',
                        borderRadius: '20px 20px 0 0',
                        textAlign: 'center'
                    }}>
                        <h2 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>
                            {editingReview ? '✏️ Edit Your Review' : '✨ Share Your Experience'}
                        </h2>
                        <p style={{ margin: '10px 0 0 0', fontSize: '18px', opacity: 0.9 }}>
                            Help others discover amazing places in Singapore
                        </p>
                    </div>

                    {/* Form Content */}
                    <div style={{ padding: '40px' }}>
                        <form onSubmit={handleSubmitReview}>
                            {/* Title */}
                            <div style={{ marginBottom: '25px' }}>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '8px', 
                                    fontSize: '16px', 
                                    fontWeight: '600', 
                                    color: '#374151' 
                                }}>
                                    📝 Review Title *
                                </label>
                                <input
                                    type="text"
                                    name="title"
                                    value={reviewForm.title}
                                    onChange={handleReviewFormChange}
                                    required
                                    placeholder="e.g., Amazing location with great amenities!"
                                    style={{
                                        width: '100%',
                                        padding: '15px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '12px',
                                        fontSize: '16px',
                                        boxSizing: 'border-box',
                                        transition: 'border-color 0.2s',
                                        outline: 'none'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                                />
                            </div>

                            {/* Area Selection */}
                            <div style={{ marginBottom: '25px' }}>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '8px', 
                                    fontSize: '16px', 
                                    fontWeight: '600', 
                                    color: '#374151' 
                                }}>
                                    📍 Housing Area *
                                </label>
                                <select
                                    name="estate"
                                    value={reviewForm.estate}
                                    onChange={handleReviewFormChange}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '15px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '12px',
                                        fontSize: '16px',
                                        boxSizing: 'border-box',
                                        backgroundColor: 'white'
                                    }}
                                >
                                    <option value="">Select your area</option>
                                    {Object.entries(SINGAPORE_AREAS).map(([region, areas]) => (
                                        <optgroup key={region} label={region}>
                                            {areas.map(area => (
                                                <option key={area} value={area}>{area}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>

                            {/* Rating */}
                            <div style={{ marginBottom: '25px' }}>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '8px', 
                                    fontSize: '16px', 
                                    fontWeight: '600', 
                                    color: '#374151' 
                                }}>
                                    ⭐ Overall Rating: {reviewForm.rating}/5
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <input
                                        type="range"
                                        name="rating"
                                        min="1"
                                        max="5"
                                        step="0.1"
                                        value={reviewForm.rating}
                                        onChange={handleReviewFormChange}
                                        style={{
                                            flexGrow: 1,
                                            height: '8px',
                                            borderRadius: '4px',
                                            background: `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${(reviewForm.rating / 5) * 100}%, #e5e7eb ${(reviewForm.rating / 5) * 100}%, #e5e7eb 100%)`,
                                            outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    />
                                    <span style={{ 
                                        minWidth: '60px', 
                                        textAlign: 'center', 
                                        fontSize: '18px', 
                                        fontWeight: 'bold',
                                        color: reviewForm.rating >= 4 ? '#10b981' : reviewForm.rating >= 3 ? '#f59e0b' : '#ef4444'
                                    }}>
                                        {reviewForm.rating >= 4.5 ? '🌟' : reviewForm.rating >= 4 ? '😊' : reviewForm.rating >= 3 ? '😐' : reviewForm.rating >= 2 ? '😕' : '😞'}
                                    </span>
                                </div>
                            </div>

                            {/* Review Content */}
                            <div style={{ marginBottom: '25px' }}>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '8px', 
                                    fontSize: '16px', 
                                    fontWeight: '600', 
                                    color: '#374151' 
                                }}>
                                    💭 Your Experience *
                                </label>
                                <textarea
                                    name="content"
                                    value={reviewForm.content}
                                    onChange={handleReviewFormChange}
                                    required
                                    rows={4}
                                    placeholder="Share your thoughts about living in this area... What did you love? What could be better?"
                                    style={{
                                        width: '100%',
                                        padding: '15px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '12px',
                                        fontSize: '16px',
                                        boxSizing: 'border-box',
                                        resize: 'vertical',
                                        fontFamily: 'inherit',
                                        outline: 'none'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                                />
                            </div>

                            {/* Amenities */}
                            <div style={{ marginBottom: '30px' }}>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '12px', 
                                    fontSize: '16px', 
                                    fontWeight: '600', 
                                    color: '#374151' 
                                }}>
                                    📍 Nearby Amenities (Optional)
                                </label>
                                <div style={{ 
                                    backgroundColor: '#f9fafb',
                                    padding: '20px',
                                    borderRadius: '12px',
                                    border: '2px solid #e5e7eb'
                                }}>
                                    {/* Suggested Amenities Grid */}
                                    <div style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
                                        gap: '12px',
                                        marginBottom: '20px'
                                    }}>
                                        {SUGGESTED_AMENITIES.map(amenity => (
                                            <label key={amenity} style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '8px', 
                                                padding: '12px', 
                                                border: '1px solid #d1d5db', 
                                                borderRadius: '8px', 
                                                cursor: 'pointer',
                                                backgroundColor: Array.isArray(reviewForm.amenities) && reviewForm.amenities.includes(amenity) ? '#dbeafe' : 'white',
                                                transition: 'all 0.2s'
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    checked={Array.isArray(reviewForm.amenities) && reviewForm.amenities.includes(amenity)}
                                                    onChange={() => handleAmenityToggle(amenity)}
                                                    style={{ margin: 0 }}
                                                />
                                                <span style={{ fontSize: '14px', color: '#374151' }}>{amenity}</span>
                                            </label>
                                        ))}
                                    </div>
                                    
                                    {/* Add Custom Amenity */}
                                    <div style={{ 
                                        borderTop: '1px solid #d1d5db', 
                                        paddingTop: '15px' 
                                    }}>
                                        {!showCustomAmenityInput ? (
                                            <button
                                                type="button"
                                                onClick={() => setShowCustomAmenityInput(true)}
                                                style={{
                                                    fontSize: '14px',
                                                    color: '#3b82f6',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                + Add custom amenity
                                            </button>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <input
                                                    type="text"
                                                    value={newAmenityName}
                                                    onChange={(e) => setNewAmenityName(e.target.value)}
                                                    placeholder="e.g., Dog Park, Night Market"
                                                    style={{
                                                        flex: 1,
                                                        padding: '8px 12px',
                                                        fontSize: '14px',
                                                        border: '1px solid #d1d5db',
                                                        borderRadius: '6px',
                                                        outline: 'none'
                                                    }}
                                                    onKeyPress={(e) => e.key === 'Enter' && handleAddCustomAmenity()}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddCustomAmenity}
                                                    disabled={!newAmenityName.trim()}
                                                    style={{
                                                        padding: '8px 16px',
                                                        fontSize: '14px',
                                                        backgroundColor: '#3b82f6',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        opacity: !newAmenityName.trim() ? 0.5 : 1
                                                    }}
                                                >
                                                    Add
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowCustomAmenityInput(false);
                                                        setNewAmenityName('');
                                                    }}
                                                    style={{
                                                        padding: '8px 16px',
                                                        fontSize: '14px',
                                                        color: '#6b7280',
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Selected Amenities Summary */}
                                    {Array.isArray(reviewForm.amenities) && reviewForm.amenities.length > 0 && (
                                        <div style={{ 
                                            marginTop: '15px', 
                                            paddingTop: '15px',
                                            borderTop: '1px solid #d1d5db'
                                        }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {reviewForm.amenities.map(amenity => (
                                                    <span
                                                        key={amenity}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            padding: '4px 8px',
                                                            fontSize: '12px',
                                                            backgroundColor: '#dbeafe',
                                                            color: '#1e40af',
                                                            borderRadius: '16px',
                                                            gap: '4px'
                                                        }}
                                                    >
                                                        {amenity}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveAmenity(amenity)}
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                color: '#3b82f6',
                                                                cursor: 'pointer',
                                                                fontSize: '14px',
                                                                lineHeight: 1
                                                            }}
                                                            title="Remove amenity"
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Privacy Option */}
                            <div style={{ marginBottom: '25px' }}>
                                <label style={{ 
                                    display: 'flex', 
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '14px', 
                                    color: '#6b7280',
                                    cursor: 'pointer'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={reviewForm.postAnonymously}
                                        onChange={(e) => setReviewForm(prev => ({ ...prev, postAnonymously: e.target.checked }))}
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            accentColor: '#3b82f6'
                                        }}
                                    />
                                    <span>🤫 Post anonymously</span>
                                </label>
                                <p style={{ 
                                    margin: '5px 0 0 24px', 
                                    fontSize: '12px', 
                                    color: '#9ca3af' 
                                }}>
                                    Your review will be shown as "Anonymous" instead of your username
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ 
                                display: 'flex', 
                                gap: '15px', 
                                justifyContent: 'flex-end',
                                borderTop: '1px solid #e5e7eb',
                                paddingTop: '25px'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAddReviewModal(false)}
                                    style={{
                                        padding: '15px 30px',
                                        border: '2px solid #e5e7eb',
                                        backgroundColor: 'white',
                                        color: '#6b7280',
                                        borderRadius: '12px',
                                        fontSize: '16px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => {
                                        e.target.style.backgroundColor = '#f9fafb';
                                        e.target.style.borderColor = '#d1d5db';
                                    }}
                                    onMouseOut={(e) => {
                                        e.target.style.backgroundColor = 'white';
                                        e.target.style.borderColor = '#e5e7eb';
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingReview}
                                    style={{
                                        padding: '15px 30px',
                                        background: isSubmittingReview ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '12px',
                                        fontSize: '16px',
                                        fontWeight: '600',
                                        cursor: isSubmittingReview ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                                    }}
                                >
                                    {isSubmittingReview ? (
                                        <>⏳ {editingReview ? 'Updating...' : 'Publishing...'}</>
                                    ) : (
                                        <>🚀 {editingReview ? 'Update Review' : 'Publish Review'}</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>,
            document.body
        )}

    <div className="min-h-screen bg-gray-50">
        <Navigation />
        
        {/* Authentication Status Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-semibold text-gray-800">Community Reviews</h1>
                    {isLoggedIn && (
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                            Welcome, {currentUser?.username}!
                        </span>
                    )}
                </div>
                
                <div className="flex items-center gap-3">
                    {!isLoggedIn ? (
                        <button
                            onClick={() => window.location.href = '/login'}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                        >
                            Login
                        </button>
                    ) : (
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
                        >
                            Logout
                        </button>
                    )}
                </div>
            </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3 mb-2">
                    <Newspaper className="w-10 h-10 text-blue-600" />
                    Market Intelligence
                </h1>
                <p className="text-gray-600">Track sentiment and insights across Singapore regions</p>

                {/* Tabs */}
                <div className="flex gap-4 mt-6 border-b-2 border-gray-200">
                    <button
                        onClick={() => setActiveTab('news')}
                        className={`px-6 py-3 font-semibold transition-all ${activeTab === 'news'
                                ? 'text-blue-600 border-b-4 border-blue-600 -mb-[2px]'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        📰 News & Market Intelligence
                    </button>
                    <button
                        onClick={() => setActiveTab('community')}
                        className={`px-6 py-3 font-semibold transition-all ${activeTab === 'community'
                                ? 'text-blue-600 border-b-4 border-blue-600 -mb-[2px]'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        💬 Community Reviews
                    </button>
                    {isLoggedIn && (
                        <button
                            onClick={() => {
                                setActiveTab('my-reviews');
                                fetchUserReviews();
                            }}
                            className={`px-6 py-3 font-semibold transition-all ${activeTab === 'my-reviews'
                                    ? 'text-blue-600 border-b-4 border-blue-600 -mb-[2px]'
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            ✨ My Reviews
                        </button>
                    )}
                </div>
            </div>

            {/* Area Ratings Section - Hidden on My Reviews tab */}
            {activeTab !== 'my-reviews' && (
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
                                className={`bg-white border-2 rounded-2xl p-4 cursor-pointer transition-all hover:shadow-lg ${isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-200'
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
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${!selectedTown
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
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedTown === town
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
            )}

            {/* NEWS TAB */}
            {activeTab === 'news' && (
                <>
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
                </>
            )}

            {/* COMMUNITY TAB */}
            {activeTab === 'community' && (
                <>
                    {/* Header Section */}
                    <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-2xl p-6 mb-6 text-white">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className="w-20 h-16 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                                    <span className="text-3xl">𐦂𖨆𐀪𖠋</span>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">Community Reviews</h2>
                                    <p className="text-white text-opacity-90">Real experiences</p>
                                </div>
                            </div>
                            
                            {isLoggedIn && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        resetForm();
                                        setEditingReview(null);
                                        setShowAddReviewModal(true);
                                    }}
                                    className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2 border border-white border-opacity-30 cursor-pointer"
                                    type="button"
                                >
                                    <span className="text-lg">+</span>
                                    Add Review
                                </button>
                            )}
                        </div>
                        

                        

                    </div>

                    {/* Search Bar */}
                    <div className={`bg-white border-2 border-gray-200 rounded-2xl p-4 mb-6 relative ${!isLoggedIn ? 'opacity-50' : ''}`}>
                        {!isLoggedIn && (
                            <div className="absolute inset-0 bg-gray-200 bg-opacity-75 rounded-2xl flex items-center justify-center z-10">
                                <div className="text-center p-4">
                                    <div className="text-4xl mb-2">🔒</div>
                                    <p className="text-gray-700 font-medium mb-2">Login Required</p>
                                    <p className="text-gray-600 text-sm mb-3">Please sign in to view and search community reviews</p>
                                    <button
                                        onClick={() => window.location.href = '/login'}
                                        className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-medium"
                                    >
                                        Sign In
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex-1 min-w-[200px]">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder="Search community reviews..."
                                        value={filters.search}
                                        onChange={(e) => handleFilterChange('search', e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-500 transition-colors"
                                        disabled={!isLoggedIn}
                                    />
                                </div>
                            </div>

                            {(filters.search || selectedRegion !== 'All') && (
                                <button
                                    onClick={clearFilters}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
                                    disabled={!isLoggedIn}
                                >
                                    <X className="w-4 h-4" />
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Loading State */}
                    {lemon8Loading && (
                        <div className={`flex items-center justify-center py-20 ${!isLoggedIn ? 'opacity-30' : ''}`}>
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
                                <p className="text-gray-600">Loading community reviews...</p>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {lemon8Error && (
                        <div className={`bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center ${!isLoggedIn ? 'opacity-30 pointer-events-none' : ''}`}>
                            <div className="text-4xl mb-4">⚠️</div>
                            <p className="text-red-600 font-medium mb-4">{lemon8Error}</p>
                            <button
                                onClick={fetchLemon8Reviews}
                                className="px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {/* Authentication Overlay for Reviews */}
                    {!isLoggedIn && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => e.stopPropagation()}>
                            <div className="bg-white rounded-2xl p-8 m-4 max-w-md text-center shadow-2xl">
                                <div className="text-6xl mb-4">🔐</div>
                                <h3 className="text-2xl font-bold text-gray-800 mb-3">Community Reviews</h3>
                                <p className="text-gray-600 mb-6">Join our community to read authentic reviews from real residents and visitors across Singapore.</p>
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={() => window.location.href = '/login'}
                                        className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105"
                                    >
                                        Sign In to View Reviews
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('news')}
                                        className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                        Browse News Instead
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Reviews Grid - Grayed out when not logged in */}
                    {!lemon8Loading && !lemon8Error && lemon8Reviews.length > 0 && (
                        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${!isLoggedIn ? 'opacity-20 pointer-events-none' : ''}`}>
                            {lemon8Reviews.map(review => renderLemon8Card(review))}
                        </div>
                    )}

                    {/* Empty State */}
                    {!lemon8Loading && !lemon8Error && lemon8Reviews.length === 0 && (
                        <div className="bg-white border-2 border-gray-200 rounded-2xl p-12 text-center">
                            <div className="text-6xl mb-6">🍋</div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">No Community Reviews Found</h3>
                            <p className="text-gray-600 mb-6 max-w-md mx-auto">
                                {selectedRegion !== 'All' 
                                    ? `No reviews available for ${selectedRegion} area yet. Try exploring other regions or clear your filters.`
                                    : 'No community reviews available yet. Check back later for fresh content from our users!'
                                }
                            </p>
                            {(filters.search || selectedRegion !== 'All') && (
                                <button
                                    onClick={clearFilters}
                                    className="px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
                                >
                                    Clear Filters & Show All
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* MY REVIEWS TAB */}
            {activeTab === 'my-reviews' && (
                <>
                    {/* Header Section */}
                    <div className="bg-gradient-to-r from-blue-500 via-teal-500 to-green-500 rounded-2xl p-6 mb-6 text-white">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                                    <span className="text-2xl">✨</span>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">My Reviews</h2>
                                    <p className="text-white text-opacity-80">Your personal reviews and ratings</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => {
                                        resetForm();
                                        setEditingReview(null);
                                        setActiveTab('community');
                                        setShowAddReviewModal(true);
                                    }}
                                    className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors font-medium"
                                >
                                    + Add Review
                                </button>
                                <button 
                                    onClick={() => setActiveTab('community')}
                                    className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors font-medium"
                                >
                                    Back to Community
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white bg-opacity-15 rounded-xl p-4">
                                <div className="text-2xl font-bold">{userReviews.length}</div>
                                <div className="text-sm text-white text-opacity-80">Total Reviews</div>
                            </div>
                            <div className="bg-white bg-opacity-15 rounded-xl p-4">
                                <div className="text-2xl font-bold">
                                    {userReviews.length > 0 
                                        ? (userReviews.reduce((sum, review) => sum + (review.rating || 0), 0) / userReviews.length).toFixed(1)
                                        : '0'
                                    }
                                </div>
                                <div className="text-sm text-white text-opacity-80">Avg Rating</div>
                            </div>
                            <div className="bg-white bg-opacity-15 rounded-xl p-4">
                                <div className="text-2xl font-bold">
                                    {userReviews.filter(r => r.created_at && new Date(r.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length}
                                </div>
                                <div className="text-sm text-white text-opacity-80">This Month</div>
                            </div>
                        </div>
                    </div>

                    {/* User Reviews Content */}
                    <div className="space-y-6">
                        {userReviews.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-2xl shadow-sm">
                                <div className="text-6xl mb-4">📝</div>
                                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Reviews Yet</h3>
                                <p className="text-gray-500 mb-4">You haven't created any reviews yet. Share your experience to help others!</p>
                                <button 
                                    onClick={() => {
                                        resetForm();
                                        setEditingReview(null);
                                        setActiveTab('community');
                                        setShowAddReviewModal(true);
                                    }}
                                    className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-medium rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all"
                                >
                                    Create Your First Review
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {userReviews.map((review, index) => (
                                    <div key={review._id || index} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow">
                                        <div className="p-6">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center space-x-2">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        My Review
                                                    </span>
                                                    <span className="text-sm text-gray-500">
                                                        {review.author_name || 'You'}
                                                    </span>
                                                </div>
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => {
                                                            handleEditReview(review);
                                                            setActiveTab('community'); // Go back to community tab for editing
                                                        }}
                                                        className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteReview(review._id)}
                                                        className="text-red-500 hover:text-red-700 text-sm font-medium"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2">
                                                {review.title}
                                            </h3>
                                            
                                            <div className="flex items-center mb-3">
                                                <div className="flex items-center">
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <svg
                                                            key={star}
                                                            className={`w-4 h-4 ${
                                                                star <= (review.rating || 0) ? 'text-yellow-400' : 'text-gray-300'
                                                            } fill-current`}
                                                            viewBox="0 0 20 20"
                                                        >
                                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                        </svg>
                                                    ))}
                                                    <span className="ml-2 text-sm text-gray-600">
                                                        {review.rating}/5
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <p className="text-gray-700 text-sm mb-4 line-clamp-3">
                                                {review.content}
                                            </p>
                                            
                                            <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                                                <span className="font-medium">{review.estate}</span>
                                                <span>
                                                    {review.created_at ? new Date(review.created_at).toLocaleDateString() : 'Unknown date'}
                                                </span>
                                            </div>
                                            
                                            {review.amenities_mentioned && review.amenities_mentioned.length > 0 && (
                                                <div className="mt-3">
                                                    <p className="text-xs text-gray-500 mb-2">Amenities Mentioned:</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {review.amenities_mentioned.slice(0, 3).map((amenity, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700"
                                                            >
                                                                🌱 {amenity}
                                                            </span>
                                                        ))}
                                                        {review.amenities_mentioned.length > 3 && (
                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-500">
                                                                +{review.amenities_mentioned.length - 3} more
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    </div>
    </>
);
}