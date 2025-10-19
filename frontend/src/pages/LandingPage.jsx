import React, { useState, useEffect } from 'react';
import { Home, TrendingUp, Map, MessageSquare, Star, Bookmark, Database, Cpu, Globe, ChevronRight, BarChart3, Building2, School, Zap, Train, Sparkles, Brain, Clock, Shield, Menu, X, Search, User, Cloud, Book } from 'lucide-react';

export default function HDBLandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [activeFeature, setActiveFeature] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 6);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { name: 'Home', icon: Home, path: '/' },
    { name: 'Dashboard', icon: BarChart3, path: '/dashboard' },
    { name: 'Map', icon: Map, path: '/map' },
    { name: 'AI-Chatbot', icon: Cloud, path: '/chatbot' },
    { name: 'Watchlist', icon: Bookmark, path: '/watchlist' },
    { name: 'Reviews', icon: Book, path: '/reviews' },
    { name: 'Check DB', icon: Database, path: '/check-db' }, // To remove after
  ];

  const stats = [
    { number: '217K+', label: 'Transactions Analyzed', icon: Building2, color: 'from-blue-600 to-blue-700' },
    { number: '9.4K', label: 'Amenities Mapped', icon: Zap, color: 'from-orange-600 to-orange-700' },
    { number: '171', label: 'Transit Stations', icon: Train, color: 'from-green-600 to-green-700' },
    { number: '337', label: 'Schools Tracked', icon: School, color: 'from-purple-600 to-purple-700' }
  ];

  const problems = [
    {
      icon: BarChart3,
      title: 'Fragmented Market Data',
      description: 'Property data scattered across multiple sources makes comprehensive analysis difficult and time-consuming.',
      gradient: 'from-blue-600 to-cyan-600'
    },
    {
      icon: TrendingUp,
      title: 'Rapid Price Volatility',
      description: 'Market prices fluctuate rapidly. Real-time insights are essential for making informed investment decisions.',
      gradient: 'from-orange-600 to-red-600'
    },
    {
      icon: Brain,
      title: 'Complex Decision Making',
      description: 'Evaluating properties requires analyzing countless factors from location to amenities to future value.',
      gradient: 'from-green-600 to-teal-600'
    }
  ];

  const features = [
    {
      icon: Brain,
      title: 'AI Price Intelligence',
      description: 'Advanced machine learning models deliver price predictions with 2-4% accuracy, powered by historical data analysis.',
      color: 'from-blue-600 to-blue-700',
      iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600'
    },
    {
      icon: Map,
      title: 'Geospatial Analytics',
      description: 'Interactive maps reveal proximity insights to MRT, schools, EV charging stations, and essential amenities.',
      color: 'from-green-600 to-green-700',
      iconBg: 'bg-gradient-to-br from-green-500 to-green-600'
    },
    {
      icon: MessageSquare,
      title: 'Natural Language Search',
      description: 'Ask questions naturally: "4-room flats in Punggol under $600k near MRT" and get instant results.',
      color: 'from-purple-600 to-purple-700',
      iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600'
    },
    {
      icon: BarChart3,
      title: 'Real-Time Dashboard',
      description: 'Live market trends, regional analytics, and historical data visualization for comprehensive insights.',
      color: 'from-orange-600 to-orange-700',
      iconBg: 'bg-gradient-to-br from-orange-500 to-orange-600'
    },
    {
      icon: Star,
      title: 'Community Intelligence',
      description: 'Crowdsourced insights from residents about neighborhoods, blocks, and living experiences.',
      color: 'from-pink-600 to-pink-700',
      iconBg: 'bg-gradient-to-br from-pink-500 to-pink-600'
    },
    {
      icon: Bookmark,
      title: 'Smart Watchlists',
      description: 'Track properties with automated price alerts and market change notifications tailored to you.',
      color: 'from-indigo-600 to-indigo-700',
      iconBg: 'bg-gradient-to-br from-indigo-500 to-indigo-600'
    }
  ];

  const techStack = [
    { name: 'PostgreSQL', type: 'Relational Database', icon: Database, color: 'from-blue-600 to-blue-700' },
    { name: 'MongoDB', type: 'Non Relational Database', icon: Database, color: 'from-green-600 to-green-700' },
    { name: 'Node.js', type: 'Runtime', icon: Globe, color: 'from-emerald-600 to-teal-700' },
    { name: 'React', type: 'Interface', icon: Globe, color: 'from-cyan-600 to-blue-700' },
    { name: 'Python', type: 'ML Engine', icon: Cpu, color: 'from-yellow-600 to-orange-700' },
    { name: 'PostGIS', type: 'Spatial', icon: Map, color: 'from-indigo-600 to-purple-700' }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrollY > 50 ? 'bg-white/95 backdrop-blur-lg shadow-lg' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                HDB Analytics
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.name}
                    href={item.path}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-blue-600 transition-all duration-200"
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{item.name}</span>
                  </a>
                );
              })}
            </div>

            {/* Auth Buttons */}
            <div className="hidden md:flex items-center space-x-4">
              <button className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300">
                Sign In
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
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
              <div className="pt-4 space-y-2">
                <button className="w-full px-4 py-3 text-gray-700 hover:text-blue-600 font-medium text-left rounded-lg hover:bg-gray-100">
                  Sign In
                </button>
                <button className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium">
                  Get Started
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-white to-cyan-50 pt-20">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
          <div className="absolute top-1/3 right-0 w-96 h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 text-center">
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center space-x-2 bg-blue-100 px-4 py-2 rounded-full">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-700">Powered by AI & Big Data</span>
            </div>
            
            {/* Main heading */}
            <h1 className="text-6xl lg:text-7xl font-black text-gray-900 leading-tight">
              Singapore Housing
              <span className="block bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                Made Simple
              </span>
            </h1>
            
            {/* Subtitle */}
            <p className="text-xl lg:text-2xl max-w-3xl mx-auto text-gray-600">
              AI-powered intelligence platform for Singapore's public housing market. 
              <span className="block mt-2 text-blue-600 font-semibold">Make data-driven decisions with confidence.</span>
            </p>

            {/* Stats preview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-16 max-w-5xl mx-auto">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div key={index} className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                    <div className={`inline-flex p-3 bg-gradient-to-br ${stat.color} rounded-xl mb-4`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-3xl font-bold text-gray-900 mb-2">
                      {stat.number}
                    </div>
                    <div className="text-sm text-gray-600 font-medium">{stat.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Problem Statement Section */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl lg:text-6xl font-black text-gray-900 mb-6">
              Why We Built This
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              The housing market is complex. We're making it simple, transparent, and accessible for everyone.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {problems.map((problem, index) => {
              const Icon = problem.icon;
              return (
                <div key={index} className="group bg-white border-2 border-gray-200 rounded-3xl p-8 hover:border-blue-500 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                  <div className={`inline-flex p-4 bg-gradient-to-br ${problem.gradient} rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">{problem.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{problem.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl lg:text-6xl font-black text-gray-900 mb-6">
              Powerful Features
            </h2>
            <p className="text-xl text-gray-600">
              Everything you need to navigate the housing market like a pro
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const isActive = activeFeature === index;
              
              return (
                <div 
                  key={index}
                  className={`bg-white border-2 border-gray-200 rounded-3xl p-8 transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 ${
                    isActive ? 'border-blue-500 shadow-xl' : 'hover:border-blue-400'
                  }`}
                >
                  <div className={`inline-flex p-4 ${feature.iconBg} rounded-2xl mb-6 shadow-lg`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl lg:text-6xl font-black text-gray-900 mb-6">
              Built with Modern Tech
            </h2>
            <p className="text-xl text-gray-600">
              Hybrid architecture combining the best of SQL and NoSQL databases
            </p>
          </div>

          {/* Main architecture diagram */}
          <div className="mb-16 max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8 items-center">
              <div className="bg-white border-2 border-blue-200 rounded-3xl p-10 text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                <div className="inline-flex p-5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-6">
                  <Database className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">PostgreSQL</h3>
                <p className="text-gray-600">Structured data with PostGIS for geospatial queries</p>
              </div>
              
              <div className="flex items-center justify-center">
                <div className="text-6xl font-black bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  +
                </div>
              </div>
              
              <div className="bg-white border-2 border-green-200 rounded-3xl p-10 text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                <div className="inline-flex p-5 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl mb-6">
                  <Database className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">MongoDB</h3>
                <p className="text-gray-600">Flexible schemas for analytics and user data</p>
              </div>
            </div>
          </div>

          {/* Tech stack grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {techStack.map((tech, index) => {
              const Icon = tech.icon;
              return (
                <div key={index} className="bg-white border-2 border-gray-200 rounded-2xl p-6 text-center hover:border-blue-500 hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
                  <div className={`inline-flex p-4 bg-gradient-to-br ${tech.color} rounded-xl mb-4`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="font-bold text-gray-900 mb-1 text-sm">{tech.name}</h4>
                  <p className="text-xs text-gray-500">{tech.type}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold">HDB Smart Analytics</span>
              </div>
              <p className="text-gray-400 max-w-md">
                Transforming Singapore's housing market with AI-powered intelligence and comprehensive data analytics.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">API</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-gray-800 text-center">
            <p className="text-gray-500">
              © 2025 HDB Smart Analytics. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -50px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(50px, 50px) scale(1.05); }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}