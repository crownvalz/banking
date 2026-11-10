(function() {
  // CONFIGURATION: List the exact filenames you want to password protect
  const SECURED_FILES = [
    "camera.html",
    "sardo.html",
    "barcode.html",
    "directory-map.html"
  ];

  // Set your hardcoded password here
  const AUTH_PASSWORD = "Mono2026Secure";
  const SESSION_KEY = "mono_auth_session_verified";

  // Get current page filename from the URL path
  const currentPath = window.location.pathname;
  const currentFile = currentPath.substring(currentPath.lastIndexOf('/') + 1);

  // If the current file is NOT in the secured list, exit immediately (leaves page open)
  if (!SECURED_FILES.includes(currentFile)) {
    return;
  }

  // Check if already authenticated in this session
  if (sessionStorage.getItem(SESSION_KEY) === "true") {
    return; // Allow access immediately
  }

  // If secured and not authenticated, inject the password modal on load
  document.addEventListener("DOMContentLoaded", function() {
    createAuthModal();
  });

  function createAuthModal() {
    const overlay = document.createElement("div");
    overlay.id = "authOverlay";
    overlay.className = "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 transition-all duration-300";

    overlay.innerHTML = `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 text-slate-900 dark:text-slate-100">
        <div class="flex items-center space-x-4">
          <div class="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-800/60 text-rose-600">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <span class="text-[10px] font-extrabold uppercase tracking-widest bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 px-3 py-1 rounded-full">Restricted Module</span>
            <h2 class="text-xl font-black tracking-tight mt-1">Authentication Required</h2>
          </div>
        </div>

        <p class="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
          The module <span class="font-mono font-bold text-slate-800 dark:text-slate-200">${currentFile}</span> is secured. Please enter your system password to proceed.
        </p>

        <form id="authForm" class="space-y-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Access Password</label>
            <input type="password" id="authPasswordInput" placeholder="Enter password..." required
              class="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-sky-500 text-sm font-medium transition" />
            <p id="authErrorMsg" class="text-xs text-rose-500 font-bold mt-2 hidden">Incorrect password. Please try again.</p>
          </div>

          <div class="flex items-center justify-between pt-2">
            <a href="index.html" class="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
              ← Return Home
            </a>
            <button type="submit" class="px-6 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold tracking-wide shadow-lg shadow-sky-600/30 transition">
              Unlock Module
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    setTimeout(() => {
      document.getElementById("authPasswordInput").focus();
    }, 100);

    document.getElementById("authForm").addEventListener("submit", function(e) {
      e.preventDefault();
      const enteredValue = document.getElementById("authPasswordInput").value;
      const errorMsg = document.getElementById("authErrorMsg");

      if (enteredValue === AUTH_PASSWORD) {
        sessionStorage.setItem(SESSION_KEY, "true");
        overlay.classList.add("opacity-0");
        setTimeout(() => overlay.remove(), 300);
      } else {
        errorMsg.classList.remove("hidden");
        document.getElementById("authPasswordInput", "").value = "";
        document.getElementById("authPasswordInput").focus();
      }
    });
  }
})();