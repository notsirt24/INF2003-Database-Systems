import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, TrendingUp, Map, Bookmark, Menu, X, Building2, Cloud, Book, LogOut, List, Lock } from 'lucide-react';
import ProfileDropdown from './ProfileDropdown';

export default function Navigation() {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const navItems = [
        { name: 'Home', icon: Home, path: '/' },
        { name: 'Listings', icon: List, path: '/listings' },
        { name: 'Dashboard', icon: TrendingUp, path: '/dashboard' },
        { name: 'Map', icon: Map, path: '/map' },
        { name: 'AI-Chatbot', icon: Cloud, path: '/chatbot' },
        { name: 'Watchlist', icon: Bookmark, path: '/watchlist' },
        { name: 'Reviews', icon: Book, path: '/reviews' },
    ];

    useEffect(() => {
        const loadUser = () => {
            const userData = sessionStorage.getItem('user')|| localStorage.getItem('user');
            if (userData) {
                setUser(JSON.parse(userData));
            } else {
                setUser(null);
            }
        };
        loadUser();
        window.addEventListener('storage', loadUser);
        window.addEventListener('userChanged', loadUser);
        return () => {
            window.removeEventListener('storage', loadUser);
            window.removeEventListener('userChanged', loadUser);
        };
    }, []);

    const handleLogout = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        setUser(null);
        window.dispatchEvent(new Event('userChanged'));
        navigate('/login');
    };

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg shadow-lg">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex items-center justify-between h-20">
                    <a href="/" className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                            HDB Analytics
                        </span>
                    </a>
                    <div className="hidden md:flex items-center space-x-0.5">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path;
                            return (
                                <a key={item.name} href={item.path} className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg transition-all duration-200 ${isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'}`}>
                                    <Icon className="w-4 h-4" />
                                    <span className="font-medium text-sm">{item.name}</span>
                                </a>
                            );
                        })}
                    </div>
                    <div className="hidden md:flex items-center">
                        {user ? (
                            <ProfileDropdown user={user} onLogout={handleLogout} />
                        ) : (
                            <a href="/login" className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300">
                                Sign In
                            </a>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <button className="md:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <div className="md:hidden bg-white border-t border-gray-200">
                    <div className="px-6 py-4 space-y-2">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path;
                            return (
                                <a key={item.name} href={item.path} className={`flex items-center space-x-3 px-4 py-3 rounded-lg ${isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'}`}>
                                    <Icon className="w-5 h-5" />
                                    <span className="font-medium">{item.name}</span>
                                </a>
                            );
                        })}
                        {user && (
                            <div className="pt-4 border-t border-gray-200 space-y-2">
                                <div className="px-4 py-2">
                                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                                    <p className="text-xs text-gray-500">{user.email}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setMobileMenuOpen(false);
                                        navigate('/change-password');
                                    }}
                                    className="flex items-center space-x-3 w-full px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 font-medium"
                                >
                                    <Lock className="w-5 h-5" />
                                    <span>Change Password</span>
                                </button>
                                <button onClick={handleLogout} className="flex items-center space-x-3 w-full px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 font-medium">
                                    <LogOut className="w-5 h-5" />
                                    <span>Logout</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
}