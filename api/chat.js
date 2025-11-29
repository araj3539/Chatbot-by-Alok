// File: /api/chat.js
// This version fixes the message ordering race condition by saving messages sequentially.

import admin from 'firebase-admin';

// --- Firebase Admin SDK Initialization ---
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_SDK))
        });
    } catch (e) {
        console.error("Firebase admin initialization error", e.stack);
    }
}

const db = admin.firestore();

// --- Gemini API Helper ---
const callGemini = async (payload, geminiApiKey) => {
   // Use this for the fast, cost-effective model
const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
    const safetySettings = [{ "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE" }];
    const response = await fetch(geminiApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, safetySettings }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message || `HTTP error! status: ${response.status}`);
    }
    return response.json();
};


// --- Main API Handler ---
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // --- 1. Authentication ---
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    let decodedToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
        console.error("Error verifying auth token:", error);
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    const userId = decodedToken.uid;

    // --- 2. Process Request ---
    const { history, systemInstruction, chatId: currentChatId } = req.body;
    const userQuery = history[history.length - 1].parts[0].text;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    let chatId = currentChatId;
    let botResponseText = "Sorry, I encountered an error. Please try again.";
    let geminiResponseData;

    try {
        // --- 3. Handle New Chat Creation in Firestore ---
        if (!chatId) {
            const chatRef = await db.collection('users').doc(userId).collection('chats').add({
                title: 'New Chat',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                userId: userId
            });
            chatId = chatRef.id;
        }

        // --- 4. The "Router" Call ---
        const routerSystemInstruction = {
            role: "system",
            parts: [{
                text: `You are an intelligent routing agent. Analyze the user's query and decide the appropriate tool. Respond in a valid JSON format with a single key "tool_to_use". Possible values are: "date_time_query", "web_search", or "general_conversation".\n\nExamples:\n- "what time is it in tokyo?" -> {"tool_to_use": "date_time_query"}\n- "who won the last world cup?" -> {"tool_to_use": "web_search"}\n- "explain quantum physics" -> {"tool_to_use": "general_conversation"}\n\nRespond ONLY with the JSON object.`
            }]
        };

        let selectedTool = 'general_conversation'; // Default tool
        try {
            const routerPayload = {
                contents: [{ role: 'user', parts: [{ text: userQuery }] }],
                system_instruction: routerSystemInstruction,
            };
            const routerResponse = await callGemini(routerPayload, geminiApiKey);
            const routerResultText = routerResponse.candidates[0]?.content?.parts[0]?.text.trim();
            const jsonResponse = JSON.parse(routerResultText.replace(/```json|```/g, ''));
            selectedTool = jsonResponse.tool_to_use;
        } catch (error) {
            console.error("Error in Router Call, defaulting to general conversation:", error);
            selectedTool = 'general_conversation';
        }

        // --- 5. Execute Action Based on Router's Decision ---
        switch (selectedTool) {
            case 'date_time_query':
                const now = new Date();
                const timeString = now.toLocaleString('en-US', {
                    hour12: true, weekday: 'long', year: 'numeric', month: 'long',
                    day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
                });
                const textGenPrompt = `The current date and time is: ${timeString}. The user's question was: "${userQuery}". Generate a natural language response based on this.`;
                const textGenPayload = {
                    contents: [{ role: 'user', parts: [{ text: textGenPrompt }] }],
                    system_instruction: {
                        role: "system",
                        parts: [{ text: "You are a helpful assistant that answers questions about date and time." }]
                    }
                };
                geminiResponseData = await callGemini(textGenPayload, geminiApiKey);
                break;

            case 'web_search':
                const host = req.headers['x-forwarded-host'] || req.headers['host'];
                const protocol = req.headers['x-forwarded-proto'] || 'http';
                const searchApiUrl = `${protocol}://${host}/api/web-search`;
                const searchResponse = await fetch(searchApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: userQuery })
                });
                let searchResultsContext = 'No web search results found.';
                if (searchResponse.ok) {
                    const searchData = await searchResponse.json();
                    searchResultsContext = searchData.context;
                }
                const finalPrompt = `You are a helpful AI assistant. Synthesize a single, concise, and accurate answer to the user's question using the provided web search snippets as your primary source. Provide the answer directly as if you already knew it.\n\n` +
                    `[Web Search Snippets]:\n${searchResultsContext}\n\n` +
                    `[User's Original Question]:\n${userQuery}\n\n` +
                    `[Final Answer]:`;
                const finalPayload = {
                    contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
                    system_instruction: systemInstruction
                };
                geminiResponseData = await callGemini(finalPayload, geminiApiKey);
                break;

            case 'general_conversation':
            default:
                const generalPayload = {
                    contents: history,
                    system_instruction: systemInstruction
                };
                geminiResponseData = await callGemini(generalPayload, geminiApiKey);
                break;
        }

        botResponseText = geminiResponseData.candidates[0]?.content?.parts[0]?.text || botResponseText;

        // --- 6. Save Conversation Turn to Firestore (THE FIX) ---
        const messagesCollection = db.collection('users').doc(userId).collection('chats').doc(chatId).collection('messages');

        // Step 6a: Save the user's message first and wait for it to complete.
        await messagesCollection.add({
            role: 'user',
            text: userQuery,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Step 6b: Then, save the bot's response.
        await messagesCollection.add({
            role: 'model',
            text: botResponseText,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // --- 7. Send Final Response to Client ---
        res.status(200).json({ ...geminiResponseData, chatId: chatId });

    } catch (error) {
        console.error("Error in main chat handler:", error);
        res.status(500).json({ error: error.message || "An unexpected error occurred." });
    }
}
