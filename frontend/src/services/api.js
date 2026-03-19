// API service for Crowd Management System

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

class CrowdApiService {
  async get(endpoint) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    return response.json();
  }

  async post(endpoint, data) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    return response.json();
  }

  async put(endpoint, data = null) {
    const config = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (data) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    return response.json();
  }

  // Dashboard stats
  async getDashboardStats() {
    return this.get('/dashboard/stats');
  }

  // Locations
  async getLocations(activeOnly = true) {
    return this.get(`/locations?active_only=${activeOnly}`);
  }

  async createLocation(locationData) {
    return this.post('/locations', locationData);
  }

  async updateLocation(locationId, updateData) {
    return this.put(`/locations/${locationId}`, updateData);
  }

  // Measurements
  async getMeasurements(locationId, hours = 24) {
    return this.get(`/measurements/${locationId}?hours=${hours}`);
  }

  async processCameraFeed(cameraId) {
    return this.post(`/measurements/process-camera/${cameraId}`);
  }

  // Alerts
  async getActiveAlerts() {
    return this.get('/alerts');
  }

  async resolveAlert(alertId) {
    return this.put(`/alerts/${alertId}/resolve`);
  }

  async createAlertThreshold(thresholdData) {
    return this.post('/alerts/thresholds', thresholdData);
  }

  // Analytics
  async getCrowdAnalytics(locationId, hours = 24) {
    return this.get(`/analytics/${locationId}?hours=${hours}`);
  }

  // Health check
  async healthCheck() {
    return this.get('/health');
  }
}

export default new CrowdApiService();