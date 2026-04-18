Developed and created By Narj Muhenga
phone: 0694128543

# Run and deploy your app

This contains everything you need to run the app locally.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env`
3. Set these values:
   `JWT_SECRET`
   `SUPER_ADMIN_USERNAME`
   `SUPER_ADMIN_PASSWORD`
   In production, set `SQLITE_DB_PATH` and `ATTENDANCE_DIR` to persistent storage paths, for example `/var/data/attendance.db` and `/var/data/attendance` on Render.
   `ADMIN_USERNAME` and `ADMIN_PASSWORD` are optional bootstrap credentials for a regular admin. Set both, or omit both.
   Firebase values use the `VITE_FIREBASE_` names shown in `.env.example`.
   Firestore and selfie Storage persistence on Render require Firebase Admin credentials: set `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`, plus `FIREBASE_STORAGE_BUCKET`.
   Without those credentials the app can still run, but SQLite data can reset on free hosting restarts.
   Enable Firebase Authentication providers for Email/Password and Google in the Firebase Console.
   Firestore and Storage rules are in `firestore.rules` and `storage.rules`. New admin accounts are active immediately; approval is no longer required.
4. Run the app:
   `npm run dev`
