/**
 * services/events.js — Global event bus for the backend.
 * Used to communicate between worker thread managers and the SSE API routes.
 */

import { EventEmitter } from 'events';

class JobEventEmitter extends EventEmitter {}

// Singleton instance
const jobEvents = new JobEventEmitter();

// Limit listeners to prevent memory leaks in dev
jobEvents.setMaxListeners(100);

export default jobEvents;
