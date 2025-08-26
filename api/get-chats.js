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
    if (req.method !== 'GET') {
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

    // 2. Fetch chat history from Firestore
    try {
        const chatsRef = db.collection('users').doc(userId).collection('chats');
        
        // --- THIS IS THE FIX ---
        // Order by the 'createdAt' field in descending order (newest first)
        const snapshot = await chatsRef.orderBy('createdAt', 'desc').get();

        if (snapshot.empty) {
            return res.status(200).json([]);
        }

        const chats = snapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title,
        }));

        res.status(200).json(chats);

    } catch (error) {
        console.error("Error fetching chat history:", error);
        res.status(500).json({ error: 'Failed to fetch chat history.' });
    }
}
