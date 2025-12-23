
const axios = require('axios');
const db = require('./database');
const config = require('../settings');

async function chatAI(prompt, user) {
    const keys = await db.getKeys();
    if (keys.length === 0) return "Maaf, API Key belum dikonfigurasi oleh Owner.";

    const aiName = user.aiName || config.defaultAiName;
    const ownerName = user.ownerName || config.defaultOwnerName;
    const persona = `Kamu adalah ${aiName}. Kamu diciptakan dan dikembangkan oleh ${ownerName}. Jika ditanya siapa penciptamu, jawablah ${ownerName}. Kamu asisten cerdas yang sangat membantu.`;

    let retryCount = 0;
    const maxRetries = Math.min(keys.length, 3);

    while (retryCount < maxRetries) {
        const currentKey = keys[retryCount];
        try {
            const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                model: config.openRouterModel,
                messages: [
                    { role: "system", content: persona },
                    { role: "user", content: prompt }
                ]
            }, {
                headers: { "Authorization": `Bearer ${currentKey}`, "Content-Type": "application/json" },
                timeout: 30000
            });

            return response.data.choices[0].message.content;
        } catch (e) {
            console.error(`Key ${retryCount} gagal, mencoba key berikutnya...`);
            retryCount++;
        }
    }
    return "Semua API Key sedang limit atau bermasalah. Coba lagi nanti.";
}

module.exports = { chatAI };
