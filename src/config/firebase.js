import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSy...",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "healthful.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "healthful",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "healthful.appspot.com",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:1234567890:web:abcdef"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Handle Web vs Native Auth persistence
let authObj;
if (Platform.OS === 'web') {
  authObj = initializeAuth(app); // Web uses IndexedDB by default
} else {
  authObj = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
}
export const auth = authObj;

export const db = getFirestore(app);
