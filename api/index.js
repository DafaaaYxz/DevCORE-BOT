const { Telegraf, Markup } = require('telegraf');
const config = require('../settings');
const db = require('../lib/database');
const { chatAI } = require('../lib/ai');

const bot = new Telegraf(config.botToken);

// Middleware Cek User
bot.use(async (ctx, next) => {
    if (!ctx.from) return;
    let user = await db.getUser(ctx.from.id);
    if (ctx.from.id === config.ownerId) user.role = 'owner';
    ctx.state.user = user;
    return next();
});

// Menu Generator
const getMenu = (role) => {
    const buttons = [
        [Markup.button.callback('📊 Info Sistem', 'info'), Markup.button.callback('👤 Owner', 'owner_info')],
        [Markup.button.callback('🎟️ Upload Token VIP', 'upload_token')]
    ];
    if (role === 'owner') {
        buttons.unshift([Markup.button.callback('➕ API Key', 'add_key'), Markup.button.callback('📜 List Keys', 'list_keys')]);
        buttons.push([Markup.button.callback('👥 List User VIP', 'list_vip')]);
    }
    return Markup.inlineKeyboard(buttons);
};

// Commands
bot.start((ctx) => {
    ctx.reply(`Halo ${ctx.from.first_name}! Selamat datang di bot AI.`, getMenu(ctx.state.user.role));
});

// Handling VIP Token Upload
bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const user = ctx.state.user;

    // Logic: Input Token
    if (text.startsWith('TOKEN-')) {
        const tokenData = await db.getToken(text);
        if (tokenData) {
            user.role = 'vip';
            user.aiName = tokenData.aiName;
            user.ownerName = tokenData.ownerName;
            await db.setUser(ctx.from.id, user);
            await db.delToken(text);
            return ctx.reply(`✅ Berhasil! Sekarang kamu VIP.\nAI Name: ${user.aiName}\nOwner: ${user.ownerName}`);
        } else {
            return ctx.reply("❌ Token tidak valid atau sudah kadaluarsa.");
        }
    }

    // AI Chat Logic
    if (!text.startsWith('/')) {
        ctx.sendChatAction('typing');
        const response = await chatAI(text, user);
        
        // Update stats
        user.chatCount = (user.chatCount || 0) + 1;
        await db.setUser(ctx.from.id, user);

        // Extract Code Block
        const codeMatch = response.match(/```([\s\S]*?)```/);
        if (codeMatch) {
            const code = codeMatch[1];
            await ctx.replyWithDocument({ source: Buffer.from(code), filename: 'code.txt' }, { caption: response.slice(0, 100) + "..." });
        } else {
            await ctx.reply(response);
        }
    }
});

// OWNER ONLY COMMANDS
bot.command('adduser', async (ctx) => {
    if (ctx.state.user.role !== 'owner') return;
    const args = ctx.message.text.split(' '); // /adduser AI_NAME OWNER_NAME
    if (args.length < 3) return ctx.reply("Gunakan format: /adduser [NamaAI] [NamaOwner]");
    
    const token = `TOKEN-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    await db.saveToken(token, { aiName: args[1], ownerName: args[2] });
    ctx.reply(`✅ Token Berhasil Dibuat:\n\n\`${token}\`\n\nKirim token ini ke user.`, { parse_mode: 'Markdown' });
});

// Handling Buttons (Actions)
bot.action('info', async (ctx) => {
    const u = ctx.state.user;
    ctx.reply(`📊 INFO KAMU:\nID: ${u.id}\nStatus: ${u.role.toUpperCase()}\nChat Count: ${u.chatCount}\nAI: ${u.aiName || config.defaultAiName}`);
});

bot.action('owner_info', async (ctx) => {
    const u = ctx.state.user;
    const owner = u.role === 'vip' ? u.ownerName : config.defaultOwnerName;
    ctx.reply(`👤 Owner bot ini adalah: ${owner}`);
});

bot.action('add_key', (ctx) => {
    if (ctx.state.user.role !== 'owner') return;
    ctx.reply("Kirimkan API Key OpenRouter baru dengan format: `key:sk-or-xxxx`", { parse_mode: 'Markdown' });
});

bot.on('text', async (ctx, next) => {
    if (ctx.message.text.startsWith('key:') && ctx.from.id === config.ownerId) {
        const key = ctx.message.text.split('key:')[1].trim();
        await db.addKey(key);
        return ctx.reply("✅ API Key berhasil ditambahkan ke pool.");
    }
    return next();
});

// Webhook Export for Vercel
module.exports = async (req, res) => {
    try {
        if (req.method === 'POST') {
            await bot.handleUpdate(req.body);
        }
        res.status(200).send('OK');
    } catch (e) {
        console.error(e);
        res.status(500).send('Error');
    }
};
