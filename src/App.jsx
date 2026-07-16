import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Header from './components/Header';
import Home from './pages/Home';
import GameRoom from './pages/GameRoom';

export default function App() {
  const { user, loading, error, updateUsername } = useAuth();

  if (loading) {
    return (
      <div className="app-loading-screen flex-center" style={{ height: '100vh', flexDirection: 'column', gap: '20px' }}>
        <div className="spinner"></div>
        <p style={{ fontFamily: 'var(--font-heading)', color: 'hsl(var(--text-secondary))', letterSpacing: '0.05em' }}>
          INITIALIZING SECURE SESSION...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-error-screen flex-center" style={{ height: '100vh', flexDirection: 'column', padding: '20px', textAlign: 'center' }}>
        <h2 style={{ color: 'hsl(var(--primary))', marginBottom: '10px' }}>Session Failure</h2>
        <p style={{ color: 'hsl(var(--text-secondary))', maxWidth: '400px', marginBottom: '20px' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry Connection</button>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="app-container">
        <Header />
        
        <main className="main-content">
          <Routes>
            <Route 
              path="/" 
              element={<Home user={user} updateUsername={updateUsername} />} 
            />
            <Route 
              path="/room/:roomCode" 
              element={<GameRoom user={user} />} 
            />
            <Route 
              path="*" 
              element={<Navigate to="/" replace />} 
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
