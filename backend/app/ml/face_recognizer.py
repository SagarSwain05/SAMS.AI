"""
Face Recognition Module using OpenCV LBPH Face Recognizer
"""
import cv2
import numpy as np
import os
import pickle
import json
from datetime import datetime


class FaceRecognizer:
    """Face recognizer using OpenCV LBPH algorithm"""

    def __init__(self, model_path='models/face_recognizer.yml', labels_path='models/face_labels.pkl'):
        """
        Initialize face recognizer

        Args:
            model_path (str): Path to save/load the trained model
            labels_path (str): Path to save/load the label mappings
        """
        self.model_path = os.path.join(os.path.dirname(__file__), model_path)
        self.labels_path = os.path.join(os.path.dirname(__file__), labels_path)

        # Create LBPH face recognizer (try new class API, fallback to legacy function API)
        try:
            if hasattr(cv2.face, 'LBPHFaceRecognizer_create'):
                self.recognizer = cv2.face.LBPHFaceRecognizer_create(radius=1, neighbors=8, grid_x=8, grid_y=8)
            elif hasattr(cv2.face, 'LBPHFaceRecognizer'):
                self.recognizer = cv2.face.LBPHFaceRecognizer.create(radius=1, neighbors=8, grid_x=8, grid_y=8)
            else:
                raise AttributeError("LBPH not available in this OpenCV build")
        except Exception as e:
            print(f"[FaceRecognizer] WARNING: LBPH unavailable ({e}). Using V2 InsightFace pipeline instead.")
            self.recognizer = None

        # Label mappings
        self.label_to_student = {}  # {label_id: student_id}
        self.student_to_label = {}  # {student_id: label_id}
        self.next_label_id = 0

        # Load existing model if available
        self.load_model()

    def train(self, faces_dict):
        """
        Train the face recognizer with multiple face images per person

        Args:
            faces_dict (dict): Dictionary {student_id: [face_images]}
                              where face_images are preprocessed grayscale face images

        Returns:
            dict: Training statistics
        """
        if not faces_dict:
            raise ValueError("No training data provided")

        faces = []
        labels = []

        # Prepare training data
        for student_id, face_images in faces_dict.items():
            # Get or create label ID for this student
            if student_id not in self.student_to_label:
                label_id = self.next_label_id
                self.student_to_label[student_id] = label_id
                self.label_to_student[label_id] = student_id
                self.next_label_id += 1
            else:
                label_id = self.student_to_label[student_id]

            # Add all face images with their label
            for face_image in face_images:
                # Convert to grayscale if needed
                if len(face_image.shape) == 3:
                    face_gray = cv2.cvtColor(face_image, cv2.COLOR_BGR2GRAY)
                else:
                    face_gray = face_image

                # Resize to standard size
                face_resized = cv2.resize(face_gray, (160, 160))

                faces.append(face_resized)
                labels.append(label_id)

        # Train the recognizer
        self.recognizer.train(faces, np.array(labels))

        # Save the model
        self.save_model()

        stats = {
            'total_students': len(faces_dict),
            'total_images': len(faces),
            'images_per_student': {
                sid: len(imgs) for sid, imgs in faces_dict.items()
            },
            'trained_at': datetime.now().isoformat()
        }

        return stats

    def update_model(self, student_id, face_images):
        """
        Update the model with new face images for a student

        Args:
            student_id (int): Student ID
            face_images (list): List of face images to add

        Returns:
            bool: Success status
        """
        if not face_images:
            return False

        # Get or create label for student
        if student_id not in self.student_to_label:
            label_id = self.next_label_id
            self.student_to_label[student_id] = label_id
            self.label_to_student[label_id] = student_id
            self.next_label_id += 1
        else:
            label_id = self.student_to_label[student_id]

        faces = []
        labels = []

        for face_image in face_images:
            # Convert to grayscale if needed
            if len(face_image.shape) == 3:
                face_gray = cv2.cvtColor(face_image, cv2.COLOR_BGR2GRAY)
            else:
                face_gray = face_image

            # Resize to standard size
            face_resized = cv2.resize(face_gray, (160, 160))

            faces.append(face_resized)
            labels.append(label_id)

        # Update the recognizer
        self.recognizer.update(faces, np.array(labels))

        # Save the updated model
        self.save_model()

        return True

    def recognize(self, face_image, confidence_threshold=100):
        """
        Recognize a face in the image

        Args:
            face_image (numpy.ndarray): Face image to recognize
            confidence_threshold (int): Maximum confidence value (lower is better)
                                       Typical values: 50-150

        Returns:
            tuple: (student_id, confidence) or (None, None) if not recognized
                  Lower confidence means better match
        """
        # Convert to grayscale if needed
        if len(face_image.shape) == 3:
            face_gray = cv2.cvtColor(face_image, cv2.COLOR_BGR2GRAY)
        else:
            face_gray = face_image

        # Resize to standard size
        face_resized = cv2.resize(face_gray, (160, 160))

        # Predict
        label_id, confidence = self.recognizer.predict(face_resized)

        # Check if confidence is within threshold
        if confidence > confidence_threshold:
            return None, confidence

        # Get student ID from label
        student_id = self.label_to_student.get(label_id)

        return student_id, confidence

    def recognize_with_details(self, face_image, confidence_threshold=100):
        """
        Recognize a face with detailed results

        Args:
            face_image (numpy.ndarray): Face image to recognize
            confidence_threshold (int): Maximum confidence value

        Returns:
            dict: Recognition results with details
        """
        student_id, confidence = self.recognize(face_image, confidence_threshold)

        # Calculate normalized confidence (0-1 scale, higher is better)
        # Convert LBPH confidence (lower is better) to percentage (higher is better)
        if confidence is not None:
            # Confidence typically ranges from 0-200
            # Convert to 0-100% where lower confidence = higher match
            confidence_percentage = max(0, min(100, 100 - (confidence / 2)))
        else:
            confidence_percentage = 0

        result = {
            'recognized': student_id is not None,
            'student_id': student_id,
            'confidence': confidence,
            'confidence_percentage': round(confidence_percentage, 2),
            'threshold': confidence_threshold,
            'timestamp': datetime.now().isoformat()
        }

        return result

    def get_embeddings(self, face_image):
        """
        Get face embeddings/features for storage

        Args:
            face_image (numpy.ndarray): Face image

        Returns:
            numpy.ndarray: Face embedding vector
        """
        # Convert to grayscale if needed
        if len(face_image.shape) == 3:
            face_gray = cv2.cvtColor(face_image, cv2.COLOR_BGR2GRAY)
        else:
            face_gray = face_image

        # Resize to standard size
        face_resized = cv2.resize(face_gray, (160, 160))

        # For LBPH, we can use the resized image as embedding
        # Flatten to 1D array
        embedding = face_resized.flatten()

        return embedding

    def save_model(self):
        """Save the trained model and label mappings"""
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)

        # Save the recognizer model
        self.recognizer.write(self.model_path)

        # Save label mappings
        mappings = {
            'label_to_student': self.label_to_student,
            'student_to_label': self.student_to_label,
            'next_label_id': self.next_label_id
        }

        with open(self.labels_path, 'wb') as f:
            pickle.dump(mappings, f)

    def load_model(self):
        """Load the trained model and label mappings"""
        try:
            if os.path.exists(self.model_path):
                self.recognizer.read(self.model_path)

            if os.path.exists(self.labels_path):
                with open(self.labels_path, 'rb') as f:
                    mappings = pickle.load(f)
                    self.label_to_student = mappings['label_to_student']
                    self.student_to_label = mappings['student_to_label']
                    self.next_label_id = mappings['next_label_id']

                return True

        except Exception as e:
            print(f"Failed to load model: {e}")

        return False

    def delete_student(self, student_id):
        """
        Remove a student from the recognizer

        Args:
            student_id (int): Student ID to remove

        Note: This requires retraining the model without this student
        """
        if student_id in self.student_to_label:
            label_id = self.student_to_label[student_id]
            del self.student_to_label[student_id]
            del self.label_to_student[label_id]
            self.save_model()
            return True
        return False

    def get_model_info(self):
        """
        Get information about the trained model

        Returns:
            dict: Model information
        """
        info = {
            'students_count': len(self.student_to_label),
            'student_ids': list(self.student_to_label.keys()),
            'model_exists': os.path.exists(self.model_path),
            'model_path': self.model_path,
            'labels_path': self.labels_path
        }

        return info


# Singleton instance
_recognizer_instance = None


def get_face_recognizer():
    """Get or create face recognizer instance"""
    global _recognizer_instance

    if _recognizer_instance is None:
        _recognizer_instance = FaceRecognizer()

    return _recognizer_instance
