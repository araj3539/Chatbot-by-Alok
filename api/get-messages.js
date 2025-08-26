import admin from 'firebase-admin';

// Initialize Firebase Admin SDK if it hasn't been already
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
    // This endpoint only accepts POST requests to include the chatId in the body
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 1. Authenticate the user
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    let decodedToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    const userId = decodedToken.uid;

    // 2. Get chatId from the request body
    const { chatId } = req.body;
    if (!chatId) {
        return res.status(400).json({ error: 'Chat ID is required.' });
    }

    // 3. Fetch messages from Firestore
    try {
        const messagesRef = db.collection('users').doc(userId).collection('chats').doc(chatId).collection('messages');
        // Order by creation date to get them in the correct sequence
        const snapshot = await messagesRef.orderBy('createdAt', 'asc').get();

        if (snapshot.empty) {
            return res.status(200).json([]);
        }

        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            role: doc.data().role,
            text: doc.data().text,
        }));

        res.status(200).json(messages);

    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ error: 'Failed to fetch messages.' });
    }
}