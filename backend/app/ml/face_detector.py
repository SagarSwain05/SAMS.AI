"""
Face Detection Module using OpenCV Haar Cascade and DNN
"""
import cv2
import numpy as np
import os


class FaceDetector:
    """Face detector using OpenCV"""

    def __init__(self, method='haar'):
        """
        Initialize face detector

        Args:
            method (str): Detection method - 'haar' or 'dnn'
        """
        self.method = method

        if method == 'haar':
            # Load Haar Cascade classifier
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            self.face_cascade = cv2.CascadeClassifier(cascade_path)

            if self.face_cascade.empty():
                raise Exception("Failed to load Haar Cascade classifier")

        elif method == 'dnn':
            # Load DNN face detector (more accurate)
            model_file = os.path.join(os.path.dirname(__file__), 'models', 'res10_300x300_ssd_iter_140000.caffemodel')
            config_file = os.path.join(os.path.dirname(__file__), 'models', 'deploy.prototxt')

            # If model files don't exist, fall back to Haar Cascade
            if not os.path.exists(model_file) or not os.path.exists(config_file):
                print("DNN model files not found, falling back to Haar Cascade")
                self.method = 'haar'
                cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
                self.face_cascade = cv2.CascadeClassifier(cascade_path)
            else:
                self.net = cv2.dnn.readNetFromCaffe(config_file, model_file)

    def detect_faces(self, image, min_confidence=0.5):
        """
        Detect faces in an image

        Args:
            image (numpy.ndarray): Input image
            min_confidence (float): Minimum confidence threshold for DNN method

        Returns:
            list: List of face bounding boxes [(x, y, w, h), ...]
        """
        if self.method == 'haar':
            return self._detect_haar(image)
        else:
            return self._detect_dnn(image, min_confidence)

    def _detect_haar(self, image):
        """Detect faces using Haar Cascade"""
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # Detect faces
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30),
            flags=cv2.CASCADE_SCALE_IMAGE
        )

        return [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in faces]

    def _detect_dnn(self, image, min_confidence):
        """Detect faces using DNN"""
        (h, w) = image.shape[:2]

        # Prepare blob for DNN
        blob = cv2.dnn.blobFromImage(
            cv2.resize(image, (300, 300)),
            1.0,
            (300, 300),
            (104.0, 177.0, 123.0)
        )

        # Pass through network
        self.net.setInput(blob)
        detections = self.net.forward()

        faces = []

        # Loop over detections
        for i in range(0, detections.shape[2]):
            confidence = detections[0, 0, i, 2]

            if confidence > min_confidence:
                # Compute bounding box coordinates
                box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                (startX, startY, endX, endY) = box.astype("int")

                # Ensure bounding box is within image bounds
                startX = max(0, startX)
                startY = max(0, startY)
                endX = min(w, endX)
                endY = min(h, endY)

                # Convert to (x, y, w, h) format
                faces.append((startX, startY, endX - startX, endY - startY))

        return faces

    def extract_face_roi(self, image, bbox, padding=0.2):
        """
        Extract face region of interest from image

        Args:
            image (numpy.ndarray): Input image
            bbox (tuple): Bounding box (x, y, w, h)
            padding (float): Padding around face (percentage)

        Returns:
            numpy.ndarray: Face ROI image
        """
        x, y, w, h = bbox

        # Add padding
        pad_w = int(w * padding)
        pad_h = int(h * padding)

        # Calculate padded coordinates
        x1 = max(0, x - pad_w)
        y1 = max(0, y - pad_h)
        x2 = min(image.shape[1], x + w + pad_w)
        y2 = min(image.shape[0], y + h + pad_h)

        # Extract ROI
        face_roi = image[y1:y2, x1:x2]

        return face_roi

    def detect_largest_face(self, image):
        """
        Detect and return the largest face in the image

        Args:
            image (numpy.ndarray): Input image

        Returns:
            tuple: Largest face bounding box (x, y, w, h) or None
        """
        faces = self.detect_faces(image)

        if len(faces) == 0:
            return None

        # Find largest face by area
        largest_face = max(faces, key=lambda bbox: bbox[2] * bbox[3])

        return largest_face

    def draw_faces(self, image, faces, color=(0, 255, 0), thickness=2):
        """
        Draw bounding boxes around detected faces

        Args:
            image (numpy.ndarray): Input image
            faces (list): List of face bounding boxes
            color (tuple): BGR color for boxes
            thickness (int): Line thickness

        Returns:
            numpy.ndarray: Image with drawn boxes
        """
        output = image.copy()

        for (x, y, w, h) in faces:
            cv2.rectangle(output, (x, y), (x + w, y + h), color, thickness)

        return output

    def preprocess_face(self, face_image, target_size=(160, 160)):
        """
        Preprocess face image for recognition

        Args:
            face_image (numpy.ndarray): Face ROI image
            target_size (tuple): Target size (width, height)

        Returns:
            numpy.ndarray: Preprocessed face image
        """
        # Resize to target size
        face_resized = cv2.resize(face_image, target_size)

        # Convert to RGB if needed
        if len(face_resized.shape) == 2:
            face_resized = cv2.cvtColor(face_resized, cv2.COLOR_GRAY2RGB)
        elif face_resized.shape[2] == 4:
            face_resized = cv2.cvtColor(face_resized, cv2.COLOR_BGRA2RGB)
        else:
            face_resized = cv2.cvtColor(face_resized, cv2.COLOR_BGR2RGB)

        # Normalize pixel values
        face_normalized = face_resized.astype('float32') / 255.0

        return face_normalized

    def is_face_quality_good(self, face_image, min_size=80):
        """
        Check if face image quality is good enough for recognition

        Args:
            face_image (numpy.ndarray): Face ROI image
            min_size (int): Minimum face dimension

        Returns:
            tuple: (is_good, reason)
        """
        # Check size
        if face_image.shape[0] < min_size or face_image.shape[1] < min_size:
            return False, f"Face too small (min {min_size}x{min_size})"

        # Check brightness
        gray = cv2.cvtColor(face_image, cv2.COLOR_BGR2GRAY)
        mean_brightness = np.mean(gray)

        if mean_brightness < 50:
            return False, "Image too dark"
        if mean_brightness > 200:
            return False, "Image too bright"

        # Check blur (using Laplacian variance)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()

        if laplacian_var < 100:
            return False, "Image too blurry"

        return True, "Good quality"


# Singleton instance
_detector_instance = None


def get_face_detector(method='haar'):
    """Get or create face detector instance"""
    global _detector_instance

    if _detector_instance is None:
        _detector_instance = FaceDetector(method)

    return _detector_instance
