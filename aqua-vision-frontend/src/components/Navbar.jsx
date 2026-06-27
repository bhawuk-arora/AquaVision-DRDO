import React from 'react';
import { motion } from 'framer-motion';
import { Upload, Image, Info, Home, Sun, Moon, Droplets, Video } from 'lucide-react';

const Navbar = ({ currentPage, setCurrentPage, isDark, toggleTheme }) => {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'upload', label: 'Upload', icon: Upload },
    { id: 'stream', label: 'Live Stream', icon: Video },
    { id: 'results', label: 'Results', icon: Image },
    { id: 'about', label: 'About', icon: Info }
  ];

  return (
    <nav className={`${isDark ? 'bg-slate-900/95' : 'bg-white/95'} backdrop-blur-md border-b ${isDark ? 'border-slate-800' : 'border-slate-200'} sticky top-0 z-40 transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <motion.div 
            className="flex items-center gap-2 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            onClick={() => setCurrentPage('home')}
          >
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
              AquaVision
            </span>
          </motion.div>

          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                    currentPage === item.id
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                      : isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </motion.button>
              );
            })}
            <motion.button
              onClick={toggleTheme}
              className={`ml-2 p-2 rounded-lg ${isDark ? 'bg-slate-800 text-yellow-400' : 'bg-slate-100 text-slate-600'}`}
              whileHover={{ scale: 1.1, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </motion.button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;