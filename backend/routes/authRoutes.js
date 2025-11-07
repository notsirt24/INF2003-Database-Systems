const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { generateVerificationCode, generateResetToken, sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Set timezone to Singapore for all connections
pool.on('connect', (client) => {
  client.query("SET timezone = 'Asia/Singapore'");
});

// JWT secret (add this to your .env file)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// ============================================
// SIGNUP ROUTE (UPDATED WITH EMAIL VERIFICATION)
// ============================================
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  
  // Validation
  if (!name || !email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Please provide name, email, and password' 
    });
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Please provide a valid email address' 
    });
  }
  
  // Password validation (minimum 6 characters)
  if (password.length < 6) {
    return res.status(400).json({ 
      success: false, 
      message: 'Password must be at least 6 characters long' 
    });
  }
  
  const client = await pool.connect();
  
  try {
    // Check if user already exists
    const userCheck = await client.query(
      'SELECT user_id, email_verified, verification_code_expires FROM "user" WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (userCheck.rows.length > 0) {
      const existingUser = userCheck.rows[0];
      
      // If user exists and is verified
      if (existingUser.email_verified) {
        return res.status(409).json({ 
          success: false, 
          message: 'User with this email already exists and is verified. Please login.' 
        });
      }
      
      // If user exists but not verified, update their verification code
      const verificationCode = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 45 * 60 * 1000); // 45 minutes
      
      await client.query(
        `UPDATE "user" 
         SET verification_code = $1, verification_code_expires = $2, created_at = CURRENT_TIMESTAMP 
         WHERE user_id = $3`,
        [verificationCode, expiresAt, existingUser.user_id]
      );
      
      // Send verification email
      try {
        await sendVerificationEmail(email, name, verificationCode);
        console.log('✅ Verification email sent successfully');
      } catch (emailError) {
        console.error('❌ Email sending failed:', emailError);
        console.log(`🔐 Verification code for ${email}: ${verificationCode}`);
      }
      
      return res.status(200).json({
        success: true,
        message: 'Verification code resent to your email',
        requiresVerification: true,
        email: email.toLowerCase(),
        verificationCode: verificationCode // Remove in production
      });
    }
    
    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);
    
    // Generate verification code
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 45 * 60 * 1000); // 45 minutes from now

    // Insert new user (not verified yet)
    const result = await client.query(
      `INSERT INTO "user" (name, email, password_hash, email_verified, verification_code, verification_code_expires, created_at) 
       VALUES ($1, $2, $3, FALSE, $4, $5, CURRENT_TIMESTAMP) 
       RETURNING user_id, name, email, created_at`,
      [name, email.toLowerCase(), password_hash, verificationCode, expiresAt]
    );
    
    const newUser = result.rows[0];
    
    // Try to send verification email
    try {
      await sendVerificationEmail(email, name, verificationCode);
      console.log('✅ Verification email sent successfully');
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError);
      console.log(`🔐 Verification code for ${email}: ${verificationCode}`);
    }
    
    res.status(201).json({
      success: true,
      message: 'Verification code sent to your email. Please verify within 45 minutes.',
      requiresVerification: true,
      email: newUser.email,
      verificationCode: verificationCode // Remove in production!
    });
    
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during signup',
      error: error.message 
    });
  } finally {
    client.release();
  }
});

// ============================================
// VERIFY EMAIL ROUTE (NEW)
// ============================================
router.post('/verify-email', async (req, res) => {
  const { email, code } = req.body;
  
  if (!email || !code) {
    return res.status(400).json({ 
      success: false, 
      message: 'Please provide email and verification code' 
    });
  }
  
  const client = await pool.connect();
  
  try {
    // Find user with this email and code
    const result = await client.query(
      `SELECT user_id, name, email, email_verified, verification_code, verification_code_expires 
       FROM "user" 
       WHERE email = $1`,
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    const user = result.rows[0];
    
    // Check if already verified
    if (user.email_verified) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already verified. Please login.' 
      });
    }
    
    // Check if code matches
    if (user.verification_code !== code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid verification code' 
      });
    }
    
    // Check if code expired
    const now = new Date();
    const expiresAt = new Date(user.verification_code_expires);
    
    if (now > expiresAt) {
      await client.query('DELETE FROM "user" WHERE user_id = $1', [user.user_id]);
      return res.status(400).json({ 
        success: false, 
        message: 'Verification code has expired. Please request a new one.' 
      });
    }
    
    // Mark email as verified
    await client.query(
      `UPDATE "user" 
       SET email_verified = TRUE, 
           verification_code = NULL, 
           verification_code_expires = NULL, 
           last_login_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Singapore'
       WHERE user_id = $1`,
      [user.user_id]
    );
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        user_id: user.user_id, 
        email: user.email,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      message: 'Email verified successfully',
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email
      }
    });
    
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during verification',
      error: error.message 
    });
  } finally {
    client.release();
  }
});

// ============================================
// RESEND VERIFICATION CODE (NEW)
// ============================================
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ 
      success: false, 
      message: 'Please provide email' 
    });
  }
  
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      'SELECT user_id, name, email, email_verified FROM "user" WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    const user = result.rows[0];
    
    if (user.email_verified) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already verified' 
      });
    }
    
    // Check if already expired
    const now = new Date();
    const expiresAt = new Date(user.verification_code_expires);
    
    if (now > expiresAt) {
      // Delete expired user
      await client.query('DELETE FROM "user" WHERE user_id = $1', [user.user_id]);
      
      return res.status(400).json({ 
        success: false, 
        message: 'Your verification period has expired. Account deleted. Please sign up again.',
        expired: true
      });
    }
    
    // Generate new code and extend timer by another 45 minutes
    const verificationCode = generateVerificationCode();
    const newExpiresAt = new Date(Date.now() + 45 * 60 * 1000);
    
    await client.query(
      `UPDATE "user" 
       SET verification_code = $1, verification_code_expires = $2 
       WHERE user_id = $3`,
      [verificationCode, expiresAt, user.user_id]
    );
    
    try {
      await sendVerificationEmail(user.email, user.name, verificationCode);
      console.log('✅ Verification email resent successfully');
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError);
      console.log(`🔐 Verification code for ${email}: ${verificationCode}`);
    }
    
    res.json({
      success: true,
      message: 'New verification code sent to your email'
    });
    
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  } finally {
    client.release();
  }
});

// ============================================
// LOGIN ROUTE (UPDATED TO CHECK EMAIL VERIFICATION)
// ============================================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  // Validation
  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Please provide email and password' 
    });
  }
  
  const client = await pool.connect();
  
  try {
    // Find user by email
    const result = await client.query(
      'SELECT user_id, name, email, password_hash, email_verified FROM "user" WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
    
    const user = result.rows[0];
    
    // Check if email is verified
    if (!user.email_verified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Please verify your email before logging in',
        requiresVerification: true,
        email: user.email
      });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
    
    // Update last login
    await client.query(
      'UPDATE "user" SET last_login_at = CURRENT_TIMESTAMP AT TIME ZONE \'Asia/Singapore\' WHERE user_id = $1',
      [user.user_id]
    );
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        user_id: user.user_id, 
        email: user.email,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login',
      error: error.message 
    });
  } finally {
    client.release();
  }
});

// ============================================
// VERIFY TOKEN ROUTE (for checking if user is logged in)
// ============================================
router.get('/verify', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'No token provided' 
    });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const client = await pool.connect();
    const result = await client.query(
      'SELECT user_id, name, email, created_at FROM "user" WHERE user_id = $1',
      [decoded.user_id]
    );
    client.release();
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    res.json({
      success: true,
      user: result.rows[0]
    });
    
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
});

// ============================================
// FORGOT PASSWORD - REQUEST RESET (UPDATED)
// ============================================
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ 
      success: false, 
      message: 'Please provide email address' 
    });
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Please provide a valid email address' 
    });
  }
  
  const client = await pool.connect();
  
  try {
    // Find user
    const result = await client.query(
      'SELECT user_id, name, email, email_verified FROM "user" WHERE email = $1',
      [email.toLowerCase()]
    );
    
 if (result.rows.length === 0 || !result.rows[0].email_verified) {
  // Don't reveal if email exists or not (more secure)
  return res.json({
    success: true,
    message: 'If an account exists with this email, you will receive a password reset link.'
  });
}
    
    const user = result.rows[0];
    
    // Check if email is verified
    if (!user.email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Please verify your email before resetting password. Check your inbox for the verification code.',
        requiresVerification: true,
        email: user.email
      });
    }
    
    // Generate reset token
    const resetToken = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    // Save reset token
    await client.query(
      'UPDATE "user" SET reset_token = $1, reset_token_expires = $2 WHERE user_id = $3',
      [resetToken, expiresAt, user.user_id]
    );
    
    // Send reset email
    try {
      await sendPasswordResetEmail(user.email, user.name, resetToken);
      console.log(`✅ Password reset email sent to ${user.email}`);
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError);
      console.log(`🔐 Reset token for ${email}: ${resetToken}`);
      console.log(`🔗 Reset URL: ${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`);
    }
    
    res.json({
      success: true,
      message: 'Password reset link sent to your email.',
      // TEMPORARY for testing - remove in production!
      resetToken: resetToken,
      resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`
    });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again later.',
      error: error.message 
    });
  } finally {
    client.release();
  }
});

// ============================================
// RESET PASSWORD - VERIFY TOKEN & UPDATE
// ============================================
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  
  if (!token || !newPassword) {
    return res.status(400).json({ 
      success: false, 
      message: 'Please provide reset token and new password' 
    });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ 
      success: false, 
      message: 'Password must be at least 6 characters long' 
    });
  }
  
  const client = await pool.connect();
  
  try {
    // Find user with this token
    const result = await client.query(
      'SELECT user_id, name, email, reset_token_expires FROM "user" WHERE reset_token = $1',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired reset token' 
      });
    }
    
    const user = result.rows[0];
    
    // Check if token expired
    const now = new Date();
    const expiresAt = new Date(user.reset_token_expires);
    
    if (now > expiresAt) {
      // Clear expired token
      await client.query(
        'UPDATE "user" SET reset_token = NULL, reset_token_expires = NULL WHERE user_id = $1',
        [user.user_id]
      );
      
      return res.status(400).json({ 
        success: false, 
        message: 'Reset token has expired. Please request a new one.',
        expired: true
      });
    }
    
    // Hash new password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password and clear reset token
    await client.query(
      `UPDATE "user" 
       SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL 
       WHERE user_id = $2`,
      [password_hash, user.user_id]
    );
    
    res.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  } finally {
    client.release();
  }
});

// ============================================
// CHANGE PASSWORD (FOR LOGGED-IN USERS)
// ============================================
router.post('/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Not authenticated' 
    });
  }
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ 
      success: false, 
      message: 'Please provide current and new password' 
    });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ 
      success: false, 
      message: 'New password must be at least 6 characters long' 
    });
  }
  
  if (currentPassword === newPassword) {
    return res.status(400).json({ 
      success: false, 
      message: 'New password must be different from current password' 
    });
  }
  
  const client = await pool.connect();
  
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user
    const result = await client.query(
      'SELECT user_id, email, password_hash FROM "user" WHERE user_id = $1',
      [decoded.user_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    const user = result.rows[0];
    
    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }
    
    // Hash new password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    await client.query(
      'UPDATE "user" SET password_hash = $1 WHERE user_id = $2',
      [password_hash, user.user_id]
    );
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    console.error('Change password error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  } finally {
    client.release();
  }
});

// ============================================
// LOGOUT ROUTE
// ============================================
router.post('/logout', (req, res) => {
  // Client-side will remove the token
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

module.exports = router;