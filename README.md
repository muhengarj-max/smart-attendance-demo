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
   `ADMIN_USERNAME` and `ADMIN_PASSWORD` are optional bootstrap credentials for a regular admin. Set both, or omit both.
   Firebase values use the `VITE_FIREBASE_` names shown in `.env.example`.
   Firestore and Storage rules are in `firestore.rules` and `storage.rules`; they require Firebase Auth users with `users/{uid}.approved == true`.
4. Run the app:
   `npm run dev`
