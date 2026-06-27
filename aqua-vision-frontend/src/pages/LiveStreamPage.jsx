import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Video, VideoOff, Settings, ShieldAlert, Cpu, Activity, Zap } from 'lucide-react';

const LiveStreamPage = ({ isDark, showToast }) => {
  const [isActive, setIsActive] = useState(false);
  const [enableUDCP, setEnableUDCP] = useState(true);
  const [enableCLAHE, setEnableCLAHE] = useState(true);
  const [enableGrayWorld, setEnableGrayWorld] = useState(true);
  const [enableInference, setEnableInference] = useState(true);
  
  // Metrics
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState('0ms');
  const [backendTime, setBackendTime] = useState('0ms');
  const [label, setLabel] = useState('N/A');
  const [confidence, setConfidence] = useState(0);
  const [enhancedFrame, setEnhancedFrame] = useState(null);

  // References
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const requestRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));
  
  // Timing references for calculating metrics
  const lastFrameTimeRef = useRef(Date.now());
  const frameTimesRef = useRef([]);
  const frameSentTimeRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  const startStream = async () => {
    try {
      // 1. Get webcam stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: { ideal: 15 } }
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // 2. Connect WebSocket
      const wsUrl = 'ws://localhost:8000/api/stream-enhance';
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsActive(true);
        showToast('Connected to enhancement stream!', 'success');
        // Start streaming frames
        startCaptureLoop();
      };

      ws.onmessage = (event) => {
        const response = JSON.parse(event.data);
        if (response.success) {
          setEnhancedFrame(response.image);
          setBackendTime(response.processing_time);
          setLabel(response.label);
          setConfidence(response.confidence);

          // Calculate latency
          if (frameSentTimeRef.current) {
            const currentLatency = Date.now() - frameSentTimeRef.current;
            setLatency(`${currentLatency}ms`);
          }

          // Calculate FPS
          const now = Date.now();
          const delta = now - lastFrameTimeRef.current;
          lastFrameTimeRef.current = now;
          
          frameTimesRef.current.push(delta);
          if (frameTimesRef.current.length > 10) {
            frameTimesRef.current.shift();
          }
          const avgDelta = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
          setFps(Math.round(1000 / avgDelta));
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket Error:', err);
        showToast('Connection error. Is backend server running?', 'error');
        stopStream();
      };

      ws.onclose = () => {
        setIsActive(false);
        setEnhancedFrame(null);
      };

    } catch (err) {
      console.error('Error starting stream:', err);
      showToast('Could not access camera. Please allow permission.', 'error');
      stopStream();
    }
  };

  const stopStream = () => {
    setIsActive(false);
    
    // Stop camera track
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Cancel animation frame loop
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Reset metrics
    setEnhancedFrame(null);
    setFps(0);
    setLatency('0ms');
    setBackendTime('0ms');
    setLabel('N/A');
    setConfidence(0);
  };

  const startCaptureLoop = () => {
    let lastSent = 0;
    const sendInterval = 80; // ~12 FPS limit to avoid choking WebSocket

    const captureFrame = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        requestRef.current = requestAnimationFrame(captureFrame);
        return;
      }

      const now = Date.now();
      if (now - lastSent >= sendInterval) {
        lastSent = now;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Set dimensions match video track size
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        // Draw image onto canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert canvas image to low-compression JPEG
        const base64Image = canvas.toDataURL('image/jpeg', 0.65);

        // Send payload
        const payload = {
          image: base64Image,
          udcp: enableUDCP,
          clahe: enableCLAHE,
          grayworld: enableGrayWorld,
          inference: enableInference
        };
        
        frameSentTimeRef.current = now;
        wsRef.current.send(JSON.stringify(payload));
      }

      requestRef.current = requestAnimationFrame(captureFrame);
    };

    requestRef.current = requestAnimationFrame(captureFrame);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className={`text-4xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Live Video Stream Enhancement
          </h1>
          <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
            Real-time dehazing, light compensation, and AI object classification from your camera
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Controls Side Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Connection Toggle */}
            <div className={`p-6 rounded-2xl ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white/50 border-slate-200'} border backdrop-blur-sm shadow-md`}>
              <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <Activity className="w-5 h-5 text-cyan-400" />
                Connection
              </h2>
              
              <button
                onClick={isActive ? stopStream : startStream}
                className={`w-full py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                  isActive
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-cyan-500/35 text-white'
                } shadow-lg`}
              >
                {isActive ? (
                  <>
                    <VideoOff className="w-5 h-5" /> Stop Stream
                  </>
                ) : (
                  <>
                    <Video className="w-5 h-5" /> Start Stream
                  </>
                )}
              </button>
            </div>

            {/* AI Enhancement Filters Toggle */}
            <div className={`p-6 rounded-2xl ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white/50 border-slate-200'} border backdrop-blur-sm shadow-md`}>
              <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <Settings className="w-5 h-5 text-cyan-400" />
                Pipeline Config
              </h2>
              <div className="space-y-4">
                {/* UDCP Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>UDCP Dehazing</p>
                    <p className="text-xs text-slate-500">Corrects light scattering</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableUDCP}
                    onChange={(e) => setEnableUDCP(e.target.checked)}
                    className="w-10 h-5 bg-slate-400 rounded-full appearance-none checked:bg-cyan-500 relative before:content-[''] before:absolute before:h-4 before:w-4 before:bg-white before:rounded-full before:top-[2px] before:left-[2px] checked:before:translate-x-5 before:transition-transform cursor-pointer"
                  />
                </div>

                {/* CLAHE Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>CLAHE Contrast</p>
                    <p className="text-xs text-slate-500">Improves visibility range</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableCLAHE}
                    onChange={(e) => setEnableCLAHE(e.target.checked)}
                    className="w-10 h-5 bg-slate-400 rounded-full appearance-none checked:bg-cyan-500 relative before:content-[''] before:absolute before:h-4 before:w-4 before:bg-white before:rounded-full before:top-[2px] before:left-[2px] checked:before:translate-x-5 before:transition-transform cursor-pointer"
                  />
                </div>

                {/* Gray-World Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>White Balance</p>
                    <p className="text-xs text-slate-500">Gray-world color tuning</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableGrayWorld}
                    onChange={(e) => setEnableGrayWorld(e.target.checked)}
                    className="w-10 h-5 bg-slate-400 rounded-full appearance-none checked:bg-cyan-500 relative before:content-[''] before:absolute before:h-4 before:w-4 before:bg-white before:rounded-full before:top-[2px] before:left-[2px] checked:before:translate-x-5 before:transition-transform cursor-pointer"
                  />
                </div>

                {/* Model Inference Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Object Classifier</p>
                    <p className="text-xs text-slate-500">ImageNet MobileNet model</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableInference}
                    onChange={(e) => setEnableInference(e.target.checked)}
                    className="w-10 h-5 bg-slate-400 rounded-full appearance-none checked:bg-cyan-500 relative before:content-[''] before:absolute before:h-4 before:w-4 before:bg-white before:rounded-full before:top-[2px] before:left-[2px] checked:before:translate-x-5 before:transition-transform cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Pipeline Stats */}
            <div className={`p-6 rounded-2xl ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white/50 border-slate-200'} border backdrop-blur-sm shadow-md`}>
              <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <Zap className="w-5 h-5 text-cyan-400" />
                Performance Metrics
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-900/60' : 'bg-slate-100'}`}>
                  <p className="text-xs text-slate-500">FPS</p>
                  <p className={`text-xl font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>{fps}</p>
                </div>
                <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-900/60' : 'bg-slate-100'}`}>
                  <p className="text-xs text-slate-500">Round Trip</p>
                  <p className={`text-xl font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>{latency}</p>
                </div>
                <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-900/60' : 'bg-slate-100'} col-span-2`}>
                  <p className="text-xs text-slate-500">Backend Core Process</p>
                  <p className={`text-xl font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>{backendTime}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Feeds Video Displays */}
          <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Raw Video Feed */}
              <div className={`p-4 rounded-3xl ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-white/55 border-slate-200'} border backdrop-blur-sm relative overflow-hidden`}>
                <p className={`text-sm font-semibold mb-3 tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  RAW VIDEO CAMERA INPUT
                </p>
                <div className="aspect-[4/3] rounded-2xl bg-black overflow-hidden relative border border-slate-800 shadow-inner">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  {!isActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2 bg-slate-950/80">
                      <VideoOff className="w-12 h-12" />
                      <p className="text-sm">Stream offline</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced Video Feed */}
              <div className={`p-4 rounded-3xl ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-white/55 border-slate-200'} border backdrop-blur-sm relative overflow-hidden`}>
                <p className={`text-sm font-semibold mb-3 tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  AI-ENHANCED STREAM OUTPUT
                </p>
                <div className="aspect-[4/3] rounded-2xl bg-black overflow-hidden relative border border-slate-800 shadow-inner">
                  {enhancedFrame ? (
                    <img
                      src={enhancedFrame}
                      alt="AI Enhanced Stream"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2 bg-slate-950/80">
                      <Cpu className="w-12 h-12 animate-pulse text-cyan-500/60" />
                      <p className="text-sm">Waiting for enhanced stream...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Model Inference Metadata Banner */}
            {enableInference && (
              <div className={`p-6 rounded-3xl border backdrop-blur-sm transition-all ${
                isDark 
                  ? 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-cyan-500/20' 
                  : 'bg-gradient-to-r from-white via-cyan-50/20 to-white border-cyan-500/25'
              }`}>
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center border border-cyan-500/20">
                      <Cpu className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                      <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>REAL-TIME CLASSIFICATION RESULT</p>
                      <h3 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {isActive ? label : 'Waiting for connection...'}
                      </h3>
                    </div>
                  </div>
                  
                  {isActive && confidence > 0 && (
                    <div className="text-right">
                      <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>CONFIDENCE</p>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-cyan-400">
                          {(confidence * 100).toFixed(1)}%
                        </span>
                        {confidence < 0.35 && (
                          <div className="flex items-center text-amber-500 gap-1 text-xs font-semibold">
                            <ShieldAlert className="w-3.5 h-3.5" /> Low confidence
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveStreamPage;
