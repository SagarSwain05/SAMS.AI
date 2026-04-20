"""
Face Embedding model for storing facial recognition data
"""
from datetime import datetime
from . import db
import json


class FaceEmbedding(db.Model):
    """Store face embeddings (facial feature vectors) for students"""
    __tablename__ = 'face_embeddings'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)
    embedding_data = db.Column(db.Text, nullable=False)  # JSON-encoded embedding vector
    model_name = db.Column(db.String(50), nullable=False, default='Facenet')  # Model used for embedding
    image_path = db.Column(db.String(255), nullable=True)  # Path to original image
    capture_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, nullable=False, default=True)  # For version control
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    student = db.relationship('Student', back_populates='face_embeddings')

    def set_embedding(self, embedding_list):
        """Convert embedding list/array to JSON string"""
        self.embedding_data = json.dumps(embedding_list)

    def get_embedding(self):
        """Convert JSON string back to list"""
        return json.loads(self.embedding_data)

    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'student_id': self.student_id,
            'model_name': self.model_name,
            'image_path': self.image_path,
            'capture_date': self.capture_date.isoformat() if self.capture_date else None,
            'is_active': self.is_active
        }

    def __repr__(self):
        return f'<FaceEmbedding {self.id} - Student {self.student_id}>'
