class ChatView  {
  static Html(){
    return String.raw`
    <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EasyAI</title>
    <style>
        body, html {
            height: 100%;
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f4f4f4;
        }
        .container {
            display: flex;
            height: 100%;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            background: #fff;
            overflow: hidden;
        }
        .chat-list {
            width: 15%;
            background: #e9e9e9;
            overflow-y: auto;
            padding: 10px;
            position: relative;
        }
        .reset-button {
            position: absolute;
            top: 10px;
            right: 10px;
            background-color: #d32f2f;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 5px;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            transition: background-color 0.3s, box-shadow 0.3s;
        }
        .reset-button:hover {
            background-color: #b71c1c;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        .chat-box {
            flex-grow: 1;
            padding: 20px;
            position: relative;
            display: flex;
            flex-direction: column;
        }
        #chat-messages {
            overflow-y: auto;
            flex-grow: 1;
        }
        .message-input {
            width: 100%;
            padding: 10px;
            background: #fff;
            display: flex;
            align-items: center;
            border-top: 2px solid #ddd;
        }
        .message-input textarea {
            flex-grow: 1;
            padding: 10px;
            margin-right: 10px;
            border: 1px solid #ccc;
            border-radius: 5px;
            resize: none;
            min-height: 40px;
        }
        .message-input button {
            padding: 10px 20px;
            background-color: #0078d7;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        .message-input button:hover {
            background-color: #005a9e;
        }
        .message {
            padding: 10px;
            margin: 10px 0;
            border-radius: 10px;
            background: #e7e7e7;
            white-space: pre-wrap; /* This preserves line breaks */
        }
        .user-message {
            background: #0078d7;
            color: #fff;
            text-align: right;
        }
        .ai-message {
            background: #58a700;
            color: #fff;
        }
        @media (max-width: 768px) {
            .container {
                flex-direction: column;
            }
            .chat-list {
                width: 100%;
                height: 150px;
                overflow-y: auto;
            }
            .chat-box {
                height: calc(100% - 150px);
            }
            .message-input {
                position: relative;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="chat-list">
            <h2>Sessions</h2>
            <!-- Sessions will be added here -->
        </div>
        <div class="chat-box">
            <button class="reset-button" onclick="resetChat()">Reset</button>
            <h2>Chat</h2>
            <div id="chat-messages" style="margin-bottom: 60px;">
                <!-- Messages will be displayed here -->
            </div>
            <div class="message-input">
                <textarea id="message-input" placeholder="Type a message..." onkeydown="handleInput(event)"></textarea>
                <button onclick="sendMessage()">Send</button>
            </div>
        </div>
    </div>

    <script>
        let eventSource = null;
        let aiMessageDiv = null;
        let isGenerating = false;
        
        function sendMessage() {
          if (isGenerating) return;
          
          const input = document.getElementById('message-input');
          const message = input.value.trim();
          if (!message) return;
          
          appendMessage(message, 'user');
          input.value = '';
          input.disabled = true;
          isGenerating = true;
          
          if (eventSource) {
            eventSource.close();
          }
          
          fetch('/message', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message })
          })
          .then(response => {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            function processStream({ done, value }) {
              if (done) {
                isGenerating = false;
                input.disabled = false;
                input.focus();
                aiMessageDiv = null;
                return;
              }
              
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n\n');
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.substring(6);
                  
                  if (data === '[DONE]') {
                    isGenerating = false;
                    input.disabled = false;
                    input.focus();
                    aiMessageDiv = null;
                    return;
                  }
                  
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.content) {
                      // Convert escaped newlines back to actual newlines
                      const contentWithLineBreaks = parsed.content.replace(/\\n/g, '\n');
                      appendMessage(contentWithLineBreaks, 'ai');
                    }
                  } catch (e) {
                    console.error('Error parsing JSON:', e, 'Data:', data);
                  }
                }
              }
              
              return reader.read().then(processStream);
            }
            
            return reader.read().then(processStream);
          })
          .catch(error => {
            console.error('Error:', error);
            isGenerating = false;
            input.disabled = false;
            input.focus();
          });
        }
        
        function resetChat() {
          fetch('/reset', { method: 'POST' });
          document.getElementById('chat-messages').innerHTML = '';
          aiMessageDiv = null;
        }
        
        function appendMessage(text, sender) {
          const chatMessages = document.getElementById('chat-messages');
          if (sender === 'ai') {
            if (aiMessageDiv) {
              // Append to existing AI message
              aiMessageDiv.textContent += text;
            } else {
              // Create new AI message
              aiMessageDiv = document.createElement('div');
              aiMessageDiv.classList.add('message', 'ai-message');
              aiMessageDiv.textContent = text;
              chatMessages.appendChild(aiMessageDiv);
            }
          } else {
            // Create user message
            const msgDiv = document.createElement('div');
            msgDiv.classList.add('message', 'user-message');
            msgDiv.textContent = text;
            chatMessages.appendChild(msgDiv);
          }
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        
        function handleInput(event) {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
          }
        }
        
        window.onload = () => {
          const input = document.getElementById('message-input');
          input.addEventListener('keydown', handleInput);
          input.focus();
        };
        </script>
        
</body>
</html>
    `;
  }
}

export default ChatView;