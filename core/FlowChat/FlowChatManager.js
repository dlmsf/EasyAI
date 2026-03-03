// core/FlowChat/FlowChatManager.js

import fs from 'fs/promises';
import path from 'path';
import { FlowChatPrompts } from './prompts.js';
import generateUniqueCode from '../util/generateUniqueCode.js';
import FileTool from '../useful/FileTool.js';
import LogMaster from '../LogMaster.js';

class FlowChatManager {
    constructor(storagePath = './flowchat_data') {
        this.storagePath = storagePath;
        this.chats = new Map();
        this.ensureStorage();
    }

    async ensureStorage() {
        try {
            await fs.mkdir(this.storagePath, { recursive: true });
        } catch (error) {
            console.error('Error creating FlowChat storage:', error);
        }
    }

    getChatPath(chatId) {
        return path.join(this.storagePath, `${chatId}.json`);
    }

    async loadChat(chatId) {
        try {
            const data = await fs.readFile(this.getChatPath(chatId), 'utf-8');
            const chat = JSON.parse(data);
            this.chats.set(chatId, chat);
            return chat;
        } catch (error) {
            return null;
        }
    }

    async saveChat(chatId) {
        const chat = this.chats.get(chatId);
        if (!chat) return false;
        
        try {
            await fs.writeFile(
                this.getChatPath(chatId), 
                JSON.stringify(chat, null, 2)
            );
            return true;
        } catch (error) {
            console.error('Error saving chat:', error);
            return false;
        }
    }

    async createChat(chatId, adminId, initialMessage = '') {
        const chat = {
            id: chatId,
            created: Date.now(),
            lastActivity: Date.now(),
            admins: [adminId],
            objectives: [],
            messages: [],
            mode: 'normal', // 'normal', 'management', 'creation'
            context: {
                currentObjective: null,
                pendingCreation: null,
                lastCommand: null
            }
        };

        if (initialMessage) {
            chat.messages.push({
                id: generateUniqueCode({ length: 8 }),
                senderId: adminId,
                content: initialMessage,
                timestamp: Date.now(),
                role: 'user'
            });
        }

        this.chats.set(chatId, chat);
        await this.saveChat(chatId);
        
        LogMaster.Log('FlowChat Created', { chatId, adminId });
        return chat;
    }

    async addMessage(chatId, senderId, content) {
        const chat = await this.getOrLoadChat(chatId);
        if (!chat) return null;

        const message = {
            id: generateUniqueCode({ length: 8 }),
            senderId,
            content,
            timestamp: Date.now(),
            role: senderId === chat.admins[0] ? 'admin' : 'user'
        };

        chat.messages.push(message);
        chat.lastActivity = Date.now();
        
        // Keep last 50 messages for context
        if (chat.messages.length > 50) {
            chat.messages = chat.messages.slice(-50);
        }

        await this.saveChat(chatId);
        return message;
    }

    async getOrLoadChat(chatId) {
        if (this.chats.has(chatId)) {
            return this.chats.get(chatId);
        }
        return await this.loadChat(chatId);
    }

    isAdmin(chatId, senderId) {
        const chat = this.chats.get(chatId);
        return chat && chat.admins.includes(senderId);
    }

    async addAdmin(chatId, adminId, newAdminId) {
        const chat = await this.getOrLoadChat(chatId);
        if (!chat || !chat.admins.includes(adminId)) return false;
        
        if (!chat.admins.includes(newAdminId)) {
            chat.admins.push(newAdminId);
            await this.saveChat(chatId);
        }
        return true;
    }

    async addObjective(chatId, adminId, description) {
        const chat = await this.getOrLoadChat(chatId);
        if (!chat || !chat.admins.includes(adminId)) return null;

        const objective = {
            id: generateUniqueCode({ length: 6 }),
            description,
            created: Date.now(),
            createdBy: adminId,
            status: 'active', // 'active', 'completed', 'cancelled'
            completedAt: null,
            progress: 0,
            notes: []
        };

        chat.objectives.push(objective);
        await this.saveChat(chatId);
        return objective;
    }

    async updateObjective(chatId, adminId, objectiveId, updates) {
        const chat = await this.getOrLoadChat(chatId);
        if (!chat || !chat.admins.includes(adminId)) return false;

        const objective = chat.objectives.find(obj => obj.id === objectiveId);
        if (!objective) return false;

        Object.assign(objective, updates);
        if (updates.status === 'completed') {
            objective.completedAt = Date.now();
        }

        await this.saveChat(chatId);
        return true;
    }

    async completeObjective(chatId, adminId, objectiveId) {
        return this.updateObjective(chatId, adminId, objectiveId, {
            status: 'completed',
            progress: 100
        });
    }

    async deleteObjective(chatId, adminId, objectiveId) {
        const chat = await this.getOrLoadChat(chatId);
        if (!chat || !chat.admins.includes(adminId)) return false;

        chat.objectives = chat.objectives.filter(obj => obj.id !== objectiveId);
        await this.saveChat(chatId);
        return true;
    }

    setMode(chatId, mode) {
        const chat = this.chats.get(chatId);
        if (chat) {
            chat.mode = mode;
            this.saveChat(chatId);
        }
    }

    getObjectivesSummary(chatId) {
        const chat = this.chats.get(chatId);
        if (!chat) return null;

        const total = chat.objectives.length;
        const completed = chat.objectives.filter(obj => obj.status === 'completed').length;
        const inProgress = total - completed;

        return {
            total,
            completed,
            inProgress,
            objectives: chat.objectives.map(obj => ({
                id: obj.id,
                description: obj.description,
                status: obj.status,
                progress: obj.progress
            }))
        };
    }

    formatObjectivesForPrompt(chatId) {
        const summary = this.getObjectivesSummary(chatId);
        if (!summary || summary.total === 0) {
            return 'No objectives set yet.';
        }

        return summary.objectives.map(obj => 
            `[${obj.id}] ${obj.description} - Status: ${obj.status} (${obj.progress}%)`
        ).join('\n');
    }

    async cleanup() {
        // Clean up old chats (older than 30 days)
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        
        for (const [chatId, chat] of this.chats) {
            if (chat.lastActivity < thirtyDaysAgo) {
                this.chats.delete(chatId);
                try {
                    await fs.unlink(this.getChatPath(chatId));
                } catch (error) {
                    console.error('Error deleting old chat:', error);
                }
            }
        }
    }
}

export default FlowChatManager;