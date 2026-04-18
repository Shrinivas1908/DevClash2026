/**
 * eventBus.js — A simple EventEmitter to bridge worker updates to SSE clients.
 */

import { EventEmitter } from 'events';

class JobEventBus extends EventEmitter {
  /**
   * Emit a job update event.
   * @param {string} jobId 
   * @param {Object} data 
   */
  emitUpdate(jobId, data) {
    this.emit(`job:${jobId}`, data);
  }

  /**
   * Subscribe to job updates.
   * @param {string} jobId 
   * @param {Function} callback 
   */
  subscribe(jobId, callback) {
    this.on(`job:${jobId}`, callback);
    return () => this.off(`job:${jobId}`, callback);
  }
}

export default new JobEventBus();
