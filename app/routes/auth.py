"""
Authentication Routes
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
import jwt
from functools import wraps
from ..models import db, User
from ..config import get_config

bp = Blueprint('auth', __name__)
config = get_config()


def token_required(f):
    """Decorator to protect routes with JWT authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        # Get token from header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer <token>
            except IndexError:
                return jsonify({'message': 'Invalid token format'}), 401

        if not token:
            return jsonify({'message': 'Token is missing'}), 401

        try:
            # Decode token
            data = jwt.decode(token, config.JWT_SECRET_KEY, algorithms=["HS256"])
            current_user = User.query.get(data['user_id'])

            if not current_user:
                return jsonify({'message': 'User not found'}), 401

        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401

        return f(current_user, *args, **kwargs)

    return decorated


def admin_required(f):
    """Decorator to protect routes requiring admin role"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        # Get token from header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer <token>
            except IndexError:
                return jsonify({'message': 'Invalid token format'}), 401

        if not token:
            return jsonify({'message': 'Token is missing'}), 401

        try:
            # Decode token
            data = jwt.decode(token, config.JWT_SECRET_KEY, algorithms=["HS256"])
            current_user = User.query.get(data['user_id'])

            if not current_user:
                return jsonify({'message': 'User not found'}), 401

            # Check if user has admin role
            if current_user.role != 'admin':
                return jsonify({'message': 'Admin access required'}), 403

        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401

        return f(current_user, *args, **kwargs)

    return decorated


@bp.route('/login', methods=['POST'])
def login():
    """Login with username and password"""
    try:
        data = request.get_json()

        if not data or not data.get('username') or not data.get('password'):
            return jsonify({'message': 'Username and password required'}), 400

        username = data.get('username')
        password = data.get('password')

        # Find user
        user = User.query.filter_by(username=username).first()

        if not user:
            return jsonify({'message': 'Invalid credentials'}), 401

        # Check password
        if not user.check_password(password):
            return jsonify({'message': 'Invalid credentials'}), 401

        # Generate JWT token
        token = jwt.encode({
            'user_id': user.id,
            'username': user.username,
            'role': user.role,
            'exp': datetime.utcnow() + config.JWT_ACCESS_TOKEN_EXPIRES
        }, config.JWT_SECRET_KEY, algorithm="HS256")

        return jsonify({
            'message': 'Login successful',
            'token': token,
            'user': user.to_dict()
        }), 200

    except Exception as e:
        return jsonify({'message': f'Login failed: {str(e)}'}), 500


@bp.route('/login_face', methods=['POST'])
def login_face():
    """Login with face recognition"""
    try:
        # TODO: Implement face recognition login
        # This will be implemented when face recognition module is ready
        return jsonify({'message': 'Face recognition login not yet implemented'}), 501

    except Exception as e:
        return jsonify({'message': f'Face login failed: {str(e)}'}), 500


@bp.route('/logout', methods=['POST'])
@token_required
def logout(current_user):
    """Logout (client-side token deletion)"""
    try:
        return jsonify({
            'message': 'Logout successful',
            'user': current_user.username
        }), 200

    except Exception as e:
        return jsonify({'message': f'Logout failed: {str(e)}'}), 500


@bp.route('/verify', methods=['GET'])
@token_required
def verify_token(current_user):
    """Verify JWT token validity"""
    try:
        return jsonify({
            'valid': True,
            'user': current_user.to_dict()
        }), 200

    except Exception as e:
        return jsonify({'message': f'Verification failed: {str(e)}'}), 500


@bp.route('/refresh', methods=['POST'])
@token_required
def refresh_token(current_user):
    """Refresh JWT token"""
    try:
        # Generate new token
        token = jwt.encode({
            'user_id': current_user.id,
            'username': current_user.username,
            'role': current_user.role,
            'exp': datetime.utcnow() + config.JWT_ACCESS_TOKEN_EXPIRES
        }, config.JWT_SECRET_KEY, algorithm="HS256")

        return jsonify({
            'message': 'Token refreshed',
            'token': token
        }), 200

    except Exception as e:
        return jsonify({'message': f'Token refresh failed: {str(e)}'}), 500
