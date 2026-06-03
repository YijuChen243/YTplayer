// firebase-config.js
// Handles dynamic Firebase initialization using ES Modules from CDN

let app = null;
let auth = null;
let db = null;
let currentConfig = null;

// Firebase modules references
let fbAuth = null;
let fbFirestore = null;

// Check if config exists in localStorage
export function getStoredConfig() {
  const configStr = localStorage.getItem('firebase_config');
  if (configStr) {
    try {
      return JSON.parse(configStr);
    } catch (e) {
      console.error('Failed to parse stored Firebase config', e);
      return null;
    }
  }
  return null;
}

export function saveConfig(config) {
  localStorage.setItem('firebase_config', JSON.stringify(config));
}

export function clearConfig() {
  localStorage.removeItem('firebase_config');
  window.location.reload();
}

export function isInitialized() {
  return app !== null && auth !== null && db !== null;
}

// Dynamically import Firebase libraries and initialize
export async function initFirebase(config) {
  if (app) return true; // Already initialized
  
  if (!config) {
    config = getStoredConfig() || {
      apiKey: "AIzaSyCzFBFqLNQAHtNwsP2aPt6C3naf78tToGg",
      authDomain: "player-98bf0.firebaseapp.com",
      projectId: "player-98bf0",
      storageBucket: "player-98bf0.firebasestorage.app",
      messagingSenderId: "426745984827",
      appId: "1:426745984827:web:d735d0e91025fb2846e91e"
    };
  }
  
  if (!config || !config.apiKey || !config.projectId) {
    console.warn('Firebase config not found or incomplete. UI setup required.');
    return false;
  }
  
  try {
    currentConfig = config;
    
    // Dynamically import modules from Firebase official CDN
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    fbAuth = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
    fbFirestore = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    
    app = initializeApp(config);
    auth = fbAuth.getAuth(app);
    db = fbFirestore.getFirestore(app);
    
    console.log('Firebase initialized successfully!');
    return true;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    throw error;
  }
}

// --- AUTH WRAPPERS ---

export async function signUpUser(email, password) {
  if (!auth) throw new Error('Firebase Auth is not initialized');
  return fbAuth.createUserWithEmailAndPassword(auth, email, password);
}

export async function signInUser(email, password) {
  if (!auth) throw new Error('Firebase Auth is not initialized');
  return fbAuth.signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  if (!auth) throw new Error('Firebase Auth is not initialized');
  return fbAuth.signOut(auth);
}

export function onAuthChanged(callback) {
  if (!auth) {
    // If not initialized yet, queue it or wait
    return null;
  }
  return fbAuth.onAuthStateChanged(auth, callback);
}

// --- FIRESTORE WRAPPERS ---

// Save a song to user's database
// We will store songs in the user's subcollection 'users/{userId}/playlists' to match security rules
// Schema: { videoId, title, thumbnail, createdAt }
export async function saveSong(userId, songData) {
  if (!db) throw new Error('Firebase Firestore is not initialized');
  
  const songsCol = fbFirestore.collection(db, 'users', userId, 'playlists');
  const docRef = await fbFirestore.addDoc(songsCol, {
    videoId: songData.videoId,
    title: songData.title,
    thumbnail: songData.thumbnail || `https://img.youtube.com/vi/${songData.videoId}/hqdefault.jpg`,
    createdAt: fbFirestore.serverTimestamp()
  });
  
  return { id: docRef.id, ...songData };
}

// Fetch all songs for a specific user
export async function fetchUserSongs(userId) {
  if (!db) throw new Error('Firebase Firestore is not initialized');
  
  const songsCol = fbFirestore.collection(db, 'users', userId, 'playlists');
  const q = fbFirestore.query(songsCol);
  
  const querySnapshot = await fbFirestore.getDocs(q);
  const songs = [];
  querySnapshot.forEach((doc) => {
    songs.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  // Sort in memory to avoid requiring a Firebase composite index
  songs.sort((a, b) => {
    const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
    const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
    return tB - tA;
  });
  
  return songs;
}

// Delete a song
export async function deleteUserSong(userId, songId) {
  if (!db) throw new Error('Firebase Firestore is not initialized');
  
  const songDocRef = fbFirestore.doc(db, 'users', userId, 'playlists', songId);
  await fbFirestore.deleteDoc(songDocRef);
  return true;
}
