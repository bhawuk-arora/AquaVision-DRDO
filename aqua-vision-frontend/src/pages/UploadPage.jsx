import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload } from 'lucide-react';
import { enhanceImage } from '../services/api';

const UploadPage = ({ isDark, showToast, setEnhancedData, setCurrentPage }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = useCallback((selectedFile) => {
    if (!selectedFile.type.match('image/(jpg|jpeg|png)')) {
      showToast('Please select a JPG or PNG image', 'error');
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(selectedFile);
  }, [showToast]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleEnhance = async () => {
    if (!file) {
      showToast('Please select an image first', 'error');
      return;
    }

    setLoading(true);

    const result = await enhanceImage(file);

    if (result.success) {
      setEnhancedData({
        original: preview,
        enhanced: result.data.enhanced_image,
        metadata: {
          processingTime: result.data.processing_time,
          confidence: result.data.confidence,
          label: result.data.classification_label
        }
      });

      showToast('Enhancement completed successfully!', 'success');
      setTimeout(() => setCurrentPage('results'), 1000);
    } else {
      showToast('Enhancement failed. Using demo mode.', 'error');
      // Demo fallback
      setEnhancedData({
        original: preview,
        enhanced: preview,
        metadata: {
          processingTime: '2.3s',
          confidence: 0.94,
          label: 'Scuba Diver'
        }
      });
      setTimeout(() => setCurrentPage('results'), 1000);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className={`text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Upload Your Image
          </h1>
          <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
            Drag and drop or click to select an underwater image
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative p-12 border-2 border-dashed rounded-3xl transition-all ${
            dragActive
              ? 'border-cyan-500 bg-cyan-500/10'
              : isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-300 bg-white/50'
          } backdrop-blur-sm`}
        >
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            onChange={(e) => e.target.files && handleFile(e.target.files[0])}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          {!preview ? (
            <div className="text-center">
              <Upload className={`w-20 h-20 mx-auto mb-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
              <p className={`text-xl mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Drop your image here
              </p>
              <p className={isDark ? 'text-slate-500' : 'text-slate-500'}>
                Supports JPG, PNG up to 10MB
              </p>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <img src={preview} alt="Preview" className="max-h-96 mx-auto rounded-xl shadow-lg mb-4" />
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{file.name}</p>
            </motion.div>
          )}
        </motion.div>

        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 text-center"
          >
            <button
              onClick={handleEnhance}
              disabled={loading}
              className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-lg font-semibold rounded-full shadow-lg hover:shadow-cyan-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                  />
                  Enhancing...
                </span>
              ) : (
                'Enhance Now'
              )}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default UploadPage;