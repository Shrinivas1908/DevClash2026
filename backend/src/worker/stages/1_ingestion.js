import path from 'path';
import fs from 'fs';
import simpleGit from 'simple-git';

const ALLOWED_EXTENSIONS = new Set([
  '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.java', '.rb', '.rs', '.cpp', '.c', '.cs', '.php', '.swift', '.kt',
]);

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', 'vendor', '.next',
  'coverage', '__pycache__', '.cache', '.nyc_output', 'out',
  'target', 'bin', 'obj', '.turbo', '.vite',
]);

const MAX_FILE_SIZE_BYTES = 500 * 1024;

export async function runIngestion({ repoUrl, branch, cloneDir, onProgress }) {
  onProgress(5, 'Cloning repository…');

  if (fs.existsSync(cloneDir)) {
    fs.rmSync(cloneDir, { recursive: true, force: true });
  }
  fs.mkdirSync(cloneDir, { recursive: true });

  const git = simpleGit();
  const cloneOptions = ['--single-branch'];
  if (branch && branch !== 'HEAD') {
    cloneOptions.push('--branch', branch);
  }

  try {
    await git.clone(repoUrl, cloneDir, cloneOptions);
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('Remote branch')) {
      await git.clone(repoUrl, cloneDir);
    } else {
      throw err;
    }
  }

  onProgress(8, 'Resolving HEAD commit…');
  const repoGit = simpleGit(cloneDir);
  const logResult = await repoGit.log({ maxCount: 1 });
  const commitSha = logResult.latest?.hash || 'unknown';

  let currentBranch = branch;
  try {
    const branchResult = await repoGit.revparse(['--abbrev-ref', 'HEAD']);
    currentBranch = branchResult.trim();
  } catch {
    currentBranch = branch || 'main';
  }

  const repoName = repoUrl
    .replace(/\.git$/, '')
    .split('/')
    .slice(-2)
    .join('/');

  onProgress(10, 'Walking file tree…');
  const files = [];
  const languageStats = {};
  walkDir(cloneDir, cloneDir, files, languageStats);

  onProgress(15, `Found ${files.length} source files`);

  return { files, commitSha, repoName, currentBranch, languageStats };
}

function walkDir(baseDir, currentDir, files, languageStats) {
  let entries;
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith('.')) continue;

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

      if (stat.size > MAX_FILE_SIZE_BYTES) continue;
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
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

export async function getRepoBranches(cloneDir) {
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
