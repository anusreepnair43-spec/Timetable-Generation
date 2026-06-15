// session-manager.js
const SessionManager = {
    // Key for localStorage
    SESSION_KEY: 'app_session',
    TAB_ID_KEY: 'tab_id',
    
    // Generate unique tab ID
    generateTabId() {
      return 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    // Initialize session tracking
    init() {
      // Get or create tab ID
      let tabId = sessionStorage.getItem(this.TAB_ID_KEY);
      if (!tabId) {
        tabId = this.generateTabId();
        sessionStorage.setItem(this.TAB_ID_KEY, tabId);
      }
      
      // Check if this is a new tab in existing session
      const currentSession = localStorage.getItem(this.SESSION_KEY);
      
      if (currentSession) {
        try {
          const session = JSON.parse(currentSession);
          // If user is logged in, redirect to their dashboard
          if (session.loggedIn && session.role && session.timestamp) {
            // Check if session is still valid (e.g., not expired)
            const sessionAge = Date.now() - session.timestamp;
            const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
            
            if (sessionAge < SESSION_TIMEOUT) {
              // Redirect to appropriate dashboard
              this.redirectToDashboard(session.role);
              return true;
            } else {
              // Session expired, clear it
              this.clearSession();
            }
          }
        } catch (e) {
          console.error('Error parsing session:', e);
          this.clearSession();
        }
      }
      
      // Set up storage event listener for cross-tab communication
      window.addEventListener('storage', this.handleStorageEvent.bind(this));
      
      // Set up beforeunload to clean up if this is the last tab
      window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
      
      return false;
    },
    
    // Handle storage events from other tabs
    handleStorageEvent(event) {
      if (event.key === this.SESSION_KEY) {
        if (!event.newValue) {
          // Session was cleared, logout
          this.forceLogout('Session ended in another tab');
        } else {
          try {
            const newSession = JSON.parse(event.newValue);
            const currentPath = window.location.pathname;
            
            // Check if we need to redirect based on new session
            if (newSession.loggedIn && newSession.role) {
              const expectedPath = this.getDashboardPath(newSession.role);
              if (!currentPath.includes(expectedPath)) {
                this.redirectToDashboard(newSession.role);
              }
            } else if (!newSession.loggedIn) {
              // User logged out in another tab
              if (!currentPath.includes('index.html')) {
                this.forceLogout('Logged out from another tab');
              }
            }
          } catch (e) {
            console.error('Error handling storage event:', e);
          }
        }
      }
    },
    
    // Handle tab closing
    handleBeforeUnload() {
      // You could implement logic to check if this is the last tab
      // For now, we'll just let the session persist
    },
    
    // Set session after login
    setSession(role, userData = {}) {
      const session = {
        loggedIn: true,
        role: role,
        username: userData.username || userData.email,
        timestamp: Date.now(),
        userData: userData
      };
      
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      
      // Also store in sessionStorage for this tab
      sessionStorage.setItem('current_role', role);
      if (userData.username) {
        sessionStorage.setItem('current_username', userData.username);
      }
    },
    
    // Clear session on logout
    clearSession() {
      localStorage.removeItem(this.SESSION_KEY);
      // Don't clear role from sessionStorage immediately to detect logout
    },
    
    // Get current session
    getSession() {
      const sessionData = localStorage.getItem(this.SESSION_KEY);
      if (!sessionData) return null;
      
      try {
        return JSON.parse(sessionData);
      } catch {
        return null;
      }
    },
    
    // Check if user is logged in
    isLoggedIn() {
      const session = this.getSession();
      return !!(session && session.loggedIn);
    },
    
    // Get dashboard path based on role
    getDashboardPath(role) {
      switch(role) {
        case 'admin': return 'admin.html';
        case 'faculty': return 'faculty.html';
        case 'student': return 'student.html';
        default: return 'index.html';
      }
    },
    
    // Redirect to appropriate dashboard
    redirectToDashboard(role) {
      const path = this.getDashboardPath(role);
      if (!window.location.pathname.includes(path)) {
        window.location.href = path;
      }
    },
    
    // Force logout from all tabs
    forceLogout(message = 'Session ended') {
      if (message) {
        // Store logout message in sessionStorage for the next page to display
        sessionStorage.setItem('logout_message', message);
      }
      this.clearSession();
      window.location.href = 'index.html';
    },
    
    // Check if current page matches user's role
    validatePageAccess() {
      const session = this.getSession();
      const currentPath = window.location.pathname;
      
      if (!session || !session.loggedIn) {
        // Not logged in, should be on index page
        if (!currentPath.includes('index.html') && !currentPath.endsWith('/')) {
          this.forceLogout('Please login first');
        }
        return false;
      }
      
      // Check if current page matches role
      const expectedPath = this.getDashboardPath(session.role);
      if (!currentPath.includes(expectedPath) && !currentPath.includes('index.html')) {
        // Wrong page for this role, redirect
        this.redirectToDashboard(session.role);
        return false;
      }
      
      return true;
    }
  };
  
  // Auto-initialize when script loads
  (function() {
    // Don't run on login page to avoid redirect loops
    if (!window.location.pathname.includes('index.html')) {
      SessionManager.init();
      SessionManager.validatePageAccess();
    }
  })();