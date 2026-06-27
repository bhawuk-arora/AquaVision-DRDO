import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar';
import Toast from './components/Toast';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import ResultsPage from './pages/ResultsPage';
import AboutPage from './pages/AboutPage';
import LiveStreamPage from './pages/LiveStreamPage';

export default function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [isDark, setIsDark] = useState(true);
  const [toast, setToast] = useState(null);
  const [enhancedData, setEnhancedData] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900' : 'bg-gradient-to-br from-blue-50 via-cyan-50 to-slate-100'} transition-colors duration-300`}>
      <Navbar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
        isDark={isDark} 
        toggleTheme={toggleTheme} 
      />
      
      <AnimatePresence mode="wait">
        {currentPage === 'home' && (
          <HomePage 
            key="home" 
            setCurrentPage={setCurrentPage} 
            isDark={isDark} 
          />
        )}
        {currentPage === 'upload' && (
          <UploadPage 
            key="upload" 
            isDark={isDark} 
            showToast={showToast} 
            setEnhancedData={setEnhancedData} 
            setCurrentPage={setCurrentPage} 
          />
        )}
        {currentPage === 'stream' && (
          <LiveStreamPage 
            key="stream" 
            isDark={isDark} 
            showToast={showToast} 
          />
        )}
        {currentPage === 'results' && (
          <ResultsPage 
            key="results" 
            isDark={isDark} 
            enhancedData={enhancedData} 
          />
        )}
        {currentPage === 'about' && (
          <AboutPage 
            key="about" 
            isDark={isDark} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <Toast 
            key="toast" 
            message={toast.message} 
            type={toast.type} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
