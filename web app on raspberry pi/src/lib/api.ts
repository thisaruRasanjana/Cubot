import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

interface Move {
  id: number;
  move: string;
  timestamp: string;
}

interface ProcessImageResponse {
  success: boolean;
  message: string;
  face?: string;
  colors?: string[];
}

class ApiClient {
  private api: AxiosInstance;
  private API_BASE_URL: string;

  constructor() {
    // Always use relative URL for nginx proxy - no environment variables
    this.API_BASE_URL = '/api';
    
    this.api = axios.create({
      baseURL: this.API_BASE_URL,
      timeout: 320000, // 5+ minutes timeout for worst case robot operations
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private handleError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        // Server responded with a status code outside 2xx
        console.error('API Error:', {
          status: axiosError.response.status,
          data: axiosError.response.data,
          headers: axiosError.response.headers,
        });
        throw new Error(`API Error: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`);
      } else if (axiosError.request) {
        // Request was made but no response received
        console.error('No response received:', axiosError.request);
        throw new Error('No response received from server. Please check your connection.');
      }
    }
    // Unknown error
    console.error('Unexpected error:', error);
    throw new Error('An unexpected error occurred. Please try again.');
  }

  async processCubeImage(imageData: string, face: string) {
    console.log(`[DEBUG] processCubeImage called for face: ${face}`);
    console.log(`[DEBUG] API_BASE_URL is: ${this.API_BASE_URL}`);
    const requestUrl = `${this.API_BASE_URL}/upload`;
    console.log(`[DEBUG] Attempting to POST to: ${requestUrl}`);

    try {
      // Convert data URL to File object
      const response = await fetch(imageData);
      const blob = await response.blob();
      const file = new File([blob], `face_${face}.jpg`, { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('face', face);

      console.log('[DEBUG] FormData created. Sending request...');

      const { data } = await this.api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('[DEBUG] Image processing successful on server:', data);
      return data;
    } catch (error) {
      console.error('--- DETAILED IMAGE PROCESSING ERROR ---');
      console.error(`[DEBUG] Failed to send request to: ${requestUrl}`);
      
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        console.error('[DEBUG] Error Type: AxiosError');
        console.error('[DEBUG] Error Code:', axiosError.code);
        console.error('[DEBUG] Error Message:', axiosError.message);
        if (axiosError.request) {
            console.error('[DEBUG] Request details:', axiosError.request);
        }
        if (axiosError.response) {
            console.error('[DEBUG] Response status:', axiosError.response.status);
            console.error('[DEBUG] Response data:', axiosError.response.data);
        }
      } else {
        console.error('[DEBUG] Error Type: Non-Axios Error');
        console.error('[DEBUG] Full error object:', error);
      }
      console.error('--- END OF ERROR ---');
      throw error;
    }
  }

  async startSolving() {
    try {
      const { data } = await this.api.post('/start_solving');
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getMoves(): Promise<Move[]> {
    console.log('Fetching solution moves from backend...');
    
    try {
      const { data } = await this.api.get<Move[]>('/get_moves');
      console.log('Received moves:', data);
      return data;
    } catch (error) {
      console.error('Failed to fetch moves:', error);
      this.handleError(error);
      throw error;
    }
  }

  async checkConnection(): Promise<{ connected: boolean; status?: string }> {
    try {
      const response = await this.api.get('/check_connection');
      return {
        connected: response.data.connected === true,
        status: response.data.message
      };
    } catch (error) {
      console.error('Connection check failed:', error);
      return { connected: false, status: 'Connection check failed' };
    }
  }

  async getSystemStatus() {
    try {
      const response = await this.api.get('/system-status');
      return response.data;
    } catch (error) {
      console.error('Failed to get system status:', error);
      throw error;
    }
  }

  async sendMove(move: string): Promise<{ success: boolean; message: string; move: string }> {
    console.log(`[DEBUG] Sending move to ESP32: ${move}`);
    
    try {
      const { data } = await this.api.post('/send_move', { move });
      console.log(`[DEBUG] ESP32 move response:`, data);
      return data;
    } catch (error) {
      console.error('Failed to send move to ESP32:', error);
      this.handleError(error);
      throw error;
    }
  }

  async startScan(): Promise<{ success: boolean; message: string; command: string }> {
    console.log('[DEBUG] Starting ESP32 cube scanning...');
    
    try {
      const { data } = await this.api.post('/start_scan');
      console.log('[DEBUG] ESP32 scan response:', data);
      return data;
    } catch (error) {
      console.error('Failed to start ESP32 scanning:', error);
      this.handleError(error);
      throw error;
    }
  }

  async gripCube(): Promise<{ success: boolean; message: string; command: string }> {
    console.log('[DEBUG] Sending GRIP command to ESP32...');
    
    try {
      const { data } = await this.api.post('/grip_cube');
      console.log('[DEBUG] ESP32 grip response:', data);
      return data;
    } catch (error) {
      console.error('Failed to grip cube with ESP32:', error);
      this.handleError(error);
      throw error;
    }
  }
}

export const apiClient = new ApiClient();
