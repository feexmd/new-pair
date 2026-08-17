// qr.js - Updated QR dashboard with interactive UI
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

function removeFile(filePath) {
    if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { recursive: true, force: true });
    }
}

// QR Dashboard HTML
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
            --gradient-primary: linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%);
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
            padding: 3rem 0;
            position: relative;
        }

        .hero-title {
            font-size: 3rem;
            font-weight: 800;
            background: var(--gradient-primary);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            margin-bottom: 1rem;
        }

        .hero-subtitle {
            color: var(--text-secondary);
            font-size: 1.2rem;
            max-width: 600px;
            margin: 0 auto 2rem;
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
            font-size: 1.3rem;
            font-weight: 600;
            margin-bottom: 1rem;
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
            padding: 2rem;
            background: rgba(15, 23, 42, 0.6);
            border-radius: 16px;
            min-height: 400px;
        }

        #qrImage {
            max-width: 300px;
            width: 100%;
            border-radius: 12px;
            box-shadow: 0 0 40px rgba(124, 58, 237, 0.3);
            border: 2px solid rgba(124, 58, 237, 0.3);
        }

        .qr-status {
            margin-top: 1.5rem;
            padding: 0.8rem 1.5rem;
            border-radius: 12px;
            font-weight: 500;
        }

        .status-waiting {
            background: rgba(245, 158, 11, 0.2);
            color: var(--warning);
            border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .status-connecting {
            background: rgba(6, 182, 212, 0.2);
            color: var(--secondary);
            border: 1px solid rgba(6, 182, 212, 0.3);
            animation: pulse 1.5s ease-in-out infinite;
        }

        .status-connected {
            background: rgba(16, 185, 129, 0.2);
            color: var(--accent);
            border: 1px solid rgba(16, 185, 129, 0.3);
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
        }

        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(124, 58, 237, 0.3);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 10px;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .steps-list {
            list-style: none;
            padding: 0;
        }

        .steps-list li {
            padding: 1rem;
            margin-bottom: 0.8rem;
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
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 0.9rem;
            flex-shrink: 0;
        }

        .step-text {
            color: var(--text-secondary);
            line-height: 1.5;
        }

        .step-text strong {
            color: white;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 0.8rem 1.8rem;
            border-radius: 12px;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
        }

        .btn-primary {
            background: var(--gradient-primary);
            color: white;
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(124, 58, 237, 0.3);
        }

        .btn-secondary {
            background: rgba(124, 58, 237, 0.1);
            color: var(--text-primary);
            border: 1px solid rgba(124, 58, 237, 0.3);
        }

        .btn-secondary:hover {
            background: rgba(124, 58, 237, 0.2);
        }

        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-top: 1.5rem;
        }

        .feature-item {
            padding: 1rem;
            background: rgba(15, 23, 42, 0.6);
            border-radius: 12px;
            text-align: center;
            border: 1px solid rgba(124, 58, 237, 0.1);
        }

        .feature-item i {
            font-size: 2rem;
            color: var(--primary);
            margin-bottom: 0.5rem;
        }

        .feature-item h4 {
            color: white;
            font-size: 0.9rem;
        }

        .feature-item p {
            color: var(--text-muted);
            font-size: 0.8rem;
        }

        .controls {
            display: flex;
            gap: 1rem;
            margin-top: 1.5rem;
            flex-wrap: wrap;
            justify-content: center;
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
            .nav-links a { padding: 0.3rem 0.6rem; font-size: 0.9rem; }
            .card { padding: 1.5rem; }
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
                <a href="/qr">QR Scanner</a>
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
        </div>

        <div class="dashboard-grid">
            <div class="card">
                <h2 class="card-title">
                    <i class="fas fa-qrcode"></i>
                    QR Code Scanner
                </h2>
                <div class="qr-container" id="qrContainer">
                    <img id="qrImage" src="" alt="QR Code" style="display: none;">
                    <div id="qrPlaceholder" style="text-align: center; padding: 2rem;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: var(--primary);"></i>
                        <p style="color: var(--text-secondary); margin-top: 1rem;">
                            Generating QR Code...
                            <br>
                            <small>Please wait a moment</small>
                        </p>
                    </div>
                    <div id="qrStatus" class="qr-status status-waiting">
                        <span class="spinner"></span>
                        Waiting for QR code...
                    </div>
                </div>
                <div class="controls">
                    <button onclick="refreshQR()" class="btn btn-primary">
                        <i class="fas fa-sync-alt"></i> Refresh QR
                    </button>
                    <button onclick="generatePairCode()" class="btn btn-secondary">
                        <i class="fas fa-key"></i> Generate Pair Code
                    </button>
                </div>
            </div>

            <div class="card">
                <h2 class="card-title">
                    <i class="fas fa-info-circle"></i>
                    How to Use
                </h2>
                <ul class="steps-list">
                    <li>
                        <span class="step-number">1</span>
                        <span class="step-text">
                            <strong>Open WhatsApp</strong><br>
                            On your phone, open WhatsApp
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
                            <strong>Connect & Enjoy</strong><br>
                            Your device will be connected to FEE-XMD!
                        </span>
                    </li>
                </ul>
                <div style="margin-top: 1rem; padding: 1rem; background: rgba(245, 158, 11, 0.1); border-radius: 12px; border-left: 3px solid var(--warning);">
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">
                        <i class="fas fa-shield-alt" style="color: var(--warning);"></i>
                        <strong>Security Notice:</strong> QR codes expire after 2 minutes. 
                        Refresh if it's not working.
                    </p>
                </div>
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
        let currentQR = null;

        async function fetchQR() {
            try {
                const response = await fetch('/qr/generate');
                if (!response.ok) throw new Error('Failed to generate QR');
                
                const data = await response.json();
                if (data.qr) {
                    currentQR = data.qr;
                    const qrImage = document.getElementById('qrImage');
                    qrImage.src = data.qr;
                    qrImage.style.display = 'block';
                    
                    document.getElementById('qrPlaceholder').style.display = 'none';
                    
                    const status = document.getElementById('qrStatus');
                    status.className = 'qr-status status-connecting';
                    status.innerHTML = '<span class="spinner"></span> Connecting to WhatsApp...';
                    
                    // Start checking connection status
                    checkConnection();
                }
            } catch (error) {
                console.error('QR fetch error:', error);
                const status = document.getElementById('qrStatus');
                status.className = 'qr-status status-waiting';
                status.innerHTML = '❌ Failed to generate QR. Please refresh.';
            }
        }

        async function checkConnection() {
            try {
                const response = await fetch('/qr/status');
                const data = await response.json();
                
                if (data.connected) {
                    const status = document.getElementById('qrStatus');
                    status.className = 'qr-status status-connected';
                    status.innerHTML = '✅ Connected successfully!';
                    
                    if (qrRefreshInterval) {
                        clearInterval(qrRefreshInterval);
                        qrRefreshInterval = null;
                    }
                }
            } catch (error) {
                console.log('Status check error:', error);
            }
        }

        function refreshQR() {
            document.getElementById('qrImage').style.display = 'none';
            document.getElementById('qrPlaceholder').style.display = 'block';
            document.getElementById('qrStatus').className = 'qr-status status-waiting';
            document.getElementById('qrStatus').innerHTML = '⏳ Generating new QR code...';
            
            if (qrRefreshInterval) {
                clearInterval(qrRefreshInterval);
                qrRefreshInterval = null;
            }
            
            fetchQR();
            
            // Set up periodic refresh (every 2 minutes)
            qrRefreshInterval = setInterval(() => {
                fetchQR();
            }, 120000);
        }

        function generatePairCode() {
            window.location.href = '/pair';
        }

        // Initial fetch
        document.addEventListener('DOMContentLoaded', () => {
            fetchQR();
            
            // Check connection status every 5 seconds
            setInterval(() => {
                checkConnection();
            }, 5000);
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
            keepAliveIntervalMs: 30000
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && !qrSent) {
                qrSent = true;
                const qrBuffer = await QRCode.toDataURL(qr);
                res.json({ qr: qrBuffer });
                
                // Clean up after QR is generated
                setTimeout(() => {
                    removeFile(tempDir);
                }, 120000);
            }

            if (connection === 'open') {
                // Send welcome message
                await sock.sendMessage(sock.user.id, {
                    text: `
╭━━━━━━━━━━━━━━━━━━━━━╮
┃   ✅ *CONNECTED!*   ┃
╰━━━━━━━━━━━━━━━━━━━━━╯

👋 Your device is now connected to FEE-XMD!

📦 Your session is being generated...
Please wait a moment.

_✨ Welcome to FEE-XMD Bot!_`
                });

                await delay(5000);
                
                const credsPath = path.join(tempDir, 'creds.json');
                let sessionData = null;
                let attempts = 0;
                
                while (attempts < 10 && !sessionData) {
                    try {
                        if (fs.existsSync(credsPath)) {
                            const data = fs.readFileSync(credsPath);
                            if (data && data.length > 50) {
                                sessionData = data;
                                break;
                            }
                        }
                        await delay(3000);
                        attempts++;
                    } catch (e) {
                        await delay(2000);
                        attempts++;
                    }
                }

                if (sessionData) {
                    const base64 = Buffer.from(sessionData).toString('base64');
                    
                    await sock.sendMessage(sock.user.id, {
                        text: `📋 *Your Session ID:*\n\`\`\`${base64}\`\`\`\n\n⚠️ Save this securely!`,
                        buttons: [
                            {
                                buttonId: 'copy_session',
                                buttonText: { displayText: '📋 Copy Session' },
                                type: 1
                            }
                        ],
                        headerType: 1
                    });
                }

                await delay(2000);
                sock.ws.close();
                removeFile(tempDir);
            }

            if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
                await delay(5000);
                // Reconnect logic
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
    res.json({ connected: false, status: 'waiting' });
});

module.exports = router;