/**
 * utils/cleanup.js — Production-ready cleanup utility.
 */

import fs from 'fs';
import logger from './logger.js';
import supabase from '../services/supabase.js';

/**
 * Clean up local repository directory and Supabase storage clone.
 * 
 * @param {string} localDir - The local path to the cloned repository.
 * @param {string} storageObjectPath - The path to the zip/object in Supabase storage.
 * @returns {Promise<void>}
 */
export async function cleanup(localDir, storageObjectPath) {
  // 1. Local cleanup
  try {
    if (localDir && fs.existsSync(localDir)) {
      fs.rmSync(localDir, { recursive: true, force: true });
      logger.info(`Successfully removed local directory: ${localDir}`);
    }
  } catch (err) {
    logger.error(`Failed to remove local directory ${localDir}: ${err.message}`);
  }

  // 2. Storage cleanup
  try {
    if (storageObjectPath) {
      const { error } = await supabase.storage.from('clones').remove([storageObjectPath]);
      if (error) {
        logger.error(`Failed to remove storage object ${storageObjectPath}: ${error.message}`);
      } else {
        logger.info(`Successfully removed storage object: ${storageObjectPath}`);
      }
    }
  } catch (err) {
    logger.error(`Storage cleanup failed for ${storageObjectPath}: ${err.message}`);
  }
}
