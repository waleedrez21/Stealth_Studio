import { createContext, useContext, useEffect, useState } from 'react';
import { onIdTokenChanged, signOut, type User } from 'firebase/auth';
import { auth } from './firebase';
import { api } from './api';

type Session = {
  user: User | null;
  coach: boolean;
  loading: boolean;
  error: string;
  logout: () => Promise<void>;
};

const context = createContext<Session>({
  user: null,
  coach: false,
  loading: true,
  error: '',
  logout: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [coach, setCoach] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    // Ignore an old account check if the user switches accounts while it is in flight.
    let generation = 0;
    const stop = onIdTokenChanged(auth, async (value) => {
      const n = ++generation;
      setLoading(true);
      setUser(value);
      setCoach(false);
      setError('');
      try {
        const result = await api<{ coach: boolean }>('/api/me');
        if (n === generation) setCoach(result.coach);
      } catch (e) {
        if (n === generation) setError(e instanceof Error ? e.message : 'Account check failed.');
      } finally {
        if (n === generation) setLoading(false);
      }
    });
    return () => {
      generation++;
      stop();
    };
  }, []);
  return (
    <context.Provider
      value={{
        user,
        coach,
        loading,
        error,
        logout: async () => {
          if (auth) await signOut(auth);
          location.assign('/');
        },
      }}
    >
      {children}
    </context.Provider>
  );
}
export function useSession() {
  return useContext(context);
}
