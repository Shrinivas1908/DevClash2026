
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import * as groq from './backend/src/services/groqService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, './.env') });

async function testGroq() {
  console.log('Testing Groq API...');
  console.log('API KEY:', process.env.GROQ_API_KEY ? 'Present' : 'Missing');

  const mockRepo = {
    repo_name: 'test-repo',
    repo_url: 'https://github.com/test/repo',
    language_stats: { JavaScript: 100 }
  };
  const topFiles = [{ path: 'src/index.js' }];
  const entryPoints = ['src/index.js'];

  try {
    const result = await groq.generateRepoContext(mockRepo, topFiles, entryPoints);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

testGroq();
