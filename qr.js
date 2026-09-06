// qr.js - Updated QR dashboard with full session generation
const express = require('express');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const pino = require('pino');
const { makeid } = require('./id');

const {
    default: Fredi,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    fetchLatestBaileysVersion,
    getContentType
} = require('@whiskeysockets/baileys');

const router = express.Router();
let activeSessions = {};

function removeFile(filePath) {
    if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { recursive: true, force: true });
    }
}

function formatSessionMessage(sessionId) {
    return `
╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃   🔐 *SESSION GENERATED!*     ┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

✅ *Device Linked Successfully!*

📦 *Your Session ID:*
\`\`\`
${sessionId}
\`\`\`

⚠️ *IMPORTANT:*
• Save this session ID securely
• Use it to deploy your FEE-XMD bot
• One-time use only
• Valid for 24 hours

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 *Quick Actions:*
`;
}

// QR Dashboard HTML with enhanced UI
const QR_DASHBOARD = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FEE-XMD QR Scanner Dashboard</title>
    <link rel="icon" type="image/x-icon" href="https://files.catbox.moe/el0qlh.jpeg">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        :root {
            --primary: #7c3aed;
            --primary-dark: #5b21b6;
            --secondary: #06b6d4;
            --accent: #10b981;
            --danger: #ef4444;
            --warning: #f59e0b;
            --background: #0f172a;
            --surface: #1e293b;
            --text-primary: #f1f5f9;
            --text-secondary: #cbd5e1;
            --text-muted: #94a3b8;
            --gradient-primary: linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%);
            --gradient-success: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
            --shadow-xl: 0 25px 50px rgba(0,0,0,0.5);
        }

        body {
            background: var(--background);
            font-family: 'Segoe UI', system-ui, sans-serif;
            color: var(--text-primary);
            min-height: 100vh;
            overflow-x: hidden;
        }

        .navbar {
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(20px);
            padding: 1rem 2rem;
            border-bottom: 1px solid rgba(124, 58, 237, 0.3);
            position: sticky;
            top: 0;
            z-index: 1000;
        }

        .nav-container {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 1.5rem;
            font-weight: 700;
            color: white;
            text-decoration: none;
        }

        .logo i { color: var(--primary); }

        .nav-links {
            display: flex;
            gap: 1.5rem;
        }

        .nav-links a {
            color: var(--text-secondary);
            text-decoration: none;
            transition: color 0.3s;
            padding: 0.5rem 1rem;
            border-radius: 8px;
            font-size: 0.95rem;
        }

        .nav-links a:hover {
            color: white;
            background: rgba(124, 58, 237, 0.1);
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }

        .hero-section {
            text-align: center;
            padding: 2rem 0 3rem;
            position: relative;
        }

        .hero-title {
            font-size: 2.8rem;
            font-weight: 800;
            background: var(--gradient-primary);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            margin-bottom: 0.5rem;
        }

        .hero-subtitle {
            color: var(--text-secondary);
            font-size: 1.1rem;
            max-width: 600px;
            margin: 0 auto 1.5rem;
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 0.5rem 1.2rem;
            border-radius: 50px;
            font-size: 0.9rem;
            font-weight: 500;
        }

        .status-badge.waiting {
            background: rgba(245, 158, 11, 0.15);
            color: var(--warning);
            border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .status-badge.connecting {
            background: rgba(6, 182, 212, 0.15);
            color: var(--secondary);
            border: 1px solid rgba(6, 182, 212, 0.3);
            animation: pulse 1.5s ease-in-out infinite;
        }

        .status-badge.connected {
            background: rgba(16, 185, 129, 0.15);
            color: var(--accent);
            border: 1px solid rgba(16, 185, 129, 0.3);
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
        }

        .dashboard-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-top: 2rem;
        }

        @media (max-width: 768px) {
            .dashboard-grid {
                grid-template-columns: 1fr;
            }
        }

        .card {
            background: rgba(30, 41, 59, 0.8);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            padding: 2rem;
            border: 1px solid rgba(124, 58, 237, 0.2);
            box-shadow: var(--shadow-xl);
            transition: all 0.3s ease;
        }

        .card:hover {
            transform: translateY(-5px);
            border-color: rgba(124, 58, 237, 0.5);
        }

        .card-title {
            font-size: 1.2rem;
            font-weight: 600;
            margin-bottom: 1.2rem;
            display: flex;
            align-items: center;
            gap: 10px;
            color: white;
        }

        .card-title i { color: var(--primary); }

        .qr-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem 1rem;
            background: rgba(15, 23, 42, 0.6);
            border-radius: 16px;
            min-height: 350px;
            position: relative;
        }

        #qrImage {
            max-width: 280px;
            width: 100%;
            border-radius: 12px;
            box-shadow: 0 0 40px rgba(124, 58, 237, 0.3);
            border: 2px solid rgba(124, 58, 237, 0.3);
            transition: all 0.5s ease;
        }

        #qrImage.connected {
            border-color: var(--accent);
            box-shadow: 0 0 60px rgba(16, 185, 129, 0.3);
        }

        .qr-placeholder {
            text-align: center;
            padding: 2rem;
        }

        .qr-placeholder i {
            font-size: 3rem;
            color: var(--primary);
            animation: spin 2s linear infinite;
        }

        .qr-placeholder p {
            color: var(--text-secondary);
            margin-top: 1rem;
        }

        .qr-placeholder small {
            color: var(--text-muted);
            font-size: 0.85rem;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .qr-status {
            margin-top: 1.2rem;
            padding: 0.7rem 1.5rem;
            border-radius: 12px;
            font-weight: 500;
            font-size: 0.95rem;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .status-waiting {
            background: rgba(245, 158, 11, 0.15);
            color: var(--warning);
            border: 1px solid rgba(245, 158, 11, 0.2);
        }

        .status-connecting {
            background: rgba(6, 182, 212, 0.15);
            color: var(--secondary);
            border: 1px solid rgba(6, 182, 212, 0.2);
            animation: pulse 1.5s ease-in-out infinite;
        }

        .status-connected {
            background: rgba(16, 185, 129, 0.15);
            color: var(--accent);
            border: 1px solid rgba(16, 185, 129, 0.2);
        }

        .status-error {
            background: rgba(239, 68, 68, 0.15);
            color: var(--danger);
            border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .spinner-small {
            display: inline-block;
            width: 18px;
            height: 18px;
            border: 2px solid rgba(124, 58, 237, 0.2);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }

        .controls {
            display: flex;
            gap: 0.8rem;
            margin-top: 1.2rem;
            flex-wrap: wrap;
            justify-content: center;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 0.7rem 1.5rem;
            border-radius: 12px;
            font-weight: 600;
            font-size: 0.95rem;
            text-decoration: none;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
        }

        .btn-primary {
            background: var(--gradient-primary);
            color: white;
            box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3);
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(124, 58, 237, 0.4);
        }

        .btn-success {
            background: var(--gradient-success);
            color: white;
            box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
        }

        .btn-success:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
        }

        .btn-secondary {
            background: rgba(124, 58, 237, 0.1);
            color: var(--text-primary);
            border: 1px solid rgba(124, 58, 237, 0.2);
        }

        .btn-secondary:hover {
            background: rgba(124, 58, 237, 0.2);
            transform: translateY(-2px);
        }

        .btn-danger {
            background: rgba(239, 68, 68, 0.15);
            color: var(--danger);
            border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .btn-danger:hover {
            background: rgba(239, 68, 68, 0.25);
            transform: translateY(-2px);
        }

        .steps-list {
            list-style: none;
            padding: 0;
        }

        .steps-list li {
            padding: 0.8rem 1rem;
            margin-bottom: 0.6rem;
            background: rgba(15, 23, 42, 0.6);
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 15px;
            border-left: 3px solid var(--primary);
            transition: all 0.3s ease;
        }

        .steps-list li:hover {
            background: rgba(15, 23, 42, 0.8);
            transform: translateX(5px);
        }

        .step-number {
            background: var(--gradient-primary);
            color: white;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 0.8rem;
            flex-shrink: 0;
        }

        .step-text {
            color: var(--text-secondary);
            line-height: 1.4;
            font-size: 0.95rem;
        }

        .step-text strong {
            color: white;
        }

        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 0.8rem;
            margin-top: 1rem;
        }

        .feature-item {
            padding: 0.8rem;
            background: rgba(15, 23, 42, 0.6);
            border-radius: 10px;
            text-align: center;
            border: 1px solid rgba(124, 58, 237, 0.1);
            transition: all 0.3s ease;
        }

        .feature-item:hover {
            border-color: rgba(124, 58, 237, 0.3);
            transform: translateY(-3px);
        }

        .feature-item i {
            font-size: 1.5rem;
            color: var(--primary);
            margin-bottom: 0.3rem;
            display: block;
        }

        .feature-item h4 {
            color: white;
            font-size: 0.85rem;
        }

        .feature-item p {
            color: var(--text-muted);
            font-size: 0.75rem;
        }

        .session-box {
            margin-top: 1rem;
            padding: 1rem;
            background: rgba(15, 23, 42, 0.8);
            border-radius: 12px;
            border: 1px solid rgba(16, 185, 129, 0.2);
            display: none;
        }

        .session-box.active {
            display: block;
            animation: slideDown 0.5s ease;
        }

        @keyframes slideDown {
            0% { opacity: 0; transform: translateY(-10px); }
            100% { opacity: 1; transform: translateY(0); }
        }

        .session-box .label {
            color: var(--text-secondary);
            font-size: 0.8rem;
            margin-bottom: 0.5rem;
        }

        .session-box .code {
            font-family: 'Courier New', monospace;
            font-size: 0.8rem;
            color: var(--text-primary);
            background: rgba(30, 41, 59, 0.5);
            padding: 0.8rem;
            border-radius: 8px;
            word-break: break-all;
            max-height: 120px;
            overflow-y: auto;
            border: 1px solid rgba(124, 58, 237, 0.1);
        }

        .session-box .actions {
            display: flex;
            gap: 0.8rem;
            margin-top: 0.8rem;
            flex-wrap: wrap;
        }

        .session-box .actions .btn {
            padding: 0.5rem 1rem;
            font-size: 0.85rem;
        }

        .footer {
            text-align: center;
            padding: 2rem;
            margin-top: 3rem;
            border-top: 1px solid rgba(124, 58, 237, 0.1);
            color: var(--text-muted);
        }

        @media (max-width: 480px) {
            .hero-title { font-size: 2rem; }
            .nav-links a { padding: 0.3rem 0.6rem; font-size: 0.85rem; }
            .card { padding: 1.2rem; }
            .qr-container { min-height: 280px; padding: 1rem; }
            #qrImage { max-width: 200px; }
            .controls .btn { padding: 0.5rem 1rem; font-size: 0.85rem; }
        }
    </style>
</head>
<body>
    <nav class="navbar">
        <div class="nav-container">
            <a href="/" class="logo">
                <i class="fas fa-robot"></i>
                <span>FEE XMD</span>
            </a>
            <div class="nav-links">
                <a href="/">Home</a>
                <a href="/pair">Pair Bot</a>
                <a href="/qr" class="active">QR Scanner</a>
                <a href="https://github.com/Fred1e/Fee-Xmd" target="_blank">
                    <i class="fab fa-github"></i>
                </a>
            </div>
        </div>
    </nav>

    <div class="container">
        <div class="hero-section">
            <h1 class="hero-title">📱 QR Scanner Dashboard</h1>
            <p class="hero-subtitle">
                Scan the QR code with WhatsApp to connect your device to FEE-XMD bot
            </p>
            <div id="statusBadge" class="status-badge waiting">
                <i class="fas fa-clock"></i>
                <span>Waiting for connection...</span>
            </div>
        </div>

        <div class="dashboard-grid">
            <div class="card">
                <h2 class="card-title">
                    <i class="fas fa-qrcode"></i>
                    QR Code Scanner
                </h2>
                <div class="qr-container" id="qrContainer">
                    <img id="qrImage" src="" alt="QR Code" style="display: none;">
                    <div id="qrPlaceholder" class="qr-placeholder">
                        <i class="fas fa-spinner"></i>
                        <p>Generating QR Code...</p>
                        <small>Please wait a moment</small>
                    </div>
                    <div id="qrStatus" class="qr-status status-waiting">
                        <i class="fas fa-clock"></i>
                        <span>Waiting for QR code...</span>
                    </div>
                </div>
                <div class="controls">
                    <button onclick="refreshQR()" class="btn btn-primary">
                        <i class="fas fa-sync-alt"></i> Refresh QR
                    </button>
                    <button onclick="generatePairCode()" class="btn btn-secondary">
                        <i class="fas fa-key"></i> Use Pair Code
                    </button>
                </div>
            </div>

            <div class="card">
                <h2 class="card-title">
                    <i class="fas fa-info-circle"></i>
                    How to Connect
                </h2>
                <ul class="steps-list">
                    <li>
                        <span class="step-number">1</span>
                        <span class="step-text">
                            <strong>Open WhatsApp</strong><br>
                            On your phone, open WhatsApp app
                        </span>
                    </li>
                    <li>
                        <span class="step-number">2</span>
                        <span class="step-text">
                            <strong>Linked Devices</strong><br>
                            Go to Settings → Linked Devices
                        </span>
                    </li>
                    <li>
                        <span class="step-number">3</span>
                        <span class="step-text">
                            <strong>Link Device</strong><br>
                            Tap "Link a Device" to open scanner
                        </span>
                    </li>
                    <li>
                        <span class="step-number">4</span>
                        <span class="step-text">
                            <strong>Scan QR</strong><br>
                            Scan the QR code displayed here
                        </span>
                    </li>
                    <li>
                        <span class="step-number">5</span>
                        <span class="step-text">
                            <strong>Get Session</strong><br>
                            Your session ID will be sent via WhatsApp
                        </span>
                    </li>
                </ul>
                <div style="margin-top: 1rem; padding: 0.8rem; background: rgba(245, 158, 11, 0.08); border-radius: 10px; border-left: 3px solid var(--warning);">
                    <p style="color: var(--text-secondary); font-size: 0.85rem;">
                        <i class="fas fa-shield-alt" style="color: var(--warning);"></i>
                        <strong>Security:</strong> QR codes expire after 2 minutes. 
                        Session ID is sent only to your WhatsApp.
                    </p>
                </div>
            </div>
        </div>

        <!-- Session Display Box -->
        <div class="card" style="margin-top: 2rem;" id="sessionCard">
            <h2 class="card-title">
                <i class="fas fa-key"></i>
                Session Management
            </h2>
            <div class="session-box" id="sessionBox">
                <div class="label">📋 Your Session ID (Copy this for deployment)</div>
                <div class="code" id="sessionCode">Loading...</div>
                <div class="actions">
                    <button onclick="copySession()" class="btn btn-success">
                        <i class="fas fa-copy"></i> Copy Session
                    </button>
                    <button onclick="downloadSession()" class="btn btn-primary">
                        <i class="fas fa-download"></i> Download
                    </button>
                    <button onclick="clearSession()" class="btn btn-danger">
                        <i class="fas fa-trash"></i> Clear
                    </button>
                </div>
            </div>
            <div id="noSession" style="text-align: center; padding: 1.5rem; color: var(--text-secondary);">
                <i class="fas fa-qrcode" style="font-size: 2rem; color: var(--text-muted); display: block; margin-bottom: 0.5rem;"></i>
                <p>Scan the QR code to receive your session</p>
                <p style="font-size: 0.85rem; color: var(--text-muted);">Session will appear here after connecting</p>
            </div>
        </div>

        <div class="card" style="margin-top: 2rem;">
            <h2 class="card-title">
                <i class="fas fa-star"></i>
                Features You'll Get
            </h2>
            <div class="features-grid">
                <div class="feature-item">
                    <i class="fas fa-download"></i>
                    <h4>Media Downloaders</h4>
                    <p>YouTube, TikTok, Instagram & more</p>
                </div>
                <div class="feature-item">
                    <i class="fas fa-robot"></i>
                    <h4>AI Chat</h4>
                    <p>GPT-4 powered conversations</p>
                </div>
                <div class="feature-item">
                    <i class="fas fa-gamepad"></i>
                    <h4>Games</h4>
                    <p>Interactive games & entertainment</p>
                </div>
                <div class="feature-item">
                    <i class="fas fa-tools"></i>
                    <h4>Utility Tools</h4>
                    <p>200+ commands for everything</p>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>Made with ❤️ by <strong>Fredi AI Tech</strong> | Arusha, Tanzania</p>
            <p style="font-size: 0.8rem; color: var(--text-muted);">
                FEE-XMD is not affiliated with WhatsApp Inc.
            </p>
        </div>
    </div>

    <script>
        let qrRefreshInterval = null;
        let statusCheckInterval = null;
        let currentSessionId = '';
        let sessionReceived = false;

        async function fetchQR() {
            try {
                const response = await fetch('/qr/generate');
                if (!response.ok) throw new Error('Failed to generate QR');
                
                const data = await response.json();
                if (data.qr) {
                    const qrImage = document.getElementById('qrImage');
                    qrImage.src = data.qr;
                    qrImage.style.display = 'block';
                    qrImage.classList.remove('connected');
                    
                    document.getElementById('qrPlaceholder').style.display = 'none';
                    
                    updateStatus('connecting', 'Connecting to WhatsApp...', 'fa-spinner fa-pulse');
                    updateBadge('connecting', 'Connecting...');
                }
            } catch (error) {
                console.error('QR fetch error:', error);
                updateStatus('error', 'Failed to generate QR. Please refresh.', 'fa-exclamation-circle');
                updateBadge('waiting', 'Error - Refresh');
            }
        }

        async function checkStatus() {
            try {
                const response = await fetch('/qr/status');
                const data = await response.json();
                
                if (data.connected && !sessionReceived) {
                    updateStatus('connected', '✅ Connected successfully!', 'fa-check-circle');
                    updateBadge('connected', 'Connected ✅');
                    
                    const qrImage = document.getElementById('qrImage');
                    qrImage.classList.add('connected');
                    
                    // Check for session
                    checkSession();
                    
                    sessionReceived = true;
                    
                    if (qrRefreshInterval) {
                        clearInterval(qrRefreshInterval);
                        qrRefreshInterval = null;
                    }
                }
                
                if (data.session) {
                    displaySession(data.session);
                }
            } catch (error) {
                console.log('Status check error:', error);
            }
        }

        async function checkSession() {
            try {
                const response = await fetch('/qr/getsession');
                const data = await response.json();
                
                if (data.session) {
                    displaySession(data.session);
                }
            } catch (error) {
                console.log('Session check error:', error);
            }
        }

        function displaySession(sessionId) {
            currentSessionId = sessionId;
            const sessionBox = document.getElementById('sessionBox');
            const noSession = document.getElementById('noSession');
            
            sessionBox.classList.add('active');
            noSession.style.display = 'none';
            document.getElementById('sessionCode').textContent = sessionId;
            
            // Update status
            updateStatus('connected', '✅ Session received! Check below', 'fa-check-circle');
            updateBadge('connected', 'Session Ready ✅');
        }

        function updateStatus(type, message, icon) {
            const status = document.getElementById('qrStatus');
            status.className = `qr-status status-${type}`;
            status.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
        }

        function updateBadge(type, text) {
            const badge = document.getElementById('statusBadge');
            badge.className = `status-badge ${type}`;
            const icon = type === 'waiting' ? 'fa-clock' : 
                        type === 'connecting' ? 'fa-spinner fa-pulse' : 
                        type === 'connected' ? 'fa-check-circle' : 'fa-exclamation-circle';
            badge.innerHTML = `<i class="fas ${icon}"></i><span>${text}</span>`;
        }

        function refreshQR() {
            sessionReceived = false;
            currentSessionId = '';
            
            document.getElementById('qrImage').style.display = 'none';
            document.getElementById('qrPlaceholder').style.display = 'block';
            
            document.getElementById('sessionBox').classList.remove('active');
            document.getElementById('noSession').style.display = 'block';
            
            updateStatus('waiting', 'Generating new QR code...', 'fa-clock');
            updateBadge('waiting', 'Generating...');
            
            if (qrRefreshInterval) {
                clearInterval(qrRefreshInterval);
                qrRefreshInterval = null;
            }
            
            fetchQR();
            
            qrRefreshInterval = setInterval(() => {
                if (!sessionReceived) {
                    fetchQR();
                }
            }, 120000);
        }

        function generatePairCode() {
            window.location.href = '/pair';
        }

        function copySession() {
            if (!currentSessionId) return;
            
            navigator.clipboard.writeText(currentSessionId).then(() => {
                const btn = event.target.closest('.btn');
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                btn.classList.add('btn-success');
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.classList.remove('btn-success');
                }, 2000);
            }).catch(() => {
                // Fallback
                const textarea = document.createElement('textarea');
                textarea.value = currentSessionId;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                alert('Session copied to clipboard!');
            });
        }

        function downloadSession() {
            if (!currentSessionId) return;
            
            const blob = new Blob([currentSessionId], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fee-xmd-session-${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function clearSession() {
            currentSessionId = '';
            document.getElementById('sessionBox').classList.remove('active');
            document.getElementById('noSession').style.display = 'block';
            sessionReceived = false;
        }

        // Initial fetch
        document.addEventListener('DOMContentLoaded', () => {
            fetchQR();
            
            // Check status every 3 seconds
            statusCheckInterval = setInterval(checkStatus, 3000);
            
            // Check session every 5 seconds
            setInterval(checkSession, 5000);
        });
    </script>
</body>
</html>
`;

// QR Generation endpoint
router.get('/', async (req, res) => {
    res.send(QR_DASHBOARD);
});

// QR Generation API
router.get('/generate', async (req, res) => {
    const id = makeid();
    const tempDir = path.join(__dirname, 'temp', id);
    let qrSent = false;
    let sessionGenerated = false;

    try {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(tempDir);

        const sock = Fredi({
            version,
            logger: pino({ level: 'silent' }).child({ level: 'silent' }),
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }).child({ level: 'silent' })),
            },
            browser: Browsers.ubuntu('Chrome', '125'),
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            generateHighQualityLinkPreview: true,
            markOnlineOnConnect: true
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && !qrSent) {
                qrSent = true;
                const qrBuffer = await QRCode.toDataURL(qr);
                res.json({ qr: qrBuffer });
            }

            if (connection === 'open') {
                console.log('✅ Device connected via QR!');
                const userJid = sock.user.id;
                
                // Send welcome message with buttons
                await sock.sendMessage(userJid, {
                    text: `
╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃   ✅ *DEVICE CONNECTED!*      ┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

👋 *Welcome to FEE-XMD!*

🤖 Your device is now connected to the bot.

⏳ *Generating your secure session ID...*
This will take a few moments.

_✨ Powered by Fredi AI Tech_`,
                    buttons: [
                        {
                            buttonId: 'get_started',
                            buttonText: { displayText: '🚀 Get Started' },
                            type: 1
                        }
                    ],
                    headerType: 1
                });

                await delay(3000);

                // Read session from file
                const credsPath = path.join(tempDir, 'creds.json');
                let sessionData = null;
                let attempts = 0;
                const maxAttempts = 15;

                console.log('⏳ Waiting for session file...');

                while (attempts < maxAttempts && !sessionData) {
                    try {
                        if (fs.existsSync(credsPath)) {
                            const data = fs.readFileSync(credsPath);
                            if (data && data.length > 50) {
                                sessionData = data;
                                console.log('✅ Session file found!');
                                break;
                            }
                        }
                        await delay(2000);
                        attempts++;
                    } catch (e) {
                        await delay(2000);
                        attempts++;
                    }
                }

                if (sessionData) {
                    const base64Session = Buffer.from(sessionData).toString('base64');
                    console.log('✅ Session generated, length:', base64Session.length);
                    sessionGenerated = true;

                    // Send session with interactive buttons
                    const sessionMessage = `
╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃   🔐 *SESSION READY!*         ┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

📦 *Your Session ID:*
\`\`\`
${base64Session}
\`\`\`

⚠️ *IMPORTANT:*
• Save this session ID securely
• Use it to deploy your FEE-XMD bot
• One-time use only
• Valid for 24 hours

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 *Quick Actions:*`;

                    await sock.sendMessage(userJid, {
                        text: sessionMessage,
                        buttons: [
                            {
                                buttonId: 'copy_session',
                                buttonText: { displayText: '📋 Copy Session ID' },
                                type: 1
                            },
                            {
                                buttonId: 'share_session',
                                buttonText: { displayText: '📤 Share Session' },
                                type: 1
                            },
                            {
                                buttonId: 'deploy_guide',
                                buttonText: { displayText: '🚀 Deploy Guide' },
                                type: 1
                            }
                        ],
                        headerType: 1
                    });

                    await delay(1000);

                    // Send full session in code block
                    await sock.sendMessage(userJid, {
                        text: `📋 *Full Session ID:*\n\n\`\`\`${base64Session}\`\`\``,
                        buttons: [
                            {
                                buttonId: 'copy_full',
                                buttonText: { displayText: '📋 Copy Full' },
                                type: 1
                            }
                        ],
                        headerType: 1
                    });

                    await delay(1000);

                    // Send deployment info
                    const infoText = `
╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃   🌟 *DEPLOYMENT RESOURCES*    ┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

📌 *Helpful Links:*
• 👑 Owner: wa.me/255752593977
• 💬 Group: https://chat.whatsapp.com/FA1GPSjfUQLCyFbquWnRIS
• 📢 Channel: https://whatsapp.com/channel/0029Vb6mzVF7tkj42VNPrZ3V
• 📸 Instagram: @frediezra
• 💻 GitHub: https://github.com/Fred1e/Fee-Xmd

🧠 *Support FEE-XMD:*
⭐ Star & 🍴 Fork the repo!

🩷 *#Thanks | #FrediAI2026 | #FEEBot*`;

                    await sock.sendMessage(userJid, {
                        text: infoText,
                        buttons: [
                            {
                                buttonId: 'open_github',
                                buttonText: { displayText: '🔗 Open Repository' },
                                type: 1
                            },
                            {
                                buttonId: 'join_group',
                                buttonText: { displayText: '👥 Join Group' },
                                type: 1
                            }
                        ],
                        headerType: 1
                    });

                    // Store session for dashboard
                    activeSessions[id] = {
                        session: base64Session,
                        user: userJid,
                        timestamp: Date.now()
                    };

                    console.log('✅ Session sent to:', userJid);
                } else {
                    await sock.sendMessage(userJid, {
                        text: '❌ Failed to generate session. Please try again.'
                    });
                }

                await delay(2000);
                sock.ws.close();
                removeFile(tempDir);

                // Clean up after 5 minutes
                setTimeout(() => {
                    delete activeSessions[id];
                }, 300000);
            }

            if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
                console.log('⚠️ Connection closed, reconnecting...');
                await delay(5000);
                // Reconnect logic
            }
        });

        // Handle button clicks
        sock.ev.on('messages.upsert', async (m) => {
            try {
                const msg = m.messages[0];
                if (!msg.key || msg.key.fromMe) return;
                if (!msg.message) return;

                const messageType = getContentType(msg.message);
                const sender = msg.key.remoteJid;

                if (messageType === 'buttonsResponseMessage') {
                    const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
                    console.log('🔘 Button clicked:', buttonId);

                    switch(buttonId) {
                        case 'copy_session':
                        case 'copy_full':
                            await sock.sendMessage(sender, {
                                text: '📋 *Session copied to clipboard!*\n\n_You can paste it in your deployment settings._'
                            });
                            break;

                        case 'share_session':
                            await sock.sendMessage(sender, {
                                text: '📤 *Share this session*\n\n_Please keep it secure._'
                            });
                            break;

                        case 'deploy_guide':
                            await sock.sendMessage(sender, {
                                text: `🚀 *Deployment Guide*

1. Copy your session ID
2. Go to your hosting platform
3. Set SESSION_ID environment variable
4. Deploy the bot
5. Enjoy FEE-XMD!

📖 Full guide: https://github.com/Fred1e/Fee-Xmd#readme`
                            });
                            break;

                        case 'open_github':
                            await sock.sendMessage(sender, {
                                text: '🔗 *FEE-XMD Repository*\n\nhttps://github.com/Fred1e/Fee-Xmd'
                            });
                            break;

                        case 'join_group':
                            await sock.sendMessage(sender, {
                                text: '👥 *Join Our Community*\n\nhttps://chat.whatsapp.com/FA1GPSjfUQLCyFbquWnRIS'
                            });
                            break;

                        case 'get_started':
                            await sock.sendMessage(sender, {
                                text: `🚀 *Getting Started with FEE-XMD*

1. Your session ID has been sent above
2. Copy and save it securely
3. Deploy on your preferred platform
4. Use commands like !help, !menu

✨ *Happy Botting!*`
                            });
                            break;
                    }
                }
            } catch (error) {
                console.error('Message handler error:', error);
            }
        });

        // Handle timeout
        setTimeout(() => {
            if (!qrSent && !res.headersSent) {
                res.status(408).json({ error: 'QR generation timeout' });
            }
        }, 60000);

    } catch (err) {
        console.error('QR Generation Error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Service unavailable' });
        }
        removeFile(tempDir);
    }
});

// Status endpoint
router.get('/status', async (req, res) => {
    res.json({ 
        connected: Object.keys(activeSessions).length > 0,
        status: Object.keys(activeSessions).length > 0 ? 'connected' : 'waiting'
    });
});

// Get session endpoint
router.get('/getsession', async (req, res) => {
    const sessions = Object.values(activeSessions);
    if (sessions.length > 0) {
        res.json({ session: sessions[sessions.length - 1].session });
    } else {
        res.json({ session: null });
    }
});

module.exports = router;