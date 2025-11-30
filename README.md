# INF2003-Database-Systems

# HDB Smart Analytics Platform 🏠📊

**Group:** P2 Group 32
**Module:** INF2003 - Database Systems

An AI-powered analytics platform designed to consolidate Singapore's public housing market data. It integrates historical transactions, geospatial amenities, and machine learning to provide comprehensive market intelligence for homebuyers and investors.

---

## 🚀 Key Features

* **📊 Real-Time Analytics Dashboard:** Interactive charts visualization over **217,000+** historical transactions with instant filtering (Town, Year, Flat Type).
* **🤖 AI Price Prediction:** Zero-latency server-side linear regression engine that forecasts property values up to 10 years ahead.
* **💬 AI Chatbot Assistant:** Powered by **Google Gemini**, translating natural language queries (e.g., *"Show me cheap 4-room flats in Bedok"*) into complex SQL database operations.
* **🗺️ Interactive Geospatial Map:** Visualizes critical infrastructure (MRT, Schools, EV Chargers) using MongoDB's proximity search.
* **⭐ Community Reviews:** A dynamic review system where authenticated users can rate and review specific blocks or towns, fostering community-driven insights.
* **🔖 Personalized Watchlist:** "Smart Grouping" feature that tracks dynamic price ranges (Min/Max) for specific blocks rather than static past transactions.
* **🔐 Secure Authentication:** JWT-based stateless sessions with Two-Factor Email Verification (OTP).

---

## 🛠️ Tech Stack

This project utilizes a **Hybrid Database Architecture** within a PERN + M stack:

* **Frontend:** React.js, Tailwind CSS, Recharts, React-Leaflet
* **Backend:** Node.js, Express.js
* **Relational DB (PostgreSQL):** Handles structured financial data, user accounts, and ML cache.
    * *Optimizations:* Materialized Views, Partial Indexing, UUIDs.
* **NoSQL DB (MongoDB):** Handles unstructured geospatial data (Amenities), Chat Logs, and **User Reviews**.
    * *Optimizations:* 2dsphere Indexing for radius search, Flexible Schema for review attributes.
* **AI Services:** Google Gemini API (via `llmService.js`).

---

## ⚙️ Installation & Setup

### 1. Clone the Repository
Open terminal 1 and input the following in root directory.
```bash
git clone https://github.com/notsirt24/INF2003-Database-Systems.git
```

### 2. Database Setup
After cloning, open the project folder. Open terminal 2 and input the following commands.
```bash
cd /database/scripts
npm install
```
**Create a new .env file with the configurations provided by the repository owner.**

### 3. Backend Setup
Open terminal 3 and input the following commands.
```bash
cd /backend
npm install
npm run dev
```

### 4. Frontend Setup
Open terminal 4 and input the following commands.
```bash
cd /frontend
npm install
npm start
```

## 👥 Contributors
* Liew Kai Min
* Shina Shih Xin Rong
* Wee Jia Xin, Stephanie
* Adele Quah
* Ong Li Lian
* Loh Cherng Jun Triston
