const path = require('path');
const fs = require('fs');
const simpleGit = require('simple-git');

const ALLOWED_EXTENSIONS = new Set([
  '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.java', '.rb', '.rs', '.cpp', '.c', '.cs', '.php', '.swift', '.kt',
]);

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', 'vendor', '.next',
  'coverage', '__pycache__', '.cache', '.nyc_output', 'out',
  'target', 'bin', 'obj', '.turbo', '.vite',
]);

const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500KB

/**
 * Stage 1: Clone the repository and walk its file tree.
 *
 * @param {object} params
 * @param {string} params.repoUrl
 * @param {string} params.branch  - branch name or 'HEAD'
 * @param {string} params.cloneDir - local directory to clone into
 * @param {function} params.onProgress - callback(percent, message)
 * @returns {Promise<{files: FileEntry[], commitSha: string, repoName: string, languageStats: object}>}
 */
async function runIngestion({ repoUrl, branch, cloneDir, onProgress }) {
  onProgress(5, 'Cloning repository…');

  // Clean clone dir if it exists
  if (fs.existsSync(cloneDir)) {
    fs.rmSync(cloneDir, { recursive: true, force: true });
  }
  fs.mkdirSync(cloneDir, { recursive: true });

  const git = simpleGit();

  // Build clone options — shallow clone for speed
  const cloneOptions = ['--depth=1', '--single-branch'];
  if (branch && branch !== 'HEAD') {
    cloneOptions.push('--branch', branch);
  }

  try {
    await git.clone(repoUrl, cloneDir, cloneOptions);
  } catch (err) {
    // If branch not found, try default branch
    if (err.message.includes('not found') || err.message.includes('Remote branch')) {
      await git.clone(repoUrl, cloneDir, ['--depth=1']);
    } else {
      throw err;
    }
  }

  onProgress(8, 'Resolving HEAD commit…');
  const repoGit = simpleGit(cloneDir);

  // Get the current HEAD commit SHA
  const logResult = await repoGit.log({ maxCount: 1 });
  const commitSha = logResult.latest?.hash || 'unknown';

  // Get current branch name
  let currentBranch = branch;
  try {
    const branchResult = await repoGit.revparse(['--abbrev-ref', 'HEAD']);
    currentBranch = branchResult.trim();
  } catch {
    currentBranch = branch || 'main';
  }

  // Extract repo name from URL
  const repoName = repoUrl
    .replace(/\.git$/, '')
    .split('/')
    .slice(-2)
    .join('/');

  onProgress(10, 'Walking file tree…');

  // Walk the file tree
  const files = [];
  const languageStats = {};

  walkDir(cloneDir, cloneDir, files, languageStats);

  onProgress(15, `Found ${files.length} source files`);

  return { files, commitSha, repoName, currentBranch, languageStats };
}

/**
 * Recursively walk a directory and collect source files.
 */
function walkDir(baseDir, currentDir, files, languageStats) {
  let entries;
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith('.')) continue; // skip hidden files/dirs

    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      walkDir(baseDir, fullPath, files, languageStats);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;

      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.size > MAX_FILE_SIZE_BYTES) continue; // skip large files

      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

      // Count language stats
      const lang = extToLanguage(ext);
      languageStats[lang] = (languageStats[lang] || 0) + 1;

      files.push({
        path: relativePath,
        absolutePath: fullPath,
        language: lang,
        sizeBytes: stat.size,
      });
    }
  }
}

/**
 * Get list of all branches in the cloned repo.
 */
async function getRepoBranches(cloneDir) {
  try {
    const git = simpleGit(cloneDir);
    const result = await git.branch(['-r']);
    const branches = result.all
      .map((b) => b.replace('origin/', '').trim())
      .filter((b) => !b.startsWith('HEAD'));
    return [...new Set(branches)];
  } catch {
    return ['main'];
  }
}

function extToLanguage(ext) {
  const map = {
    '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
    '.ts': 'typescript', '.jsx': 'javascript', '.tsx': 'typescript',
    '.py': 'python', '.go': 'go', '.java': 'java', '.rb': 'ruby',
    '.rs': 'rust', '.cpp': 'cpp', '.c': 'c', '.cs': 'csharp',
    '.php': 'php', '.swift': 'swift', '.kt': 'kotlin',
  };
  return map[ext] || 'unknown';
}

module.exports = { runIngestion, getRepoBranches };
