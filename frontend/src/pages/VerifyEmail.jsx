import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Mail, Building2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

export default function VerifyEmail() {
    const navigate = useNavigate();
    const location = useLocation();
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [resending, setResending] = useState(false);
    const [email, setEmail] = useState('');
    const [countdown, setCountdown] = useState(60);
    const [canResend, setCanResend] = useState(false);

    // Get email from navigation state
    useEffect(() => {
        const emailFromState = location.state?.email;
        if (!emailFromState) {
            // If no email provided, redirect to signup
            navigate('/signup');
            return;
        }
        setEmail(emailFromState);
    }, [location, navigate]);

    // Countdown timer for resend
    useEffect(() => {
        if (countdown > 0 && !canResend) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0) {
            setCanResend(true);
        }
    }, [countdown, canResend]);

    // Auto-focus next input
    const handleChange = (index, value) => {
        if (value.length > 1) {
            value = value.slice(-1);
        }

        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);
        setError('');

        // Auto-focus next input
        if (value && index < 5) {
            const nextInput = document.getElementById(`code-${index + 1}`);
            if (nextInput) nextInput.focus();
        }

        // Auto-submit when all fields are filled
        if (newCode.every(digit => digit !== '') && index === 5) {
            handleSubmit(newCode.join(''));
        }
    };

    // Handle backspace
    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            const prevInput = document.getElementById(`code-${index - 1}`);
            if (prevInput) prevInput.focus();
        }
    };

    // Handle paste
    const handlePaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').slice(0, 6);
        const newCode = pastedData.split('');
        
        if (newCode.length === 6 && newCode.every(char => /^\d$/.test(char))) {
            setCode(newCode);
            handleSubmit(pastedData);
        }
    };

    const handleSubmit = async (verificationCode = null) => {
        const codeToVerify = verificationCode || code.join('');
        
        if (codeToVerify.length !== 6) {
            setError('Please enter the complete 6-digit code');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch('http://localhost:3001/api/auth/verify-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    code: codeToVerify
                }),
            });

            const data = await response.json();

            if (data.success) {
                setSuccess('Email verified successfully! Redirecting...');
                
                // Store token and user
                const storage = sessionStorage; // or use rememberMe logic
                storage.setItem('token', data.token);
                storage.setItem('user', JSON.stringify(data.user));
                
                // Dispatch event to update Navigation
                window.dispatchEvent(new Event('userChanged'));
                
                // Redirect to dashboard after 1.5 seconds
                setTimeout(() => {
                    navigate('/dashboard');
                }, 1500);
            } else {
                setError(data.message || 'Verification failed');
                setCode(['', '', '', '', '', '']);
                document.getElementById('code-0')?.focus();
            }
        } catch (err) {
            console.error('Verification error:', err);
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setResending(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch('http://localhost:3001/api/auth/resend-verification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (data.success) {
                setSuccess('New verification code sent to your email!');
                setCountdown(60);
                setCanResend(false);
                setCode(['', '', '', '', '', '']);
                document.getElementById('code-0')?.focus();
            } else {
                setError(data.message || 'Failed to resend code');
            }
        } catch (err) {
            console.error('Resend error:', err);
            setError('Network error. Please try again.');
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-4">
            {/* Background decorative elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
                <div className="absolute top-1/3 right-0 w-96 h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl mb-4">
                        <Building2 className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                        HDB Analytics
                    </h1>
                    <p className="text-gray-600 mt-2">Verify your email address</p>
                </div>

                {/* Verification Form */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {/* Email icon and message */}
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                            <Mail className="w-8 h-8 text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
                        <p className="text-gray-600">
                            We've sent a 6-digit verification code to
                        </p>
                        <p className="text-blue-600 font-medium mt-1">{email}</p>
                        <p className="text-red-600">
                            Account will be automatically deleted if not verified within 45 minutes.
                        </p>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    {/* Success message */}
                    {success && (
                        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-3">
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-green-700">{success}</p>
                        </div>
                    )}

                    {/* Code input fields */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                            Enter verification code
                        </label>
                        <div className="flex justify-center space-x-2" onPaste={handlePaste}>
                            {code.map((digit, index) => (
                                <input
                                    key={index}
                                    id={`code-${index}`}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    disabled={loading}
                                    className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:bg-gray-100"
                                    autoComplete="off"
                                />
                            ))}
                        </div>
                    </div>

                    {/* Submit button */}
                    <button
                        onClick={() => handleSubmit()}
                        disabled={loading || code.some(digit => digit === '')}
                        className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 mb-4"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Verifying...</span>
                            </>
                        ) : (
                            <span>Verify Email</span>
                        )}
                    </button>

                    {/* Resend code */}
                    <div className="text-center">
                        <p className="text-sm text-gray-600 mb-2">
                            Didn't receive the code?
                        </p>
                        {canResend ? (
                            <button
                                onClick={handleResend}
                                disabled={resending}
                                className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center justify-center space-x-1 mx-auto disabled:opacity-50"
                            >
                                {resending ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>Sending...</span>
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-4 h-4" />
                                        <span>Resend code</span>
                                    </>
                                )}
                            </button>
                        ) : (
                            <p className="text-sm text-gray-500">
                                Resend available in {countdown}s
                            </p>
                        )}
                    </div>

                    {/* Tips */}
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 text-center">
                            💡 <strong>Tip:</strong> <b>Check your spam folder if you don't see the email</b>
                        </p>
                    </div>
                </div>

                {/* Back to signup */}
                <div className="text-center mt-6">
                    <Link to="/signup" className="text-gray-600 hover:text-gray-800 text-sm">
                        ← Back to signup
                    </Link>
                </div>
            </div>
        </div>
    );
}