import React, { useState } from 'react';
import { motion } from 'framer-motion';

const ResultsPage = ({ isDark, enhancedData }) => {
  const [showComparison, setShowComparison] = useState(true);

  if (!enhancedData) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>No results yet. Upload an image first!</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className={`text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Enhancement Complete
          </h1>
          <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
            Your image has been processed successfully
          </p>
        </motion.div>

        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => setShowComparison(true)}
            className={`px-6 py-2 rounded-lg transition-all ${
              showComparison
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                : isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
            }`}
          >
            Side by Side
          </button>
          <button
            onClick={() => setShowComparison(false)}
            className={`px-6 py-2 rounded-lg transition-all ${
              !showComparison
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                : isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
            }`}
          >
            Enhanced Only
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`grid ${showComparison ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-6 mb-8`}
        >
          {showComparison && (
            <div className={`p-4 rounded-2xl ${isDark ? 'bg-slate-800/50' : 'bg-white/50'} backdrop-blur-sm border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>ORIGINAL</p>
              <img src={enhancedData.original} alt="Original" className="w-full rounded-xl shadow-lg" />
            </div>
          )}
          <div className={`p-4 rounded-2xl ${isDark ? 'bg-slate-800/50' : 'bg-white/50'} backdrop-blur-sm border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>ENHANCED</p>
            <img src={enhancedData.enhanced} alt="Enhanced" className="w-full rounded-xl shadow-lg" />
          </div>
        </motion.div>

        <div className={`p-6 rounded-2xl ${isDark ? 'bg-slate-800/50' : 'bg-white/50'} backdrop-blur-sm border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Inference & Enhancement Metadata</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>AI Classification</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                {enhancedData.metadata.label || 'N/A'}
              </p>
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Confidence Score</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                {(enhancedData.metadata.confidence * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Processing Time</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                {enhancedData.metadata.processingTime}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsPage;