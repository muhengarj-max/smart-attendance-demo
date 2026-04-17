import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadString } from "firebase/storage";
import { getFirebaseStorage, getFirestoreDb } from "./firebase";

type AttendanceFirebasePayload = {
  name: string;
  reg: string;
  lat: number;
  lng: number;
  imageUrl: string;
  sessionId?: string;
};

const safePathSegment = (value: string) => value.trim().replace(/[^a-zA-Z0-9_-]/g, "_") || "student";

export const uploadImage = async (base64: string, userId: string) => {
  const storage = await getFirebaseStorage();
  if (!storage) {
    throw new Error("Firebase Storage is not configured");
  }

  const storageRef = ref(storage, `attendance/${safePathSegment(userId)}_${Date.now()}.jpg`);
  await uploadString(storageRef, base64, "data_url");

  return getDownloadURL(storageRef);
};

export const saveAttendance = async (data: AttendanceFirebasePayload) => {
  const db = await getFirestoreDb();
  if (!db) {
    throw new Error("Firestore is not configured");
  }

  await addDoc(collection(db, "attendance"), {
    name: data.name,
    reg: data.reg,
    lat: data.lat,
    lng: data.lng,
    image: data.imageUrl,
    sessionId: data.sessionId || null,
    createdAt: serverTimestamp(),
  });
};
