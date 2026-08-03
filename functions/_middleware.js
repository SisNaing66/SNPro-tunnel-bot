///////////////////////////////////////////////
// Copyright (C) t.me/Result69
// Channel: https://t.me/noresult6999
///////////////////////////////////////////////

import { handleUpdate, handleLicenseCheck } from './bot.js';
import { TELEGRAM_BOT_TOKEN_ENV } from './config.js';

const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Telegram Bot Status Panel</title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
    </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen flex items-center justify-center p-4">
    <div class="max-w-md w-full bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        
        <div class="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/20 rounded-full blur-2xl"></div>
        <div class="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl"></div>

        <div class="flex justify-center mb-6">
            <div class="w-20 h-20 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/30 animate-bounce duration-1000">
                <i class="fa-solid fa-robot text-3xl text-white"></i>
            </div>
        </div>

        <div class="text-center mb-8">
            <h1 class="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Bot Status Server</h1>
            <p class="text-slate-400 text-sm mt-1">Cloudflare Worker Gateway</p>
        </div>

        <div class="space-y-4 mb-8">
            <div class="flex items-center justify-between p-4 bg-slate-700/30 rounded-2xl border border-slate-700/50">
                <div class="flex items-center gap-3">
                    <i class="fa-solid fa-circle-check text-emerald-400 text-lg"></i>
                    <span class="text-sm font-medium text-slate-300">System Status</span>
                </div>
                <span class="text-xs px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full font-semibold border border-emerald-500/20">Active / Live</span>
            </div>

            <div class="flex items-center justify-between p-4 bg-slate-700/30 rounded-2xl border border-slate-700/50">
                <div class="flex items-center gap-3">
                    <i class="fa-solid fa-bolt text-amber-400 text-lg"></i>
                    <span class="text-sm font-medium text-slate-300">Engine Version</span>
                </div>
                <span class="text-sm font-semibold text-slate-400">💥Sis Naing💥</span>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-3 mb-6">
            <a href="/set-webhook" class="flex flex-col items-center justify-center p-4 bg-slate-700/40 hover:bg-slate-700/70 border border-slate-700/50 hover:border-cyan-500/50 rounded-2xl transition-all duration-300 group">
                <i class="fa-solid fa-link text-cyan-400 mb-2 group-hover:scale-110 transition-transform"></i>
                <span class="text-xs font-semibold text-slate-300">Set Webhook</span>
            </a>
            <a href="https://t.me/noresult6999" target="_blank" class="flex flex-col items-center justify-center p-4 bg-slate-700/40 hover:bg-slate-700/70 border border-slate-700/50 hover:border-blue-500/50 rounded-2xl transition-all duration-300 group">
                <i class="fa-brands fa-telegram text-blue-400 mb-2 group-hover:scale-110 transition-transform"></i>
                <span class="text-xs font-semibold text-slate-300">Telegram Channel</span>
            </a>
        </div>

        <div class="text-center text-xs text-slate-500">
            &copy; 2026 Developed by <a href="https://t.me/Result69" target="_blank" class="text-cyan-400/80 hover:underline">@nkka404</a>. All rights reserved.
        </div>

    </div>
</body>
</html>
`;

async function handleImageProxy(url) {
    const targetUrl = url.searchParams.get("url");
    
    if (!targetUrl) {
        return new Response(JSON.stringify({ error: "Missing image URL" }), { 
            status: 400, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }

    try {
        const imageResponse = await fetch(targetUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
            }
        });

        if (!imageResponse.ok) throw new Error("Failed to fetch image from source");
        
        return new Response(imageResponse.body, {
            headers: {
                "Content-Type": imageResponse.headers.get("Content-Type") || "image/jpeg",
                "Cache-Control": "public, max-age=86400"
            }
        });
    } catch (e) {
        return new Response(`Error: ${e.message}`, { status: 500 });
    }
}

async function configureWebhook(request, env) {
    const token = env[TELEGRAM_BOT_TOKEN_ENV];
    const url = new URL(request.url);
    const webhookUrl = `${url.protocol}//${url.hostname}/`;

    const apiTarget = `https://api.telegram.org/bot${token}/setWebhook`;
    
    const response = await fetch(apiTarget, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url: webhookUrl,
            allowed_updates: ["message", "callback_query", "chat_member", "my_chat_member"],
            drop_pending_updates: true
        })
    });

    const result = await response.json();
    
    return new Response(JSON.stringify({
        success: result.ok,
        status: result.description,
        webhook_endpoint: webhookUrl
    }), { headers: { 'Content-Type': 'application/json' } });
}

export async function onRequest(context) {
    const { request, env, waitUntil } = context;
    const url = new URL(request.url);
    
    // 1. Image Proxy Endpoint
    if (url.pathname === '/proxy-img') {
        return await handleImageProxy(url);
    }
    
    // 2. Telegram Webhook Setup Endpoint
    if (url.pathname === '/set-webhook') {
        return await configureWebhook(request, env);
    }

    // 3. Android App License Check Endpoint
    if (url.pathname === '/api/check-license' && request.method === 'POST') {
        return await handleLicenseCheck(request, env);
    }
    
    // 4. Telegram Bot Updates Handling (POST Request to Root)
    if (request.method === 'POST') {
        try {
            const update = await request.json();
            
            waitUntil(handleUpdate(update, env, request));

            return new Response('OK', { status: 200 });
        } catch (e) {
            console.error('Update Processing Error:', e);
            return new Response('Internal Server Error', { status: 200 });
        }
    }
    
    // 5. Main Web Status Dashboard Panel
    return new Response(htmlTemplate, { 
        status: 200, 
        headers: {
            'Content-Type': 'text/html; charset=utf-8'
        }
    });
}
