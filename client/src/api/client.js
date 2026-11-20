// API client for War Room backend
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class WarRoomAPI {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`[API] ${endpoint} failed:`, error.message);
      throw error;
    }
  }

  // Rooms
  async getRooms() {
    return this.request('/rooms');
  }

  async getRoom(id) {
    return this.request(`/rooms/${id}`);
  }

  async createRoom(name, config = {}) {
    return this.request('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name, config })
    });
  }

  async updateRoom(id, name, config) {
    return this.request(`/rooms/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, config })
    });
  }

  async deleteRoom(id) {
    return this.request(`/rooms/${id}`, {
      method: 'DELETE'
    });
  }

  // Agents
  async getAgents() {
    return this.request('/agents');
  }

  async getAgentHealth() {
    return this.request('/agents/health');
  }

  async getRoomAgents(roomId) {
    return this.request(`/agents/room/${roomId}`);
  }

  async createAgent(name, type, api_endpoint, config, room_id) {
    return this.request('/agents', {
      method: 'POST',
      body: JSON.stringify({ name, type, api_endpoint, config, room_id })
    });
  }

  async updateAgent(id, data) {
    return this.request(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteAgent(id) {
    return this.request(`/agents/${id}`, {
      method: 'DELETE'
    });
  }

  async toggleAgent(id, active) {
    return this.request(`/agents/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ active })
    });
  }

  // Messages
  async getRoomMessages(roomId, limit = 100, offset = 0) {
    return this.request(`/messages/room/${roomId}?limit=${limit}&offset=${offset}`);
  }

  async getMessage(id) {
    return this.request(`/messages/${id}`);
  }

  async sendMessage(room_id, content, agent_id = null, parent_id = null) {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify({ room_id, agent_id, content, parent_id })
    });
  }

  async updateMessageStatus(id, status) {
    return this.request(`/messages/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }
}

export default new WarRoomAPI();