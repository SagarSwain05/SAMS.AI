"""
Model Trainer for Face Recognition
Handles training and updating the face recognition model
"""
import cv2
import os
import numpy as np
from datetime import datetime
from pathlib import Path


class ModelTrainer:
    """Trainer for face recognition model"""

    def __init__(self, dataset_path='dataset', face_detector=None, face_recognizer=None):
        """
        Initialize model trainer

        Args:
            dataset_path (str): Path to dataset directory
            face_detector: FaceDetector instance
            face_recognizer: FaceRecognizer instance
        """
        self.dataset_path = Path(dataset_path)
        self.face_detector = face_detector
        self.face_recognizer = face_recognizer

        # Create dataset directory if it doesn't exist
        self.dataset_path.mkdir(parents=True, exist_ok=True)

    def save_face_images(self, student_id, images, num_images=50):
        """
        Save face images for a student

        Args:
            student_id (int): Student ID
            images (list): List of face images (numpy arrays)
            num_images (int): Number of images to save

        Returns:
            tuple: (success_count, saved_paths)
        """
        student_dir = self.dataset_path / f"student_{student_id}"
        student_dir.mkdir(exist_ok=True)

        saved_paths = []
        success_count = 0

        for idx, image in enumerate(images[:num_images]):
            try:
                # Generate filename with timestamp
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"face_{idx+1}_{timestamp}.jpg"
                filepath = student_dir / filename

                # Save image
                cv2.imwrite(str(filepath), image)
                saved_paths.append(str(filepath))
                success_count += 1

            except Exception as e:
                print(f"Failed to save image {idx}: {e}")

        return success_count, saved_paths

    def load_face_images(self, student_id):
        """
        Load face images for a student

        Args:
            student_id (int): Student ID

        Returns:
            list: List of face images
        """
        student_dir = self.dataset_path / f"student_{student_id}"

        if not student_dir.exists():
            return []

        images = []

        for image_path in student_dir.glob("*.jpg"):
            try:
                image = cv2.imread(str(image_path))
                if image is not None:
                    images.append(image)
            except Exception as e:
                print(f"Failed to load image {image_path}: {e}")

        return images

    def load_all_student_faces(self):
        """
        Load face images for all students

        Returns:
            dict: Dictionary {student_id: [face_images]}
        """
        faces_dict = {}

        # Iterate through all student directories
        for student_dir in self.dataset_path.glob("student_*"):
            try:
                # Extract student ID from directory name
                student_id = int(student_dir.name.split("_")[1])

                # Load images for this student
                images = []

                for image_path in student_dir.glob("*.jpg"):
                    image = cv2.imread(str(image_path))
                    if image is not None:
                        images.append(image)

                if images:
                    faces_dict[student_id] = images

            except Exception as e:
                print(f"Failed to process directory {student_dir}: {e}")

        return faces_dict

    def preprocess_faces_for_training(self, faces_dict):
        """
        Preprocess face images for training

        Args:
            faces_dict (dict): Dictionary {student_id: [face_images]}

        Returns:
            dict: Dictionary {student_id: [processed_faces]}
        """
        if self.face_detector is None:
            raise ValueError("Face detector not initialized")

        processed_dict = {}

        for student_id, images in faces_dict.items():
            processed_faces = []

            for image in images:
                # Detect face in image
                faces = self.face_detector.detect_faces(image)

                if len(faces) == 0:
                    print(f"No face detected in image for student {student_id}")
                    continue

                # Use the largest face
                largest_face = max(faces, key=lambda bbox: bbox[2] * bbox[3])

                # Extract face ROI
                face_roi = self.face_detector.extract_face_roi(image, largest_face)

                # Check quality
                is_good, reason = self.face_detector.is_face_quality_good(face_roi)

                if not is_good:
                    print(f"Poor quality face for student {student_id}: {reason}")
                    continue

                # Preprocess face
                face_processed = self.face_detector.preprocess_face(face_roi)

                # Convert back to uint8 for LBPH recognizer
                face_uint8 = (face_processed * 255).astype(np.uint8)

                processed_faces.append(face_uint8)

            if processed_faces:
                processed_dict[student_id] = processed_faces

        return processed_dict

    def train_model(self):
        """
        Train the face recognition model with all available data

        Returns:
            dict: Training statistics
        """
        if self.face_recognizer is None:
            raise ValueError("Face recognizer not initialized")

        # Load all face images
        print("Loading face images...")
        faces_dict = self.load_all_student_faces()

        if not faces_dict:
            raise ValueError(
                "No training data found for LBPH model. "
                "This system uses InsightFace ArcFace for recognition — "
                "use POST /api/v2/recognition/enroll to enroll student faces, "
                "or POST /api/v2/recognition/embeddings/refresh to reload embeddings."
            )

        print(f"Loaded images for {len(faces_dict)} students")

        # Preprocess faces
        print("Preprocessing faces...")
        processed_dict = self.preprocess_faces_for_training(faces_dict)

        if not processed_dict:
            raise ValueError("No valid faces found after preprocessing")

        print(f"Preprocessing complete: {len(processed_dict)} students with valid faces")

        # Train the model
        print("Training model...")
        stats = self.face_recognizer.train(processed_dict)

        print("Training complete!")

        return stats

    def add_student_to_model(self, student_id, images):
        """
        Add a new student to the existing model

        Args:
            student_id (int): Student ID
            images (list): List of face images

        Returns:
            dict: Update statistics
        """
        if self.face_recognizer is None:
            raise ValueError("Face recognizer not initialized")

        # Save images to dataset
        success_count, saved_paths = self.save_face_images(student_id, images)

        # Preprocess faces
        processed_dict = self.preprocess_faces_for_training({student_id: images})

        if not processed_dict or student_id not in processed_dict:
            raise ValueError("No valid faces found for student")

        # Update the model
        success = self.face_recognizer.update_model(student_id, processed_dict[student_id])

        stats = {
            'student_id': student_id,
            'images_saved': success_count,
            'images_processed': len(processed_dict[student_id]),
            'saved_paths': saved_paths,
            'model_updated': success,
            'timestamp': datetime.now().isoformat()
        }

        return stats

    def capture_faces_from_camera(self, num_images=50, delay_ms=100):
        """
        Capture face images from camera

        Args:
            num_images (int): Number of images to capture
            delay_ms (int): Delay between captures in milliseconds

        Returns:
            list: List of captured face images
        """
        from .camera import get_camera_stream

        camera = get_camera_stream()
        camera.start()
        camera.enable_detection(True)

        captured_faces = []
        attempts = 0
        max_attempts = num_images * 5  # Allow some failed attempts

        print(f"Capturing {num_images} face images...")

        while len(captured_faces) < num_images and attempts < max_attempts:
            frame = camera.camera.get_frame()

            if frame is None:
                attempts += 1
                continue

            # Detect faces
            faces = self.face_detector.detect_faces(frame)

            if len(faces) > 0:
                # Use the largest face
                largest_face = max(faces, key=lambda bbox: bbox[2] * bbox[3])

                # Extract face ROI
                face_roi = self.face_detector.extract_face_roi(frame, largest_face)

                # Check quality
                is_good, reason = self.face_detector.is_face_quality_good(face_roi)

                if is_good:
                    captured_faces.append(face_roi)
                    print(f"Captured face {len(captured_faces)}/{num_images}")
                else:
                    print(f"Rejected: {reason}")

            attempts += 1

            # Delay between captures
            import time
            time.sleep(delay_ms / 1000.0)

        print(f"Capture complete: {len(captured_faces)} images")

        return captured_faces

    def delete_student_data(self, student_id):
        """
        Delete all face images and data for a student

        Args:
            student_id (int): Student ID

        Returns:
            bool: Success status
        """
        student_dir = self.dataset_path / f"student_{student_id}"

        if not student_dir.exists():
            return False

        try:
            # Delete all files in the directory
            for file_path in student_dir.glob("*"):
                file_path.unlink()

            # Delete the directory
            student_dir.rmdir()

            # Remove from model
            if self.face_recognizer is not None:
                self.face_recognizer.delete_student(student_id)

            return True

        except Exception as e:
            print(f"Failed to delete student data: {e}")
            return False

    def get_training_statistics(self):
        """
        Get statistics about the training dataset

        Returns:
            dict: Training statistics
        """
        faces_dict = self.load_all_student_faces()

        stats = {
            'total_students': len(faces_dict),
            'images_per_student': {},
            'total_images': 0,
            'dataset_path': str(self.dataset_path)
        }

        for student_id, images in faces_dict.items():
            count = len(images)
            stats['images_per_student'][student_id] = count
            stats['total_images'] += count

        if stats['total_students'] > 0:
            stats['avg_images_per_student'] = stats['total_images'] / stats['total_students']

        return stats


# Global trainer instance
_trainer_instance = None


def get_model_trainer(dataset_path='dataset'):
    """
    Get or create model trainer instance

    Args:
        dataset_path (str): Path to dataset directory

    Returns:
        ModelTrainer: Model trainer instance
    """
    global _trainer_instance

    if _trainer_instance is None:
        from .face_detector import get_face_detector
        from .face_recognizer import get_face_recognizer

        detector = get_face_detector()
        recognizer = get_face_recognizer()

        _trainer_instance = ModelTrainer(
            dataset_path=dataset_path,
            face_detector=detector,
            face_recognizer=recognizer
        )

    return _trainer_instance
