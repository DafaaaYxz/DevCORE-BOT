
const { Redis } = require('@upstash/redis');
const config = require('../settings');

const redis = new Redis({
  url: config.upstashUrl,
  token: config.upstashToken,
});

module.exports = {
    // User Data
    getUser: async (id) => await redis.get(`user:${id}`) || { id, role: 'user', chatCount: 0 },
    setUser: async (id, data) => await redis.set(`user:${id}`, data),
    
    // API Keys Pool
    getKeys: async () => await redis.get('api_keys') || [],
    addKey: async (key) => {
        const keys = await redis.get('api_keys') || [];
        keys.push(key);
        await redis.set('api_keys', keys);
    },
    
    // VIP Tokens
    saveToken: async (token, data) => await redis.set(`token:${token}`, data),
    getToken: async (token) => await redis.get(`token:${token}`),
    delToken: async (token) => await redis.del(`token:${token}`),
    
    // Stats
    getAllUsers: async () => {
        const [_, keys] = await redis.scan(0, { match: 'user:*' });
        const users = [];
        for (let key of keys) {
            users.push(await redis.get(key));
        }
        return users;
    }
};
