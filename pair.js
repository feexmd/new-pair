// pair.js - With Pastebin integration
const PastebinAPI = require('pastebin-js');
const pastebin = new PastebinAPI('EMWTMkQAVfJa9kM-MRUrxd5Oku1U7pgL');
const express = require('express');
const fs = require('fs');
const path = require('path');
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
const sessionDir = path.join(__dirname, "temp");
let activeSessions = {};

function removeFile(filePath) {
    if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { recursive: true, force: true });
    }
}

router.get('/', async (req, res) => {
    const id = makeid();
    const num = (req.query.number || '').replace(/[^0-9]/g, '');
    const tempDir = path.join(sessionDir, id);
    let responseSent = false;
    let sessionCleanedUp = false;
    let sessionIdSent = false;
    let sockInstance = null;

    async function cleanUpSession() {
        if (!sessionCleanedUp) {
            try {
                if (sockInstance) {
                    try {
                        await sockInstance.ws.close();
                    } catch (e) {}
                }
                removeFile(tempDir);
            } catch (cleanupError) {
                console.error("Cleanup error:", cleanupError);
            }
            sessionCleanedUp = true;
        }
    }

    async function startPairing() {
        try {
            const { version } = await fetchLatestBaileysVersion();
            const { state, saveCreds } = await useMultiFileAuthState(tempDir);

            sockInstance = Fredi({
                version,
                logger: pino({ level: 'silent' }).child({ level: 'silent' }),
                printQRInTerminal: false,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }).child({ level: 'silent' })),
                },
                browser: Browsers.ubuntu('Chrome', '125'),
                syncFullHistory: false,
                generateHighQualityLinkPreview: true,
                shouldIgnoreJid: jid => !!jid?.endsWith('@g.us'),
                getMessage: async () => undefined,
                markOnlineOnConnect: true,
                connectTimeoutMs: 120000,
                keepAliveIntervalMs: 30000,
                emitOwnEvents: true,
                fireInitQueries: true,
                defaultQueryTimeoutMs: 60000
            });

            // Generate pairing code
            if (!sockInstance.authState.creds.registered) {
                await delay(1500);
                const code = await sockInstance.requestPairingCode(num);
                if (!responseSent && !res.headersSent) {
                    res.json({ code: code });
                    responseSent = true;
                }
            }

            sockInstance.ev.on('creds.update', saveCreds);

            sockInstance.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === 'open') {
                    console.log('✅ FEE-XMD connected to WhatsApp.');
                    const userJid = sockInstance.user.id;
                    console.log('📱 Connected as:', userJid);

                    // Send welcome message
                    await sockInstance.sendMessage(userJid, { text: `
╭┈┈┈┈━━━━━━┈┈┈┈◈
┋❒ Hello! 👋 You're now connected to 🄵🄴🄴-🅇🄼🄳.

┋❒ Please wait a moment while we generate your session ID. It will be sent shortly... 🙂
╰┈┈┈┈━━━━━━┈┈┈┈◈
` });

                    await delay(5000);

                    // Read session from file
                    const credsPath = path.join(tempDir, "creds.json");
                    let sessionData = null;
                    let attempts = 0;
                    const maxAttempts = 20;

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
                            console.log(`⏳ Attempt ${attempts + 1}/${maxAttempts}...`);
                        } catch (readError) {
                            console.error('Read attempt error:', readError);
                            await delay(2000);
                            attempts++;
                        }
                    }

                    if (!sessionData) {
                        console.error('❌ Failed to read session data');
                        await sockInstance.sendMessage(userJid, {
                            text: '❌ Failed to generate session. Please try again.'
                        });
                        await cleanUpSession();
                        return;
                    }

                    // Generate base64 session
                    const base64Session = Buffer.from(sessionData).toString('base64');
                    console.log('✅ Session generated, length:', base64Session.length);

                    // Send session via WhatsApp
                    let session = await sockInstance.sendMessage(userJid, { text: '' + base64Session });

                    // Upload to Pastebin
                    try {
                        const pastebinUrl = await pastebin.createPaste({
                            text: base64Session,
                            title: 'FEE-XMD Session - ' + id,
                            format: 'text',
                            privacy: 1 // public
                        });
                        console.log('✅ Session uploaded to Pastebin:', pastebinUrl);
                        
                        await sockInstance.sendMessage(userJid, {
                            text: `📋 *Session Backup:*\n${pastebinUrl}\n\n_Keep this link safe!_`
                        });
                    } catch (pastebinError) {
                        console.log('Pastebin upload failed:', pastebinError);
                    }

                    // Store session for dashboard
                    activeSessions[id] = {
                        session: base64Session,
                        user: userJid,
                        timestamp: Date.now()
                    };

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

                    await sockInstance.sendMessage(userJid, { text: FEE_XMD_TEXT }, { quoted: session });
                    sessionIdSent = true;

                    await delay(3000);
                    await cleanUpSession();

                } else if (connection === "close") {
                    if (lastDisconnect?.error?.output?.statusCode !== 401) {
                        console.log('⚠️ Connection closed, reconnecting...');
                        await delay(10000);
                        if (!sessionIdSent) {
                            startPairing();
                        }
                    } else {
                        console.log('❌ Connection closed permanently');
                        await cleanUpSession();
                    }
                }
            });

        } catch (err) {
            console.error('❌ Error during pairing:', err);
            await cleanUpSession();
            if (!responseSent && !res.headersSent) {
                res.status(500).json({ code: 'Service Unavailable. Please try again.' });
                responseSent = true;
            }
        }
    }

    if (!num || num.length < 10) {
        if (!res.headersSent) {
            res.status(400).json({ error: 'Invalid phone number. Please provide a valid number.' });
        }
        return;
    }

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error("Pairing process timeout"));
        }, 300000);
    });

    try {
        await Promise.race([startPairing(), timeoutPromise]);
    } catch (finalError) {
        console.error("Final error:", finalError);
        await cleanUpSession();
        if (!responseSent && !res.headersSent) {
            res.status(500).json({ code: "Service Error - Timeout" });
        }
    }
});

// Status endpoint for dashboard
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