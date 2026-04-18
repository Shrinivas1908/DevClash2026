import simpleGit from 'simple-git';

const ISSUE_REF_REGEX = /\b([A-Z]{2,10}-\d+|#\d+)\b/g;

export async function runCommitAnalysis(cloneDir, branch, onProgress) {
  onProgress(50, 'Reading commit history…');

  const git = simpleGit(cloneDir);
  const commits = [];
  const issueToFiles = new Map();

  try {
    const logArgs = [
      '--format=%H|%an|%aI|%s',
      '--name-only',
      '--no-merges',
      `-n`, '500',
    ];

    if (branch && branch !== 'HEAD') {
      logArgs.push(branch);
    }

    const rawLog = await git.raw(['log', ...logArgs]);
    const parsedCommits = parseGitLog(rawLog);

    for (const commit of parsedCommits) {
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

      for (const ref of issueRefs) {
        if (!issueToFiles.has(ref)) issueToFiles.set(ref, new Set());
        for (const f of commit.files) {
          issueToFiles.get(ref).add(f);
        }
      }
    }

    onProgress(65, `Parsed ${commits.length} commits, found ${issueToFiles.size} issue refs`);

  } catch (err) {
    onProgress(65, 'Commit analysis skipped (no git history)');
  }

  return { commits, issueToFiles };
}

function parseGitLog(rawLog) {
  const commits = [];
  const blocks = rawLog.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (!lines.length) continue;

    const headerLine = lines[0];
    const parts = headerLine.split('|');
    if (parts.length < 4) continue;

    const [hash, author, date, ...subjectParts] = parts;
    const message = subjectParts.join('|').trim();

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

export async function getAllBranches(cloneDir) {
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

export function tagFilesWithIssues(analyzedFiles, issueToFiles) {
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
