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
            
            // Migrate old objective format to new format if needed
            if (chat.objectives) {
                chat.objectives = chat.objectives.map(obj => {
                    // If objective doesn't have registrations array, migrate from old collectedData
                    if (!obj.registrations && obj.collectedData && Object.keys(obj.collectedData).length > 0) {
                        // Create a registration from old collected data
                        const registration = {
                            id: generateUniqueCode({ length: 8 }),
                            userId: obj.createdBy || 'unknown',
                            status: obj.status === 'completed' ? 'completed' : 'in-progress',
                            collectedData: {},
                            startedAt: obj.created,
                            completedAt: obj.completedAt
                        };
                        
                        // Migrate each field
                        Object.entries(obj.collectedData).forEach(([key, value]) => {
                            if (value && typeof value === 'object' && value.value !== undefined) {
                                registration.collectedData[key] = {
                                    value: value.value,
                                    timestamp: value.timestamp || Date.now()
                                };
                            } else {
                                registration.collectedData[key] = {
                                    value: value,
                                    timestamp: Date.now()
                                };
                            }
                        });
                        
                        obj.registrations = [registration];
                    } else if (!obj.registrations) {
                        obj.registrations = [];
                    }
                    
                    // Set default registration type if not present
                    if (!obj.registrationType) {
                        obj.registrationType = 'multiple';
                    }
                    
                    return obj;
                });
            }
            
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

        // Ensure requiredData is properly structured
        let requiredData = objectiveData.requiredData || [];
        
        // If requiredData is empty but fields exist, build proper structure
        if (requiredData.length === 0 && objectiveData.fields && objectiveData.fields.length > 0) {
            requiredData = objectiveData.fields.map(field => {
                if (typeof field === 'string') {
                    return {
                        name: field,
                        type: 'text',
                        description: '',
                        required: true,
                        unique: false,
                        validation: null,
                        options: null
                    };
                }
                return {
                    name: field.name || 'field',
                    type: field.type || 'text',
                    description: field.description || '',
                    required: field.required !== false,
                    unique: field.unique || false,
                    validation: field.validation || null,
                    options: field.options || null
                };
            });
        }

        const objective = {
            id: generateUniqueCode({ length: 6 }),
            description: objectiveData.description,
            type: objectiveData.type || 'simple',
            fields: objectiveData.fields || [],
            requiredData: requiredData,
            created: Date.now(),
            createdBy: adminId,
            status: 'active',
            completedAt: null,
            progress: 0,
            registrationType: objectiveData.registrationType || 'multiple', // 'single' or 'multiple'
            maxRegistrations: objectiveData.maxRegistrations || null, // null = unlimited
            registrations: [], // Array to store multiple registrations
            collectedData: {}, // Keep for backward compatibility
            notes: []
        };

        chat.objectives.push(objective);
        
        // Set as current objective if this is the first one
        if (chat.status === 'setup' && chat.objectives.length > 0) {
            chat.status = 'active';
            chat.context.currentObjectiveId = objective.id;
        }

        await this.saveChat(chatId);
        
        LogMaster.Log('Objective Added', { 
            chatId, 
            objectiveId: objective.id,
            registrationType: objective.registrationType,
            maxRegistrations: objective.maxRegistrations 
        });
        
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

    /**
     * Collect data for an objective from a specific user
     * @param {string} chatId - Chat ID
     * @param {string} objectiveId - Objective ID
     * @param {string} field - Field name
     * @param {any} value - Field value
     * @param {string} userId - User ID submitting the data
     * @returns {Promise<Object>} Result object with success status and registration data
     */
    async collectObjectiveData(chatId, objectiveId, field, value, userId) {
        const chat = await this.getOrLoadChat(chatId);
        if (!chat) return { success: false, error: 'chat_not_found' };

        const objective = chat.objectives.find(obj => obj.id === objectiveId);
        if (!objective) return { success: false, error: 'objective_not_found' };

        // Check if objective is completed
        if (objective.status === 'completed') {
            return { 
                success: false, 
                error: 'objective_completed',
                message: 'This objective has been completed and no longer accepts submissions.'
            };
        }

        // Validate field exists in requiredData
        const fieldDef = objective.requiredData.find(f => f.name === field);
        if (!fieldDef) {
            return { 
                success: false, 
                error: 'invalid_field',
                message: `Field "${field}" is not defined for this objective.`
            };
        }

        // Check if this is a new registration or continuing existing one
        let currentRegistration = objective.registrations.find(
            r => r.userId === userId && r.status === 'in-progress'
        );

        if (!currentRegistration) {
            // Check if user can create new registration based on registration type
            const userRegistrations = objective.registrations.filter(r => r.userId === userId);
            
            if (objective.registrationType === 'single') {
                // Check if user already has a completed registration
                const existingComplete = userRegistrations.find(r => r.status === 'completed');
                if (existingComplete) {
                    return { 
                        success: false, 
                        error: 'single_registration_limit',
                        message: 'You have already completed this objective. Multiple registrations are not allowed.'
                    };
                }
            }

            if (objective.maxRegistrations) {
                if (userRegistrations.length >= objective.maxRegistrations) {
                    return { 
                        success: false, 
                        error: 'max_registrations_reached',
                        message: `Maximum registrations (${objective.maxRegistrations}) reached for this objective.`
                    };
                }
            }

            // Check if any field has unique constraint and value already exists
            if (fieldDef.unique) {
                const existingValue = objective.registrations.some(r => 
                    r.collectedData[field] && r.collectedData[field].value === value
                );
                if (existingValue) {
                    return {
                        success: false,
                        error: 'unique_constraint_violation',
                        message: `The value "${value}" for field "${field}" has already been used and must be unique.`
                    };
                }
            }

            // Create new registration
            currentRegistration = {
                id: generateUniqueCode({ length: 8 }),
                userId: userId,
                status: 'in-progress',
                collectedData: {},
                startedAt: Date.now(),
                completedAt: null,
                metadata: {
                    userAgent: null, // Can be populated if needed
                    ipAddress: null,
                    sessionId: null
                }
            };
            objective.registrations.push(currentRegistration);
        } else {
            // Check unique constraint for existing registration
            if (fieldDef.unique) {
                // Check if any OTHER registration has this value
                const existingValue = objective.registrations.some(r => 
                    r.id !== currentRegistration.id && 
                    r.collectedData[field] && 
                    r.collectedData[field].value === value
                );
                if (existingValue) {
                    return {
                        success: false,
                        error: 'unique_constraint_violation',
                        message: `The value "${value}" for field "${field}" has already been used by another user and must be unique.`
                    };
                }
            }
        }

        // Store the field value
        currentRegistration.collectedData[field] = {
            value: value,
            timestamp: Date.now()
        };

        // Validate data type if specified
        if (fieldDef.type) {
            const validation = this.validateFieldValue(fieldDef, value);
            if (!validation.valid) {
                return {
                    success: false,
                    error: 'validation_failed',
                    message: validation.message
                };
            }
        }

        // Check if registration is complete (all required fields collected)
        if (objective.requiredData && objective.requiredData.length > 0) {
            const collectedFields = Object.keys(currentRegistration.collectedData);
            const requiredFields = objective.requiredData
                .filter(f => f.required)
                .map(f => f.name);
            
            const allRequiredCollected = requiredFields.every(f => collectedFields.includes(f));
            
            if (allRequiredCollected) {
                currentRegistration.status = 'completed';
                currentRegistration.completedAt = Date.now();
                
                LogMaster.Log('Registration Completed', {
                    chatId,
                    objectiveId,
                    registrationId: currentRegistration.id,
                    userId
                });
            }

            // Update overall objective progress based on completed registrations
            const totalRegistrations = objective.registrations.length;
            const completedRegistrations = objective.registrations.filter(r => r.status === 'completed').length;
            
            if (objective.maxRegistrations) {
                objective.progress = Math.round((completedRegistrations / objective.maxRegistrations) * 100);
                
                // Auto-complete objective if max registrations reached
                if (completedRegistrations >= objective.maxRegistrations) {
                    objective.status = 'completed';
                    objective.completedAt = Date.now();
                    
                    LogMaster.Log('Objective Auto-Completed', {
                        chatId,
                        objectiveId,
                        completedRegistrations,
                        maxRegistrations: objective.maxRegistrations
                    });
                }
            } else {
                // For unlimited registrations, progress is based on total registrations
                objective.progress = totalRegistrations > 0 ? 50 : 0; // Arbitrary, just shows activity
            }
        }

        await this.saveChat(chatId);
        
        return { 
            success: true, 
            registration: currentRegistration,
            objective: objective,
            isComplete: currentRegistration.status === 'completed'
        };
    }

    /**
     * Validate field value based on field definition
     * @param {Object} fieldDef - Field definition
     * @param {any} value - Value to validate
     * @returns {Object} Validation result
     */
    validateFieldValue(fieldDef, value) {
        // Type validation
        switch (fieldDef.type) {
            case 'number':
                if (isNaN(Number(value))) {
                    return { valid: false, message: `Field "${fieldDef.name}" must be a number.` };
                }
                break;
            case 'date':
                if (isNaN(Date.parse(value))) {
                    return { valid: false, message: `Field "${fieldDef.name}" must be a valid date.` };
                }
                break;
            case 'choice':
                if (fieldDef.options && !fieldDef.options.includes(value)) {
                    return { 
                        valid: false, 
                        message: `Field "${fieldDef.name}" must be one of: ${fieldDef.options.join(', ')}` 
                    };
                }
                break;
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    return { valid: false, message: `Field "${fieldDef.name}" must be a valid email address.` };
                }
                break;
            case 'phone':
                const phoneRegex = /^[\d\s\-+()]+$/;
                if (!phoneRegex.test(value)) {
                    return { valid: false, message: `Field "${fieldDef.name}" must be a valid phone number.` };
                }
                break;
        }

        // Custom validation if provided
        if (fieldDef.validation) {
            try {
                const validationFn = new Function('value', `return ${fieldDef.validation}`);
                if (!validationFn(value)) {
                    return { valid: false, message: `Field "${fieldDef.name}" failed validation.` };
                }
            } catch (error) {
                console.error('Error in custom validation:', error);
            }
        }

        return { valid: true };
    }

    /**
     * Get all registrations for a specific user in an objective
     * @param {string} chatId - Chat ID
     * @param {string} objectiveId - Objective ID
     * @param {string} userId - User ID
     * @returns {Array} User's registrations
     */
    async getUserRegistrations(chatId, objectiveId, userId) {
        const chat = await this.getOrLoadChat(chatId);
        if (!chat) return null;

        const objective = chat.objectives.find(obj => obj.id === objectiveId);
        if (!objective) return null;

        return objective.registrations.filter(r => r.userId === userId);
    }

    /**
     * Get all registrations for an objective
     * @param {string} chatId - Chat ID
     * @param {string} objectiveId - Objective ID
     * @returns {Array} All registrations
     */
    async getAllRegistrations(chatId, objectiveId) {
        const chat = await this.getOrLoadChat(chatId);
        if (!chat) return null;

        const objective = chat.objectives.find(obj => obj.id === objectiveId);
        if (!objective) return null;

        return objective.registrations;
    }

    /**
     * Get statistics for an objective
     * @param {string} chatId - Chat ID
     * @param {string} objectiveId - Objective ID
     * @returns {Object} Statistics
     */
    async getObjectiveStats(chatId, objectiveId) {
        const chat = await this.getOrLoadChat(chatId);
        if (!chat) return null;

        const objective = chat.objectives.find(obj => obj.id === objectiveId);
        if (!objective) return null;

        const totalRegistrations = objective.registrations.length;
        const completedRegistrations = objective.registrations.filter(r => r.status === 'completed').length;
        const inProgressRegistrations = totalRegistrations - completedRegistrations;
        
        // Unique users count
        const uniqueUsers = new Set(objective.registrations.map(r => r.userId)).size;
        
        // Field completion stats
        const fieldStats = {};
        objective.requiredData.forEach(field => {
            const completedCount = objective.registrations.filter(r => 
                r.collectedData[field.name]
            ).length;
            fieldStats[field.name] = {
                total: totalRegistrations,
                completed: completedCount,
                completionRate: totalRegistrations > 0 ? (completedCount / totalRegistrations) * 100 : 0
            };
        });

        return {
            objectiveId: objective.id,
            description: objective.description,
            registrationType: objective.registrationType,
            maxRegistrations: objective.maxRegistrations,
            totalRegistrations,
            completedRegistrations,
            inProgressRegistrations,
            uniqueUsers,
            fieldStats,
            status: objective.status,
            progress: objective.progress
        };
    }

    /**
     * Get the current in-progress registration for a user in an objective
     * @param {string} chatId - Chat ID
     * @param {string} objectiveId - Objective ID
     * @param {string} userId - User ID
     * @returns {Object|null} Current registration or null
     */
    getCurrentUserRegistration(chatId, objectiveId, userId) {
        const chat = this.chats.get(chatId);
        if (!chat) return null;

        const objective = chat.objectives.find(obj => obj.id === objectiveId);
        if (!objective) return null;

        return objective.registrations.find(
            r => r.userId === userId && r.status === 'in-progress'
        ) || null;
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

    /**
     * Format objectives for prompt display
     * @param {string} chatId - Chat ID
     * @param {boolean} includeDetails - Include detailed information
     * @param {string} userId - User ID to show user-specific data
     * @returns {string} Formatted objectives
     */
    formatObjectivesForPrompt(chatId, includeDetails = false, userId = null) {
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
            
            // Registration type info
            const regTypeText = obj.registrationType === 'single' ? 'One entry per user' : 'Multiple entries allowed';
            output += `   Type: ${regTypeText}\n`;
            
            if (obj.maxRegistrations) {
                output += `   Max Registrations: ${obj.maxRegistrations} per user\n`;
            }

            // Show user's registrations if userId provided
            if (userId && obj.registrations) {
                const userRegs = obj.registrations.filter(r => r.userId === userId);
                const completedRegs = userRegs.filter(r => r.status === 'completed').length;
                const inProgressReg = userRegs.find(r => r.status === 'in-progress');
                
                output += `   Your Registrations: ${completedRegs} completed`;
                if (inProgressReg) {
                    output += `, 1 in progress\n`;
                    
                    // Show collected data for in-progress registration
                    if (Object.keys(inProgressReg.collectedData).length > 0) {
                        output += `   Current Data:\n`;
                        Object.entries(inProgressReg.collectedData).forEach(([key, data]) => {
                            output += `   - ${key}: ${data.value}\n`;
                        });
                    }
                    
                    // Show remaining fields
                    if (obj.requiredData) {
                        const missingFields = obj.requiredData.filter(f => 
                            f.required && !inProgressReg.collectedData[f.name]
                        );
                        if (missingFields.length > 0) {
                            output += `   Still Need:\n`;
                            missingFields.forEach(f => {
                                output += `   - ${f.name} (${f.type}): ${f.description || 'No description'}\n`;
                            });
                        }
                    }
                } else {
                    output += `\n`;
                }
            }
            
            // Show total stats if admin or includeDetails
            if (includeDetails && obj.registrations && obj.registrations.length > 0) {
                output += `   Total Registrations: ${obj.registrations.length}\n`;
                const completed = obj.registrations.filter(r => r.status === 'completed').length;
                output += `   Completed: ${completed}\n`;
                const uniqueUsers = new Set(obj.registrations.map(r => r.userId)).size;
                output += `   Unique Users: ${uniqueUsers}\n`;
            }
            
            // Show field requirements
            if (obj.type === 'form' && obj.requiredData && obj.requiredData.length > 0) {
                output += `   Required Information:\n`;
                obj.requiredData.forEach(field => {
                    const required = field.required ? '(required)' : '(optional)';
                    const unique = field.unique ? '🔒 unique' : '';
                    const type = field.type ? `[${field.type}]` : '';
                    output += `   - ${field.name} ${type} ${required} ${unique}\n`;
                    if (field.description) {
                        output += `     └ ${field.description}\n`;
                    }
                    if (field.type === 'choice' && field.options) {
                        output += `     Options: ${field.options.join(', ')}\n`;
                    }
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
                registrationType: currentObjective.registrationType,
                maxRegistrations: currentObjective.maxRegistrations,
                registrations: currentObjective.registrations,
                requiredData: currentObjective.requiredData,
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
                registrationType: obj.registrationType,
                maxRegistrations: obj.maxRegistrations,
                registrations: obj.registrations,
                requiredData: obj.requiredData,
                collectedData: obj.collectedData
            }))
        };
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

    /**
     * Export objective data as CSV
     * @param {string} chatId - Chat ID
     * @param {string} objectiveId - Objective ID
     * @returns {string} CSV data
     */
    async exportObjectiveToCSV(chatId, objectiveId) {
        const chat = await this.getOrLoadChat(chatId);
        if (!chat) return null;

        const objective = chat.objectives.find(obj => obj.id === objectiveId);
        if (!objective) return null;

        // Define CSV headers
        const headers = ['Registration ID', 'User ID', 'Status', 'Started At', 'Completed At', ...objective.requiredData.map(f => f.name)];
        
        // Build rows
        const rows = objective.registrations.map(reg => {
            const row = [
                reg.id,
                reg.userId,
                reg.status,
                new Date(reg.startedAt).toISOString(),
                reg.completedAt ? new Date(reg.completedAt).toISOString() : '',
                ...objective.requiredData.map(f => reg.collectedData[f.name]?.value || '')
            ];
            return row;
        });

        // Convert to CSV
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        return csvContent;
    }

    async cleanup() {
        // Clean up old chats (older than 30 days)
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        
        for (const [chatId, chat] of this.chats) {
            if (chat.lastActivity < thirtyDaysAgo) {
                this.chats.delete(chatId);
                try {
                    await fs.unlink(this.getChatPath(chatId));
                    LogMaster.Log('Chat Cleaned Up', { chatId, lastActivity: new Date(chat.lastActivity).toISOString() });
                } catch (error) {
                    console.error('Error deleting old chat:', error);
                }
            }
        }
    }
}

export default FlowChatManager;