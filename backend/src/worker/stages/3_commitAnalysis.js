const simpleGit = require('simple-git');

// Issue ref patterns: #123, GH-123, JIRA-456, FEAT-12, etc.
const ISSUE_REF_REGEX = /\b([A-Z]{2,10}-\d+|#\d+)\b/g;

/**
 * Stage 3: Parse git commit history and extract issue references.
 *
 * @param {string} cloneDir - local path to the cloned repo
 * @param {string} branch - branch being analyzed
 * @param {function} onProgress - callback(percent, message)
 * @returns {Promise<{commits: CommitRecord[], issueToFiles: Map<string, Set<string>>}>}
 */
async function runCommitAnalysis(cloneDir, branch, onProgress) {
  onProgress(50, 'Reading commit history…');

  const git = simpleGit(cloneDir);
  const commits = [];
  const issueToFiles = new Map(); // issue_ref -> Set of file paths

  try {
    // Get commit log with file names
    // Format: HASH|AUTHOR|DATE|SUBJECT
    const logArgs = [
      '--format=%H|%an|%aI|%s',
      '--name-only',
      '--no-merges',
      `-n`, '500', // cap at 500 commits
    ];

    if (branch && branch !== 'HEAD') {
      logArgs.push(branch);
    }

    const rawLog = await git.raw(['log', ...logArgs]);
    const parsedCommits = parseGitLog(rawLog);

    for (const commit of parsedCommits) {
      // Extract issue refs from commit message
      const issueRefs = extractIssueRefs(commit.message);

      commits.push({
        commit_hash: commit.hash,
        message: commit.message,
        author: commit.author,
        authored_at: commit.date,
        branch: branch || 'HEAD',
        issue_refs: issueRefs,
        files_touched: commit.files,
      });

      // Build issue → files mapping
      for (const ref of issueRefs) {
        if (!issueToFiles.has(ref)) issueToFiles.set(ref, new Set());
        for (const f of commit.files) {
          issueToFiles.get(ref).add(f);
        }
      }
    }

    onProgress(65, `Parsed ${commits.length} commits, found ${issueToFiles.size} issue refs`);

  } catch (err) {
    console.warn('[CommitAnalysis] git log failed:', err.message);
    onProgress(65, 'Commit analysis skipped (no git history)');
  }

  return { commits, issueToFiles };
}

/**
 * Parse raw git log output (format=%H|%an|%aI|%s --name-only).
 * Output looks like:
 *   abc123|John|2024-01-01T10:00:00Z|Fix auth bug
 *   src/auth.ts
 *   src/user.ts
 *
 *   def456|Jane|2024-01-02T11:00:00Z|Add logging
 *   src/logger.ts
 */
function parseGitLog(rawLog) {
  const commits = [];
  const blocks = rawLog.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (!lines.length) continue;

    // First line is the commit info
    const headerLine = lines[0];
    const parts = headerLine.split('|');
    if (parts.length < 4) continue;

    const [hash, author, date, ...subjectParts] = parts;
    const message = subjectParts.join('|').trim();

    // Remaining lines are file names
    const files = lines
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('diff') && l.includes('.'));

    commits.push({ hash: hash.trim(), author: author.trim(), date: date.trim(), message, files });
  }

  return commits;
}

function extractIssueRefs(message) {
  const refs = [];
  let match;
  ISSUE_REF_REGEX.lastIndex = 0;
  while ((match = ISSUE_REF_REGEX.exec(message)) !== null) {
    refs.push(match[1]);
  }
  return [...new Set(refs)];
}

/**
 * Get all branches available in the cloned repo.
 */
async function getAllBranches(cloneDir) {
  try {
    const git = simpleGit(cloneDir);
    const result = await git.branch(['-r', '--format=%(refname:short)']);
    const branches = result.all
      .map((b) => b.replace(/^origin\//, '').trim())
      .filter((b) => b && !b.includes('HEAD'));
    return [...new Set(branches)];
  } catch {
    return [];
  }
}

/**
 * Tag each analyzed file with the issues that touched it.
 */
function tagFilesWithIssues(analyzedFiles, issueToFiles) {
  for (const file of analyzedFiles) {
    const issues = [];
    for (const [issue, filePaths] of issueToFiles.entries()) {
      if (filePaths.has(file.path)) {
        issues.push(issue);
      }
    }
    file.issues = issues;
  }
}

module.exports = { runCommitAnalysis, getAllBranches, tagFilesWithIssues };
