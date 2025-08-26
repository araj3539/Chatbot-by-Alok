// --- Firebase Initialization ---
const firebaseConfig = {
    apiKey: "AIzaSyAwOc3hEpqeaN5bkeN4eenckdbs-OxM84U",
    authDomain: "namasteai-chatbot.firebaseapp.com",
    projectId: "namasteai-chatbot",
    storageBucket: "namasteai-chatbot.appspot.com",
    messagingSenderId: "10477791349",
    appId: "1:10477791349:web:71a99aa6fc239f7980b03c"
};
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- DOM Element References ---
const authContainer = document.getElementById('auth-container');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const signinBtn = document.getElementById('signin-btn');
const signupBtn = document.getElementById('signup-btn');
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
const userSettingsBtn = document.getElementById('user-settings-btn');
const userEmailDisplay = document.getElementById('user-email-display');
const userMenuDropdown = document.getElementById('user-menu-dropdown');
const logoutMenuBtn = document.getElementById('logout-menu-btn');
const logoutModal = document.getElementById('logout-modal');
const cancelLogoutBtn = document.getElementById('cancel-logout-btn');
const confirmLogoutBtn = document.getElementById('confirm-logout-btn');

const systemInstruction = {
    role: "system",
    parts: [{
        text: `Your name is NamasteAI created by Alok Raj. You are an intelligent chatbot with reasoning capability.
        Follow these formatting rules strictly in all your responses:
    1.  **Code Blocks**: ALWAYS enclose code snippets in triple backticks. Specify the language for syntax highlighting. For example: \`\`\`javascript\nconsole.log("Hello");\n\`\`\`
    2.  **Mathematical Notation**: ALWAYS use KaTeX for math. For inline formulas, use single dollar signs, like $E=mc^2$. For block-level formulas, use double dollar signs, like $$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$. IMPORTANT: Inside KaTeX blocks ($...$) you MUST escape all backslashes. For example, write '\\\\frac' instead of '\\frac', and '\\\\textbf' instead of '\\textbf'.
    3.  **General Formatting**: Use Markdown for lists, bolding, italics, and other text formatting.` }]
};

// --- State Management ---
let currentUser = null;
let currentChatHistory = [];
let allChats = [];
let currentChatId = null;
let abortController;
let isGenerating = false;

// --- Authentication ---
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        userEmailDisplay.textContent = user.email;
        authContainer.style.display = 'none';
        appContainer.classList.remove('hidden');
        loadUserChats();
    } else {
        currentUser = null;
        authContainer.style.display = 'flex';
        appContainer.classList.add('hidden');
        messageList.innerHTML = '';
        chatHistoryList.innerHTML = '';
    }
});

const handleSignUp = () => {
    auth.createUserWithEmailAndPassword(emailInput.value, passwordInput.value)
        .catch(error => alert("Error: " + error.message));
};

const handleSignIn = () => {
    auth.signInWithEmailAndPassword(emailInput.value, passwordInput.value)
        .catch(error => alert("Error: " + error.message));
};

const handleSignOut = () => {
    auth.signOut().catch(error => console.error("Sign out error", error));
};

// --- UI Rendering ---
const renderChatHistoryList = () => {
    chatHistoryList.innerHTML = '';
    allChats.forEach(chat => {
        const item = document.createElement('div');
        item.classList.add('history-item', 'relative');
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = chat.title;
        link.classList.add('block', 'p-3', 'rounded-lg', 'truncate', 'hover:bg-gray-700');
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
        chatHistoryList.append(item);
    });
};

const renderChatMessages = () => {
    messageList.innerHTML = '';
    currentChatHistory.forEach(msg => {
        if (msg.role !== 'system') {
            const sender = msg.role === 'user' ? 'user' : 'bot';
            const formattedMessage = sender === 'bot' ? marked.parse(msg.parts[0].text) : msg.parts[0].text;
            appendMessage(formattedMessage, sender);
        }
    });
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
        // This is the fix: render KaTeX math in the new message
        renderMathInElement(messageBubble, {
            delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "$", right: "$", display: false },
                { left: "\\(", right: "\\)", display: false },
                { left: "\\[", right: "\\]", display: true }
            ]
        });

        messageBubble.querySelectorAll('pre code').forEach((el) => {
            Prism.highlightElement(el);
        });
    }
    messageWrapper.appendChild(messageBubble);
    messageList.appendChild(messageWrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showTypingIndicator(show) {
    let indicator = messageList.querySelector('#typing-indicator');
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

// --- Chat Logic ---
const startNewChat = () => {
    currentChatId = null;
    const welcomeMessage = "Hello! How can I help you today?";
    currentChatHistory = [
        systemInstruction,
        { role: "model", parts: [{ text: welcomeMessage }] }
    ];
    renderChatMessages();
    renderChatHistoryList();
    closeSidebar();
};

async function loadUserChats() {
    if (!currentUser) return;
    try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/get-chats', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to load chats.');
        const chats = await response.json();
        allChats = chats;
        renderChatHistoryList();
        if (allChats.length > 0) {
            loadChat(allChats[0].id);
        } else {
            startNewChat();
        }
    } catch (error) {
        console.error('Error loading user chats:', error);
    }
}

const loadChat = async (chatId) => {
    if (!currentUser) return;
    currentChatId = chatId;
    renderChatHistoryList();
    messageList.innerHTML = '';
    showTypingIndicator(true);
    try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/get-messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ chatId: chatId })
        });
        if (!response.ok) throw new Error('Failed to load messages.');
        const messages = await response.json();
        currentChatHistory = [systemInstruction];
        messages.forEach(msg => {
            currentChatHistory.push({ role: msg.role, parts: [{ text: msg.text }] });
        });
        renderChatMessages();
    } catch (error) {
        console.error('Error loading chat messages:', error);
        appendMessage('<strong>Error:</strong> Could not load this conversation.', 'bot');
    } finally {
        showTypingIndicator(false);
    }
};

const deleteChat = async (chatId) => {
    if (!currentUser) return;
    try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/delete-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ chatId: chatId })
        });
        if (!response.ok) throw new Error('Failed to delete chat.');
        allChats = allChats.filter(c => c.id !== chatId);
        if (currentChatId === chatId) {
            if (allChats.length > 0) { loadChat(allChats[0].id); } else { startNewChat(); }
        }
        renderChatHistoryList();
    } catch (error) {
        console.error("Error deleting chat:", error);
        alert("Could not delete the chat.");
    }
};

function isSubstantialMessage(message) {
    const genericGreetings = ['hi', 'hello', 'hey', 'yo', 'sup'];
    const normalizedMessage = message.toLowerCase().trim().replace(/[.,!?;]/g, '');
    return !genericGreetings.includes(normalizedMessage) || message.split(' ').length > 3;
}

async function renameChatWithAI(chatId, chatHistory) {
    if (!currentUser) return;
    try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/rename-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ history: chatHistory.slice(1, 5), chatId: chatId })
        });
        if (!response.ok) return;
        const result = await response.json();
        if (result.title) {
            const chatInState = allChats.find(c => c.id === chatId);
            if (chatInState) { chatInState.title = result.title; }
            renderChatHistoryList();
        }
    } catch (error) {
        console.error("Error auto-renaming chat:", error);
    }
}

async function handleSendMessage() {
    if (isGenerating || !currentUser) return;
    const userMessage = userInput.value.trim();
    if (!userMessage) return;

    isGenerating = true;
    const isNewChat = !currentChatId;
    appendMessage(userMessage, 'user');
    currentChatHistory.push({ role: "user", parts: [{ text: userMessage }] });
    userInput.value = '';
    showTypingIndicator(true);
    sendBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    abortController = new AbortController();

    try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                history: currentChatHistory.slice(1),
                systemInstruction: systemInstruction,
                chatId: currentChatId
            }),
            signal: abortController.signal
        });
        if (!response.ok) throw new Error((await response.json()).error || 'HTTP error!');

        const result = await response.json();

        if (isNewChat && result.chatId) {
            currentChatId = result.chatId;
            const newChat = { id: result.chatId, title: "New Chat" };
            allChats.unshift(newChat);
            renderChatHistoryList();
        }

        const botMessage = result.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, something went wrong.";
        appendMessage(marked.parse(botMessage), 'bot');
        currentChatHistory.push({ role: "model", parts: [{ text: botMessage }] });

        const currentChatObject = allChats.find(c => c.id === currentChatId);
        if (currentChatObject && currentChatObject.title === "New Chat" && isSubstantialMessage(userMessage)) {
            renameChatWithAI(currentChatId, currentChatHistory);
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
        isGenerating = false;
    }
}

function handleStopGeneration() {
    if (abortController) {
        abortController.abort();
    }
}

// --- THIS IS THE FIX: Mobile Viewport Height Logic ---
const setAppHeight = () => {
    appContainer.style.height = `${window.innerHeight}px`;
};

// --- UI Event Listeners ---
if (signinBtn && signupBtn) {
    signinBtn.addEventListener('click', handleSignIn);
    signupBtn.addEventListener('click', handleSignUp);
}

sendBtn.addEventListener('click', handleSendMessage);
stopBtn.addEventListener('click', handleStopGeneration);
userInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') handleSendMessage(); });
newChatBtn.addEventListener('click', startNewChat);

// User Menu Logic
userSettingsBtn.addEventListener('click', () => userMenuDropdown.classList.toggle('hidden'));
logoutMenuBtn.addEventListener('click', () => {
    logoutModal.classList.remove('hidden');
    userMenuDropdown.classList.add('hidden');
});
cancelLogoutBtn.addEventListener('click', () => logoutModal.classList.add('hidden'));
confirmLogoutBtn.addEventListener('click', () => {
    handleSignOut();
    logoutModal.classList.add('hidden');
});

// Mobile Sidebar & Height
const openSidebar = () => { sidebar.classList.remove('-translate-x-full'); sidebarOverlay.classList.remove('hidden'); };
const closeSidebar = () => { sidebar.classList.add('-translate-x-full'); sidebarOverlay.classList.add('hidden'); };
menuBtn.addEventListener('click', openSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);
window.addEventListener('resize', setAppHeight);

// --- Speech to Text (Voice Recognition) Logic ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
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
        micBtn.classList.add('text-red-500');
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
        userInput.value = event.results[0][0].transcript;
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        userInput.placeholder = "Sorry, I couldn't hear that.";
    };
} else {
    console.log("Speech recognition not supported in this browser.");
    micBtn.style.display = 'none';
}

// Initial setup call
setAppHeight();