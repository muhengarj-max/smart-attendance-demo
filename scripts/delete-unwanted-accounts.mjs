import "dotenv/config";
import admin from "firebase-admin";

const blockedNames = new Set([
  "replace-with-super-admin-username",
  "Mikanu",
  "mikanu",
]);

const getServiceAccount = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSO;
  if (!raw) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON in .env");
  }

  return JSON.parse(raw.replace(/^['"]|['"]$/g, ""));
};

const app = admin.apps.length
  ? admin.app()
  : admin.initializeApp({
      credential: admin.credential.cert(getServiceAccount()),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });

const db = admin.firestore(app);
const auth = admin.auth(app);

const matchesBlockedName = (value) => {
  if (!value) return false;
  return blockedNames.has(String(value).trim());
};

const deleteFirestoreUsers = async () => {
  const snapshot = await db.collection("users").get();
  const deletions = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    const shouldDelete =
      matchesBlockedName(doc.id) ||
      matchesBlockedName(data.username) ||
      matchesBlockedName(data.name) ||
      matchesBlockedName(data.displayName) ||
      matchesBlockedName(data.email);

    if (shouldDelete) {
      deletions.push({ id: doc.id, data });
    }
  });

  for (const user of deletions) {
    await db.collection("users").doc(user.id).delete();
    console.log(`Deleted Firestore user: ${user.id}`);

    try {
      await auth.deleteUser(user.id);
      console.log(`Deleted Firebase Auth user by uid: ${user.id}`);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") {
        console.warn(`Could not delete Auth user ${user.id}: ${error.message}`);
      }
    }
  }

  return deletions.length;
};

const deleteAuthUsers = async () => {
  let nextPageToken;
  let deleted = 0;

  do {
    const result = await auth.listUsers(1000, nextPageToken);
    nextPageToken = result.pageToken;

    for (const user of result.users) {
      const shouldDelete =
        matchesBlockedName(user.uid) ||
        matchesBlockedName(user.displayName) ||
        matchesBlockedName(user.email);

      if (!shouldDelete) continue;

      await auth.deleteUser(user.uid);
      deleted += 1;
      console.log(`Deleted Firebase Auth user: ${user.uid}`);
    }
  } while (nextPageToken);

  return deleted;
};

const firestoreDeleted = await deleteFirestoreUsers();
const authDeleted = await deleteAuthUsers();

console.log(`Cleanup complete. Firestore users deleted: ${firestoreDeleted}. Auth users deleted: ${authDeleted}.`);
