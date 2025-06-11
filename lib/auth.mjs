/**
 * Node-RED Authentication Manager
 * Handles dynamic token authentication with username/password
 */

import axios from 'axios';

class NodeRedAuth {
  constructor(config) {
    this.config = config;
    this.tokenData = null; // { token, expiresAt, obtainedAt }
  }

  /**
   * 检查当前token是否有效（未过期）
   * @returns {boolean} true if token is valid and not expired
   */
  isTokenValid() {
    if (!this.tokenData || !this.tokenData.token) {
      return false;
    }

    const now = Date.now();
    const buffer = 60 * 1000; // 60秒缓冲时间，提前刷新
    
    return now < (this.tokenData.expiresAt - buffer);
  }

  /**
   * 通过用户名密码获取新的token
   * @returns {Promise<string>} access token
   */
  async refreshToken() {
    if (!this.config.nodeRedUsername || !this.config.nodeRedPassword) {
      throw new Error('Username and password are required for token authentication');
    }

    const url = `${this.config.nodeRedUrl}/auth/token`;
    const payload = {
      client_id: 'node-red-admin',
      grant_type: 'password',
      scope: '*',
      username: this.config.nodeRedUsername,
      password: this.config.nodeRedPassword
    };

    try {
      if (this.config.verbose) {
        console.log('🔑 Refreshing Node-RED token...');
      }

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const { access_token, expires_in, token_type } = response.data;
      
      if (!access_token) {
        throw new Error('No access token received from Node-RED');
      }

      const now = Date.now();
      const expiresAt = now + (expires_in * 1000); // 转换为毫秒

      this.tokenData = {
        token: access_token,
        tokenType: token_type || 'Bearer',
        expiresAt: expiresAt,
        obtainedAt: now,
        expiresIn: expires_in
      };

      if (this.config.verbose) {
        const expiresInHours = Math.round(expires_in / 3600);
        console.log(`✅ Token refreshed successfully! Expires in ${expiresInHours} hours`);
      }

      return access_token;
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        if (status === 401) {
          throw new Error('Invalid username or password for Node-RED authentication');
        } else if (status === 404) {
          throw new Error('Node-RED authentication endpoint not found. Check if adminAuth is enabled.');
        }
        throw new Error(`Authentication failed with status ${status}: ${error.response.statusText}`);
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error(`Cannot connect to Node-RED at ${this.config.nodeRedUrl}`);
      }
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * 获取有效的token，如果过期则自动刷新
   * @returns {Promise<string>} valid access token
   */
  async getValidToken() {
    // 如果有静态token配置，优先使用静态token
    if (this.config.nodeRedToken && !this.config.nodeRedUsername) {
      return this.config.nodeRedToken;
    }

    // 检查当前token是否有效
    if (this.isTokenValid()) {
      return this.tokenData.token;
    }

    // token无效或不存在，刷新token
    return await this.refreshToken();
  }

  /**
   * 获取认证头
   * @returns {Promise<Object>} authorization headers
   */
  async getAuthHeaders() {
    const token = await this.getValidToken();
    
    if (!token) {
      return {};
    }

    const tokenType = this.tokenData?.tokenType || 'Bearer';
    return {
      'Authorization': `${tokenType} ${token}`
    };
  }

  /**
   * 清除token数据
   */
  clearToken() {
    this.tokenData = null;
    if (this.config.verbose) {
      console.log('🗑️ Token data cleared');
    }
  }

  /**
   * 获取token状态信息
   * @returns {Object} token status information
   */
  getTokenStatus() {
    if (!this.tokenData) {
      return { 
        hasToken: false, 
        isValid: false,
        source: this.config.nodeRedToken ? 'static' : 'none'
      };
    }

    const now = Date.now();
    const remainingMs = this.tokenData.expiresAt - now;
    const remainingHours = Math.max(0, Math.round(remainingMs / (1000 * 60 * 60)));

    return {
      hasToken: true,
      isValid: this.isTokenValid(),
      source: 'dynamic',
      expiresAt: new Date(this.tokenData.expiresAt).toISOString(),
      remainingHours: remainingHours,
      obtainedAt: new Date(this.tokenData.obtainedAt).toISOString()
    };
  }
}

export default NodeRedAuth; 