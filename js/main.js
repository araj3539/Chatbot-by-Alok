// DOM Element References
const appContainer = document.getElementById('app-container');
const chatContainer = document.getElementById('chat-container');
const messageList = document.getElementById('message-list');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const stopBtn = document.getElementById('stop-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const chatHistoryList = document.getElementById('chat-history-list');
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const micBtn = document.getElementById('mic-btn');

const systemInstruction = {
    role: "system",
    parts: [{
        text: "Your name is NamasteAI created by Alok Raj. You are an AI Tutor Chatbot, an intelligent study companion designed to help students learn, revise, and stay motivated. You act as both a study assistant and a mentor, providing subject explanations, solving doubts, giving practice problems, and offering motivational support to keep learners engaged. when someone do ask about creator then tell name only nothing more about creator."
    }]
};

// --- State Management ---
let currentChatHistory = [];
let allChats = [];
let currentChatId = null;
let abortController;
let isGenerating = false; // To prevent concurrent submissions

// --- Local Storage Functions ---
const saveAllChats = () => {
    if (allChats.length > 50) {
        allChats = allChats.slice(allChats.length - 50);
    }
    localStorage.setItem('aiTutorAllChats', JSON.stringify(allChats));
};

const loadAllChats = () => {
    const savedChats = localStorage.getItem('aiTutorAllChats');
    allChats = savedChats ? JSON.parse(savedChats) : [];
};

// --- UI Rendering Functions ---
const renderChatHistoryList = () => {
    chatHistoryList.innerHTML = '';
    allChats.forEach(chat => {
        const item = document.createElement('div');
        item.classList.add('history-item', 'relative');

        const link = document.createElement('a');
        link.href = '#';
        link.textContent = chat.title;
        link.classList.add('block', 'p-3', 'rounded-lg', 'truncate', 'hover:bg-gray-700', 'transition-colors', 'duration-200', 'w-full');
        if (chat.id === currentChatId) {
            link.classList.add('bg-gray-700/50');
        }
        link.onclick = (e) => {
            e.preventDefault();
            loadChat(chat.id);
            closeSidebar();
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.classList.add('delete-btn', 'absolute', 'right-2', 'top-1/2', '-translate-y-1/2', 'text-gray-400', 'hover:text-red-500', 'p-1');
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        };

        item.appendChild(link);
        item.appendChild(deleteBtn);
        chatHistoryList.prepend(item);
    });
};

const renderChatMessages = () => {
    messageList.innerHTML = '';
    currentChatHistory.forEach(msg => {
        if (msg.role !== 'system') {
            const sender = msg.role === 'user' ? 'user' : 'bot';
            const messageText = msg.parts[0].text;
            const formattedMessage = sender === 'bot' ? marked.parse(messageText) : messageText;
            appendMessage(formattedMessage, sender);
        }
    });
    Prism.highlightAll();
};

function appendMessage(message, sender) {
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('flex', sender === 'user' ? 'justify-end' : 'justify-start');
    const messageBubble = document.createElement('div');
    messageBubble.classList.add('chat-bubble', 'p-4', 'rounded-2xl', sender === 'user' ? 'user-bubble' : 'bot-bubble', 'shadow-md');
    if (sender === 'user') {
        messageBubble.textContent = message;
    } else {
        messageBubble.innerHTML = message;
    }
    messageWrapper.appendChild(messageBubble);
    messageList.appendChild(messageWrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showTypingIndicator(show) {
    let indicator = messageList.querySelector('#typing-indicator');;
    if (show) {
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'typing-indicator';
            indicator.classList.add('flex', 'justify-start');
            indicator.innerHTML = `<div class="chat-bubble bot-bubble p-4 rounded-2xl shadow-md"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
            messageList.appendChild(indicator);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    } else {
        if (indicator) indicator.remove();
    }
}

// --- Chat Logic Functions ---
const startNewChat = () => {
    currentChatId = null;
    const welcomeMessage = "Hello! I'm your AI Tutor. How can I help you with your studies today?";
    currentChatHistory = [
        systemInstruction,
        { role: "model", parts: [{ text: welcomeMessage }] }
    ];
    renderChatMessages();
    renderChatHistoryList(); // Deselects any active chat
    closeSidebar();
};

const loadChat = (chatId) => {
    const chat = allChats.find(c => c.id === chatId);
    if (chat) {
        currentChatId = chat.id;
        currentChatHistory = [...chat.history];
        renderChatMessages();
        renderChatHistoryList();
    }
};

const deleteChat = (chatId) => {
    allChats = allChats.filter(c => c.id !== chatId);
    saveAllChats();
    if (currentChatId === chatId) {
        if (allChats.length > 0) {
            loadChat(allChats[allChats.length - 1].id);
        } else {
            startNewChat();
        }
    }
    renderChatHistoryList();
};

function isSubstantialMessage(message) {
    const genericGreetings = ['hi', 'hello', 'hey', 'yo', 'sup', 'what\'s up', 'good morning', 'good afternoon', 'good evening'];
    const normalizedMessage = message.toLowerCase().trim().replace(/[.,!?;]/g, '');
    return !genericGreetings.includes(normalizedMessage) || message.split(' ').length > 3;
}

async function renameChatWithAI(chatObject) {
    try {
        const conversationForTitle = chatObject.history.slice(1, 5).map(m => `${m.role}: ${m.parts[0].text}`).join('\n');
        const prompt = `Based on the following conversation, create a short, concise title (2-4 words maximum). The title should be about the main subject. Do not include "AI Tutor", "Chatbot", or use quotes. Just return the title text.\n\nConversation:\n${conversationForTitle}`;

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                history: [{ role: 'user', parts: [{ text: prompt }] }],
                systemInstruction: { role: 'system', parts: [{ text: 'You are an expert at creating concise, relevant titles for conversations.' }] }
            })
        });

        if (!response.ok) return;

        const result = await response.json();
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const newTitle = result.candidates[0].content.parts[0].text;
            chatObject.title = newTitle.trim().replace(/"/g, '');
            saveAllChats();
            renderChatHistoryList();
        }
    } catch (error) {
        console.error("Error auto-renaming chat:", error);
    }
}

async function handleSendMessage() {
    // **FIX**: Prevent sending if a message is already being generated
    if (isGenerating) return;

    const userMessage = userInput.value.trim();
    if (!userMessage) return;

    // **FIX**: Set generating state to true
    isGenerating = true;

    const isNewChat = !currentChatId;
    let currentChatObject;

    if (isNewChat) {
        currentChatId = Date.now().toString();
        const newChat = {
            id: currentChatId,
            title: "New Chat",
            history: [...currentChatHistory]
        };
        allChats.push(newChat);
        currentChatObject = newChat;
    } else {
        currentChatObject = allChats.find(c => c.id === currentChatId);
    }

    appendMessage(userMessage, 'user');
    currentChatHistory.push({ role: "user", parts: [{ text: userMessage }] });
    currentChatObject.history = currentChatHistory;

    saveAllChats();
    if (isNewChat) renderChatHistoryList();

    userInput.value = '';
    showTypingIndicator(true);

    sendBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    abortController = new AbortController();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                history: currentChatHistory.slice(1).map(msg => ({
                    role: msg.role === 'model' ? 'model' : 'user',
                    parts: msg.parts
                })),
                systemInstruction: systemInstruction
            }),
            signal: abortController.signal
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        let botMessage = "Sorry, I couldn't get a response. Please try again.";
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            botMessage = result.candidates[0].content.parts[0].text;
        }

        showTypingIndicator(false);
        const formattedBotMessage = marked.parse(botMessage);
        appendMessage(formattedBotMessage, 'bot');
        Prism.highlightAll();
        currentChatHistory.push({ role: "model", parts: [{ text: botMessage }] });
        currentChatObject.history = currentChatHistory;
        saveAllChats();

        const needsRenaming = currentChatObject.title === "New Chat";
        if (needsRenaming && isSubstantialMessage(userMessage)) {
            renameChatWithAI(currentChatObject);
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            appendMessage('Generation stopped.', 'bot');
        } else {
            console.error("Error calling chat API:", error);
            appendMessage(`<strong>Error:</strong> ${error.message}`, 'bot');
        }
    } finally {
        showTypingIndicator(false);
        sendBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        // **FIX**: Reset generating state to false
        isGenerating = false;
    }
}

function handleStopGeneration() {
    if (abortController) {
        abortController.abort();
    }
}

// --- Mobile Viewport & Sidebar Logic ---
const setAppHeight = () => { appContainer.style.height = `${window.innerHeight}px`; };
const openSidebar = () => { sidebar.classList.remove('-translate-x-full'); sidebarOverlay.classList.remove('hidden'); };
const closeSidebar = () => { sidebar.classList.add('-translate-x-full'); sidebarOverlay.classList.add('hidden'); };

// --- Event Listeners & Initialization ---
sendBtn.addEventListener('click', handleSendMessage);
stopBtn.addEventListener('click', handleStopGeneration);
userInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') handleSendMessage(); });
newChatBtn.addEventListener('click', startNewChat);
menuBtn.addEventListener('click', openSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);
window.addEventListener('resize', setAppHeight);

window.onload = () => {
    setAppHeight();
    loadAllChats();
    if (allChats.length > 0) {
        loadChat(allChats[allChats.length - 1].id);
    } else {
        startNewChat();
    }
};
// --- Speech to Text (Voice Recognition) Logic ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false; // Process a single utterance
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    let isRecognizing = false;

    micBtn.addEventListener('click', () => {
        if (isRecognizing) {
            recognition.stop();
            return;
        }
        recognition.start();
    });

    recognition.onstart = () => {
        isRecognizing = true;
        micBtn.classList.add('text-red-500'); // Visual feedback: recording
        micBtn.querySelector('i').classList.add('fa-beat');
        userInput.placeholder = "Listening...";
    };

    recognition.onend = () => {
        isRecognizing = false;
        micBtn.classList.remove('text-red-500');
        micBtn.querySelector('i').classList.remove('fa-beat');
        userInput.placeholder = "Ask me anything...";
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value = transcript;
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        userInput.placeholder = "Sorry, I couldn't hear that.";
    };

} else {
    console.log("Speech recognition not supported in this browser.");
    micBtn.style.display = 'none'; // Hide button if not supported
}