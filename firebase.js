// Инициализация Firebase с обновленными настройками
const firebaseConfig = {
  apiKey: "AIzaSyCGqNn_jx13SKHBYMZLhUJ7nEbK32vAJx4",
  authDomain: "curatorterminal.firebaseapp.com",
  databaseURL: "https://curatorterminal-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "curatorterminal",
  storageBucket: "curatorterminal.appspot.com",
  messagingSenderId: "577721444184",
  appId: "1:577721444184:web:58f4d0aeede9a8c0ba672d",
  measurementId: "G-X0N5JT0K8D"
};

// Убедитесь, что Firebase не инициализирован повторно
try {
  if (!firebase.apps.length) {
    const app = firebase.initializeApp(firebaseConfig);
  } else {
    firebase.app(); // если уже инициализирован
  }
} catch (error) {
  console.error("Ошибка инициализации Firebase:", error);
}

// Глобальные ссылки для удобства
const db = firebase.database();