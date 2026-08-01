///////////////////////////////////////////////
// Copyright (C) t.me/nkka404
// Channel: https://t.me/premium_channel_404
///////////////////////////////////////////////

import { TELEGRAM_BOT_TOKEN_ENV, D1_BINDING_NAME, ADMIN_IDS } from './config.js';

function generateRandomKey() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "WARP";
    for (let i = 0; i < 3; i++) {
        result += "-";
        for (let j = 0; j < 4; j++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    }
    return result;
}

async function sendTelegramMsg(token, chatId, text) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: "Markdown" })
    });
}

export async function handleUpdate(update, env, request) {
    const token = env[TELEGRAM_BOT_TOKEN_ENV];
    const db = env[D1_BINDING_NAME];

    if (!update.message || !update.message.text) return;

    const message = update.message;
    const chatId = message.chat.id;
    const text = message.text.trim();
    const parts = text.split(/\s+/);
    const command = parts[0];
    
    if (command.startsWith("/")) {
        if (!ADMIN_IDS.includes(chatId)) {
            return await sendTelegramMsg(token, chatId, "🚫 *Access Denied!* You are not authorized to use this bot commands.");
        }
    }
    
    if (command === "/genkey") {
        if (parts.length < 3) {
            return await sendTelegramMsg(token, chatId, "❌ Usage: `/genkey <HWID> <Days>d`\nExample: `/genkey 1234567890abcdef 30d`");
        }
        const hwid = parts[1];
        const daysStr = parts[2].replace("d", "");
        const days = parseInt(daysStr);

        if (isNaN(days) || days <= 0) {
            return await sendTelegramMsg(token, chatId, "❌ Invalid number of days!");
        }

        const serialKey = generateRandomKey();
        const expireTimestamp = Date.now() + days * 24 * 60 * 60 * 1000;

        await db.prepare(
            "INSERT OR REPLACE INTO licenses (hwid, serial_key, expire_date, is_active) VALUES (?, ?, ?, 1)"
        ).bind(hwid, serialKey, expireTimestamp).run();

        const expireDateStr = new Date(expireTimestamp).toISOString().split('T')[0];
        const reply = `✅ *New Key Generated & Bound!*\n\n📱 *HWID:* \`${hwid}\`\n🔑 *Serial Key:* \`${serialKey}\`\n📅 *Expire Date:* \`${expireDateStr}\` (${days} days)`;
        return await sendTelegramMsg(token, chatId, reply);
    }
    
    if (command === "/delkey") {
        if (parts.length < 2) {
            return await sendTelegramMsg(token, chatId, "❌ Usage: `/delkey <HWID>`");
        }
        const hwid = parts[1];

        await db.prepare("DELETE FROM licenses WHERE hwid = ?").bind(hwid).run();
        return await sendTelegramMsg(token, chatId, `🗑️ License for HWID \`${hwid}\` deleted successfully!`);
    }
    
    if (command === "/upkey") {
        if (parts.length < 3) {
            return await sendTelegramMsg(token, chatId, "❌ Usage: `/upkey <HWID> <ExtraDays>d`");
        }
        const hwid = parts[1];
        const daysStr = parts[2].replace("d", "");
        const extraDays = parseInt(daysStr);

        if (isNaN(extraDays) || extraDays <= 0) {
            return await sendTelegramMsg(token, chatId, "❌ Invalid number of days!");
        }

        const row = await db.prepare("SELECT expire_date FROM licenses WHERE hwid = ?").bind(hwid).first();
        if (!row) {
            return await sendTelegramMsg(token, chatId, "❌ No existing license found for this HWID!");
        }

        const currentExpire = Math.max(Date.now(), row.expire_date);
        const newExpire = currentExpire + extraDays * 24 * 60 * 60 * 1000;

        await db.prepare("UPDATE licenses SET expire_date = ? WHERE hwid = ?").bind(newExpire, hwid).run();

        const newExpireStr = new Date(newExpire).toISOString().split('T')[0];
        return await sendTelegramMsg(token, chatId, `🚀 *License Extended!*\n\n📱 *HWID:* \`${hwid}\`\n📅 *New Expire Date:* \`${newExpireStr}\``);
    }
}

export async function handleLicenseCheck(request, env) {
    const db = env[D1_BINDING_NAME];
    try {
        const { hwid, serial_key } = await request.json();
        const currentTime = Date.now();

        const row = await db.prepare(
            "SELECT * FROM licenses WHERE hwid = ?"
        ).bind(hwid).first();

        if (!row) {
            return new Response(JSON.stringify({ success: false, message: "No active license found for this device." }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (row.is_active !== 1) {
            return new Response(JSON.stringify({ success: false, message: "License is disabled by Admin!" }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (serial_key && row.serial_key !== serial_key) {
            return new Response(JSON.stringify({ success: false, message: "Invalid Serial Key provided!" }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (currentTime > row.expire_date) {
            return new Response(JSON.stringify({ success: false, message: "License has expired!", is_expired: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

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
