import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import CheckDBConnection from './pages/CheckDBConnection';
import ProtectedRoute from './components/ProtectedRoute';

// Import other pages as you create them
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ChangePassword from './pages/ChangePassword';
import VerifyEmail from './pages/VerifyEmail';
import Watchlist from './pages/WatchList';
import InteractiveMap from './pages/InteractiveMap';
import Listings from './pages/Listings';
import Reviews from './pages/Reviews';
// import MapView from './pages/MapView';
// import Login from './pages/Login';
// import Register from './pages/Register';
// import PropertyDetails from './pages/PropertyDetails';
// import Watchlist from './pages/Watchlist';
// import Profile from './pages/Profile';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Landing Page */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/check-db" element={<CheckDBConnection />} /> {/* ADD THIS */}
          
          {/* Listings Page */}
          <Route path="/listings" element={<Listings />} />
          <Route path="/reviews" element={<Reviews />} />
          
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} /> 
          <Route path="/signup" element={<Signup />} /> 
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Uncomment these routes as you create the pages */}
          <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/dashboard" element={ <ProtectedRoute> <Dashboard /> </ProtectedRoute> }/>
          <Route path="/change-password" element={ <ProtectedRoute><ChangePassword /></ProtectedRoute> } 
          />
          <Route path="/map" element={<InteractiveMap />} />
          {/* <Route path="/login" element={<Login />} /> */}
          {/* <Route path="/register" element={<Register />} /> */}
          {/* <Route path="/property/:id" element={<PropertyDetails />} /> */}
          <Route path="/watchlist" element={ <ProtectedRoute> <Watchlist /> </ProtectedRoute> } />
          {/* <Route path="/profile" element={<Profile />} /> */}
          
          {/* 404 Not Found */}
          <Route path="*" element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <h1 className="text-6xl font-bold text-purple-600 mb-4">404</h1>
                <p className="text-xl text-gray-600 mb-8">Page not found</p>
                <a 
                  href="/" 
                  className="px-8 py-3 bg-purple-600 text-white rounded-full font-semibold hover:bg-purple-700 transition-colors"
                >
                  Go Home
                </a>
              </div>
            </div>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;