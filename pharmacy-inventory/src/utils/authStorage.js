const SESSION_KEY = 'mediquick.auth';

export const loadAuthSession = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(SESSION_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch (error) {
    return null;
  }
};

export const saveAuthSession = (authPayload) => {
  if (typeof window === 'undefined' || !authPayload?.token || !authPayload?.user) {
    return null;
  }

  const session = {
    token: authPayload.token,
    user: authPayload.user,
  };

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.localStorage.setItem('authToken', authPayload.token);
  window.localStorage.setItem('username', authPayload.user.username);
  window.localStorage.setItem('role', authPayload.user.role);

  return session;
};

export const clearAuthSession = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem('authToken');
  window.localStorage.removeItem('username');
  window.localStorage.removeItem('role');
};

export const getAccessToken = () => {
  const session = loadAuthSession();
  return session?.token || null;
};

export const emitForcedLogout = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event('mediquick:logout'));
};
