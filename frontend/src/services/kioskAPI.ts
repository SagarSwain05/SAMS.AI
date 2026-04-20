/**
 * Kiosk API - Public endpoints for door/gate face recognition kiosk
 * No authentication required
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export const kioskAPI = {
  /**
   * Get recognition status (public endpoint)
   * Polls the current recognition session status without authentication
   */
  getStatus: async () => {
    const response = await fetch(`${API_BASE_URL}/recognition/status_public`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch status');
    }

    return response.json();
  },

  /**
   * Get video feed URL (public endpoint)
   * Returns the URL for the MJPEG video stream
   */
  getVideoFeedUrl: () => {
    return `${API_BASE_URL}/recognition/video_feed`;
  },
};

export default kioskAPI;
