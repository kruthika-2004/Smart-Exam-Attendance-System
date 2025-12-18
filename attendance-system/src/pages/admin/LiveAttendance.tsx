import { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { localDB, Session, Student, Attendance, Class, ClassStudent } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import { loadFaceApiModels, detectFacesInVideo, findBestMatch, computeFaceDescriptor, compareDescriptors } from '../../utils/faceRecognition';
import { generateUUID } from '../../utils/uuid';
import * as faceapi from 'face-api.js';
import { Camera, X, CheckCircle, Users, ArrowLeft, User, AlertCircle } from 'lucide-react';

interface LiveAttendanceProps {
  sessionId: string;
  onBack: () => void;
}

export function LiveAttendance({ sessionId, onBack }: LiveAttendanceProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [classData, setClassData] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMarking, setIsMarking] = useState(false);
  const [faceRecognitionActive, setFaceRecognitionActive] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [detectedStudent, setDetectedStudent] = useState<{ student: Student; confidence: number } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render key
  const recognitionIntervalRef = useRef<number | null>(null);
  const faceRecognitionActiveRef = useRef(false);
  const lastNotificationTimeRef = useRef<{ [studentId: string]: number }>({});
  const markedStudentsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    loadSessionData();
  }, [sessionId]);

  // Debug: Log attendance changes
  useEffect(() => {
    console.log('📋 Attendance state updated:', {
      count: attendance.length,
      studentIds: attendance.map(a => a.student_id),
      records: attendance.map(a => ({
        studentId: a.student_id,
        timestamp: a.timestamp,
        method: a.method
      }))
    });
  }, [attendance]);

  useEffect(() => {
    return () => {
      // Cleanup camera stream on unmount
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Ensure video plays when stream is set
  useEffect(() => {
    if (videoRef.current && stream && cameraActive) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch((err) => {
        console.error('Error playing video in useEffect:', err);
      });
    }
  }, [stream, cameraActive]);

  const loadSessionData = async () => {
    try {
      const sessionData = await localDB.selectSingle<Session>('sessions', {
        eq: { id: sessionId }
      });

      if (!sessionData) {
        showToast('Session not found', 'error');
        onBack();
        return;
      }

      setSession(sessionData);

      // Load class data
      const classInfo = await localDB.selectSingle<Class>('classes', {
        eq: { id: sessionData.class_id }
      });
      setClassData(classInfo);

      // Load students for this class
      const classStudents = await localDB.select<ClassStudent>('classStudents', {
        eq: { class_id: sessionData.class_id }
      });
      
      if (classStudents.length > 0) {
        const studentIds = classStudents.map(cs => cs.student_id);
        const classStudentsData = await Promise.all(
          studentIds.map(async (id) => {
            return await localDB.selectSingle<Student>('students', { eq: { id } });
          })
        );
        setStudents(classStudentsData.filter(s => s !== null) as Student[]);
      } else {
        // Fallback: load all students if no class association
        const allStudents = await localDB.select<Student>('students', {
          orderBy: { column: 'name', ascending: true }
        });
        setStudents(allStudents);
      }

      // Load existing attendance
      const attendanceRecords = await localDB.select<Attendance>('attendance', {
        eq: { session_id: sessionId }
      });
      console.log(`📋 Loaded ${attendanceRecords.length} existing attendance records`);
      setAttendance(attendanceRecords);
      
      // Initialize marked students set with existing attendance
      markedStudentsRef.current = new Set(attendanceRecords.map(a => a.student_id));
      console.log(`📋 Initialized markedStudentsRef with:`, Array.from(markedStudentsRef.current));
    } catch (error: any) {
      showToast(error.message || 'Error loading session data', 'error');
    }
  };

  const startCamera = async () => {
    try {
      // Load face-api.js models first
      setModelsLoading(true);
      let modelsAvailable = false;
      try {
        console.log('Loading face-api.js models...');
        await loadFaceApiModels();
        modelsAvailable = true;
        showToast('Face recognition models loaded', 'success');
        console.log('✅ Models loaded successfully');
      } catch (error: any) {
        console.error('❌ Failed to load models:', error);
        showToast(`Face recognition models not available: ${error.message}. Manual marking only.`, 'warning');
        modelsAvailable = false;
      } finally {
        setModelsLoading(false);
      }
      
      if (!modelsAvailable) {
        console.warn('Starting camera without face recognition models - manual marking only');
      }

      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Check if we're on HTTP (not HTTPS or localhost)
        const isSecureContext = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (!isSecureContext && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
          const errorMsg = 'Camera access requires HTTPS or localhost. When accessing from another device, please use HTTPS or access from the server laptop at http://localhost:5173';
          console.error(errorMsg);
          showToast(errorMsg, 'error');
          throw new Error(errorMsg);
        }
        
        // Fallback for older browsers
        const getUserMedia = (navigator as any).getUserMedia ||
          (navigator as any).webkitGetUserMedia ||
          (navigator as any).mozGetUserMedia ||
          (navigator as any).msGetUserMedia;
        
        if (!getUserMedia) {
          const errorMsg = 'Camera access is not supported in this browser. Please use a modern browser (Chrome, Firefox, Safari, Edge).';
          console.error(errorMsg);
          showToast(errorMsg, 'error');
          throw new Error(errorMsg);
        }
        
        // Use fallback getUserMedia (callback-based)
        const mediaStream = await new Promise<MediaStream>((resolve, reject) => {
          getUserMedia.call(
            navigator,
            { video: { width: 1280, height: 720, facingMode: 'user' }, audio: false },
            resolve,
            reject
          );
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          setStream(mediaStream);
          setCameraActive(true);
          showToast('Camera started successfully', 'success');
        }
        return;
      }

      // Modern API - try to access camera
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false
        });
      } catch (error: any) {
        // Check if it's a security/permission error
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          const errorMsg = 'Camera permission denied. Please allow camera access in your browser settings.';
          console.error(errorMsg, error);
          showToast(errorMsg, 'error');
          throw new Error(errorMsg);
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          const errorMsg = 'No camera found. Please connect a camera device.';
          console.error(errorMsg, error);
          showToast(errorMsg, 'error');
          throw new Error(errorMsg);
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          const errorMsg = 'Camera is already in use by another application.';
          console.error(errorMsg, error);
          showToast(errorMsg, 'error');
          throw new Error(errorMsg);
        } else {
          // Check if it's a secure context issue
          const isSecureContext = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          if (!isSecureContext && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
            const errorMsg = 'Camera access requires HTTPS when accessing from network IP. For development, use http://localhost:5173 on the server laptop, or set up HTTPS.';
            console.error(errorMsg, error);
            showToast(errorMsg, 'error');
            throw new Error(errorMsg);
          }
          throw error;
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Wait for video metadata to load and play
        await new Promise<void>((resolve, reject) => {
          if (videoRef.current) {
            const video = videoRef.current;
            
            const onLoadedMetadata = () => {
              video.removeEventListener('loadedmetadata', onLoadedMetadata);
              video.play()
                .then(() => {
                  console.log('Video playing, dimensions:', video.videoWidth, 'x', video.videoHeight);
                  resolve();
                })
                .catch((err) => {
                  console.error('Error playing video:', err);
                  reject(err);
                });
            };
            
            const onError = (err: Event) => {
              video.removeEventListener('error', onError);
              console.error('Video error:', err);
              reject(err);
            };
            
            video.addEventListener('loadedmetadata', onLoadedMetadata);
            video.addEventListener('error', onError);
            
            // Fallback timeout
            setTimeout(() => {
              if (video.readyState >= 2) {
                video.play().then(() => resolve()).catch(reject);
              } else {
                reject(new Error('Video metadata timeout'));
              }
            }, 5000);
          } else {
            resolve();
          }
        });
      }

      setStream(mediaStream);
      setCameraActive(true);
      showToast('Camera started', 'success');

      // Wait for video to be ready, then start face recognition
      const startRecognitionWhenReady = () => {
        if (videoRef.current && videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0) {
          startFaceRecognition();
        } else {
          setTimeout(startRecognitionWhenReady, 100);
        }
      };
      
      setTimeout(startRecognitionWhenReady, 500);
    } catch (error: any) {
      showToast('Failed to access camera: ' + error.message, 'error');
      console.error('Camera error:', error);
      setModelsLoading(false);
    }
  };

  const startFaceRecognition = async () => {
    if (!videoRef.current || !canvasRef.current) {
      console.warn('Video or canvas ref not available');
      return;
    }

    // Compute descriptors for students who don't have them
    await computeMissingDescriptors();

    // Set active BEFORE starting the loop (both state and ref)
    faceRecognitionActiveRef.current = true;
    setFaceRecognitionActive(true);
    console.log('✅ Face recognition activated');

    // Start recognition loop
    const recognizeFaces = async () => {
      // Check ref instead of state to avoid stale closure
      if (!videoRef.current) {
        console.log('⏸️ Video ref not available');
        return;
      }
      if (!canvasRef.current) {
        console.log('⏸️ Canvas ref not available');
        return;
      }
      
      // Use ref to check active state (avoids stale closure issue)
      if (!faceRecognitionActiveRef.current) {
        console.log('⏸️ Face recognition not active (skipping this tick)');
        return;
      }

      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        // Ensure video is ready and has dimensions
        if (video.readyState < 2) {
          console.log('⏳ Video not ready (readyState < 2):', { readyState: video.readyState });
          return;
        }
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          console.log('⏳ Video dimensions are 0:', { width: video.videoWidth, height: video.videoHeight });
          return;
        }
        
        console.log('🔍 Running face detection...', { 
          videoWidth: video.videoWidth, 
          videoHeight: video.videoHeight,
          readyState: video.readyState 
        });
        
        // Get video display size (what's actually shown on screen)
        const videoRect = video.getBoundingClientRect();
        const displaySize = {
          width: videoRect.width,
          height: videoRect.height
        };
        
        // Get video native size (actual video dimensions)
        const videoSize = {
          width: video.videoWidth,
          height: video.videoHeight
        };
        
        // Set canvas to match video display size
        if (displaySize.width > 0 && displaySize.height > 0) {
          canvas.width = displaySize.width;
          canvas.height = displaySize.height;
        } else {
          console.warn('Display size is 0, using video size');
          canvas.width = videoSize.width;
          canvas.height = videoSize.height;
        }
        
        // Position canvas to overlay video exactly
        canvas.style.width = `${displaySize.width}px`;
        canvas.style.height = `${displaySize.height}px`;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.warn('Could not get canvas context');
          return;
        }
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        console.log('🔍 Attempting face detection...', { 
          videoSize, 
          displaySize, 
          canvasSize: { width: canvas.width, height: canvas.height } 
        });
        
        // Try to detect faces
        const detections = await detectFacesInVideo(video);
        
        console.log('📊 Detection result:', { 
          detections: detections?.length || 0, 
          hasDetections: !!detections && detections.length > 0 
        });
        
        if (detections && detections.length > 0) {
          console.log(`🎯 Drawing ${detections.length} face detection(s)`);
          
          // Clear canvas first
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Match canvas dimensions to video native size for face-api.js coordinate system
          faceapi.matchDimensions(canvas, videoSize);
          
          // Resize detections to match video native size
          const resizedDetections = faceapi.resizeResults(detections, videoSize);
          
          // Now resize to match display size for drawing
          const displayDetections = faceapi.resizeResults(resizedDetections, displaySize);
          
          // Draw boxes and labels for all detected faces
          displayDetections.forEach((detection, index) => {
            const box = detection.detection.box;
            
            // Ensure box coordinates are valid
            if (box.width > 0 && box.height > 0 && box.x >= 0 && box.y >= 0) {
              const label = detectedStudent && index === 0
                ? detectedStudent.student.name
                : 'Face Detected';
              
              // Draw box directly with display coordinates
              ctx.strokeStyle = detectedStudent && index === 0 ? '#16A34A' : '#0B6CF9';
              ctx.lineWidth = 3;
              ctx.strokeRect(box.x, box.y, box.width, box.height);
              
              // Draw label background
              ctx.fillStyle = detectedStudent && index === 0 ? '#16A34A' : '#0B6CF9';
              const labelHeight = 20;
              ctx.fillRect(box.x, box.y - labelHeight, box.width, labelHeight);
              
              // Draw label text
              ctx.fillStyle = '#FFFFFF';
              ctx.font = '14px Arial';
              ctx.textAlign = 'center';
              ctx.fillText(
                label,
                box.x + box.width / 2,
                box.y - 5
              );
              
              console.log(`✅ Box ${index + 1} drawn at:`, box);
            } else {
              console.warn(`⚠️ Invalid box coordinates for face ${index + 1}:`, box);
            }
          });
          
          console.log('✅ Face boxes drawn on canvas');

          // Try to recognize faces (only process first detection for now)
          // Only attempt recognition if:
          // 1. Face is detected with descriptor
          // 2. Detection score is high enough (at least 0.5)
          const firstDetection = detections[0];
          if (firstDetection?.descriptor && firstDetection.detection.score >= 0.5) {
            console.log('🎯 Face detected with descriptor, attempting recognition...', {
              score: firstDetection.detection.score
            });
            await recognizeFace(firstDetection.descriptor);
          } else if (detections.length > 0) {
            if (!firstDetection?.descriptor) {
              // Face detected but no descriptor (recognition model not loaded)
              console.log('⚠️ Face detected but no descriptor available (recognition model may not be loaded)');
            } else if (firstDetection.detection.score < 0.5) {
              // Detection score too low
              console.log('⚠️ Face detection score too low:', firstDetection.detection.score);
              setDetectedStudent(null);
            }
          }
        } else {
          // No faces detected - clear any previous detection
          console.log('No faces detected in this frame');
          setDetectedStudent(null);
        }
      } catch (error: any) {
        console.error('Face recognition error:', error);
        console.error('Error details:', error.message, error.stack);
      }
    };

    // Run recognition every 500ms for better responsiveness
    console.log('🔄 Starting face detection interval...');
    
    // Use ref to check active state in interval
    recognitionIntervalRef.current = window.setInterval(() => {
      if (faceRecognitionActiveRef.current) {
        recognizeFaces();
      }
    }, 500);
    
    // Run immediately after a short delay to ensure ref is set
    setTimeout(() => {
      console.log('🚀 Running initial face detection...');
      recognizeFaces();
    }, 100);
  };

  const computeMissingDescriptors = async () => {
    // Only compute descriptors if recognition model is available
    // Check by trying to load models first
    try {
      await loadFaceApiModels();
    } catch (error) {
      console.log('Recognition model not available, skipping descriptor computation');
      return;
    }

    // Check if recognition is actually available (modelsLoaded might be true but recognition might have failed)
    // We'll check by attempting one descriptor computation
    let recognitionAvailable = false;
    if (students.length > 0 && students[0].photo_url) {
      try {
        const testDescriptor = await computeFaceDescriptor(students[0].photo_url);
        if (testDescriptor) {
          recognitionAvailable = true;
        }
      } catch (error) {
        // Recognition not available
      }
    }

    if (!recognitionAvailable) {
      console.log('Recognition model not available, skipping descriptor computation for all students');
      return;
    }

    // Only compute for students without descriptors
    const studentsNeedingDescriptors = students.filter(s => !s.descriptor && s.photo_url);
    if (studentsNeedingDescriptors.length === 0) {
      return;
    }

    console.log(`Computing descriptors for ${studentsNeedingDescriptors.length} student(s)...`);
    
    for (const student of studentsNeedingDescriptors) {
      try {
        const descriptor = await computeFaceDescriptor(student.photo_url);
        if (descriptor) {
          await localDB.update<Student>('students', { eq: { id: student.id } }, {
            descriptor: Array.from(descriptor),
            descriptor_computed_at: new Date().toISOString()
          });
          // Update local state
          setStudents(prev => prev.map(s => 
            s.id === student.id 
              ? { ...s, descriptor: Array.from(descriptor), descriptor_computed_at: new Date().toISOString() }
              : s
          ));
          console.log(`✓ Computed descriptor for ${student.name}`);
        }
      } catch (error) {
        console.warn(`Could not compute descriptor for ${student.name}:`, error);
      }
    }
  };

  const recognizeFace = async (detectedDescriptor: Float32Array) => {
    console.log('🔎 Attempting face recognition...');
    
    // Validate descriptor
    if (!detectedDescriptor || detectedDescriptor.length === 0) {
      console.warn('⚠️ Invalid descriptor provided');
      setDetectedStudent(null);
      return;
    }
    
    // Get students with descriptors
    const studentsWithDescriptors = students
      .filter(s => s.descriptor && s.descriptor.length > 0)
      .map(s => ({
        studentId: s.id,
        descriptor: s.descriptor!
      }));

    console.log(`📚 Students with descriptors: ${studentsWithDescriptors.length} out of ${students.length}`);

    if (studentsWithDescriptors.length === 0) {
      console.warn('⚠️ No students have descriptors computed. Cannot recognize faces.');
      setDetectedStudent(null);
      return;
    }

    // Find best match - using threshold of 0.65 (65% similarity) for better accuracy
    const match = findBestMatch(detectedDescriptor, studentsWithDescriptors, 0.65);
    
    // Log all matches for debugging
    console.log('🔍 Checking matches against all students...');
    const allMatches = studentsWithDescriptors.map(({ studentId, descriptor }) => {
      const confidence = compareDescriptors(detectedDescriptor, descriptor);
      const student = students.find(s => s.id === studentId);
      return { studentId, studentName: student?.name || 'Unknown', confidence };
    }).sort((a, b) => b.confidence - a.confidence);
    
    console.log('📊 All match scores:', allMatches.map(m => 
      `${m.studentName}: ${(m.confidence * 100).toFixed(1)}%`
    ));
    
    if (allMatches.length > 0) {
      const bestMatch = allMatches[0];
      console.log(`🏆 Best match: ${bestMatch.studentName} with ${(bestMatch.confidence * 100).toFixed(1)}% confidence`);
      
      // Check if confidence is below 65%
      if (bestMatch.confidence < 0.65) {
        console.log('⚠️ Confidence too low, asking user to come closer');
        setDetectedStudent(null);
        
        // Show message only once per 3 seconds to avoid spam
        const now = Date.now();
        const lastLowConfidenceMessage = lastNotificationTimeRef.current['low_confidence'] || 0;
        
        if (now - lastLowConfidenceMessage > 3000) {
          showToast('Face not recognized clearly. Please come closer or ensure good lighting.', 'warning');
          lastNotificationTimeRef.current['low_confidence'] = now;
        }
        return;
      }
    }

    if (match && match.confidence >= 0.65) {
      console.log(`✅ Face recognized: ${match.studentId} with ${(match.confidence * 100).toFixed(1)}% confidence`);
      console.log(`🔍 Looking for student in array. Total students: ${students.length}`);
      console.log(`🔍 Student IDs in array:`, students.map(s => ({ id: s.id, name: s.name })));
      const student = students.find(s => s.id === match.studentId);
      console.log(`🔍 Found student:`, student ? { id: student.id, name: student.name } : 'NOT FOUND');
      
      if (student) {
        console.log(`👤 Setting detected student: ${student.name}`);
        setDetectedStudent({ student, confidence: match.confidence });
        
        // Check if already marked using both state and ref (more reliable)
        const isAlreadyMarkedInState = attendance.some(a => a.student_id === student.id);
        const isAlreadyMarkedInRef = markedStudentsRef.current.has(student.id);
        const isAlreadyMarked = isAlreadyMarkedInState || isAlreadyMarkedInRef;
        
        console.log(`📋 Marking check:`, {
          isAlreadyMarkedInState,
          isAlreadyMarkedInRef,
          isAlreadyMarked,
          attendanceCount: attendance.length,
          markedInRef: Array.from(markedStudentsRef.current)
        });
        
        if (!isAlreadyMarked) {
          console.log(`📝 Starting auto-mark process for ${student.name} (ID: ${student.id})`);
          
          // DON'T add to ref yet - let markAttendance do it after successful save
          console.log(`📝 Calling markAttendance for ${student.name}...`);
          try {
            const result = await markAttendance(student.id, 'face', match.confidence);
            console.log(`✅ markAttendance completed for ${student.name}. Result:`, result);
            
            // Force a re-render by updating a dummy state or reloading
            console.log(`🔄 Verifying attendance was saved...`);
            const verifyAttendance = await localDB.select<Attendance>('attendance', {
              eq: { session_id: sessionId, student_id: student.id }
            });
            console.log(`✅ Verification: Found ${verifyAttendance.length} attendance record(s) for ${student.name}`);
            
            // Always reload all attendance to update UI, regardless of verification
            console.log(`🔄 Reloading all attendance to update UI...`);
            const allAttendance = await localDB.select<Attendance>('attendance', {
              eq: { session_id: sessionId }
            });
            // Use spread operator to create new array reference for React to detect change
            const newAttendance = [...allAttendance];
            setAttendance(newAttendance);
            // Update ref with all marked students
            markedStudentsRef.current = new Set(newAttendance.map(a => a.student_id));
            // Force re-render
            setRefreshKey(prev => prev + 1);
            console.log(`✅ Reloaded attendance state. Total records: ${newAttendance.length}`);
            console.log(`✅ Attendance state updated. Student IDs:`, newAttendance.map(a => a.student_id));
            console.log(`✅ Updated markedStudentsRef. Now contains:`, Array.from(markedStudentsRef.current));
            console.log(`🔄 Forced UI update with refreshKey: ${refreshKey + 1}`);
            
            if (verifyAttendance.length === 0) {
              console.error(`❌ Verification failed: No attendance record found for ${student.name}`);
            }
          } catch (error: any) {
            console.error(`❌ Error in markAttendance:`, error);
            console.error(`❌ Error stack:`, error.stack);
            // Remove from ref if marking failed
            markedStudentsRef.current.delete(student.id);
            showToast(`Error marking attendance: ${error.message}`, 'error');
          }
        } else {
          console.log(`⏭️ ${student.name} already marked, skipping`);
          // Already marked - show notification only once per 5 seconds
          const now = Date.now();
          const lastNotification = lastNotificationTimeRef.current[student.id] || 0;
          
          if (now - lastNotification > 5000) {
            console.log(`✓ ${student.name} already marked`);
            showToast(`${student.name} - Already marked`, 'info');
            lastNotificationTimeRef.current[student.id] = now;
          }
        }
      } else {
        console.error(`❌ Student not found for ID: ${match.studentId}`);
      }
    } else {
      console.log('❌ No match found (confidence below 65% threshold)');
      setDetectedStudent(null);
      
      // Show message if we have matches but all are below threshold
      if (allMatches.length > 0 && allMatches[0].confidence > 0.3) {
        const now = Date.now();
        const lastLowConfidenceMessage = lastNotificationTimeRef.current['low_confidence'] || 0;
        
        if (now - lastLowConfidenceMessage > 3000) {
          showToast('Face not recognized. Please come closer or ensure good lighting.', 'warning');
          lastNotificationTimeRef.current['low_confidence'] = now;
        }
      } else if (allMatches.length === 0) {
        // No matches at all - might be unknown person
        const now = Date.now();
        const lastNoMatchMessage = lastNotificationTimeRef.current['no_match'] || 0;
        
        if (now - lastNoMatchMessage > 5000) {
          showToast('No matching student found. Please ensure you are registered.', 'warning');
          lastNotificationTimeRef.current['no_match'] = now;
        }
      }
    }
  };

  const stopCamera = () => {
    // Stop face recognition
    if (recognitionIntervalRef.current) {
      clearInterval(recognitionIntervalRef.current);
      recognitionIntervalRef.current = null;
    }
    faceRecognitionActiveRef.current = false;
    setFaceRecognitionActive(false);
    setDetectedStudent(null);
    // Note: Don't clear markedStudentsRef here - it should persist for the session

    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    showToast('Camera stopped', 'info');
  };

  const markAttendance = async (studentId: string, method: 'face' | 'manual' = 'manual', confidence?: number) => {
    console.log(`🎯 markAttendance called:`, { studentId, method, confidence, isMarking });
    
    if (isMarking) {
      console.log(`⏸️ Already marking, skipping`);
      return;
    }

    // Check if already marked - only check state, not ref (ref is updated after save)
    const existing = attendance.find(a => a.student_id === studentId);
    
    console.log(`🔍 markAttendance check:`, {
      existing: !!existing,
      attendanceCount: attendance.length,
      studentId
    });
    
    if (existing) {
      const student = students.find(s => s.id === studentId);
      const studentName = student?.name || 'Student';
      console.log(`⏭️ ${studentName} already marked in state, returning early`);
      showToast(`${studentName} - Already marked`, 'info');
      return;
    }
    
    // Also check database to be sure (in case state is stale)
    const dbCheck = await localDB.select<Attendance>('attendance', {
      eq: { session_id: sessionId, student_id: studentId }
    });
    
    if (dbCheck.length > 0) {
      const student = students.find(s => s.id === studentId);
      const studentName = student?.name || 'Student';
      console.log(`⏭️ ${studentName} already marked in database, reloading state and returning`);
      // Reload state from database
      const allAttendance = await localDB.select<Attendance>('attendance', {
        eq: { session_id: sessionId }
      });
      setAttendance([...allAttendance]);
      markedStudentsRef.current = new Set(allAttendance.map(a => a.student_id));
      showToast(`${studentName} - Already marked`, 'info');
      return;
    }

    console.log(`▶️ Starting markAttendance process for ${studentId}`);
    setIsMarking(true);
    try {
      if (!user || !session) {
        throw new Error('Session or user not found');
      }

      const attendanceRecord: Attendance = {
        id: generateUUID(),
        session_id: sessionId,
        student_id: studentId,
        timestamp: new Date().toISOString(),
        method,
        confidence: confidence || (method === 'face' ? 0.95 : undefined),
        marked_by: user.id,
        created_at: new Date().toISOString()
      };

      console.log(`💾 Inserting attendance record:`, attendanceRecord);
      await localDB.insert('attendance', attendanceRecord);
      console.log(`✅ Attendance inserted to database`);
      
      // Reload attendance from database to ensure consistency
      const updatedAttendance = await localDB.select<Attendance>('attendance', {
        eq: { session_id: sessionId }
      });
      console.log(`🔄 Reloaded attendance from database: ${updatedAttendance.length} records`);
      console.log(`🔄 Attendance records:`, updatedAttendance.map(a => ({
        studentId: a.student_id,
        timestamp: a.timestamp
      })));
      
      // Update state with fresh data from database - use a new array reference to force re-render
      const newAttendance = [...updatedAttendance];
      setAttendance(newAttendance);
      markedStudentsRef.current.add(studentId);
      console.log(`✅ Updated attendance state. Count: ${newAttendance.length}`);
      console.log(`✅ Added ${studentId} to markedStudentsRef. Now contains:`, Array.from(markedStudentsRef.current));
      
      // Force a re-render by updating refresh key
      setRefreshKey(prev => prev + 1);
      console.log(`🔄 Forced UI update with refreshKey: ${refreshKey + 1}`);
      
      const student = students.find(s => s.id === studentId);
      showToast(
        `Attendance marked for ${student?.name || 'Student'}`,
        'success'
      );
      
      // Update session status to live if not already
      if (session.status !== 'live') {
        await localDB.update<Session>('sessions', { eq: { id: sessionId } }, { status: 'live' });
        setSession({ ...session, status: 'live' });
      }
    } catch (error: any) {
      showToast(error.message || 'Error marking attendance', 'error');
    } finally {
      setIsMarking(false);
    }
  };

  const refreshAttendance = async () => {
    console.log(`🔄 Manually refreshing attendance from database...`);
    try {
      const attendanceRecords = await localDB.select<Attendance>('attendance', {
        eq: { session_id: sessionId }
      });
      console.log(`✅ Refreshed: Found ${attendanceRecords.length} attendance records`);
      setAttendance([...attendanceRecords]);
      markedStudentsRef.current = new Set(attendanceRecords.map(a => a.student_id));
      setRefreshKey(prev => prev + 1);
      console.log(`✅ Attendance state refreshed. Student IDs:`, attendanceRecords.map(a => a.student_id));
    } catch (error: any) {
      console.error(`❌ Error refreshing attendance:`, error);
    }
  };

  const getMarkedStudents = () => {
    const marked = attendance.map(a => a.student_id);
    return marked;
  };

  const getStudentAttendance = (studentId: string) => {
    const record = attendance.find(a => a.student_id === studentId);
    return record || null;
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#0B6CF9] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#F7F9FC] flex flex-col">
      {/* Header Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft size={18} />
            Back to Sessions
          </Button>
          <div className="h-6 w-px bg-gray-300"></div>
          <div>
            <h1 className="text-xl font-semibold text-[#0F172A]">{session.title}</h1>
            <p className="text-sm text-gray-500">
              {classData && `${classData.branch_name} - ${classData.section_name}`}
              {session.start_at && ` • ${new Date(session.start_at).toLocaleString()}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users size={16} />
            <div className="flex items-center gap-2">
              <span>{attendance.length} / {students.length} Present</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={refreshAttendance}
                className="ml-2"
                title="Refresh attendance"
              >
                🔄
              </Button>
            </div>
          </div>
          {session.status === 'live' && (
            <Badge variant="success" className="flex items-center gap-1">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              Live
            </Badge>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Camera Preview */}
        <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden">
          {cameraActive ? (
            <div className="relative w-full h-full" style={{ position: 'relative' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
                style={{ 
                  minWidth: 0,
                  minHeight: 0,
                  backgroundColor: '#000',
                  display: 'block'
                }}
                onLoadedMetadata={() => {
                  console.log('✅ Video metadata loaded:', {
                    videoWidth: videoRef.current?.videoWidth,
                    videoHeight: videoRef.current?.videoHeight,
                    readyState: videoRef.current?.readyState
                  });
                }}
                onPlay={() => {
                  console.log('▶️ Video is playing');
                }}
                onError={(e) => {
                  console.error('❌ Video error:', e);
                }}
              />
              <canvas
                ref={canvasRef}
                style={{ 
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 10
                }}
              />
              {faceRecognitionActive && (
                <div className="absolute top-4 left-4 bg-blue-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 z-10">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="text-sm">Face Detection Active</span>
                </div>
              )}
              {detectedStudent && (
                <div className="absolute top-4 left-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-10">
                  <CheckCircle size={20} />
                  <div>
                    <p className="font-semibold">{detectedStudent.student.name}</p>
                    <p className="text-xs">{(detectedStudent.confidence * 100).toFixed(1)}% match</p>
                  </div>
                </div>
              )}
              {modelsLoading && (
                <div className="absolute top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-10">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading models...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-white">
              <Camera size={64} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">Camera Preview</p>
              <p className="text-sm text-gray-400 mb-4">Click "Start Camera" to begin face recognition</p>
              <Button 
                onClick={startCamera} 
                className="bg-[#0B6CF9] hover:bg-[#0A5CD7]"
                disabled={modelsLoading}
              >
                <Camera size={18} className="mr-2" />
                {modelsLoading ? 'Loading Models...' : 'Start Camera'}
              </Button>
              {students.filter(s => !s.descriptor && s.photo_url).length > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-yellow-600 mt-0.5" />
                    <p className="text-xs text-yellow-800">
                      {students.filter(s => !s.descriptor && s.photo_url).length} student(s) need face descriptors computed. 
                      This will happen automatically when camera starts.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Camera Controls Overlay */}
          {cameraActive && (
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-3">
              <Button
                variant="secondary"
                onClick={stopCamera}
                className="bg-white/90 hover:bg-white"
              >
                <X size={18} className="mr-2" />
                Stop Camera
              </Button>
            </div>
          )}
        </div>

        {/* Right Side - Student Info */}
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
          {/* Selected Student Info */}
          {selectedStudent ? (
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-lg font-semibold text-[#0F172A]">Student Details</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedStudent(null)}
                >
                  <X size={18} />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {selectedStudent.photo_url ? (
                      <img
                        src={selectedStudent.photo_url}
                        alt={selectedStudent.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={32} className="text-gray-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#0F172A]">{selectedStudent.name}</h3>
                    <p className="text-sm text-gray-500 font-mono">{selectedStudent.usn}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Branch</p>
                    <p className="font-medium">{selectedStudent.branch}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Semester</p>
                    <p className="font-medium">{selectedStudent.semester}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Email</p>
                    <p className="font-medium text-xs">{selectedStudent.email}</p>
                  </div>
                  {selectedStudent.phone && (
                    <div>
                      <p className="text-gray-500">Phone</p>
                      <p className="font-medium">{selectedStudent.phone}</p>
                    </div>
                  )}
                </div>

                {getStudentAttendance(selectedStudent.id) ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <CheckCircle size={20} className="text-[#16A34A]" />
                    <div>
                      <p className="font-medium text-[#16A34A]">Attendance Marked</p>
                      <p className="text-xs text-gray-600">
                        {new Date(getStudentAttendance(selectedStudent.id)!.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => markAttendance(selectedStudent.id, 'manual')}
                    disabled={isMarking}
                    className="w-full bg-[#0B6CF9] hover:bg-[#0A5CD7]"
                  >
                    {isMarking ? 'Marking...' : 'Mark Attendance'}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 border-b border-gray-200 text-center text-gray-500">
              <User size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Select a student to view details</p>
            </div>
          )}

          {/* Students List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-sm text-[#0F172A]">Students ({students.length})</h3>
            </div>
            <div className="divide-y divide-gray-100" key={`students-list-${refreshKey}`}>
              {students.map((student) => {
                const isMarked = getMarkedStudents().includes(student.id);
                const attendanceRecord = getStudentAttendance(student.id);

                return (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedStudent?.id === student.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {student.photo_url ? (
                          <img
                            src={student.photo_url}
                            alt={student.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User size={20} className="text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-[#0F172A] truncate">{student.name}</p>
                        <p className="text-xs text-gray-500 font-mono truncate">{student.usn}</p>
                      </div>
                      {isMarked && (
                        <CheckCircle size={18} className="text-[#16A34A] flex-shrink-0" />
                      )}
                    </div>
                    {attendanceRecord && (
                      <p className="text-xs text-gray-500 mt-1 ml-13">
                        Marked at {new Date(attendanceRecord.timestamp).toLocaleTimeString()}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

