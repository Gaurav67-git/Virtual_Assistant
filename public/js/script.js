// script.js (full patched file)
// -------------------------
// Firebase & Firestore imports
// -------------------------
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  fetchSignInMethodsForEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  initializeFirestore,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc as fsDeleteDoc,
  query,
  orderBy,
  serverTimestamp,
  doc,
  getDocs,
  getDoc,
  setDoc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// -------------------------
// Helper: normalize username
// -------------------------
function normalizeUsername(u) {
  if (!u) return "";
  return u.trim().toLowerCase();
}

// -------------------------
// DOMContentLoaded boot
// -------------------------
document.addEventListener("DOMContentLoaded", () => {
  console.log("NOVA frontend booting...");

  // Global error handlers to catch silent failures
  window.addEventListener("error", (ev) => {
    console.error("Global window error:", ev.message, ev.filename, ev.lineno, ev.colno, ev.error);
  });
  window.addEventListener("unhandledrejection", (ev) => {
    console.error("Unhandled promise rejection:", ev.reason);
  });

  /* --------------------------
     Firebase config - REPLACE with your project's web config if different
     -------------------------- */
  const firebaseConfig = {
    apiKey: "AIzaSyDj7J3PNgWf90BVqRzkns8sGr7SaOCKWH4",
    authDomain: "virtual-assistant-feacf.firebaseapp.com",
    projectId: "virtual-assistant-feacf",
    storageBucket: "virtual-assistant-feacf.firebasestorage.app",
    messagingSenderId: "572255669769",
    appId: "1:572255669769:web:dd508299989413201e32d8"
  };

  // Initialize app only once
  let firebaseApp;
  if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
    console.log("Firebase initialized.");
  } else {
    firebaseApp = getApp();
    console.log("Firebase app already exists — reused.");
  }

  // Initialize Firestore with long-polling fallback to avoid some environment issues
  const db = initializeFirestore(firebaseApp, {
    experimentalForceLongPolling: true,
    useFetchStreams: false
  });
  console.log("Firestore initialized with long-polling");

  const auth = getAuth(firebaseApp);
  const provider = new GoogleAuthProvider();

  /* --------------------------
     DOM elements (IDs expected to exist in your HTML)
     -------------------------- */
  const btn = document.querySelector("#btn"); // mic
  const content = document.querySelector("#content");
  const textInput = document.querySelector("#textCommand");
  const extraInfo = document.querySelector("#extra-info");

  const authScreen = document.getElementById("auth-screen");
  const appScreen = document.getElementById("app");
  const userNameDisplay = document.getElementById("userName");

  const showLogin = document.getElementById("showLogin");
  const showRegister = document.getElementById("showRegister");
  const loginForm = document.getElementById("login-form");
  const regForm = document.getElementById("register-form");

  const loginBtn = document.getElementById("loginBtn");
  const signupBtn = document.getElementById("signupBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const googleLoginBtn = document.getElementById("googleLogin");

  const loginUser = document.getElementById("login-username");
  const loginPass = document.getElementById("login-password");
  const loginMsg = document.getElementById("login-msg");

  const regName = document.getElementById("reg-name");
  const regEmail = document.getElementById("reg-email");
  const regPass = document.getElementById("reg-password");
  const regMsg = document.getElementById("reg-msg");
  const regUsername = document.getElementById("reg-username"); // optional username input if present

  const taskInput = document.getElementById("taskInput");
  const addTaskBtn = document.getElementById("addTaskBtn");
  const taskList = document.getElementById("taskList");

  const reminderText = document.getElementById("reminderText");
  const reminderTime = document.getElementById("reminderTime");
  const addReminderBtn = document.getElementById("addReminderBtn");
  const reminderList = document.getElementById("reminderList");
  const clearRemindersBtn = document.getElementById("clearRemindersBtn");

  let clearContentTimer = null;

  /* --------------------------
     TTS helper
     -------------------------- */
  function detectLangFromText(text) {
    if (!text || typeof text !== "string") return navigator.language || "en-IN";
    const hasDevanagari = /[\u0900-\u097F]/.test(text);
    const hasArabic = /[\u0600-\u06FF\u0750-\u077F]/.test(text);
    const hasCyrillic = /[\u0400-\u04FF]/.test(text);
    const hasHan = /[\u4E00-\u9FFF]/.test(text);
    const hasKana = /[\u3040-\u30FF]/.test(text);
    const hasHangul = /[\uAC00-\uD7AF]/.test(text);

    if (hasDevanagari) return "hi-IN";
    if (hasArabic) return "ar-SA";
    if (hasCyrillic) return "ru-RU";
    if (hasHan) return "zh-CN";
    if (hasKana) return "ja-JP";
    if (hasHangul) return "ko-KR";
    return navigator.language || "en-IN";
  }

  function speak(text) {
  try {
    // stop any previous speech
    window.speechSynthesis.cancel();

    const lang = detectLangFromText(text);
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1;
    utt.pitch = 1;
    utt.lang = lang;

    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length) {
      const match = voices.find(v =>
        v.lang && v.lang.toLowerCase().startsWith(lang.split("-")[0])
      );
      if (match) utt.voice = match;
    }

    // ✅ CLEAR TEXT ONLY AFTER SPEECH FINISHES
    utt.onend = () => {
      console.log("Assistant finished speaking");
      // OPTIONAL: clear text here if you want
      // content.innerText = "";
    };

    window.speechSynthesis.speak(utt);
  } catch (e) {
    console.warn("TTS failed:", e);
  }
}

  /* --------------------------
     Auth UI toggle
     -------------------------- */
  if (showLogin && showRegister) {
    showLogin.addEventListener("click", () => {
      showLogin.classList.add("active");
      showRegister.classList.remove("active");
      loginForm.style.display = "block";
      regForm.style.display = "none";
    });
    showRegister.addEventListener("click", () => {
      showRegister.classList.add("active");
      showLogin.classList.remove("active");
      regForm.style.display = "block";
      loginForm.style.display = "none";
    });
  }

  /* --------------------------
     Signup (with optional username reservation)
     -------------------------- */
  signupBtn?.addEventListener("click", async () => {
    const name = regName?.value.trim() || "";
    const email = regEmail?.value.trim().toLowerCase() || "";
    const pass = regPass?.value.trim() || "";
    const usernameRaw = regUsername?.value?.trim() || "";
    const username = normalizeUsername(usernameRaw);

    if (!name || !email || !pass) {
      if (regMsg) regMsg.innerText = "Please fill all fields!";
      return;
    }

    // If username input exists, use the uniqueness + rollback flow; otherwise do simple registration
    if (username) {
      // validate username
      if (!/^[a-z0-9_.-]{3,30}$/.test(username)) {
        if (regMsg) regMsg.innerText = "Username must be 3-30 chars: letters/numbers/._-";
        return;
      }

      try {
        // check if email already registered (nice UX)
        const methods = await fetchSignInMethodsForEmail(auth, email).catch(() => []);
        if (methods && methods.length > 0) {
          if (regMsg) regMsg.innerText = "An account with this email already exists. Please login or use account recovery.";
          return;
        }
      } catch (err) {
        console.warn("fetchSignInMethodsForEmail error:", err);
      }

      try {
        // create Auth user first
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        const uid = cred.user.uid;

        const usernameDocRef = doc(db, "usernames", username);
        const userDocRef = doc(db, "users", uid);

        try {
          await runTransaction(db, async (tx) => {
            const uSnap = await tx.get(usernameDocRef);
            if (uSnap.exists()) throw new Error("username_taken");
            tx.set(usernameDocRef, { uid, createdAt: serverTimestamp() });
            tx.set(userDocRef, { uid, name, username, email, createdAt: serverTimestamp(), provider: "password" });
          });

          if (regMsg) regMsg.innerText = "✅ Registered and profile created — please login.";
          regName.value = regEmail.value = regPass.value = regUsername.value = "";
        } catch (txErr) {
          console.error("Transaction error:", txErr);
          // delete auth user to avoid orphans
          await cred.user.delete().catch((e) => console.warn("Failed to delete auth user after username collision:", e));
          if (txErr.message === "username_taken") {
            if (regMsg) regMsg.innerText = "Username already taken — choose another.";
          } else {
            if (regMsg) regMsg.innerText = "Failed to create profile. Try again.";
          }
        }
      } catch (e) {
        console.error("Signup error:", e);
        if (regMsg) regMsg.innerText = e.message || "Registration failed";
      }
    } else {
      // fallback simple create without username
      try {
        await createUserWithEmailAndPassword(auth, email, pass);
        if (regMsg) regMsg.innerText = "✅ Registered — please login.";
        if (regName) regName.value = "";
        if (regEmail) regEmail.value = "";
        if (regPass) regPass.value = "";
      } catch (e) {
        console.error(e);
        if (regMsg) regMsg.innerText = e.message || "Registration failed";
      }
    }
  });

  /* --------------------------
     Login (email/password)
     -------------------------- */
  loginBtn?.addEventListener("click", async () => {
    const user = loginUser?.value.trim() || "";
    const pass = loginPass?.value.trim() || "";
    if (!user || !pass) { if (loginMsg) loginMsg.innerText = "Please fill both fields!"; return; }
    try {
      await signInWithEmailAndPassword(auth, user, pass);
      if (loginMsg) {
        loginMsg.innerText = "✅ Login successful!";
        setTimeout(() => loginMsg.innerText = "", 1200);
      }
    } catch (e) {
      console.error("Login error:", e);
      if (loginMsg) loginMsg.innerText = e.message || "Login failed";
    }
  });

  /* --------------------------
     Enhanced Google sign-in handler (replaces simple handler)
     - Attempts to reserve username via transaction
     - Creates user profile in users/{uid} and usernames/{username}
     -------------------------- */
  googleLoginBtn?.addEventListener("click", async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const uid = user.uid;
      const email = (user.email || "").toLowerCase();
      const displayName = user.displayName || "";

      // If user doc already exists, nothing to do
      const userDocRef = doc(db, "users", uid);
      const uSnap = await getDoc(userDocRef);
      if (uSnap.exists()) {
        return;
      }

      // Auto-generate a base username from displayName or email local part
      let base = (displayName || email.split("@")[0] || "user").replace(/\s+/g, "");
      base = normalizeUsername(base);
      if (!/^[a-z0-9_.-]{3,30}$/.test(base)) {
        base = base.replace(/[^a-z0-9_.-]/g, "").slice(0, 20) || "user";
      }

      let candidate = base;
      let i = 0;
      const MAX_TRIES = 40;
      let created = false;

      while (i <= MAX_TRIES && !created) {
        const usernameDocRef = doc(db, "usernames", candidate);
        try {
          await runTransaction(db, async (tx) => {
            const s = await tx.get(usernameDocRef);
            if (s.exists()) throw new Error("taken");
            // reserve username and create user profile atomically
            tx.set(usernameDocRef, { uid, createdAt: serverTimestamp() });
            tx.set(userDocRef, {
              uid,
              name: displayName,
              username: candidate,
              email,
              createdAt: serverTimestamp(),
              provider: "google"
            });
          });
          created = true;
          console.log("Reserved username:", candidate);
        } catch (txErr) {
          // try next candidate
          i += 1;
          candidate = base + (i === 0 ? "" : String(i));
        }
      }

      if (!created) {
        // fallback: create a profile with a safe fallback username including UID suffix
        const fallback = `${base}-${uid.slice(0, 6)}`.slice(0, 30);
        await setDoc(userDocRef, {
          uid,
          name: displayName,
          username: fallback,
          email,
          createdAt: serverTimestamp(),
          provider: "google",
          fallbackUsername: true
        });
        console.warn("Could not auto-reserve nice username — saved fallback:", fallback);
      }
    } catch (e) {
      // common case: email exists with different provider
      if (e && (e.code === "auth/account-exists-with-different-credential" || e.code === "auth/email-already-in-use")) {
        alert("An account with this email exists with a different sign-in method. Please sign in using that method and link providers from account settings.");
      } else {
        console.error("Google sign-in error:", e);
        alert("Google sign-in failed: " + (e.message || e));
      }
    }
  });

  /* --------------------------
     Logout
     -------------------------- */
  logoutBtn?.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Sign out error:", e);
    }
  });

  /* --------------------------
     Firestore listeners w/ fallback
     -------------------------- */
  let unsubTasks = null;
  let unsubRems = null;

  // track scheduled reminder timeouts so we can clear them
  let scheduledReminders = [];

  function scheduleLocalReminder(id, text, timeIso) {
    try {
      const delay = new Date(timeIso).getTime() - Date.now();
      if (!(delay > 0 && delay < 1000 * 60 * 60 * 24 * 30)) return null; // only schedule reasonable future reminders
      const timeoutId = setTimeout(() => {
        alert("⏰ Reminder: " + text);
        speak("Reminder: " + text);
      }, delay);
      scheduledReminders.push({ id, timeoutId });
      return timeoutId;
    } catch (e) {
      console.warn("Failed to schedule local reminder:", e);
      return null;
    }
  }

  function clearScheduledReminders() {
    scheduledReminders.forEach(r => {
      try { clearTimeout(r.timeoutId); } catch (e) {}
    });
    scheduledReminders = [];
  }

  async function startFirestoreListeners(uid) {
    try {
      const tasksRef = collection(db, "users", uid, "tasks");
      const qTasks = query(tasksRef, orderBy("createdAt"));

      unsubTasks = onSnapshot(qTasks, (snap) => {
        taskList.innerHTML = "";
        snap.forEach(s => {
          const d = s.data();
          const li = document.createElement("li");
          li.innerHTML = `<span class="task-text">${escapeHtml(String(d.text || ""))}</span> <div><button class="del">❌</button></div>`;
          li.addEventListener("click", ()=> li.classList.toggle("completed"));
          li.querySelector(".del").addEventListener("click", async (ev) => {
            ev.stopPropagation();
            await fsDeleteDoc(doc(db, "users", uid, "tasks", s.id));
          });
          taskList.appendChild(li);
        });
      }, async (error) => {
        console.warn("onSnapshot tasks error, falling back to getDocs:", error);
        try {
          const snap = await getDocs(qTasks);
          taskList.innerHTML = "";
          snap.forEach(docSnap => {
            const d = docSnap.data();
            const li = document.createElement("li");
            li.innerHTML = `${escapeHtml(String(d.text || ""))} <button class="del">❌</button>`;
            taskList.appendChild(li);
          });
        } catch (e) {
          console.error("getDocs fallback error (tasks):", e);
        }
      });

      const remRef = collection(db, "users", uid, "reminders");
      const qRem = query(remRef, orderBy("time"));

      unsubRems = onSnapshot(qRem, (snap) => {
        // clear previously scheduled timeouts and re-schedule
        clearScheduledReminders();
        reminderList.innerHTML = "";
        snap.forEach(s => {
          const d = s.data();
          const li = document.createElement("li");
          const timeText = d.time ? new Date(d.time).toLocaleString() : "No time set";
          li.innerHTML = `<div style="flex:1"><strong>${escapeHtml(String(d.text || ""))}</strong><div style="font-size:12px;color:#666">${escapeHtml(timeText)}</div></div><div><button class="del">❌</button></div>`;
          li.querySelector(".del").addEventListener("click", async (ev) => {
            ev.stopPropagation();
            await fsDeleteDoc(doc(db, "users", uid, "reminders", s.id));
          });
          reminderList.appendChild(li);

          // schedule local alert
          try {
            if (d.time) {
              scheduleLocalReminder(s.id, d.text, d.time);
            }
          } catch (e) {
            console.warn("Failed scheduling reminder for", s.id, e);
          }
        });
      }, async (error) => {
        console.warn("onSnapshot reminders error, falling back to getDocs:", error);
        try {
          const snap = await getDocs(qRem);
          reminderList.innerHTML = "";
          snap.forEach(docSnap => {
            const d = docSnap.data();
            const timeText = d.time ? new Date(d.time).toLocaleString() : "No time set";
            const li = document.createElement("li");
            li.innerHTML = `<strong>${escapeHtml(String(d.text || ""))}</strong> at ${escapeHtml(timeText)} <button class="del">❌</button>`;
            reminderList.appendChild(li);
          });
        } catch (e) {
          console.error("getDocs fallback error (reminders):", e);
        }
      });

    } catch (err) {
      console.error("startFirestoreListeners failed:", err);
    }
  }

  function stopFirestoreListeners() {
    if (typeof unsubTasks === "function") unsubTasks();
    if (typeof unsubRems === "function") unsubRems();
    unsubTasks = unsubRems = null;
    clearScheduledReminders();
    if (taskList) taskList.innerHTML = "";
    if (reminderList) reminderList.innerHTML = "";
  }

  /* --------------------------
     Auth state change
     -------------------------- */
  onAuthStateChanged(auth, (user) => {
    if (user) {
      if (authScreen) authScreen.style.display = "none";
      if (appScreen) appScreen.style.display = "block";
      if (userNameDisplay) userNameDisplay.innerText = user.displayName || user.email || "User";
      startFirestoreListeners(user.uid);
      wishMe();
    } else {
      if (authScreen) authScreen.style.display = "block";
      if (appScreen) appScreen.style.display = "none";
      if (userNameDisplay) userNameDisplay.innerText = "";
      stopFirestoreListeners();
    }
  });

  /* --------------------------
     Add task & reminder handlers
     -------------------------- */
  addTaskBtn?.addEventListener("click", async () => {
    if (!taskInput?.value.trim() || !auth.currentUser) return;
    try {
      await addDoc(collection(db, "users", auth.currentUser.uid, "tasks"), { text: taskInput.value.trim(), createdAt: serverTimestamp() });
      taskInput.value = "";
    } catch (e) { console.error("add task error:", e); }
  });

  addReminderBtn?.addEventListener("click", async () => {
    if (!reminderText?.value.trim() || !reminderTime?.value || !auth.currentUser) return;
    try {
      const timeIso = new Date(reminderTime.value).toISOString();
      await addDoc(collection(db, "users", auth.currentUser.uid, "reminders"), { text: reminderText.value.trim(), time: timeIso, createdAt: serverTimestamp() });
      reminderText.value = "";
      reminderTime.value = "";
    } catch (e) { console.error("add reminder error:", e); }
  });

  clearRemindersBtn?.addEventListener("click", () => {
    clearScheduledReminders();
    alert("Local reminder alerts cleared.");
  });

  /* --------------------------
     Speech recognition & typed input
     -------------------------- */
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;

  if (SpeechRecognition && btn) {
    recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => btn.classList.add("listening");
    recognition.onend = () => btn.classList.remove("listening");
    recognition.onerror = (ev) => {
      console.error("SpeechRecognition error:", ev);
    };
    recognition.onresult = async (ev) => {
      const text = ev.results[0][0].transcript;
      if (content) content.innerText = text;
      if (clearContentTimer) clearTimeout(clearContentTimer);
clearContentTimer = setTimeout(() => {
  if (content) content.innerText = "";
}, 1400);
      await handleMessage(text);
    };

    btn.addEventListener("click", async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        recognition.start();
      } catch (err) {
        console.error("Microphone permission error:", err);
        alert("Please allow microphone access to use voice commands.");
      }
    });
  } else {
    if (!SpeechRecognition) console.warn("SpeechRecognition not supported in this browser.");
    if (!btn) console.warn("#btn (mic) missing in DOM.");
  }

  if (textInput) {
    textInput.addEventListener("keydown", async (e) => {
      if (e.key === "Enter" && textInput.value.trim() !== "") {
        const typed = textInput.value.trim();
        if (content) content.innerText = typed;
        if (clearContentTimer) clearTimeout(clearContentTimer);
clearContentTimer = setTimeout(() => {
  if (content) content.innerText = "";
}, 1200);
        console.log("handleMessage called from typed input. message:", typed);
        await handleMessage(typed);
        textInput.value = "";
      }
    });
  }

  /* --------------------------
     Instrumented handleMessage (always attempts backend)
     -------------------------- */
  async function handleMessage(message) {
    try {
      if (!message) { console.log("handleMessage called with empty message"); return; }
      console.log("handleMessage:", message);

      const lower = message.toLowerCase();

      // local quick commands
      if (lower.includes("hello") || lower.includes("hi")) { speak("Hello, how can I help you?"); return; }
      if (lower.includes("who are you")) { speak("I am Nova, your virtual assistant."); return; }
      if (lower.includes("time")) { const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); speak("The time is " + time); return; }
      if (lower.includes("date")) { speak("Today's date is " + new Date().toLocaleDateString()); return; }
      if (lower.includes("open youtube")) { speak("Opening YouTube"); window.open("https://www.youtube.com/"); return; }
      if (lower.includes("weather")) {
        const city = message.split("in")[1]?.trim() || message.replace("weather","").trim() || "Delhi";
        await getWeather(city);
        return;
      }

      // --- quick local UI commands: show/open tasks & reminders ---
           // ----- show / hide tasks -----
      if (lower.includes("show tasks") || lower.includes("open tasks") || lower.includes("go to tasks") || lower.includes("view tasks")) {
        const el = document.getElementById("tasks-section");
        if (el) {
          // make visible (CSS may default to display:none)
          el.style.display = "block";
          // optional fade-in animation class (add CSS below)
          el.classList.add("fade-in");
          setTimeout(() => el.classList.remove("fade-in"), 450);
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          const ti = document.getElementById("taskInput");
          if (ti) ti.focus();
          speak("Showing your tasks");
        } else {
          speak("Tasks section not found.");
        }
        return;
      }

      if (lower.includes("hide tasks") || lower.includes("close tasks")) {
        const el = document.getElementById("tasks-section");
        if (el) {
          el.style.display = "none";
          speak("Tasks hidden");
        } else {
          speak("Tasks section not found.");
        }
        return;
      }

      // ----- show / hide reminders -----
      if (lower.includes("show reminders") || lower.includes("open reminders") || lower.includes("go to reminders") || lower.includes("view reminders")) {
        const el = document.getElementById("reminder-section");
        if (el) {
          el.style.display = "block";
          el.classList.add("fade-in");
          setTimeout(() => el.classList.remove("fade-in"), 450);
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          const ri = document.getElementById("reminderText");
          if (ri) ri.focus();
          speak("Showing your reminders");
        } else {
          speak("Reminders section not found.");
        }
        return;
      }

      if (lower.includes("hide reminders") || lower.includes("close reminders")) {
        const el = document.getElementById("reminder-section");
        if (el) {
          el.style.display = "none";
          speak("Reminders hidden");
        } else {
          speak("Reminders section not found.");
        }
        return;
      }

      // quick add task via voice/text: "add task buy milk"
      if (lower.startsWith("add task ")) {
        const taskText = message.slice(9).trim();
        if (!taskText) { speak("Please tell me the task to add."); return; }
        if (!auth.currentUser) { speak("Please login to add tasks."); return; }
        try {
          await addDoc(collection(db, "users", auth.currentUser.uid, "tasks"), { text: taskText, createdAt: serverTimestamp() });
          speak("Task added: " + taskText);
        } catch (e) {
          console.error("Voice add task failed:", e);
          speak("Failed to add task.");
        }
        return;
      }

      // quick add reminder via voice/text: "add reminder call mom at 2025-11-19 22:30" (attempt to parse date)
      if (lower.startsWith("add reminder ") || lower.startsWith("set reminder ") || lower.startsWith("remind me to ")) {
        // normalize forms
        let remainder = message;
        if (lower.startsWith("add reminder ")) remainder = message.slice(13).trim();
        else if (lower.startsWith("set reminder ")) remainder = message.slice(12).trim();
        else if (lower.startsWith("remind me to ")) remainder = message.slice(13).trim();

        // try to detect " at " clause
        const atIndex = remainder.toLowerCase().lastIndexOf(" at ");
        let textPart = remainder;
        let timePart = null;
        if (atIndex !== -1) {
          textPart = remainder.slice(0, atIndex).trim();
          timePart = remainder.slice(atIndex + 4).trim();
        }

        if (!textPart) { speak("Please tell me what to remind you about."); return; }
        if (!auth.currentUser) { speak("Please login to add reminders."); return; }

        // if user provided a time attempt to parse
        if (timePart) {
          const parsed = Date.parse(timePart);
          if (!isNaN(parsed)) {
            const iso = new Date(parsed).toISOString();
            try {
              await addDoc(collection(db, "users", auth.currentUser.uid, "reminders"), { text: textPart, time: iso, createdAt: serverTimestamp() });
              speak(`Reminder set for ${new Date(parsed).toLocaleString()}`);
            } catch (e) {
              console.error("Voice add reminder failed:", e);
              speak("Failed to add reminder.");
            }
            return;
          } else {
            // attempt another parse when user said "tomorrow" or "in 2 hours" - simple support
            const parsedRelative = tryParseRelativeTime(timePart);
            if (parsedRelative) {
              const iso = new Date(parsedRelative).toISOString();
              try {
                await addDoc(collection(db, "users", auth.currentUser.uid, "reminders"), { text: textPart, time: iso, createdAt: serverTimestamp() });
                speak(`Reminder set for ${new Date(parsedRelative).toLocaleString()}`);
              } catch (e) {
                console.error("Voice add reminder failed:", e);
                speak("Failed to add reminder.");
              }
              return;
            }
          }
        }

        // if no valid time provided, open reminder panel and focus inputs to let user set time
        const el = document.getElementById("reminder-section");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          if (reminderText) reminderText.value = textPart;
          if (reminderTime) reminderTime.focus();
        }
        speak("I added the reminder text. Please pick a time and press Set Reminder.");
        return;
      }

      // absolute endpoint to avoid relative path issues
      const apiUrl = (window.location.origin || "http://localhost:3000") + "/api/chat";
      console.log("Will call API URL:", apiUrl);

      // UI feedback
      if (content) content.innerText = "Thinking...";
      // fetch with timeout
      try {
        const start = Date.now();
        console.log("Starting fetch to /api/chat ...");
        const controller = new AbortController();
        const timeout = setTimeout(() => { controller.abort(); }, 15000); // 15s

        const resp = await fetch(apiUrl, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message })
        });

        clearTimeout(timeout);
        console.log("/api/chat response status:", resp.status);

        if (!resp.ok) {
          const text = await resp.text().catch(()=>"<no-body>");
          console.error("/api/chat non-ok body:", text);
          if (content) content.innerText = "Assistant error: " + (text || resp.status);
          speak("Sorry, assistant returned an error.");
          return;
        }

        const json = await resp.json().catch(e => { console.error("Failed to parse /api/chat JSON:", e); return null; });
        console.log("/api/chat returned JSON:", json);
        const reply = json?.reply || json?.message || "Sorry, no response.";
        // AFTER: const reply = json?.reply || json?.message || "Sorry, no response.";
if (reply) {
  // --- auto-open reminders or tasks if assistant mentions them in its reply ---
  try {
    const lowReply = String(reply).toLowerCase();

    // if assistant mentions reminders -> show reminder panel
    if (/\b(reminder|reminders)\b/.test(lowReply) || /here are your reminders/.test(lowReply)) {
      const remEl = document.getElementById("reminder-section");
      if (remEl) {
        remEl.style.display = "block";
        remEl.classList?.add?.("fade-in");
        setTimeout(() => remEl.classList?.remove?.("fade-in"), 450);
        remEl.scrollIntoView({ behavior: "smooth", block: "center" });
        (document.getElementById("reminderText"))?.focus();
      }
    }

    // if assistant mentions tasks -> show tasks panel
    if (/\b(task|tasks|to-do|todo)\b/.test(lowReply) || /here are your tasks/.test(lowReply)) {
      const taskEl = document.getElementById("tasks-section");
      if (taskEl) {
        taskEl.style.display = "block";
        taskEl.classList?.add?.("fade-in");
        setTimeout(() => taskEl.classList?.remove?.("fade-in"), 450);
        taskEl.scrollIntoView({ behavior: "smooth", block: "center" });
        (document.getElementById("taskInput"))?.focus();
      }
    }
  } catch (e) {
    console.warn("Auto-open panel failed:", e);
  }
}
        if (clearContentTimer) {
  clearTimeout(clearContentTimer);
  clearContentTimer = null;
}
        if (content) content.innerText = reply;
        speak(reply);

        console.log("Fetch roundtrip took (ms):", Date.now() - start);
      } catch (fetchErr) {
        console.error("Fetch to /api/chat failed:", fetchErr);
        if (fetchErr.name === "AbortError") {
          if (content) content.innerText = "Assistant request timed out.";
          speak("Request timed out.");
        } else {
          if (content) content.innerText = "Network error contacting assistant.";
          speak("Network error contacting assistant.");
        }
      }
    } catch (err) {
      console.error("handleMessage top-level error:", err);
    }
  }

  /* --------------------------
     Weather helper
     -------------------------- */
  async function getWeather(city) {
    try {
      const r = await fetch(`/api/weather?q=${encodeURIComponent(city)}`);
      const data = await r.json();
      if (data?.main) {
        const msg = `Weather in ${data.name}: ${data.weather[0].description}, ${data.main.temp}°C`;
        if (extraInfo) extraInfo.innerText = msg;
        speak(msg);
      } else {
        speak("Couldn't fetch weather for " + city);
      }
    } catch (err) {
      console.error("Weather fetch error:", err);
      speak("Couldn't reach weather service.");
    }
  }

  /* --------------------------
     Greeting helper
     -------------------------- */
  function wishMe() {
    try {
      const hours = new Date().getHours();
      if (hours < 12) speak("Good morning");
      else if (hours < 16) speak("Good afternoon");
      else if (hours < 19) speak("Good evening");
      else speak("Good night");
    } catch (e) {}
  }

  /* --------------------------
     Manual test button (temporary)
     -------------------------- */
  const manualBtn = document.createElement("button");
  manualBtn.textContent = "Test Assistant (manual)";
  manualBtn.style.position = "fixed";
  manualBtn.style.right = "12px";
  manualBtn.style.bottom = "12px";
  manualBtn.style.zIndex = "9999";
  manualBtn.style.padding = "8px 10px";
  manualBtn.style.background = "#111827";
  manualBtn.style.color = "#fff";
  manualBtn.style.border = "1px solid rgba(255,255,255,0.08)";
  manualBtn.addEventListener("click", async () => {
    console.log("Manual test button clicked.");
    await handleMessage("hello");
  });
  document.body.appendChild(manualBtn);

  /* --------------------------
     UI color updater (optional)
     -------------------------- */
  function updateColors() {
    const bgEl = document.querySelector(".bg-animation");
    if (!bgEl) return;
    const bg = window.getComputedStyle(bgEl).backgroundImage;
    const colors = bg?.match(/#[0-9a-f]{3,6}/gi);
    if (!colors) return;
    document.documentElement.style.setProperty("--name-color", colors[0]);
    if (colors[1]) document.documentElement.style.setProperty("--va-color", colors[1]);
  }
  setInterval(updateColors, 2000);
  updateColors();

  console.log("NOVA frontend ready — try typing and press Enter (check Console logs).");

  /* --------------------------
     Utility helpers
     -------------------------- */
  function escapeHtml(unsafe) {
    return unsafe
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Simple relative time parser (supports "in X minutes/hours", "tomorrow", "in X days")
  function tryParseRelativeTime(text) {
    try {
      const t = text.toLowerCase().trim();
      const now = Date.now();
      const m = t.match(/in\s+(\d+)\s*(minute|minutes|min)/);
      if (m) return now + parseInt(m[1], 10) * 60000;
      const h = t.match(/in\s+(\d+)\s*(hour|hours|hr)/);
      if (h) return now + parseInt(h[1], 10) * 3600000;
      const d = t.match(/in\s+(\d+)\s*(day|days)/);
      if (d) return now + parseInt(d[1], 10) * 86400000;
      if (t.includes("tomorrow")) {
        const dt = new Date();
        dt.setDate(dt.getDate() + 1);
        dt.setHours(9, 0, 0, 0); // default tomorrow 9:00am
        return dt.getTime();
      }
      return null;
    } catch (e) {
      return null;
    }
  }
});
