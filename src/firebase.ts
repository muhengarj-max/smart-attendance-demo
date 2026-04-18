import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import {
  OAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword,
  signInWithPopup,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

type FirebaseServices = {
  app: FirebaseApp;
  db: Firestore;
  storage: FirebaseStorage;
  auth: Auth;
  analytics: Analytics | null;
};

let servicesPromise: Promise<FirebaseServices | null> | null = null;
const isLocalDev = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);

const loadFirebaseConfig = async () => {
  const response = await fetch("/api/firebase-config", { credentials: "same-origin" });
  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<FirebaseOptions>;
};

export const initializeFirebase = async () => {
  if (!servicesPromise) {
    servicesPromise = loadFirebaseConfig()
      .then(async (config) => {
        if (!config) {
          if (isLocalDev) {
            console.warn("Firebase is disabled. Missing runtime config.");
          }
          return null;
        }

        const app = getApps()[0] ?? initializeApp(config);
        const analytics = await isSupported()
          .then((supported) => (supported ? getAnalytics(app) : null))
          .catch(() => null);

        return {
          app,
          db: getFirestore(app),
          storage: getStorage(app),
          auth: getAuth(app),
          analytics,
        };
      })
      .catch((error) => {
        if (isLocalDev) {
          console.warn("Firebase is disabled.", error);
        }
        return null;
      });
  }

  return servicesPromise;
};

export const getFirebaseApp = async () => {
  const services = await initializeFirebase();
  return services?.app ?? null;
};

export const getFirestoreDb = async () => {
  const services = await initializeFirebase();
  return services?.db ?? null;
};

export const getFirebaseStorage = async () => {
  const services = await initializeFirebase();
  return services?.storage ?? null;
};

export const signInWithGoogle = async () => {
  const services = await initializeFirebase();
  if (!services) {
    throw new Error("Google account login is not configured");
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(services.auth, provider);
  return credential.user.getIdToken();
};

export const signInWithApple = async () => {
  const services = await initializeFirebase();
  if (!services) {
    throw new Error("Apple account login is not configured");
  }

  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  const credential = await signInWithPopup(services.auth, provider);
  return credential.user.getIdToken();
};

export const registerWithEmailPassword = async (email: string, password: string) => {
  const services = await initializeFirebase();
  if (!services) {
    throw new Error("Firebase account registration is not configured");
  }

  const credential = await createUserWithEmailAndPassword(services.auth, email, password);
  return credential.user.getIdToken();
};

export const signInWithEmailPassword = async (email: string, password: string) => {
  const services = await initializeFirebase();
  if (!services) {
    throw new Error("Firebase account login is not configured");
  }

  const credential = await firebaseSignInWithEmailAndPassword(services.auth, email, password);
  return credential.user.getIdToken();
};

export const sendFirebasePasswordReset = async (email: string) => {
  const services = await initializeFirebase();
  if (!services) {
    throw new Error("Password reset is not configured");
  }

  await sendPasswordResetEmail(services.auth, email);
};

export const firebaseAnalytics = initializeFirebase().then((services) => services?.analytics ?? null);
