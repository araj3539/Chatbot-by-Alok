// File: /api/delete-chat.js
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

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 1. Authenticate the user
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    let decodedToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    const userId = decodedToken.uid;

    // 2. Get chatId from request
    const { chatId } = req.body;
    if (!chatId) {
        return res.status(400).json({ error: 'Chat ID is required.' });
    }

    // 3. Delete the chat document from Firestore
    try {
        const chatRef = db.collection('users').doc(userId).collection('chats').doc(chatId);
        
        // Note: For a full production app, you'd also want to delete the 'messages'
        // subcollection, which requires a more complex cloud function.
        // For now, just deleting the chat document will make it disappear from the app.
        await chatRef.delete();

        res.status(200).json({ success: true, message: 'Chat deleted successfully.' });

    } catch (error) {
        console.error("Error deleting chat:", error);
        res.status(500).json({ error: 'Failed to delete chat.' });
    }
}