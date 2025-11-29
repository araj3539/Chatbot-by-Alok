import admin from 'firebase-admin';

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_SDK))
        });
    } catch (e) {
        console.error("Firebase admin initialization error", e);
    }
}

const db = admin.firestore();

// Helper to call Gemini API
const callGemini = async (payload, geminiApiKey) => {
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
    const response = await fetch(geminiApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message || `HTTP error! status: ${response.status}`);
    }
    return response.json();
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 1. Authenticate the user
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) { return res.status(401).json({ error: 'Unauthorized' }); }

    let decodedToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    const userId = decodedToken.uid;

    // 2. Get data from request
    const { history, chatId } = req.body;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!history || history.length === 0 || !chatId) {
        return res.status(400).json({ error: 'History and Chat ID are required.' });
    }

    try {
        // 3. Ask Gemini for a title
        const conversationForTitle = history.map(m => `${m.role}: ${m.parts[0].text}`).join('\n');
        const prompt = `Based on the following conversation, create a short, concise title (2-5 words). Do not use quotes. Just return the title text.\n\nConversation:\n${conversationForTitle}`;
        const geminiReqPayload = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        };
        const geminiResponse = await callGemini(geminiReqPayload, geminiApiKey);
        const newTitle = (geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "Chat")
            .trim()
            .replace(/"/g, '');

        // 4. Update the chat title in Firestore
        const chatRef = db.collection('users').doc(userId).collection('chats').doc(chatId);
        await chatRef.update({ title: newTitle });

        // 5. Send the new title back to the client
        res.status(200).json({ title: newTitle });

    } catch (error) {
        console.error("Error in rename-chat handler:", error);
        res.status(500).json({ error: error.message || "An unexpected error occurred." });
    }
}