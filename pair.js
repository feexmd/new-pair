// pair.js - Updated with full session ID generation
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
    getContentType,
    proto,
    generateWAMessageFromContent,
    prepareWAMessageMedia
} = require('@whiskeysockets/baileys');

const router = express.Router();
const sessionDir = path.join(__dirname, "temp");

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

function formatWelcomeMessage() {
    return `
╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃   🚀 *FEE-XMD BOT ACTIVE*     ┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

👋 *Hello! Welcome to FEE-XMD!*

🤖 I'm your powerful WhatsApp bot assistant with:
• 200+ Commands
• Media Downloaders (50+ platforms)
• AI Chat (GPT-4, Gemini, Claude)
• Games & Entertainment
• Group Management
• Utility Tools

⏳ *Generating your secure session ID...*
Please wait a moment...

_✨ Created with ❤️ by Fredi AI Tech_
`;
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

    // Function to send session with buttons
    async function sendSessionWithButtons(sock, sessionId, userJid) {
        try {
            // Send main session message with buttons
            const sessionMessage = formatSessionMessage(sessionId);
            
            // Send session ID as text with buttons
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

            // Send full session in code block for easy copying
            await sock.sendMessage(userJid, {
                text: `📋 *Full Session ID:*\n\n\`\`\`${sessionId}\`\`\``,
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

            // Send info message with links
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

🩷 *#Thanks | #FrediAI2026 | #FEEBot*
`;

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
                    },
                    {
                        buttonId: 'contact_owner',
                        buttonText: { displayText: '👑 Contact Owner' },
                        type: 1
                    }
                ],
                headerType: 1
            });

            sessionIdSent = true;
            console.log('✅ Session ID sent successfully to:', userJid);

        } catch (error) {
            console.error('Error sending session:', error);
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

            // Handle connection updates
            sockInstance.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === 'open') {
                    console.log('✅ FEE-XMD connected to WhatsApp.');
                    
                    const userJid = sockInstance.user.id;
                    console.log('📱 Connected as:', userJid);

                    // Send welcome message with buttons
                    await sockInstance.sendMessage(userJid, {
                        text: formatWelcomeMessage(),
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

                    // Wait for session to be saved
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

                    // Generate base64 session ID
                    const base64Session = Buffer.from(sessionData).toString('base64');
                    console.log('✅ Session generated, length:', base64Session.length);

                    // Send session with interactive buttons
                    await sendSessionWithButtons(sockInstance, base64Session, userJid);

                    // Clean up after sending
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

            // Handle button clicks
            sockInstance.ev.on('messages.upsert', async (m) => {
                try {
                    const msg = m.messages[0];
                    if (!msg.key || msg.key.fromMe) return;
                    if (!msg.message) return;

                    const messageType = getContentType(msg.message);
                    const sender = msg.key.remoteJid;

                    if (messageType === 'buttonsResponseMessage') {
                        const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
                        console.log('🔘 Button clicked:', buttonId, 'from:', sender);

                        switch(buttonId) {
                            case 'copy_session':
                            case 'copy_full':
                                await sockInstance.sendMessage(sender, {
                                    text: '📋 *Session copied to clipboard!*\n\n_You can paste it in your deployment settings._'
                                });
                                break;

                            case 'share_session':
                                await sockInstance.sendMessage(sender, {
                                    text: '📤 *Share this session*\n\n_Please keep it secure and don\'t share with anyone you don\'t trust._'
                                });
                                break;

                            case 'deploy_guide':
                                await sockInstance.sendMessage(sender, {
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
                                await sockInstance.sendMessage(sender, {
                                    text: '🔗 *FEE-XMD Repository*\n\nhttps://github.com/Fred1e/Fee-Xmd\n\n⭐ Star & 🍴 Fork to support!'
                                });
                                break;

                            case 'join_group':
                                await sockInstance.sendMessage(sender, {
                                    text: '👥 *Join Our Community*\n\nhttps://chat.whatsapp.com/FA1GPSjfUQLCyFbquWnRIS'
                                });
                                break;

                            case 'contact_owner':
                                await sockInstance.sendMessage(sender, {
                                    text: '👑 *Contact Owner*\n\nhttps://wa.me/255752593977\n\n_For support, inquiries, or collaboration_'
                                });
                                break;

                            case 'get_started':
                                await sockInstance.sendMessage(sender, {
                                    text: `🚀 *Getting Started with FEE-XMD*

1. Your session ID has been sent above
2. Copy and save it securely
3. Deploy on your preferred platform
4. Use commands like !help, !menu

✨ *Happy Botting!*`
                                });
                                break;

                            case 'view_commands':
                                await sockInstance.sendMessage(sender, {
                                    text: `📋 *Command Categories*

🎯 *Downloaders*
!yt, !ig, !tt, !fb, !tw

🤖 *AI Chat*
!ai, !gpt, !gemini

🎮 *Games*
!trivia, !puzzle, !rpg

🔧 *Utilities*
!weather, !news, !calc

👥 *Group*
!welcome, !mod, !ban

📚 *Education*
!dict, !translate, !math

*Use !help for full list*`
                                });
                                break;

                            default:
                                console.log('Unknown button:', buttonId);
                        }
                    }

                    // Handle text commands
                    if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
                        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                        const lowerText = text.toLowerCase().trim();

                        if (lowerText === '!session' || lowerText === '!getsession') {
                            // Resend session if requested
                            const credsPath = path.join(tempDir, "creds.json");
                            if (fs.existsSync(credsPath)) {
                                const data = fs.readFileSync(credsPath);
                                const base64Session = Buffer.from(data).toString('base64');
                                await sendSessionWithButtons(sockInstance, base64Session, sender);
                            } else {
                                await sockInstance.sendMessage(sender, {
                                    text: '❌ No active session found. Please re-pair your device.'
                                });
                            }
                        }
                    }

                } catch (error) {
                    console.error('Message handler error:', error);
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

    // Validate phone number
    if (!num || num.length < 10) {
        if (!res.headersSent) {
            res.status(400).json({ error: 'Invalid phone number. Please provide a valid number.' });
        }
        return;
    }

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error("Pairing process timeout"));
        }, 300000); // 5 minutes timeout
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