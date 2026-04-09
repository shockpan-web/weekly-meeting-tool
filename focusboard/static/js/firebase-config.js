const firebaseConfig = {
  // TODO: Replace with your actual Firebase configuration
  apiKey: "AIzaSyBxxxxxxx",
  authDomain: "focusboard-teama.firebaseapp.com",
  projectId: "focusboard-teama",
  storageBucket: "focusboard-teama.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:12345:web:abcd"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
