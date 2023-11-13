import readline from 'readline';

class ChatModule {
  constructor(config = { aiGenerateFunction: undefined, terminalTest: undefined }) {
    this.aiGenerate = config.aiGenerateFunction || this.defaultGenerateFunction;
    this.chatHistory = [];
    this.terminalTestActive = config.terminalTest || false;
    if (this.terminalTestActive) {
      this.initializeTerminalInterface();
    }
  }

  async sendMessage(userMessage) {
    this.addToChatHistory('User', userMessage);
    process.stdout.write('AI : '); // Print the AI tag before starting the generation
    const aiMessage = await this.aiGenerate(
      `You are a helpful assistant and have a objective to help the user generating the next AI message \n\n${this.formatChatHistory()}\nUser: ${userMessage}`,
      { stream: true },
      (token) => {
        if (this.terminalTestActive) {
          process.stdout.write(token.full_text); // This will simulate the typing effect
        }
      }
    );
    if (aiMessage && aiMessage.content) {
      this.addToChatHistory('AI', aiMessage.content);
      if (this.terminalTestActive) {
        console.log('\n'); // Ensure the next user prompt starts on a new line
      }
    }
  }

  addToChatHistory(speaker, message) {
    this.chatHistory.push({ speaker, message });
  }

  formatChatHistory() {
    return this.chatHistory.map(entry => `${entry.speaker} : ${entry.message}`).join('\n');
  }

  getChatHistory() {
    return this.chatHistory;
  }

  initializeTerminalInterface() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  
    rl.setPrompt('You: ');
  
    const prompt = () => {
      rl.prompt();
      rl.once('line', (line) => {
        this.sendMessage(line.trim()).finally(prompt); // use finally to ensure prompt is always reset
      });
    };
  
    prompt(); // Start the conversation
  
    rl.on('close', () => {
      console.log('Session ended.');
      process.exit(0);
    });
  }
  

  async defaultGenerateFunction(prompt, options, callback) {
    const fakeResponse = "Sure, I can help with that.";
    let i = 0;
    return new Promise(resolve => {
      const intervalId = setInterval(() => {
        if (i < fakeResponse.length) {
          const token = { full_text: fakeResponse[i++] };
          callback(token);
        } else {
          clearInterval(intervalId);
          process.stdout.write('\n'); // End the typing simulation with a newline
          resolve({ content: fakeResponse });
        }
      }, 100);
    });
  }
  
}

export default ChatModule;
