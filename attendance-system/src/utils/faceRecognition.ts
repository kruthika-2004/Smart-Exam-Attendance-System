import * as faceapi from 'face-api.js';

let modelsLoaded = false;
let recognitionModelAvailable = false;
let loadingPromise: Promise<void> | null = null;

export async function loadFaceApiModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const MODEL_URL = '/models';
      // Add cache busting to ensure fresh model load
      const cacheBuster = `?v=${Date.now()}`;
      
      console.log('Loading face-api.js models from:', MODEL_URL);
      
      // Load models one by one with better error handling
      console.log('Loading tinyFaceDetector...');
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      console.log('✓ tinyFaceDetector loaded');
      
      console.log('Loading faceLandmark68Net...');
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      console.log('✓ faceLandmark68Net loaded');
      
      console.log('Loading faceRecognitionNet...');
      // Try loading with error handling for this specific model
      // Since local file is corrupted, try CDN first, then local as fallback
      try {
        // Try loading from CDN first (more reliable)
        console.log('Trying to load from CDN...');
        await faceapi.nets.faceRecognitionNet.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights');
        console.log('✓ faceRecognitionNet loaded from CDN');
        recognitionModelAvailable = true;
      } catch (cdnError: any) {
        console.warn('CDN load failed, trying local file...', cdnError.message);
        try {
          // Fallback to local file
          await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
          console.log('✓ faceRecognitionNet loaded from local');
          recognitionModelAvailable = true;
        } catch (localError: any) {
          console.error('❌ Error loading faceRecognitionNet from local:', localError.message);
          console.warn('⚠️ Face recognition model unavailable. Face detection will work but recognition is disabled.');
          recognitionModelAvailable = false;
        }
      }

      modelsLoaded = true;
      if (recognitionModelAvailable) {
        console.log('✅ All face-api.js models loaded successfully');
      } else {
        console.log('✅ Face detection models loaded (recognition unavailable)');
      }
    } catch (error: any) {
      console.error('❌ Error loading face-api.js models:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      modelsLoaded = false;
      recognitionModelAvailable = false;
      // Only throw if even basic detection fails
      if (error.message.includes('tinyFaceDetector') || error.message.includes('faceLandmark')) {
        throw new Error(`Failed to load face detection models: ${error.message}. Please ensure models are in /public/models folder.`);
      }
      // If only recognition fails, don't throw - detection can still work
      console.warn('Recognition model unavailable, but detection should still work');
    }
  })();

  return loadingPromise;
}

export async function computeFaceDescriptor(imageUrl: string): Promise<Float32Array | null> {
  try {
    console.log('🔄 Computing face descriptor...');
    
    // Check if recognition model is available before attempting
    if (!modelsLoaded) {
      console.log('Models not loaded, loading now...');
      try {
        await loadFaceApiModels();
      } catch (error: any) {
        console.error('Failed to load models:', error);
        // If models fail to load completely, return null
        return null;
      }
    }

    // If recognition model is not available, try to load it again
    if (!recognitionModelAvailable) {
      console.warn('Recognition model not available, attempting to load from CDN...');
      try {
        // Try CDN first
        await faceapi.nets.faceRecognitionNet.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights');
        recognitionModelAvailable = true;
        console.log('✅ Recognition model loaded from CDN');
      } catch (cdnError: any) {
        console.warn('CDN failed, trying local...', cdnError.message);
        try {
          await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
          recognitionModelAvailable = true;
          console.log('✅ Recognition model loaded from local');
        } catch (error: any) {
          console.error('❌ Recognition model still unavailable:', error.message);
          return null;
        }
      }
    }

    console.log('Loading image for descriptor computation...');
    const img = await faceapi.fetchImage(imageUrl);
    console.log('Image loaded, detecting face...');
    
    // Try to detect with descriptor
    try {
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection && detection.descriptor) {
        console.log('✅ Descriptor computed successfully');
        return detection.descriptor;
      } else {
        console.warn('No face detected in image');
        return null;
      }
    } catch (descriptorError: any) {
      console.error('Could not compute descriptor:', descriptorError.message);
      console.error('Error stack:', descriptorError.stack);
      return null;
    }
  } catch (error: any) {
    console.error('Error computing face descriptor:', error);
    console.error('Error stack:', error.stack);
    return null;
  }
}

export async function detectFacesInVideo(video: HTMLVideoElement): Promise<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<faceapi.WithFaceDetection<{}>>>[] | null> {
  try {
    if (!modelsLoaded) {
      try {
        await loadFaceApiModels();
      } catch (error) {
        console.warn('Models failed to load, trying face detection without recognition...');
        // Try to load just detection models
        try {
          await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
          await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
          modelsLoaded = true; // Set flag so we don't try to load again
          console.log('Basic detection models loaded (recognition unavailable)');
        } catch (detectionError) {
          console.error('Even basic detection models failed:', detectionError);
          return null;
        }
      }
    }

    // Check if video is ready
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn('Video not ready for face detection');
      return null;
    }

    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 512, // Increased for better detection
      scoreThreshold: 0.2 // Lower threshold for better detection
    });
    
    console.log('🔍 Starting face detection with options:', { inputSize: options.inputSize, scoreThreshold: options.scoreThreshold });

    // Try detection with landmarks, but handle if recognition model is missing
    let detections;
    try {
      if (recognitionModelAvailable) {
        detections = await faceapi
          .detectAllFaces(video, options)
          .withFaceLandmarks()
          .withFaceDescriptors();
      } else {
        // Recognition model not available, just detect faces and landmarks
        detections = await faceapi
          .detectAllFaces(video, options)
          .withFaceLandmarks();
        
        // Add empty descriptors to maintain type compatibility
        detections = detections.map((det: any) => ({
          ...det,
          descriptor: null
        }));
      }
    } catch (error: any) {
      // If recognition model fails, try without descriptors
      console.warn('Recognition model unavailable, detecting faces without descriptors');
      try {
        detections = await faceapi
          .detectAllFaces(video, options)
          .withFaceLandmarks();
        
        // Add empty descriptors to maintain type compatibility
        detections = detections.map((det: any) => ({
          ...det,
          descriptor: null
        }));
      } catch (detectionError: any) {
        console.error('Face detection failed:', detectionError);
        return null;
      }
    }

    if (detections && detections.length > 0) {
      console.log(`✅ Detected ${detections.length} face(s)`);
      detections.forEach((det, idx) => {
        console.log(`  Face ${idx + 1}:`, {
          score: det.detection.score,
          box: det.detection.box,
          hasDescriptor: !!det.descriptor
        });
      });
    } else {
      console.log('⚠️ No faces detected in this frame');
    }
    return detections as any;
  } catch (error: any) {
    console.error('Error detecting faces in video:', error);
    console.error('Error details:', error.message);
    return null;
  }
}

export function compareDescriptors(
  descriptor1: Float32Array | number[],
  descriptor2: Float32Array | number[]
): number {
  // Convert to Float32Array if needed
  const d1 = descriptor1 instanceof Float32Array ? descriptor1 : new Float32Array(descriptor1);
  const d2 = descriptor2 instanceof Float32Array ? descriptor2 : new Float32Array(descriptor2);

  // Calculate Euclidean distance
  let distance = 0;
  for (let i = 0; i < d1.length; i++) {
    const diff = d1[i] - d2[i];
    distance += diff * diff;
  }
  distance = Math.sqrt(distance);

  // face-api.js uses distance threshold of 0.6 for recognition
  // Lower distance = better match
  // Convert distance to similarity (0-1, where 1 is most similar)
  // Using a better formula: similarity decreases as distance increases
  // At distance 0.0: similarity = 1.0 (perfect match)
  // At distance 0.6: similarity = ~0.5 (threshold)
  // At distance 1.2: similarity = ~0.33 (poor match)
  const threshold = 0.6; // face-api.js default threshold
  const similarity = Math.max(0, 1 - (distance / (threshold * 2)));
  
  return similarity;
}

export function findBestMatch(
  detectedDescriptor: Float32Array,
  studentDescriptors: Array<{ studentId: string; descriptor: Float32Array | number[] }>,
  threshold: number = 0.6
): { studentId: string; confidence: number } | null {
  let bestMatch: { studentId: string; confidence: number } | null = null;
  let bestConfidence = threshold;

  for (const { studentId, descriptor } of studentDescriptors) {
    const confidence = compareDescriptors(detectedDescriptor, descriptor);
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestMatch = { studentId, confidence };
    }
  }

  return bestMatch;
}

