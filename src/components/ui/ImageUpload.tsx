import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, Camera, X, Image as ImageIcon, RotateCw, Trash2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface ImageUploadProps {
  value?: string;
  onChange?: (url: string | null) => void;
  className?: string;
  label?: string;
  bucketName?: string;
  folder?: string;
  maxSize?: number;
}

function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
}

function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext || isLocalhost();
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function getCameraErrorMessage(error: any): string {
  console.log('Camera error details:', error);
  
  if (!isSecureContext()) {
    return "L'accès à la caméra nécessite HTTPS ou localhost. Utilisez http://localhost:3000.";
  }
  
  if (!navigator.mediaDevices) {
    return "Votre navigateur ne supporte pas l'accès à la caméra.";
  }
  
  if (error.name === 'NotAllowedError') {
    return "Permission refusée. Cliquez sur l'icône 🔒 dans la barre d'adresse pour autoriser la caméra.";
  }
  
  if (error.name === 'NotFoundError') {
    return "Aucune caméra détectée sur cet appareil.";
  }
  
  if (error.name === 'NotReadableError') {
    return "La caméra est déjà utilisée par une autre application.";
  }
  
  if (error.name === 'OverconstrainedError') {
    return "Les contraintes de la caméra ne sont pas supportées. Essayez une caméra différente.";
  }
  
  if (error.name === 'AbortError') {
    return "La demande d'accès à la caméra a été annulée.";
  }
  
  if (error.name === 'TypeError') {
    return "Erreur de configuration de la caméra. Vérifiez vos permissions.";
  }
  
  return error.message || "Impossible d'accéder à la caméra.";
}

export function ImageUpload({
  value,
  onChange,
  className,
  label = 'Image du produit',
  bucketName = 'product-images',
  folder = '',
  maxSize = 5 * 1024 * 1024,
}: ImageUploadProps) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(value || null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  useEffect(() => {
    setPreview(value || null);
  }, [value]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const uploadToSupabase = async (file: File | Blob, fileName: string): Promise<string> => {
    if (!user?.id) {
      throw new Error('Utilisateur non connecté');
    }

    try {
      const filePath = folder 
        ? `${folder}/${user.id}/${fileName}`
        : `${user.id}/${fileName}`;

      const { data, error } = await supabase
        .storage
        .from(bucketName)
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type || 'image/jpeg',
        });

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      const { data: { publicUrl } } = supabase
        .storage
        .from(bucketName)
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      console.log('Supabase upload failed, using base64');
      throw error;
    }
  };

  const convertToBase64 = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    if (file.size > maxSize) {
      toast.error(`L'image est trop volumineuse (max ${(maxSize / 1024 / 1024).toFixed(0)}MB)`);
      return;
    }

    setIsUploading(true);
    setCameraError(null);
    
    try {
      const localPreview = URL.createObjectURL(file);
      setPreview(localPreview);

      try {
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${file.name.split('.').pop() || 'jpg'}`;
        const url = await uploadToSupabase(file, fileName);
        setPreview(url);
        onChange?.(url);
        toast.success('Image téléchargée avec succès');
      } catch (supabaseError: any) {
        console.warn('Supabase upload failed, using base64 fallback:', supabaseError?.message);
        const base64Url = await convertToBase64(file);
        setPreview(base64Url);
        onChange?.(base64Url);
        toast.success('Image ajoutée (mode hors connexion)');
      }
    } catch (error: any) {
      console.error('File handling error:', error);
      toast.error(error.message || 'Erreur lors du traitement de l\'image');
      setPreview(null);
    } finally {
      setIsUploading(false);
    }
  }, [maxSize, onChange, user, folder, bucketName]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const checkCameraAvailability = (): { available: boolean; message?: string } => {
    if (isMobile) {
      return { available: true };
    }
    
    if (typeof navigator === 'undefined') {
      return { available: false, message: 'Environnement non supporté' };
    }
    
    if (!navigator.mediaDevices) {
      return { available: false, message: 'Votre navigateur ne supporte pas l\'accès à la caméra' };
    }
    
    if (!navigator.mediaDevices.getUserMedia) {
      return { available: false, message: 'getUserMedia non supporté' };
    }
    
    if (!isSecureContext()) {
      return { 
        available: false, 
        message: 'Utilisez http://localhost:3000 au lieu de l\'adresse IP' 
      };
    }
    
    return { available: true };
  };

  const handleNativeCameraCapture = () => {
    if (nativeCameraInputRef.current) {
      nativeCameraInputRef.current.click();
    }
  };

  const handleNativeCameraInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    
    if (nativeCameraInputRef.current) {
      nativeCameraInputRef.current.value = '';
    }
  };

  const startCamera = async () => {
    if (isMobile) {
      handleNativeCameraCapture();
      return;
    }

    setCameraError(null);
    
    const availability = checkCameraAvailability();
    if (!availability.available) {
      console.log('Camera not available:', availability.message);
      setCameraError(availability.message || 'Caméra non disponible');
      toast.error(availability.message || 'Caméra non disponible');
      return;
    }

    console.log('=== Attempting to access camera (desktop mode ===');
    console.log('isSecureContext:', isSecureContext());
    console.log('isLocalhost:', isLocalhost());
    console.log('URL:', window.location.href);

    const videoConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user',
    };

    try {
      console.log('Requesting camera access...');
      console.log('Constraints:', videoConstraints);
      
      let stream: MediaStream | null = null;
      
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
        console.log('Camera access granted with preferred constraints!');
      } catch (preferredError: any) {
        console.log('Preferred constraints failed:', preferredError.name, preferredError.message);
        console.log('Trying with simple constraints...');
        
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          console.log('Camera access granted with simple constraints!');
        } catch (simpleError: any) {
          console.log('Simple constraints failed:', simpleError.name, simpleError.message);
          throw simpleError;
        }
      }
      
      if (!stream) {
        throw new Error('Impossible d\'obtenir le flux vidéo');
      }
      
      streamRef.current = stream;
      setIsCameraActive(true);
      setCameraError(null);
      
      if (videoRef.current) {
        const video = videoRef.current;
        
        video.muted = true;
        video.playsInline = true;
        video.autoPlay = true;
        
        const startPlayback = () => {
          video.play()
            .then(() => console.log('Video playback started successfully'))
            .catch(playError => {
              console.error('Video play error:', playError);
            });
        };
        
        video.onloadedmetadata = () => {
          console.log('Video metadata loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
          startPlayback();
        };
        
        video.onerror = (e) => {
          console.error('Video element error:', e);
        };
        
        video.srcObject = stream;
        
        setTimeout(() => {
          if (video && video.readyState < 1) {
            console.log('Metadata not loaded after timeout, trying direct play...');
            startPlayback();
          }
        }, 1000);
      }
     } catch (error: any) {
      console.error('=== CAMERA ERROR ===');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Full error:', error);
      
      const userMessage = getCameraErrorMessage(error);
      setCameraError(userMessage);
      toast.error(userMessage, { duration: 6000 });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log('Stopping track:', track.kind);
        track.stop();
      });
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error('Erreur lors de la capture');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast.error('Erreur lors de la capture');
      return;
    }

    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob(
      (blob) => {
        if (blob) {
          console.log('Photo captured, size:', blob.size, 'bytes');
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
          handleFile(file);
          stopCamera();
        } else {
          toast.error('Erreur lors de la création de l\'image');
        }
      },
      'image/jpeg',
      0.9
    );
  };

  const removeImage = () => {
    setPreview(null);
    setCameraError(null);
    onChange?.(null);
    stopCamera();
  };

  const isCameraSupported = checkCameraAvailability().available;

  return (
    <div className={cn("space-y-4", className)}>
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}

      <canvas ref={canvasRef} className="hidden" />
      
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleNativeCameraInputChange}
        disabled={isUploading}
      />

      {!isMobile && !isCameraSupported && !isCameraActive && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>
            {isLocalhost() 
              ? "Vérifiez que votre appareil possède une caméra."
              : `Utilisez http://localhost:3000 (actuellement: ${window.location.hostname})`}
          </span>
        </div>
      )}

      {cameraError && !isCameraActive && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Accès à la caméra impossible</p>
            <p className="text-xs mt-1 opacity-80">{cameraError}</p>
            <p className="text-xs mt-1">
              Utilisez le bouton <strong>"Importer une image"</strong> à la place.
            </p>
          </div>
        </div>
      )}

      {isCameraActive ? (
        <div className="relative rounded-[6px] overflow-hidden border-2 border-emerald-500 bg-black">
          <video
            ref={videoRef}
            className="w-full aspect-video object-cover min-h-[240px]"
            autoPlay
            playsInline
            muted
          />
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-4 border-2 border-white/30 rounded-lg" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-white/20 rounded-full" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
            <div className="flex justify-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={stopCamera}
                className="bg-white/90 hover:bg-white text-slate-800"
              >
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>
              <Button
                type="button"
                onClick={capturePhoto}
                className="bg-primary hover:bg-primary/90 min-w-[120px]"
              >
                <Camera className="h-5 w-5 mr-2" />
                Capturer
              </Button>
            </div>
          </div>
        </div>
      ) : preview ? (
        <div className="relative rounded-[6px] overflow-hidden border-2 border-slate-200 bg-slate-50/50">
          <img
            src={preview}
            alt="Preview"
            className="w-full max-h-64 object-contain"
            onError={(e) => {
              console.error('Image preview error');
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="absolute top-3 right-3 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="bg-white/90 hover:bg-white h-9 w-9 shadow-none border border-slate-200"
              disabled={isUploading}
            >
              {isUploading ? (
                <RotateCw className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={removeImage}
              className="bg-white/90 hover:bg-white text-rose-600 h-9 w-9 shadow-none border border-slate-200"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "relative border-2 border-dashed rounded-[6px] p-8 text-center transition-all cursor-pointer",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.jpg,.jpeg,.png,.gif,.webp"
            className="hidden"
            onChange={handleFileInputChange}
            disabled={isUploading}
          />
          
          <div className="flex flex-col items-center space-y-4">
            <div className={cn(
              "p-4 rounded-full",
              isDragging ? "bg-primary/10" : "bg-muted"
            )}>
              <ImageIcon className={cn(
                "h-8 w-8",
                isDragging ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {isDragging ? "Déposez l'image ici" : "Ajouter une image"}
              </p>
              <p className="text-xs text-muted-foreground">
                Glissez-déposez, ou cliquez pour sélectionner
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                JPG, PNG, WebP - Max 5MB
              </p>
            </div>
          </div>
        </div>
      )}

      {!isCameraActive && (
        <div className="flex gap-2">
          {!preview && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                Importer une image
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "flex-1",
                  !isCameraSupported && "opacity-50"
                )}
                onClick={startCamera}
                disabled={isUploading}
              >
                <Camera className="h-4 w-4 mr-2" />
                Prendre une photo
              </Button>
            </>
          )}
          {preview && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                !isCameraSupported && "opacity-50"
              )}
              onClick={startCamera}
              disabled={isUploading}
            >
              <Camera className="h-4 w-4 mr-2" />
              Remplacer par une photo
            </Button>
          )}
        </div>
      )}

      {!isCameraActive && !isMobile && (
        <p className="text-[10px] text-muted-foreground/60 text-center">
          💡 Si la caméra ne fonctionne pas, vérifiez :
          1) Êtes-vous sur <span className="font-mono bg-slate-100 px-1 rounded">localhost:3000</span> ?
          2) La permission caméra est-elle autorisée dans le navigateur ?
        </p>
      )}
    </div>
  );
}
