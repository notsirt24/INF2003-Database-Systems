const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

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
// SIGNUP ROUTE
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
      'SELECT user_id FROM "user" WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'User with this email already exists' 
      });
    }
    
    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);
    
    // Insert new user
    const result = await client.query(
      `INSERT INTO "user" (name, email, password_hash, created_at, last_login_at) 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
       RETURNING user_id, name, email, created_at`,
      [name, email.toLowerCase(), password_hash]
    );
    
    const newUser = result.rows[0];
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        user_id: newUser.user_id, 
        email: newUser.email,
        name: newUser.name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      token,
      user: {
        user_id: newUser.user_id,
        name: newUser.name,
        email: newUser.email,
        created_at: newUser.created_at
      }
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
// LOGIN ROUTE
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
      'SELECT user_id, name, email, password_hash FROM "user" WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
    
    const user = result.rows[0];
    
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
      'UPDATE "user" SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = $1',
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