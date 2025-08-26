// File: /api/complete-auth.js
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
const auth = admin.auth();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { email, token } = req.body;

    if (!email || !token) {
        return res.status(400).json({ error: 'Email and token are required.' });
    }

    try {
        // Step 1: Get the user by email to retrieve their UID
        const userRecord = await auth.getUserByEmail(email);
        const uid = userRecord.uid;

        // Step 2: Create a custom sign-in token for the user
        // This token allows the original device to sign in securely
        const customToken = await auth.createCustomToken(uid);

        // Step 3: Update the Firestore document that the original device is listening to
        const tokenRef = db.collection('authTokens').doc(token);
        await tokenRef.set({
            status: 'verified',
            customToken: customToken,
            verifiedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Step 4: Respond with success to the device that clicked the link
        res.status(200).json({ success: true, message: 'Authentication completed.' });

    } catch (error) {
        console.error("Error in complete-auth handler:", error);
        // Clean up the token if something goes wrong
        await db.collection('authTokens').doc(token).delete().catch(() => {});
        res.status(500).json({ error: error.message || "An unexpected error occurred." });
    }
}
