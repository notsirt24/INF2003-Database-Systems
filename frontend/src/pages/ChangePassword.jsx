import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

export default function ChangePassword() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState('');

    useEffect(() => {
        // Check if user is logged in
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        const userData = sessionStorage.getItem('user') || localStorage.getItem('user');
        
        if (!token || !userData) {
            navigate('/login');
            return;
        }
        
        setUser(JSON.parse(userData));
    }, [navigate]);

    useEffect(() => {
        // Calculate password strength
        const password = formData.newPassword;
        if (!password) {
            setPasswordStrength('');
        } else if (password.length < 6) {
            setPasswordStrength('Weak');
        } else if (password.length < 10) {
            setPasswordStrength('Medium');
        } else {
            setPasswordStrength('Strong');
        }
    }, [formData.newPassword]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError('');
    };

    const togglePasswordVisibility = (field) => {
        setShowPasswords({
            ...showPasswords,
            [field]: !showPasswords[field]
        });
    };

    const validateForm = () => {
        if (!formData.currentPassword) {
            setError('Please enter your current password');
            return false;
        }

        if (!formData.newPassword) {
            setError('Please enter a new password');
            return false;
        }

        if (formData.newPassword.length < 6) {
            setError('New password must be at least 6 characters long');
            return false;
        }

        if (formData.currentPassword === formData.newPassword) {
            setError('New password must be different from current password');
            return false;
        }

        if (formData.newPassword !== formData.confirmPassword) {
            setError('New passwords do not match');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setError('');

        const token = sessionStorage.getItem('token') || localStorage.getItem('token');

        try {
            const response = await fetch('http://localhost:3001/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword: formData.currentPassword,
                    newPassword: formData.newPassword
                }),
            });

            const data = await response.json();

            if (data.success) {
                setSuccess(true);
                setFormData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                });
                
                // Redirect to dashboard after 2 seconds
                setTimeout(() => {
                    navigate('/dashboard');
                }, 2000);
            } else {
                setError(data.message || 'Failed to change password');
            }
        } catch (err) {
            console.error('Change password error:', err);
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getStrengthColor = () => {
        switch (passwordStrength) {
            case 'Weak': return 'bg-red-500';
            case 'Medium': return 'bg-yellow-500';
            case 'Strong': return 'bg-green-500';
            default: return 'bg-gray-300';
        }
    };

    const getStrengthWidth = () => {
        switch (passwordStrength) {
            case 'Weak': return 'w-1/3';
            case 'Medium': return 'w-2/3';
            case 'Strong': return 'w-full';
            default: return 'w-0';
        }
    };

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 pt-24 pb-12 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Back Button */}
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Back to Dashboard</span>
                </button>

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl mb-4">
                        <Lock className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Change Password</h1>
                    <p className="text-gray-600">Update your password to keep your account secure</p>
                </div>

                {/* Success Message */}
                {success && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-3">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-green-800">Password changed successfully!</p>
                            <p className="text-sm text-green-700">Redirecting to dashboard...</p>
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                {/* Form */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {/* User Info */}
                    <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">Changing password for:</p>
                        <p className="text-lg font-semibold text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Current Password */}
                        <div>
                            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
                                Current Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type={showPasswords.current ? 'text' : 'password'}
                                    id="currentPassword"
                                    name="currentPassword"
                                    value={formData.currentPassword}
                                    onChange={handleChange}
                                    required
                                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                    placeholder="Enter current password"
                                />
                                <button
                                    type="button"
                                    onClick={() => togglePasswordVisibility('current')}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* New Password */}
                        <div>
                            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                                New Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type={showPasswords.new ? 'text' : 'password'}
                                    id="newPassword"
                                    name="newPassword"
                                    value={formData.newPassword}
                                    onChange={handleChange}
                                    required
                                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                    placeholder="Enter new password"
                                />
                                <button
                                    type="button"
                                    onClick={() => togglePasswordVisibility('new')}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            {formData.newPassword && (
                                <div className="mt-2">
                                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                                        <span>Password strength</span>
                                        <span className={
                                            passwordStrength === 'Weak' ? 'text-red-600' :
                                            passwordStrength === 'Medium' ? 'text-yellow-600' :
                                            'text-green-600'
                                        }>{passwordStrength}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor()} ${getStrengthWidth()}`}></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Confirm New Password */}
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                                Confirm New Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type={showPasswords.confirm ? 'text' : 'password'}
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                    placeholder="Confirm new password"
                                />
                                <button
                                    type="button"
                                    onClick={() => togglePasswordVisibility('confirm')}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            {formData.confirmPassword && formData.newPassword === formData.confirmPassword && (
                                <p className="mt-2 text-sm text-green-600 flex items-center space-x-1">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Passwords match</span>
                                </p>
                            )}
                            {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
                                <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>Passwords do not match</span>
                                </p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={loading || success}
                                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center space-x-2">
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Changing Password...</span>
                                    </span>
                                ) : success ? (
                                    'Password Changed!'
                                ) : (
                                    'Change Password'
                                )}
                            </button>
                        </div>
                    </form>

                    {/* Security Tips */}
                    <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                        <h3 className="text-sm font-semibold text-blue-900 mb-2">Password Security Tips:</h3>
                        <ul className="text-xs text-blue-800 space-y-1">
                            <li>• Use at least 10 characters for a strong password</li>
                            <li>• Mix uppercase, lowercase, numbers, and symbols</li>
                            <li>• Don't reuse passwords from other accounts</li>
                            <li>• Change your password regularly</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}