// qr.js - With Pastebin integration
const PastebinAPI = require('pastebin-js');
const pastebin = new PastebinAPI('EMWTMkQAVfJa9kM-MRUrxd5Oku1U7pgL');
const { makeid } = require('./id');
const QRCode = require('qrcode');
const express = require('express');
const path = require('path');
const fs = require('fs');
let router = express.Router();
const pino = require('pino');
const {
    default: Fredi,
    useMultiFileAuthState,
    jidNormalizedUser,
    Browsers,
    delay,
    makeInMemoryStore,
    fetchLatestBaileysVersion,
    getContentType
} = require('@whiskeysockets/baileys');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, {
        recursive: true,
        force: true
    });
}

const { readFile } = require('node:fs/promises');

// QR Dashboard HTML
const QR_DASHBOARD = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FEE-XMD QR Scanner</title>
    <link rel="icon" type="image/x-icon" href="https://files.catbox.moe/el0qlh.jpeg">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0f172a;
            font-family: 'Segoe UI', sans-serif;
            color: #f1f5f9;
            min-height: 100vh;
        }
        .navbar {
            background: rgba(15,23,42,0.95);
            padding: 1rem 2rem;
            border-bottom: 1px solid rgba(124,58,237,0.3);
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
        .logo i { color: #7c3aed; }
        .nav-links { display: flex; gap: 1.5rem; }
        .nav-links a {
            color: #cbd5e1;
            text-decoration: none;
            padding: 0.5rem 1rem;
            border-radius: 8px;
            transition: 0.3s;
        }
        .nav-links a:hover { color: white; background: rgba(124,58,237,0.1); }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .hero-section { text-align: center; padding: 2rem 0; }
        .hero-title {
            font-size: 2.8rem;
            font-weight: 800;
            background: linear-gradient(135deg, #7c3aed, #06b6d4);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }
        .hero-subtitle { color: #cbd5e1; font-size: 1.1rem; margin: 0.5rem 0 1.5rem; }
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 0.5rem 1.2rem;
            border-radius: 50px;
            font-size: 0.9rem;
            font-weight: 500;
        }
        .status-badge.waiting { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }
        .status-badge.connecting { background: rgba(6,182,212,0.15); color: #06b6d4; border: 1px solid rgba(6,182,212,0.3); animation: pulse 1.5s infinite; }
        .status-badge.connected { background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3); }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
        .dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 2rem; }
        @media (max-width:768px) { .dashboard-grid { grid-template-columns: 1fr; } }
        .card {
            background: rgba(30,41,59,0.8);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            padding: 2rem;
            border: 1px solid rgba(124,58,237,0.2);
            box-shadow: 0 25px 50px rgba(0,0,0,0.5);
            transition: 0.3s;
        }
        .card:hover { transform: translateY(-5px); border-color: rgba(124,58,237,0.5); }
        .card-title {
            font-size: 1.2rem;
            font-weight: 600;
            margin-bottom: 1.2rem;
            display: flex;
            align-items: center;
            gap: 10px;
            color: white;
        }
        .card-title i { color: #7c3aed; }
        .qr-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem 1rem;
            background: rgba(15,23,42,0.6);
            border-radius: 16px;
            min-height: 350px;
        }
        #qrImage {
            max-width: 280px;
            width: 100%;
            border-radius: 12px;
            box-shadow: 0 0 40px rgba(124,58,237,0.3);
            border: 2px solid rgba(124,58,237,0.3);
        }
        #qrImage.connected { border-color: #10b981; box-shadow: 0 0 60px rgba(16,185,129,0.3); }
        .qr-placeholder { text-align: center; padding: 2rem; }
        .qr-placeholder i { font-size: 3rem; color: #7c3aed; animation: spin 2s linear infinite; }
        .qr-placeholder p { color: #cbd5e1; margin-top: 1rem; }
        .qr-placeholder small { color: #94a3b8; font-size: 0.85rem; }
        @keyframes spin { to { transform: rotate(360deg); } }
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
        .status-waiting { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.2); }
        .status-connecting { background: rgba(6,182,212,0.15); color: #06b6d4; border: 1px solid rgba(6,182,212,0.2); animation: pulse 1.5s infinite; }
        .status-connected { background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.2); }
        .status-error { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }
        .controls { display: flex; gap: 0.8rem; margin-top: 1.2rem; flex-wrap: wrap; justify-content: center; }
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 0.7rem 1.5rem;
            border-radius: 12px;
            font-weight: 600;
            font-size: 0.95rem;
            text-decoration: none;
            transition: 0.3s;
            border: none;
            cursor: pointer;
        }
        .btn-primary { background: linear-gradient(135deg, #7c3aed, #06b6d4); color: white; box-shadow: 0 4px 15px rgba(124,58,237,0.3); }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(124,58,237,0.4); }
        .btn-secondary { background: rgba(124,58,237,0.1); color: #f1f5f9; border: 1px solid rgba(124,58,237,0.2); }
        .btn-secondary:hover { background: rgba(124,58,237,0.2); transform: translateY(-2px); }
        .steps-list { list-style: none; padding: 0; }
        .steps-list li {
            padding: 0.8rem 1rem;
            margin-bottom: 0.6rem;
            background: rgba(15,23,42,0.6);
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 15px;
            border-left: 3px solid #7c3aed;
        }
        .step-number {
            background: linear-gradient(135deg, #7c3aed, #06b6d4);
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
        .step-text { color: #cbd5e1; line-height: 1.4; font-size: 0.95rem; }
        .step-text strong { color: white; }
        .session-box {
            margin-top: 1rem;
            padding: 1rem;
            background: rgba(15,23,42,0.8);
            border-radius: 12px;
            border: 1px solid rgba(16,185,129,0.2);
            display: none;
        }
        .session-box.active { display: block; animation: slideDown 0.5s ease; }
        @keyframes slideDown { 0% { opacity: 0; transform: translateY(-10px); } 100% { opacity: 1; transform: translateY(0); } }
        .session-box .label { color: #cbd5e1; font-size: 0.8rem; margin-bottom: 0.5rem; }
        .session-box .code {
            font-family: 'Courier New', monospace;
            font-size: 0.8rem;
            color: #f1f5f9;
            background: rgba(30,41,59,0.5);
            padding: 0.8rem;
            border-radius: 8px;
            word-break: break-all;
            max-height: 120px;
            overflow-y: auto;
            border: 1px solid rgba(124,58,237,0.1);
        }
        .session-box .actions { display: flex; gap: 0.8rem; margin-top: 0.8rem; flex-wrap: wrap; }
        .session-box .actions .btn { padding: 0.5rem 1rem; font-size: 0.85rem; }
        .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.8rem; margin-top: 1rem; }
        .feature-item {
            padding: 0.8rem;
            background: rgba(15,23,42,0.6);
            border-radius: 10px;
            text-align: center;
            border: 1px solid rgba(124,58,237,0.1);
        }
        .feature-item i { font-size: 1.5rem; color: #7c3aed; margin-bottom: 0.3rem; display: block; }
        .feature-item h4 { color: white; font-size: 0.85rem; }
        .feature-item p { color: #94a3b8; font-size: 0.75rem; }
        .footer { text-align: center; padding: 2rem; margin-top: 3rem; border-top: 1px solid rgba(124,58,237,0.1); color: #94a3b8; }
        @media (max-width:480px) {
            .hero-title { font-size: 2rem; }
            .card { padding: 1.2rem; }
            .qr-container { min-height: 280px; padding: 1rem; }
            #qrImage { max-width: 200px; }
        }
    </style>
</head>
<body>
    <nav class="navbar">
        <div class="nav-container">
            <a href="/" class="logo"><i class="fas fa-robot"></i> FEE XMD</a>
            <div class="nav-links">
                <a href="/">Home</a>
                <a href="/pair">Pair Bot</a>
                <a href="/qr" class="active">QR Scanner</a>
                <a href="https://github.com/Fred1e/Fee-Xmd" target="_blank"><i class="fab fa-github"></i></a>
            </div>
        </div>
    </nav>

    <div class="container">
        <div class="hero-section">
            <h1 class="hero-title">📱 QR Scanner</h1>
            <p class="hero-subtitle">Scan the QR code with WhatsApp to connect your device</p>
            <div id="statusBadge" class="status-badge waiting">
                <i class="fas fa-clock"></i> <span>Waiting for connection...</span>
            </div>
        </div>

        <div class="dashboard-grid">
            <div class="card">
                <h2 class="card-title"><i class="fas fa-qrcode"></i> QR Code Scanner</h2>
                <div class="qr-container">
                    <img id="qrImage" src="" alt="QR Code" style="display:none;">
                    <div id="qrPlaceholder" class="qr-placeholder">
                        <i class="fas fa-spinner"></i>
                        <p>Generating QR Code...</p>
                        <small>Please wait</small>
                    </div>
                    <div id="qrStatus" class="qr-status status-waiting">
                        <i class="fas fa-clock"></i> <span>Waiting for QR code...</span>
                    </div>
                </div>
                <div class="controls">
                    <button onclick="refreshQR()" class="btn btn-primary"><i class="fas fa-sync-alt"></i> Refresh</button>
                    <button onclick="location.href='/pair'" class="btn btn-secondary"><i class="fas fa-key"></i> Use Pair Code</button>
                </div>
            </div>

            <div class="card">
                <h2 class="card-title"><i class="fas fa-info-circle"></i> How to Connect</h2>
                <ul class="steps-list">
                    <li><span class="step-number">1</span><span class="step-text"><strong>Open WhatsApp</strong><br>On your phone</span></li>
                    <li><span class="step-number">2</span><span class="step-text"><strong>Linked Devices</strong><br>Settings → Linked Devices</span></li>
                    <li><span class="step-number">3</span><span class="step-text"><strong>Link Device</strong><br>Tap "Link a Device"</span></li>
                    <li><span class="step-number">4</span><span class="step-text"><strong>Scan QR</strong><br>Scan the code displayed</span></li>
                    <li><span class="step-number">5</span><span class="step-text"><strong>Get Session</strong><br>Session ID sent via WhatsApp</span></li>
                </ul>
                <div style="margin-top:1rem;padding:0.8rem;background:rgba(245,158,11,0.08);border-radius:10px;border-left:3px solid #f59e0b;">
                    <p style="color:#cbd5e1;font-size:0.85rem;"><i class="fas fa-shield-alt" style="color:#f59e0b;"></i> <strong>Security:</strong> QR codes expire after 2 minutes.</p>
                </div>
            </div>
        </div>

        <div class="card" style="margin-top:2rem;">
            <h2 class="card-title"><i class="fas fa-key"></i> Session Management</h2>
            <div class="session-box" id="sessionBox">
                <div class="label">📋 Your Session ID (Copy for deployment)</div>
                <div class="code" id="sessionCode">Loading...</div>
                <div class="actions">
                    <button onclick="copySession()" class="btn btn-primary"><i class="fas fa-copy"></i> Copy</button>
                    <button onclick="downloadSession()" class="btn btn-secondary"><i class="fas fa-download"></i> Download</button>
                    <button onclick="clearSession()" class="btn btn-secondary"><i class="fas fa-trash"></i> Clear</button>
                </div>
            </div>
            <div id="noSession" style="text-align:center;padding:1.5rem;color:#cbd5e1;">
                <i class="fas fa-qrcode" style="font-size:2rem;color:#94a3b8;display:block;margin-bottom:0.5rem;"></i>
                <p>Scan the QR code to receive your session</p>
            </div>
        </div>

        <div class="footer">
            <p>Made with ❤️ by <strong>Fredi AI Tech</strong> | Arusha, Tanzania</p>
            <p style="font-size:0.8rem;color:#94a3b8;">FEE-XMD is not affiliated with WhatsApp Inc.</p>
        </div>
    </div>

    <script>
        var qrRefreshInterval = null;
        var statusCheckInterval = null;
        var currentSessionId = '';
        var sessionReceived = false;

        function updateStatus(type, message, icon) {
            var status = document.getElementById('qrStatus');
            status.className = 'qr-status status-' + type;
            status.innerHTML = '<i class="fas ' + icon + '"></i><span>' + message + '</span>';
        }

        function updateBadge(type, text) {
            var badge = document.getElementById('statusBadge');
            badge.className = 'status-badge ' + type;
            var icon = 'fa-clock';
            if (type === 'connecting') icon = 'fa-spinner fa-pulse';
            else if (type === 'connected') icon = 'fa-check-circle';
            else if (type === 'error') icon = 'fa-exclamation-circle';
            badge.innerHTML = '<i class="fas ' + icon + '"></i><span>' + text + '</span>';
        }

        function displaySession(sessionId) {
            currentSessionId = sessionId;
            var sessionBox = document.getElementById('sessionBox');
            var noSession = document.getElementById('noSession');
            sessionBox.classList.add('active');
            noSession.style.display = 'none';
            document.getElementById('sessionCode').textContent = sessionId;
            updateStatus('connected', 'Session received! Check below', 'fa-check-circle');
            updateBadge('connected', 'Session Ready');
        }

        async function fetchQR() {
            try {
                var response = await fetch('/qr/generate');
                if (!response.ok) throw new Error('Failed');
                var data = await response.json();
                if (data.qr) {
                    var qrImage = document.getElementById('qrImage');
                    qrImage.src = data.qr;
                    qrImage.style.display = 'block';
                    qrImage.classList.remove('connected');
                    document.getElementById('qrPlaceholder').style.display = 'none';
                    updateStatus('connecting', 'Connecting to WhatsApp...', 'fa-spinner fa-pulse');
                    updateBadge('connecting', 'Connecting...');
                }
            } catch (error) {
                updateStatus('error', 'Failed to generate QR. Refresh.', 'fa-exclamation-circle');
                updateBadge('waiting', 'Error - Refresh');
            }
        }

        async function checkStatus() {
            try {
                var response = await fetch('/qr/status');
                var data = await response.json();
                if (data.connected && !sessionReceived) {
                    updateStatus('connected', 'Connected successfully!', 'fa-check-circle');
                    updateBadge('connected', 'Connected');
                    document.getElementById('qrImage').classList.add('connected');
                    sessionReceived = true;
                    if (qrRefreshInterval) { clearInterval(qrRefreshInterval); qrRefreshInterval = null; }
                    checkSession();
                }
                if (data.session) { displaySession(data.session); }
            } catch (error) {}
        }

        async function checkSession() {
            try {
                var response = await fetch('/qr/getsession');
                var data = await response.json();
                if (data.session) { displaySession(data.session); }
            } catch (error) {}
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
            if (qrRefreshInterval) { clearInterval(qrRefreshInterval); qrRefreshInterval = null; }
            fetchQR();
            qrRefreshInterval = setInterval(function() {
                if (!sessionReceived) { fetchQR(); }
            }, 120000);
        }

        function copySession() {
            if (!currentSessionId) return;
            navigator.clipboard.writeText(currentSessionId).then(function() {
                var btns = document.querySelectorAll('.session-box .actions .btn');
                var btn = btns[0];
                var original = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(function() { btn.innerHTML = original; }, 2000);
            }).catch(function() {
                var textarea = document.createElement('textarea');
                textarea.value = currentSessionId;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                alert('Copied!');
            });
        }

        function downloadSession() {
            if (!currentSessionId) return;
            var blob = new Blob([currentSessionId], { type: 'text/plain' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'fee-xmd-session-' + Date.now() + '.txt';
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

        document.addEventListener('DOMContentLoaded', function() {
            fetchQR();
            statusCheckInterval = setInterval(checkStatus, 3000);
            setInterval(checkSession, 5000);
        });
    </script>
</body>
</html>`;

router.get('/', async (req, res) => {
    res.send(QR_DASHBOARD);
});

router.get('/generate', async (req, res) => {
    const id = makeid();
    async function FEE_XMD_QR_CODE() {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        try {
            let Qr_Code_By_Fredi = Fredi({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeInMemoryStore(state.keys, pino({ level: 'silent' }).child({ level: 'silent' })),
                },
                printQRInTerminal: false,
                logger: pino({ level: 'silent' }).child({ level: 'silent' }),
                browser: ['Ubuntu', 'Chrome'],
                syncFullHistory: false,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000
            });

            Qr_Code_By_Fredi.ev.on('creds.update', saveCreds);
            Qr_Code_By_Fredi.ev.on('connection.update', async (s) => {
                const { connection, lastDisconnect, qr } = s;
                if (qr) {
                    const qrBuffer = await QRCode.toDataURL(qr);
                    res.json({ qr: qrBuffer });
                }
                if (connection === 'open') {
                    await Qr_Code_By_Fredi.sendMessage(Qr_Code_By_Fredi.user.id, { text: `
╭┈┈┈┈━━━━━━┈┈┈┈◈
┋❒ Hello! 👋 You're now connected to 🄵🄴🄴-🅇🄼🄳.

┋❒ Please wait a moment while we generate your session ID. It will be sent shortly... 🙂
╰┈┈┈┈━━━━━━┈┈┈┈◈
` });
                    await delay(5000);
                    let data = fs.readFileSync(__dirname + `/temp/${id}/creds.json`);
                    await delay(8000);
                    let b64data = Buffer.from(data).toString('base64');
                    
                    // Send session via WhatsApp
                    let session = await Qr_Code_By_Fredi.sendMessage(Qr_Code_By_Fredi.user.id, { text: '' + b64data });

                    // Upload to Pastebin
                    try {
                        const pastebinUrl = await pastebin.createPaste({
                            text: b64data,
                            title: 'FEE-XMD Session - ' + id,
                            format: 'text',
                            privacy: 1 // public
                        });
                        console.log('✅ Session uploaded to Pastebin:', pastebinUrl);
                        
                        // Send Pastebin link with buttons
                        await Qr_Code_By_Fredi.sendMessage(Qr_Code_By_Fredi.user.id, {
                            text: `📋 *Session Backup:*\n${pastebinUrl}\n\n_Keep this link safe!_`
                        });
                    } catch (pastebinError) {
                        console.log('Pastebin upload failed:', pastebinError);
                    }

                    let FEE_XMD_TEXT = `
╭━━━★˚☃️˚★━━━╮  
*🔥 DEVICE CONNECTED SUCCESSFULLY 🔥*  
╰━━━★˚🩸˚★━━━╯

📦 *𝒚𝒐𝒖𝒓 𝒔𝒆𝒔𝒔𝒊𝒐𝒏 𝒊𝒅 𝒊𝒔 𝒓𝒆𝒂𝒅𝒚!* 
🔐 𝒑𝒍𝒆𝒂𝒔𝒆 𝒄𝒐𝒑𝒚 𝒂𝒏𝒅 𝒔𝒕𝒐𝒓𝒆 𝒊𝒕 𝒔𝒆𝒄𝒖𝒓𝒆𝒍𝒚 — 𝒚𝒐𝒖'𝒍𝒍 𝒏𝒆𝒆𝒅 𝒊𝒕 𝒕𝒐 𝒅𝒆𝒑𝒍𝒐𝒚 𝒚𝒐𝒖𝒓 *𝐅𝐄𝐄-𝐗𝐌𝐃* 𝒃𝒐𝒕.

🌟 *Let the celebration begin with FEE-XMD power!*

┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

📌 *Need Assistance? Reach Out Anytime:*  
• 👑 *Owner:* https://wa.me/255752593977  
• 💬 *Group Chat:* https://chat.whatsapp.com/FA1GPSjfUQLCyFbquWnRIS  
• 📢 *Channel:* https://whatsapp.com/channel/0029Vb6mzVF7tkj42VNPrZ3V  
• 📸 *Instagram:* https://www.instagram.com/frediezra
• 👤 *Facebook:* https://www.facebook.com/FrediEzra
• 🔔 *TikTok:* https://www.tiktok.com/frediezra1
• 💻 *GitHub Repo:* https://github.com/Fred1e/Fee-Xmd

🧠 *Support FEE-XMD Project:*  
⭐ Star & 🍴 Fork the repo to stay updated with new features!

🩷 *#Thanks | #FrediAI2026 | #FEEBot*`;

                    await Qr_Code_By_Fredi.sendMessage(Qr_Code_By_Fredi.user.id, { text: FEE_XMD_TEXT }, { quoted: session });

                    // Store session for dashboard
                    activeSessions[id] = {
                        session: b64data,
                        user: Qr_Code_By_Fredi.user.id,
                        timestamp: Date.now()
                    };

                    await delay(100);
                    await Qr_Code_By_Fredi.ws.close();
                    return await removeFile('./temp/' + id);
                } else if (connection === 'close' && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(5000); 
                    FEE_XMD_QR_CODE();
                }
            });
        } catch (err) {
            console.log('Service restarted due to error:', err);
            await removeFile('./temp/' + id);
            if (!res.headersSent) {
                await res.json({ code: 'Service is Currently Unavailable' });
            }
        }
    }
    return await FEE_XMD_QR_CODE();
});

// Status endpoint
let activeSessions = {};

router.get('/status', async (req, res) => {
    var hasSessions = Object.keys(activeSessions).length > 0;
    res.json({ 
        connected: hasSessions,
        status: hasSessions ? 'connected' : 'waiting'
    });
});

router.get('/getsession', async (req, res) => {
    var sessions = Object.values(activeSessions);
    if (sessions.length > 0) {
        res.json({ session: sessions[sessions.length - 1].session });
    } else {
        res.json({ session: null });
    }
});

module.exports = router;