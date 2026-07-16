import { useState, useEffect } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth, isRealFirebase } from '../firebase/config';

// Helper to generate a nice random gaming nickname
const ADJECTIVES = ['Alpha', 'Apex', 'Cyber', 'Neon', 'Cosmic', 'Shadow', 'Turbo', 'Hyper', 'Swift', 'Mega'];
const NOUNS = ['Ninja', 'Raptor', 'Viper', 'Specter', 'Titan', 'Knight', 'Wizard', 'Glitch', 'Rogue', 'Helix'];

export function generateNickname() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${adj}${noun}${num}`;
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let unsubscribe = () => {};

    if (isRealFirebase && auth) {
      // Firebase authentication listener
      unsubscribe = auth.onAuthStateChanged(
        async (firebaseUser) => {
          if (firebaseUser) {
            // User is signed in
            setUser({
              uid: firebaseUser.uid,
              name: sessionStorage.getItem('bingo_username') || generateNickname(),
              isAnonymous: firebaseUser.isAnonymous,
            });
            setLoading(false);
          } else {
            // Sign in anonymously
            try {
              const userCredential = await signInAnonymously(auth);
              const generatedName = sessionStorage.getItem('bingo_username') || generateNickname();
              sessionStorage.setItem('bingo_username', generatedName);
              setUser({
                uid: userCredential.user.uid,
                name: generatedName,
                isAnonymous: true,
              });
            } catch (err) {
              console.error('Anonymous sign-in error:', err);
              setError(err.message);
            } finally {
              setLoading(false);
            }
          }
        },
        (err) => {
          console.error('Auth state change listener error:', err);
          setError(err.message);
          setLoading(false);
        }
      );
    } else {
      // Mock Auth for Demo Mode (uses sessionStorage so multiple tabs act as different users)
      let mockUid = sessionStorage.getItem('bingo_mock_uid');
      if (!mockUid) {
        mockUid = `mock_user_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        sessionStorage.setItem('bingo_mock_uid', mockUid);
      }

      let mockName = sessionStorage.getItem('bingo_username');
      if (!mockName) {
        mockName = generateNickname();
        sessionStorage.setItem('bingo_username', mockName);
      }

      setUser({
        uid: mockUid,
        name: mockName,
        isAnonymous: true,
        isMock: true,
      });
      setLoading(false);
    }

    return () => unsubscribe();
  }, []);

  const updateUsername = (newName) => {
    if (!newName || newName.trim() === '') return;
    const cleanName = newName.trim();
    sessionStorage.setItem('bingo_username', cleanName);
    setUser(prev => prev ? { ...prev, name: cleanName } : null);
  };

  return { user, loading, error, updateUsername };
}
