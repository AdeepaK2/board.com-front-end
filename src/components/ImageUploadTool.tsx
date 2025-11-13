import { useState, useRef, useCallback } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Upload, X, Check, Loader2 } from 'lucide-react';
import './ImageUploadTool.css';

interface ImageUploadToolProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  onUploadSuccess?: () => void;
  onUploadError?: (error: string) => void;
}

const ASPECT_RATIO = 16 / 9;
const MIN_DIMENSION = 150;

/**
 * Convert a cropped image area to a File object
 */
function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop,
  fileName: string
): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('No 2d context'));
      return;
    }

    // Calculate scale factor for high-quality output
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Set canvas dimensions to crop size
    canvas.width = crop.width * scaleX;
    canvas.height = crop.height * scaleY;

    // Draw the cropped image onto canvas
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // Convert canvas to blob, then to File
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }

        // Create File from Blob
        const file = new File([blob], fileName, {
          type: 'image/png',
          lastModified: Date.now(),
        });

        resolve(file);
      },
      'image/png',
      0.95 // Quality (for PNG, this doesn't affect size much, but keeps format consistent)
    );
  });
}

/**
 * Upload image file to backend
 */
async function uploadImage(file: File, roomName: string): Promise<Response> {
  const formData = new FormData();
  formData.append('image', file);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';
  const url = `${API_BASE_URL}/api/boards/uploadImage?room=${encodeURIComponent(roomName)}`;

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Upload failed with status ${response.status}`);
  }

  return response;
}

export const ImageUploadTool = ({
  isOpen,
  onClose,
  roomName,
  onUploadSuccess,
  onUploadError,
}: ImageUploadToolProps) => {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle file selection
   */
  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Image size must be less than 10MB');
        return;
      }

      setError('');
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImgSrc(reader.result?.toString() || '');
      });
      reader.readAsDataURL(file);
    }
  };

  /**
   * Initialize crop when image loads
   */
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImage(img);

    // Create initial centered crop
    const { width, height } = img;
    const cropWidth = Math.min(width * 0.8, height * 0.8 * ASPECT_RATIO);
    const cropHeight = cropWidth / ASPECT_RATIO;

    const initialCrop = centerCrop(
      makeAspectCrop(
        {
          unit: 'px',
          width: cropWidth,
          height: cropHeight,
        },
        ASPECT_RATIO,
        width,
        height
      ),
      width,
      height
    );

    setCrop(initialCrop);
  }, []);

  /**
   * Handle crop completion
   */
  const onCropComplete = useCallback((crop: PixelCrop) => {
    setCompletedCrop(crop);
  }, []);

  /**
   * Handle upload
   */
  const handleUpload = async () => {
    if (!image || !completedCrop) {
      setError('Please select and crop an image');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      // Generate filename with timestamp
      const timestamp = Date.now();
      const fileName = `image-${timestamp}.png`;

      // Get cropped image as File
      const croppedFile = await getCroppedImg(image, completedCrop, fileName);

      // Upload to backend
      await uploadImage(croppedFile, roomName);

      // Success callback
      if (onUploadSuccess) {
        onUploadSuccess();
      }

      // Reset and close
      handleReset();
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      if (onUploadError) {
        onUploadError(errorMessage);
      }
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Reset component state
   */
  const handleReset = () => {
    setImgSrc('');
    setImage(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Handle close
   */
  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="image-upload-overlay">
      <div className="image-upload-modal">
        <div className="image-upload-header">
          <h2>Upload Image</h2>
          <button className="close-btn" onClick={handleClose} disabled={isUploading}>
            <X size={20} />
          </button>
        </div>

        <div className="image-upload-content">
          {!imgSrc ? (
            <div className="image-upload-placeholder">
              <Upload size={48} className="upload-icon" />
              <p>Select an image to upload</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onSelectFile}
                className="file-input"
                disabled={isUploading}
              />
              <button
                className="btn-select-file"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                Choose File
              </button>
            </div>
          ) : (
            <div className="image-crop-container">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={onCropComplete}
                aspect={ASPECT_RATIO}
                minWidth={MIN_DIMENSION}
                minHeight={MIN_DIMENSION / ASPECT_RATIO}
              >
                <img
                  ref={imgRef}
                  alt="Crop"
                  src={imgSrc}
                  style={{ maxWidth: '100%', maxHeight: '70vh' }}
                  onLoad={onImageLoad}
                />
              </ReactCrop>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="image-upload-footer">
          <button className="btn-cancel" onClick={handleClose} disabled={isUploading}>
            Cancel
          </button>
          {imgSrc && (
            <button
              className="btn-upload"
              onClick={handleUpload}
              disabled={!completedCrop || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 size={18} className="spinner" />
                  Uploading...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Upload Image
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

