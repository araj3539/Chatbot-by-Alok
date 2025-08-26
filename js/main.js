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
const appContainer = document.getElementById('app-container');

// Auth Views
const signinView = document.getElementById('signin-view');
const signupView = document.getElementById('signup-view');
const verificationSuccessView = document.getElementById('verification-success-view');
const showSignupViewLinks = document.querySelectorAll('#show-signup-view');
const showSigninViewLinks = document.querySelectorAll('#show-signin-view');

// Sign In Elements
const signinStep1 = document.getElementById('signin-step-1');
const signinStep2 = document.getElementById('signin-step-2');
const signinEmailInput = document.getElementById('signin-email-input');
const signinPasswordInput = document.getElementById('signin-password-input');
const signinBtn = document.getElementById('signin-btn');
const signinEmailLinkBtn = document.getElementById('signin-email-link-btn');
const signinMessage = document.getElementById('signin-message');

// Sign Up Elements
const signupStep1 = document.getElementById('signup-step-1');
const signupStep2 = document.getElementById('signup-step-2');
const signupEmailInput = document.getElementById('signup-email-input');
const signupPasswordInput = document.getElementById('signup-password-input');
const signupConfirmPasswordInput = document.getElementById('signup-confirm-password-input');
const signupSendLinkBtn = document.getElementById('signup-send-link-btn');
const signupCreateAccountBtn = document.getElementById('signup-create-account-btn');
const signupMessage = document.getElementById('signup-message');


// Main App Elements
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
    parts: [{ text: `Your name is NamasteAI created by Alok Raj. You are an intelligent chatbot with reasoning capability.
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

// --- Authentication UI Logic ---
const switchToSignUpView = () => {
    signinView.classList.add('hidden');
    verificationSuccessView.classList.add('hidden');
    signupView.classList.remove('hidden');
};
const switchToSigninView = () => {
    signupView.classList.add('hidden');
    verificationSuccessView.classList.add('hidden');
    signinView.classList.remove('hidden');
};
const switchToVerificationSuccessView = () => {
    signinView.classList.add('hidden');
    signupView.classList.add('hidden');
    verificationSuccessView.classList.remove('hidden');
};

showSignupViewLinks.forEach(link => link.addEventListener('click', (e) => { e.preventDefault(); switchToSignUpView(); }));
showSigninViewLinks.forEach(link => link.addEventListener('click', (e) => { e.preventDefault(); switchToSigninView(); }));


// --- Authentication Core Logic ---
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

const handleEmailLinkFlow = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const authToken = urlParams.get('authToken');
    const isSignUp = urlParams.get('mode') === 'signup';

    if (auth.isSignInWithEmailLink(window.location.href) && authToken) {
        let email = window.localStorage.getItem(isSignUp ? 'emailForSignUp' : 'emailForSignIn');
        if (!email) {
            email = window.prompt('Please provide your email for confirmation');
        }

        if (email) {
            // This device's job is to complete the auth and notify the other device.
            fetch('/api/complete-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, token: authToken })
            }).then(res => {
                if (res.ok) {
                    switchToVerificationSuccessView();
                } else {
                    alert('Verification failed. Please try again.');
                }
            });
        }
    }
};


const handleAuthError = (error, type = 'signin') => {
    const messageElement = type === 'signin' ? signinMessage : signupMessage;
    messageElement.textContent = `Error: ${error.message}`;
    messageElement.classList.remove('text-green-400');
    messageElement.classList.add('text-red-400');
};

// Sign In Handlers
const handleSignIn = () => {
    auth.signInWithEmailAndPassword(signinEmailInput.value, signinPasswordInput.value)
        .catch(handleAuthError);
};

const handlePasswordlessSignIn = () => {
    const email = signinEmailInput.value;
    if (!email) { alert("Please enter your email address."); return; }

    const authToken = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const url = `${window.location.origin}${window.location.pathname}?authToken=${authToken}`;
    const actionCodeSettings = { url: url, handleCodeInApp: true };

    auth.sendSignInLinkToEmail(email, actionCodeSettings)
        .then(() => {
            window.localStorage.setItem('emailForSignIn', email);
            signinStep1.classList.add('hidden');
            signinStep2.classList.remove('hidden');

            // Listen for the verification from the other device
            const unsub = db.collection('authTokens').doc(authToken).onSnapshot(doc => {
                if (doc.exists && doc.data().status === 'verified') {
                    unsub(); // Stop listening
                    auth.signInWithCustomToken(doc.data().customToken).catch(handleAuthError);
                    doc.ref.delete(); // Clean up the token
                }
            });
        })
        .catch(handleAuthError);
};

// Sign Up Handlers
const handleSignUpSendLink = () => {
    const email = signupEmailInput.value;
    if (!email) { alert("Please enter your email address."); return; }
    
    const authToken = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const url = `${window.location.origin}${window.location.pathname}?authToken=${authToken}&mode=signup`;
    const actionCodeSettings = { url: url, handleCodeInApp: true };

    auth.sendSignInLinkToEmail(email, actionCodeSettings)
        .then(() => {
            window.localStorage.setItem('emailForSignUp', email);
            signupMessage.textContent = `A verification link has been sent to ${email}. Please check your inbox to continue.`;
            signupMessage.classList.add('text-green-400');
        })
        .catch((error) => handleAuthError(error, 'signup'));
};

const handleCreateAccount = () => {
    const password = signupPasswordInput.value;
    const confirmPassword = signupConfirmPasswordInput.value;
    const email = window.localStorage.getItem('emailForSignUp');

    if (!email) {
        handleAuthError({ message: "Could not find your verified email. Please start the sign-up process again." }, 'signup');
        return;
    }
    if (password !== confirmPassword) {
        handleAuthError({ message: "Passwords do not match." }, 'signup');
        return;
    }
    if (password.length < 6) {
        handleAuthError({ message: "Password should be at least 6 characters." }, 'signup');
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then(() => {
            window.localStorage.removeItem('emailForSignUp');
        })
        .catch((error) => handleAuthError(error, 'signup'));
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
        
        renderMathInElement(messageBubble, {
            delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "$", right: "$", display: false }
            ]
        });

        messageBubble.querySelectorAll('pre code').forEach((el) => {
            Prism.highlightElement(el);
        });
    }

    messageWrapper.appendChild(messageWrapper);
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

const setAppHeight = () => {
    appContainer.style.height = `${window.innerHeight}px`;
};

// --- UI Event Listeners ---
signinBtn.addEventListener('click', handleSignIn);
signinEmailLinkBtn.addEventListener('click', handlePasswordlessSignIn);
signupSendLinkBtn.addEventListener('click', handleSignUpSendLink);
signupCreateAccountBtn.addEventListener('click', handleCreateAccount);

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

// --- Initial setup calls ---
setAppHeight();
handleEmailLinkFlow(); // Check for any kind of email link on page load
