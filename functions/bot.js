///////////////////////////////////////////////
// Copyright (C) t.me/Result69
// Channel: https://t.me/noresult6999
///////////////////////////////////////////////

import { TELEGRAM_BOT_TOKEN_ENV, D1_BINDING_NAME, ADMIN_IDS } from './config.js';

function generateRandomKey() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "SN";
    for (let i = 0; i < 3; i++) {
        result += "-";
        for (let j = 0; j < 4; j++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    }
    return result;
}

// ခလုတ်တွေပါ ပို့လို့ရအောင် reply_markup ကို ထပ်တိုးထားပါတယ်
async function sendTelegramMsg(token, chatId, text, reply_markup = null) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = { chat_id: chatId, text: text, parse_mode: "Markdown" };
    if (reply_markup) payload.reply_markup = reply_markup;
    
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    return await res.json();
}

async function editTelegramMsg(token, chatId, messageId, text) {
    const url = `https://api.telegram.org/bot${token}/editMessageText`;
    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: text,
            parse_mode: "Markdown"
        })
    });
}

export async function handleUpdate(update, env, request) {
    const token = env[TELEGRAM_BOT_TOKEN_ENV];
    const db = env[D1_BINDING_NAME];

    let chatId, text;

    // ခလုတ်နှိပ်တဲ့ (Callback Query) နဲ့ စာရိုက်တဲ့ (Message) ၂ မျိုးလုံးကို ဖမ်းပေးမယ့်အပိုင်း
    if (update.callback_query) {
        chatId = update.callback_query.message.chat.id;
        text = update.callback_query.data;
        // Loading လည်နေတာ ရပ်အောင် Callback ကို Answer ပြန်ပေးခြင်း
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: update.callback_query.id })
        });
    } else if (update.message && update.message.text) {
        chatId = update.message.chat.id;
        text = update.message.text.trim();
    } else {
        return;
    }

    const parts = text.split(/\s+/);
    const command = parts[0];
    const isAdmin = ADMIN_IDS.includes(chatId);
    
    if (command === "/start") {
        if (isAdmin) {
            // Admin အတွက် အလန်းစား ခလုတ်များ
            const welcomeText = "👋 *Welcome Admin to SN Tulip Vpn!*\n\n" +
                "This bot manages hardware-bound license keys for your users.\n\n" +
                "⚡ *Available Commands:*\n" +
                "• `/genkey <HWID> <Days>d` - Bind new key\n" +
                "• `/upkey <HWID> <Days>d` - Extend license\n" +
                "• `/delkey <HWID>` - Delete license\n" +
                "• `/search <HWID>` - Find specific key\n\n" +
                `👤 *Your Admin ID:* \`${chatId}\``;

            const keyboard = {
                inline_keyboard: [
                    [{ text: "📊 View All Licenses", callback_data: "/list" }],
                    [
                        { text: "🔑 Add Key", switch_inline_query_current_chat: "/genkey " }, 
                        { text: "🔍 Search", switch_inline_query_current_chat: "/search " }
                    ]
                ]
            };
            return await sendTelegramMsg(token, chatId, welcomeText, keyboard);
        } else {
            // သာမန် User / Customer များအတွက် Welcome Message နဲ့ ခလုတ်
            const welcomeText = "🌷 *Welcome to SN Tulip Vpn!*\n\n" +
                "You can easily check your premium VPN key validity here.\n\n" +
                "To check your remaining days, click the button below or type:\n`/check <Your_HWID>`\n\n" +
                `👤 *Your Telegram ID:* \`${chatId}\``;

            const keyboard = {
                inline_keyboard: [
                    [{ text: "🔍 Check My License Status", switch_inline_query_current_chat: "/check " }]
                ]
            };
            return await sendTelegramMsg(token, chatId, welcomeText, keyboard);
        }
    }

    // Customer များ ကိုယ်တိုင် သက်တမ်းစစ်ရန် Feature (Admin ဖြစ်စရာမလိုပါ)
    if (command === "/check") {
        if (parts.length < 2) {
            return await sendTelegramMsg(token, chatId, "❌ *Usage:* `/check <Your_HWID>`");
        }
        
        const hwid = parts[1];
        const row = await db.prepare("SELECT * FROM licenses WHERE hwid = ?").bind(hwid).first();
        
        if (!row) {
            return await sendTelegramMsg(token, chatId, `❌ *Error:* We couldn't find a VPN key for this device. Please contact Admin to purchase a new key.`);
        }
        
        const expireDateStr = new Date(row.expire_date).toISOString().split('T')[0];
        const isExpired = Date.now() > row.expire_date;
        
        let reply;
        if (isExpired) {
            reply = `🔴 *License Expired!*\n\nYour VPN key for device \`${hwid}\` expired on \`${expireDateStr}\`. Please renew your key to continue using the servers.`;
        } else {
            const remainingMs = row.expire_date - Date.now();
            const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
            reply = `🟢 *Active License Found!*\n\n📱 *HWID:* \`${hwid}\`\n📅 *Valid Until:* \`${expireDateStr}\`\n⏳ *Remaining:* ${remainingDays} Days\n\nEnjoy your premium VPN connection! 🚀`;
        }
        return await sendTelegramMsg(token, chatId, reply);
    }
    
    // အောက်က Command တွေကတော့ Admin သီးသန့်ဖြစ်လို့ Admin ID စစ်ပါမယ်
    if (command.startsWith("/") && command !== "/check") {
        if (!isAdmin) {
            return await sendTelegramMsg(token, chatId, "🚫 *Access Denied!* You are not authorized to use admin commands.");
        }
    }

    // Admin သီးသန့် HWID အလိုက် ရှာဖွေရန် Feature
    if (command === "/search") {
        if (parts.length < 2) {
            return await sendTelegramMsg(token, chatId, "❌ *Usage:* `/search <HWID>`");
        }
        
        const hwid = parts[1];
        const row = await db.prepare("SELECT * FROM licenses WHERE hwid = ?").bind(hwid).first();
        
        if (!row) {
            return await sendTelegramMsg(token, chatId, `📭 No license record found for HWID: \`${hwid}\``);
        }
        
        const expireDateStr = new Date(row.expire_date).toISOString().split('T')[0];
        const isExpired = Date.now() > row.expire_date;
        const status = isExpired ? "🔴 EXPIRED" : "🟢 ACTIVE";
        
        const reply = `🔍 *Search Result*\n\n` +
            `📱 *HWID:* \`${row.hwid}\`\n` +
            `🔑 *Serial:* \`${row.serial_key}\`\n` +
            `📅 *Expire Date:* \`${expireDateStr}\`\n` +
            `📊 *Status:* ${status}`;
            
        return await sendTelegramMsg(token, chatId, reply);
    }
    
    if (command === "/genkey") {
        if (parts.length < 3) return await sendTelegramMsg(token, chatId, "❌ *Usage:* `/genkey <HWID> <Days>d`\n*Example:* `/genkey 3c94e111df90d2cb 30d`");
        const loadingRes = await sendTelegramMsg(token, chatId, "⏳ *Generating Serial Key & Binding Database... Please wait.*");
        const msgId = loadingRes.result?.message_id;

        try {
            const hwid = parts[1];
            const daysStr = parts[2].replace("d", "");
            const days = parseInt(daysStr);

            if (isNaN(days) || days <= 0) {
                const errText = "❌ *Error:* Invalid number of days!";
                if (msgId) return await editTelegramMsg(token, chatId, msgId, errText);
                return await sendTelegramMsg(token, chatId, errText);
            }

            const serialKey = generateRandomKey();
            const expireTimestamp = Date.now() + days * 24 * 60 * 60 * 1000;

            await db.prepare("INSERT OR REPLACE INTO licenses (hwid, serial_key, expire_date, is_active) VALUES (?, ?, ?, 1)").bind(hwid, serialKey, expireTimestamp).run();

            const expireDateStr = new Date(expireTimestamp).toISOString().split('T')[0];
            const successReply = "✅ *License Key Successfully Generated!*\n\n" +
                `📱 *HWID:* \`${hwid}\`\n` +
                `🔑 *Serial Key:* \`${serialKey}\`\n` +
                `📅 *Expire Date:* \`${expireDateStr}\` (${days} days)\n` +
                "STATUS: `ACTIVE`";

            if (msgId) await editTelegramMsg(token, chatId, msgId, successReply);
            else await sendTelegramMsg(token, chatId, successReply);
        } catch (e) {
            const failText = `❌ *Database Error:* ${e.message}`;
            if (msgId) await editTelegramMsg(token, chatId, msgId, failText);
            else await sendTelegramMsg(token, chatId, failText);
        }
        return;
    }
    
    if (command === "/delkey") {
        if (parts.length < 2) return await sendTelegramMsg(token, chatId, "❌ *Usage:* `/delkey <HWID>`");
        const loadingRes = await sendTelegramMsg(token, chatId, "⏳ *Deleting license from database...*");
        const msgId = loadingRes.result?.message_id;

        try {
            const hwid = parts[1];
            await db.prepare("DELETE FROM licenses WHERE hwid = ?").bind(hwid).run();
            const reply = `🗑️ *License Deleted!*\n\nHWID \`${hwid}\` has been removed from database.`;
            if (msgId) await editTelegramMsg(token, chatId, msgId, reply);
            else await sendTelegramMsg(token, chatId, reply);
        } catch (e) {
            const failText = `❌ *Error:* ${e.message}`;
            if (msgId) await editTelegramMsg(token, chatId, msgId, failText);
            else await sendTelegramMsg(token, chatId, failText);
        }
        return;
    }
    
    if (command === "/upkey") {
        if (parts.length < 3) return await sendTelegramMsg(token, chatId, "❌ *Usage:* `/upkey <HWID> <ExtraDays>d`");
        const loadingRes = await sendTelegramMsg(token, chatId, "⏳ *Updating expiration date...*");
        const msgId = loadingRes.result?.message_id;

        try {
            const hwid = parts[1];
            const daysStr = parts[2].replace("d", "");
            const extraDays = parseInt(daysStr);

            if (isNaN(extraDays) || extraDays <= 0) {
                const errText = "❌ *Error:* Invalid number of days!";
                if (msgId) return await editTelegramMsg(token, chatId, msgId, errText);
                return await sendTelegramMsg(token, chatId, errText);
            }

            const row = await db.prepare("SELECT expire_date FROM licenses WHERE hwid = ?").bind(hwid).first();
            if (!row) {
                const notFoundText = `❌ *Error:* No existing license found for HWID \`${hwid}\`!`;
                if (msgId) return await editTelegramMsg(token, chatId, msgId, notFoundText);
                return await sendTelegramMsg(token, chatId, notFoundText);
            }

            const currentExpire = Math.max(Date.now(), row.expire_date);
            const newExpire = currentExpire + extraDays * 24 * 60 * 60 * 1000;

            await db.prepare("UPDATE licenses SET expire_date = ? WHERE hwid = ?").bind(newExpire, hwid).run();
            const newExpireStr = new Date(newExpire).toISOString().split('T')[0];
            const reply = "🚀 *License Extended!*\n\n" +
                `📱 *HWID:* \`${hwid}\`\n` +
                `📅 *New Expire Date:* \`${newExpireStr}\` (+${extraDays} days)`;

            if (msgId) await editTelegramMsg(token, chatId, msgId, reply);
            else await sendTelegramMsg(token, chatId, reply);
        } catch (e) {
            const failText = `❌ *Error:* ${e.message}`;
            if (msgId) await editTelegramMsg(token, chatId, msgId, failText);
            else await sendTelegramMsg(token, chatId, failText);
        }
        return;
    }

    if (command === "/list") {
        const loadingRes = await sendTelegramMsg(token, chatId, "⏳ *Fetching license data...*");
        const msgId = loadingRes.result?.message_id;

        try {
            const { results } = await db.prepare("SELECT * FROM licenses ORDER BY expire_date ASC").all();
            
            if (!results || results.length === 0) {
                const emptyText = "📭 *Database is empty!* No licenses found.";
                if (msgId) return await editTelegramMsg(token, chatId, msgId, emptyText);
                return await sendTelegramMsg(token, chatId, emptyText);
            }

            const currentTime = Date.now();
            let activeCount = 0;
            let expiredCount = 0;
            let listText = "";

            results.forEach((row, index) => {
                const isExpired = currentTime > row.expire_date;
                if (isExpired) {
                    expiredCount++;
                } else {
                    activeCount++;
                }
                const expireDateStr = new Date(row.expire_date).toISOString().split('T')[0];
                const statusEmoji = isExpired ? "🔴" : "🟢";
                if (index < 30) {
                    listText += `${statusEmoji} \`${row.hwid}\` | Exp: ${expireDateStr}\n`;
                }
            });

            let reply = `📊 *License Database Stats*\n\n` +
                        `🔹 *Total Licenses:* ${results.length}\n` +
                        `🟢 *Active:* ${activeCount}\n` +
                        `🔴 *Expired:* ${expiredCount}\n\n` +
                        `📝 *License List (Top 30):*\n${listText}`;
            
            if (results.length > 30) {
                reply += `\n... *and ${results.length - 30} more.*`;
            }

            if (msgId) await editTelegramMsg(token, chatId, msgId, reply);
            else await sendTelegramMsg(token, chatId, reply);
        } catch (e) {
            const failText = `❌ *Database Error:* ${e.message}`;
            if (msgId) await editTelegramMsg(token, chatId, msgId, failText);
            else await sendTelegramMsg(token, chatId, failText);
        }
        return;
    }
}

export async function handleLicenseCheck(request, env) {
    const db = env[D1_BINDING_NAME];
    try {
        const { hwid, serial_key } = await request.json();
        const currentTime = Date.now();
        const row = await db.prepare("SELECT * FROM licenses WHERE hwid = ?").bind(hwid).first();

        if (!row) return new Response(JSON.stringify({ success: false, message: "No active license found for this device." }), { headers: { 'Content-Type': 'application/json' } });
        if (row.is_active !== 1) return new Response(JSON.stringify({ success: false, message: "License is disabled by Admin!" }), { headers: { 'Content-Type': 'application/json' } });
        if (serial_key && row.serial_key !== serial_key) return new Response(JSON.stringify({ success: false, message: "Invalid Serial Key provided!" }), { headers: { 'Content-Type': 'application/json' } });
        if (currentTime > row.expire_date) return new Response(JSON.stringify({ success: false, message: "License has expired!", is_expired: true }), { headers: { 'Content-Type': 'application/json' } });

        return new Response(JSON.stringify({
            success: true,
            message: "License Valid",
            serial_key: row.serial_key,
            expire_date: row.expire_date
        }), { headers: { 'Content-Type': 'application/json' } });

    } catch (e) {
        return new Response(JSON.stringify({ success: false, message: "Server Error: " + e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

