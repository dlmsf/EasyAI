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
            status: 'setup', // 'setup', 'active', 'completed'
            context: {
                currentObjectiveId: null,
                pendingFields: [],
                collectedData: {}
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

    async addObjective(chatId, adminId, objectiveData) {
        const chat = await this.getOrLoadChat(chatId);
        if (!chat || !chat.admins.includes(adminId)) return null;

        const objective = {
            id: generateUniqueCode({ length: 6 }),
            description: objectiveData.description,
            type: objectiveData.type || 'simple', // 'simple', 'form', 'information_gathering'
            fields: objectiveData.fields || [], // For form-type objectives
            requiredData: objectiveData.requiredData || [], // Data points to collect
            created: Date.now(),
            createdBy: adminId,
            status: 'active', // 'active', 'completed', 'cancelled'
            completedAt: null,
            progress: 0,
            collectedData: {}, // Store collected information
            notes: []
        };

        chat.objectives.push(objective);
        
        // If this is the first objective, change status to active
        if (chat.status === 'setup' && chat.objectives.length > 0) {
            chat.status = 'active';
            chat.context.currentObjectiveId = objective.id;
        }

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
            objective.progress = 100;
            
            // Move to next objective if available
            const nextObjective = chat.objectives.find(obj => obj.status === 'active' && obj.id !== objectiveId);
            if (nextObjective) {
                chat.context.currentObjectiveId = nextObjective.id;
            } else {
                // Check if all objectives are completed
                const allCompleted = chat.objectives.every(obj => obj.status === 'completed');
                if (allCompleted) {
                    chat.status = 'completed';
                }
            }
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

    async collectObjectiveData(chatId, objectiveId, field, value) {
        const chat = await this.getOrLoadChat(chatId);
        if (!chat) return false;

        const objective = chat.objectives.find(obj => obj.id === objectiveId);
        if (!objective) return false;

        // Store collected data
        objective.collectedData[field] = {
            value,
            timestamp: Date.now()
        };

        // Update progress based on required data
        if (objective.requiredData && objective.requiredData.length > 0) {
            const collectedFields = Object.keys(objective.collectedData);
            const requiredFields = objective.requiredData.map(f => f.name);
            const completedFields = requiredFields.filter(f => collectedFields.includes(f));
            objective.progress = Math.round((completedFields.length / requiredFields.length) * 100);
        }

        await this.saveChat(chatId);
        return true;
    }

    async setCurrentObjective(chatId, objectiveId) {
        const chat = await this.getOrLoadChat(chatId);
        if (!chat) return false;

        const objective = chat.objectives.find(obj => obj.id === objectiveId);
        if (!objective || objective.status !== 'active') return false;

        chat.context.currentObjectiveId = objectiveId;
        await this.saveChat(chatId);
        return true;
    }

    getCurrentObjective(chatId) {
        const chat = this.chats.get(chatId);
        if (!chat || !chat.context.currentObjectiveId) return null;
        
        return chat.objectives.find(obj => obj.id === chat.context.currentObjectiveId);
    }

    getObjectivesSummary(chatId) {
        const chat = this.chats.get(chatId);
        if (!chat) return null;

        const total = chat.objectives.length;
        const completed = chat.objectives.filter(obj => obj.status === 'completed').length;
        const inProgress = total - completed;
        const currentObjective = this.getCurrentObjective(chatId);

        return {
            total,
            completed,
            inProgress,
            status: chat.status,
            currentObjective: currentObjective ? {
                id: currentObjective.id,
                description: currentObjective.description,
                type: currentObjective.type,
                progress: currentObjective.progress,
                collectedData: currentObjective.collectedData,
                remainingFields: currentObjective.requiredData?.filter(
                    f => !currentObjective.collectedData[f.name]
                ) || []
            } : null,
            objectives: chat.objectives.map(obj => ({
                id: obj.id,
                description: obj.description,
                type: obj.type,
                status: obj.status,
                progress: obj.progress,
                collectedData: obj.collectedData
            }))
        };
    }

    formatObjectivesForPrompt(chatId, includeDetails = false) {
        const summary = this.getObjectivesSummary(chatId);
        if (!summary || summary.total === 0) {
            return 'No objectives set yet.';
        }

        let output = '📋 **Current Objectives:**\n\n';
        
        summary.objectives.forEach(obj => {
            const statusEmoji = obj.status === 'completed' ? '✅' : 
                               obj.status === 'active' ? '🔄' : '⏳';
            
            output += `${statusEmoji} **${obj.description}**\n`;
            output += `   Status: ${obj.status} (${obj.progress}%)\n`;
            
            if (includeDetails && obj.collectedData && Object.keys(obj.collectedData).length > 0) {
                output += `   Collected Information:\n`;
                Object.entries(obj.collectedData).forEach(([key, data]) => {
                    output += `   - ${key}: ${data.value}\n`;
                });
            }
            
            if (obj.type === 'form' && obj.requiredData && obj.status !== 'completed') {
                output += `   Required Information:\n`;
                obj.requiredData.forEach(field => {
                    const collected = obj.collectedData[field.name];
                    const status = collected ? '✅' : '⭕';
                    output += `   ${status} ${field.name}${field.type ? ` (${field.type})` : ''}: ${field.description || ''}\n`;
                });
            }
            
            output += '\n';
        });

        if (summary.currentObjective) {
            output += `🎯 **Current Focus:** ${summary.currentObjective.description}\n`;
        }

        if (summary.status === 'completed') {
            output += '\n✨ **All objectives completed!** ✨\n';
        }

        return output;
    }

    async analyzeUserMessage(chatId, message, isAdmin) {
        const chat = await this.getOrLoadChat(chatId);
        if (!chat) return { action: 'none', relevance: 0 };

        const summary = this.getObjectivesSummary(chatId);
        
        // If no objectives and user is admin, they're in setup mode
        if (summary.total === 0 && isAdmin) {
            return {
                action: 'setup',
                relevance: 1,
                message: "You're in setup mode. Please create your first objective."
            };
        }

        // If no objectives and user is not admin, they can't do anything
        if (summary.total === 0 && !isAdmin) {
            return {
                action: 'blocked',
                relevance: 0,
                message: "This chat is currently being set up. Please wait for objectives to be created."
            };
        }

        // If all objectives completed
        if (summary.status === 'completed') {
            return {
                action: 'completed',
                relevance: 1,
                message: "All objectives have been completed. The chat session is finished."
            };
        }

        // Check if message is relevant to current objective
        const currentObjective = summary.currentObjective;
        if (!currentObjective) {
            return {
                action: 'no_focus',
                relevance: 0,
                message: "No active objective. Please wait for direction."
            };
        }

        return {
            action: 'active',
            relevance: 1,
            currentObjective,
            message: "Processing your message..."
        };
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