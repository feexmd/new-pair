// pair.js - Updated with new Baileys
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
    proto,
    generateWAMessageFromContent,
    generateWAMessageContent,
    prepareWAMessageMedia,
    getDevice,
    downloadMediaMessage,
    getAggregateVotesInPollMessage,
    getContentType
} = require('@whiskeysockets/baileys');

const router = express.Router();
const sessionDir = path.join(__dirname, "temp");

function removeFile(filePath) {
    if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { recursive: true, force: true });
    }
}

function generateButtonsMessage(text, buttons) {
    const rows = buttons.map((btn, index) => ({
        id: btn.id || `btn_${index}`,
        title: btn.title,
        description: btn.description || ''
    }));

    return {
        text: text,
        buttons: [
            {
                buttonId: 'copy_session',
                buttonText: { displayText: '📋 Copy Session' },
                type: 1
            },
            {
                buttonId: 'share_session',
                buttonText: { displayText: '📤 Share Session' },
                type: 1
            },
            {
                buttonId: 'open_github',
                buttonText: { displayText: '🔗 Open Repository' },
                type: 1
            }
        ],
        headerType: 1
    };
}

router.get('/', async (req, res) => {
    const id = makeid();
    const num = (req.query.number || '').replace(/[^0-9]/g, '');
    const tempDir = path.join(sessionDir, id);
    let responseSent = false;
    let sessionCleanedUp = false;

    async function cleanUpSession() {
        if (!sessionCleanedUp) {
            try {
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

            if (!sock.authState.creds.registered) {
                await delay(1500);
                const code = await sock.requestPairingCode(num);
                if (!responseSent && !res.headersSent) {
                    res.json({ code: code });
                    responseSent = true;
                }
            }

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === 'open') {
                    console.log('✅ FEE-XMD successfully connected to WhatsApp.');

                    // Welcome message with buttons
                    const welcomeText = `
╭━━━━━━━━━━━━━━━━━━━━━╮
┃   🚀 *FEE-XMD BOT*   ┃
╰━━━━━━━━━━━━━━━━━━━━━╯

👋 *Hello! Welcome to FEE-XMD!*

🤖 I'm your powerful WhatsApp bot assistant with:
• 200+ Commands
• Media Downloaders
• AI Chat (GPT-4)
• Games & Tools
• Group Management

⏳ *Generating your session ID...*
Please wait a moment...

_✨ Created by Fredi AI Tech_
`;

                    await sock.sendMessage(sock.user.id, {
                        text: welcomeText,
                        buttons: [
                            {
                                buttonId: 'get_started',
                                buttonText: { displayText: '🚀 Get Started' },
                                type: 1
                            },
                            {
                                buttonId: 'view_commands',
                                buttonText: { displayText: '📋 Commands' },
                                type: 1
                            }
                        ],
                        headerType: 1
                    });

                    await delay(8000);

                    const credsPath = path.join(tempDir, "creds.json");
                    let sessionData = null;
                    let attempts = 0;
                    const maxAttempts = 15;

                    while (attempts < maxAttempts && !sessionData) {
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
                        } catch (readError) {
                            await delay(2000);
                            attempts++;
                        }
                    }

                    if (!sessionData) {
                        await sock.sendMessage(sock.user.id, {
                            text: '❌ Failed to generate session. Please try again.'
                        });
                        await cleanUpSession();
                        sock.ws.close();
                        return;
                    }

                    const base64 = Buffer.from(sessionData).toString('base64');

                    // Send session with interactive buttons
                    const sessionMessageText = `
╭━━━━━━━━━━━━━━━━━━━━━╮
┃   🔐 *SESSION READY*   ┃
╰━━━━━━━━━━━━━━━━━━━━━╯

📦 *Your session ID has been generated!*

⚠️ *Important:*
• Copy and save this session ID
• It's needed to deploy your bot
• One-time use only
• Valid for 5 minutes

━━━━━━━━━━━━━━━━━━━━━
*Session ID:*
\`${base64.substring(0, 50)}...\`
━━━━━━━━━━━━━━━━━━━━━

📌 *Quick Actions:*
`;

                    const sessionButtons = [
                        {
                            buttonId: 'copy_session',
                            buttonText: { displayText: '📋 Copy Session' },
                            type: 1
                        },
                        {
                            buttonId: 'share_session',
                            buttonText: { displayText: '📤 Share Session' },
                            type: 1
                        }
                    ];

                    await sock.sendMessage(sock.user.id, {
                        text: sessionMessageText,
                        buttons: sessionButtons,
                        headerType: 1
                    });

                    // Send full session as separate message
                    await sock.sendMessage(sock.user.id, {
                        text: `\`\`\`${base64}\`\`\``,
                        buttons: [
                            {
                                buttonId: 'copy_full',
                                buttonText: { displayText: '📋 Copy Full Session' },
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

                    await delay(2000);

                    // Send info message with links
                    const infoText = `
╭━━━━━━━━━━━━━━━━━━━━━╮
┃   🌟 *DEPLOYMENT INFO*   ┃
╰━━━━━━━━━━━━━━━━━━━━━╯

📌 *Need Help?*
• 👑 Owner: wa.me/255752593977
• 💬 Group: https://chat.whatsapp.com/FA1GPSjfUQLCyFbquWnRIS
• 📢 Channel: https://whatsapp.com/channel/0029Vb6mzVF7tkj42VNPrZ3V
• 📸 Instagram: @frediezra
• 💻 GitHub: https://github.com/Fred1e/Fee-Xmd

🧠 *Support FEE-XMD:*
⭐ Star & 🍴 Fork the repo!

🩷 #Thanks | #FrediAI2026 | #FEEBot
`;

                    await sock.sendMessage(sock.user.id, {
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

                    await delay(3000);
                    sock.ws.close();
                    await cleanUpSession();

                } else if (connection === "close") {
                    if (lastDisconnect?.error?.output?.statusCode !== 401) {
                        console.log('⚠️ Connection closed, reconnecting...');
                        await delay(10000);
                        startPairing();
                    } else {
                        console.log('❌ Connection closed permanently');
                        await cleanUpSession();
                    }
                }
            });

            sock.ev.on('messages.upsert', async (m) => {
                const msg = m.messages[0];
                if (msg.key && msg.key.fromMe) return;
                if (!msg.message) return;

                const messageType = getContentType(msg.message);
                if (messageType === 'buttonsResponseMessage') {
                    const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
                    const sender = msg.key.remoteJid;

                    if (buttonId === 'copy_session') {
                        await sock.sendMessage(sender, { text: '📋 *Session copied to clipboard!*\n\n_Note: The session is also available above._' });
                    } else if (buttonId === 'share_session') {
                        await sock.sendMessage(sender, { text: '📤 *Share this session with your deployment platform*\n\n_Keep it secure!_ 📱' });
                    } else if (buttonId === 'open_github') {
                        await sock.sendMessage(sender, { text: '🔗 *GitHub Repository*\n\nhttps://github.com/Fred1e/Fee-Xmd\n\n⭐ Star & 🍴 Fork to support!' });
                    } else if (buttonId === 'join_group') {
                        await sock.sendMessage(sender, { text: '👥 *Join Our Community*\n\nhttps://chat.whatsapp.com/FA1GPSjfUQLCyFbquWnRIS' });
                    } else if (buttonId === 'get_started') {
                        await sock.sendMessage(sender, { text: '🚀 *Getting Started*\n\n1. Your session will be generated\n2. Copy the session ID\n3. Deploy on your platform\n4. Enjoy FEE-XMD!' });
                    } else if (buttonId === 'view_commands') {
                        await sock.sendMessage(sender, { text: '📋 *Available Commands*\n\n• !help - Show all commands\n• !menu - Main menu\n• !status - Bot status\n• !ping - Check latency\n• !download - Download media\n• !ai - AI chat\n• + 200+ more commands!' });
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
        }, 180000);
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

module.exports = router;