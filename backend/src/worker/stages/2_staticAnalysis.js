const fs = require('fs');
const path = require('path');

// AST Parsers — loaded lazily
let babelParser = null;
let tsParser = null;
let acorn = null;

function getBabelParser() {
  if (!babelParser) babelParser = require('@babel/parser');
  return babelParser;
}

function getTsParser() {
  if (!tsParser) tsParser = require('@typescript-eslint/parser');
  return tsParser;
}

function getAcorn() {
  if (!acorn) acorn = require('acorn');
  return acorn;
}

/**
 * Stage 2: Parse all files with AST parsers to extract imports/exports.
 * Builds the dependency graph and computes fan_in / fan_out / importance.
 *
 * @param {Array<{path, absolutePath, language, sizeBytes}>} files
 * @param {function} onProgress - callback(percent, message)
 * @returns {{ analyzedFiles: AnalyzedFile[], graphJson: {nodes, edges} }}
 */
async function runStaticAnalysis(files, onProgress) {
  onProgress(15, 'Starting AST analysis…');

  const total = files.length;
  const analyzed = [];
  const pathToId = new Map(); // file path -> uuid index

  // Parallel parsing with a concurrency limit
  const concurrencyLimit = 10;
  const chunks = [];
  for (let i = 0; i < files.length; i += concurrencyLimit) {
    chunks.push(files.slice(i, i + concurrencyLimit));
  }

  onProgress(15, `Parsing ${total} files in parallel…`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    await Promise.all(chunk.map(async (file, chunkIdx) => {
      const globalIdx = i * concurrencyLimit + chunkIdx;
      const id = `file-${globalIdx}`;
      pathToId.set(file.path, id);

      const result = parseFile(file);
      analyzed.push({
        id,
        path: file.path,
        absolutePath: file.absolutePath,
        language: file.language,
        sizeBytes: file.sizeBytes,
        imports: result.imports,
        exports: result.exports,
        rawImportPaths: result.rawImportPaths,
        fan_in: 0,
        fan_out: result.rawImportPaths.length,
        importance: 0,
        is_entry_point: isEntryPoint(file.path),
      });
    }));

    if (i % 5 === 0) {
      const currentAnalyzed = Math.min((i + 1) * concurrencyLimit, total);
      const percent = 15 + Math.floor((currentAnalyzed / total) * 25);
      onProgress(percent, `Parsing files… ${currentAnalyzed}/${total}`);
    }
  }


  onProgress(40, 'Building dependency graph…');

  // Second pass: resolve import paths to actual files (build edges)
  const edges = [];
  const fanInCounts = new Map(); // id -> count

  for (const file of analyzed) {
    for (const rawImport of file.rawImportPaths) {
      const resolvedId = resolveImport(rawImport, file.path, pathToId);
      if (resolvedId && resolvedId !== file.id) {
        edges.push({
          source: file.id,
          target: resolvedId,
          import_type: rawImport.isDynamic ? 'dynamic' : 'static',
        });
        fanInCounts.set(resolvedId, (fanInCounts.get(resolvedId) || 0) + 1);
      }
    }
  }

  // Third pass: compute fan_in and importance
  for (const file of analyzed) {
    file.fan_in = fanInCounts.get(file.id) || 0;
    file.fan_out = edges.filter((e) => e.source === file.id).length;
    file.importance = file.fan_in * 3 + file.fan_out;
  }

  // Build React Flow compatible graph (cap at top 200 by importance)
  const sortedByImportance = [...analyzed].sort((a, b) => b.importance - a.importance);
  const topFiles = sortedByImportance.slice(0, 200);
  const topIds = new Set(topFiles.map((f) => f.id));

  const graphNodes = topFiles.map((f) => ({
    id: f.id,
    path: f.path,
    name: path.basename(f.path),
    language: f.language,
    fan_in: f.fan_in,
    fan_out: f.fan_out,
    composite_importance: f.importance,
    is_entry_point: f.is_entry_point,
    last_commit_sha: '',
  }));

  const graphEdges = edges.filter(
    (e) => topIds.has(e.source) && topIds.has(e.target)
  );

  onProgress(50, `Graph built: ${graphNodes.length} nodes, ${graphEdges.length} edges`);

  return {
    analyzedFiles: analyzed,
    graphJson: { nodes: graphNodes, edges: graphEdges },
    pathToId,
  };
}

/**
 * Parse a single file and extract imports/exports using the right parser.
 */
function parseFile(file) {
  const imports = [];
  const exports = [];
  const rawImportPaths = [];

  let code = '';
  try {
    code = fs.readFileSync(file.absolutePath, 'utf8');
  } catch {
    return { imports, exports, rawImportPaths };
  }

  const lang = file.language;

  try {
    if (lang === 'typescript') {
      parseWithTsParser(code, file.path, imports, exports, rawImportPaths);
    } else if (lang === 'javascript') {
      parseWithBabel(code, file.path, imports, exports, rawImportPaths);
    }
    // For other languages (python, go, etc.) use regex-based extraction
    else {
      parseWithRegex(code, file.language, imports, exports, rawImportPaths);
    }
  } catch {
    // If AST parsing fails, fall back to regex
    try {
      parseWithRegex(code, file.language, imports, exports, rawImportPaths);
    } catch {
      // silent fail
    }
  }

  return { imports, exports, rawImportPaths };
}

function parseWithBabel(code, filePath, imports, exports, rawImportPaths) {
  const parser = getBabelParser();
  let ast;

  // Try different source types
  for (const sourceType of ['module', 'script']) {
    try {
      ast = parser.parse(code, {
        sourceType,
        plugins: ['jsx', 'classProperties', 'decorators-legacy', 'dynamicImport', 'optionalChaining', 'nullishCoalescingOperator'],
        errorRecovery: true,
      });
      break;
    } catch {
      // try next
    }
  }

  if (!ast) return;
  extractFromBabelAst(ast, imports, exports, rawImportPaths);
}

function parseWithTsParser(code, filePath, imports, exports, rawImportPaths) {
  const parser = getTsParser();
  try {
    const ast = parser.parse(code, {
      jsx: filePath.endsWith('.tsx') || filePath.endsWith('.jsx'),
      range: false,
      loc: false,
      tokens: false,
      comment: false,
    });
    extractFromEstreeAst(ast, imports, exports, rawImportPaths);
  } catch {
    // Fall back to babel
    parseWithBabel(code, filePath, imports, exports, rawImportPaths);
  }
}

function extractFromBabelAst(ast, imports, exports, rawImportPaths) {
  if (!ast || !ast.program || !ast.program.body) return;

  for (const node of ast.program.body) {
    // Import declarations: import X from './x'
    if (node.type === 'ImportDeclaration' && node.source) {
      const src = node.source.value;
      imports.push(src);
      rawImportPaths.push({ path: src, isDynamic: false });
    }

    // Export declarations
    if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
      if (node.declaration) {
        const decl = node.declaration;
        if (decl.id) exports.push(decl.id.name);
        if (decl.declarations) {
          for (const d of decl.declarations) {
            if (d.id?.name) exports.push(d.id.name);
          }
        }
      }
      if (node.specifiers) {
        for (const spec of node.specifiers) {
          if (spec.exported?.name) exports.push(spec.exported.name);
        }
      }
      // Re-exports: export { X } from './y'
      if (node.source) {
        rawImportPaths.push({ path: node.source.value, isDynamic: false });
      }
    }

    // Dynamic imports: import('./x')
    if (node.type === 'ExpressionStatement') {
      extractDynamicImports(node, rawImportPaths);
    }
  }
}

function extractFromEstreeAst(ast, imports, exports, rawImportPaths) {
  // Same logic but for ESTree-compatible ASTs (TS parser output)
  extractFromBabelAst({ program: ast }, imports, exports, rawImportPaths);
}

function extractDynamicImports(node, rawImportPaths) {
  // Recursively look for import() calls
  const str = JSON.stringify(node);
  const matches = str.matchAll(/"type":"ImportExpression"[^}]*"value":"([^"]+)"/g);
  for (const m of matches) {
    rawImportPaths.push({ path: m[1], isDynamic: true });
  }
}

function parseWithRegex(code, language, imports, exports, rawImportPaths) {
  if (language === 'python') {
    const importMatches = code.matchAll(/^(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm);
    for (const m of importMatches) {
      const src = (m[1] || m[2]).replace(/\./g, '/');
      imports.push(src);
      rawImportPaths.push({ path: src, isDynamic: false });
    }
    const defMatches = code.matchAll(/^def\s+(\w+)|^class\s+(\w+)/gm);
    for (const m of defMatches) {
      exports.push(m[1] || m[2]);
    }
  } else if (language === 'go') {
    const importMatches = code.matchAll(/"([^"]+)"/g);
    for (const m of importMatches) {
      if (m[1].includes('/')) {
        imports.push(m[1]);
        rawImportPaths.push({ path: m[1], isDynamic: false });
      }
    }
    const funcMatches = code.matchAll(/^func\s+(\w+)/gm);
    for (const m of funcMatches) exports.push(m[1]);
  } else {
    // Generic: look for require() and import statements
    const reqMatches = code.matchAll(/require\(['"]([^'"]+)['"]\)/g);
    for (const m of reqMatches) {
      imports.push(m[1]);
      rawImportPaths.push({ path: m[1], isDynamic: false });
    }
  }
}

/**
 * Try to resolve a relative import path to a known file ID.
 */
function resolveImport(rawImport, fromFilePath, pathToId) {
  if (!rawImport.path.startsWith('.')) return null; // skip node_modules

  const fromDir = path.dirname(fromFilePath);
  const resolved = path.join(fromDir, rawImport.path).replace(/\\/g, '/');

  // Try exact match first
  if (pathToId.has(resolved)) return pathToId.get(resolved);

  // Try with extensions
  for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mjs']) {
    const withExt = resolved + ext;
    if (pathToId.has(withExt)) return pathToId.get(withExt);
  }

  // Try index file in directory
  for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
    const indexPath = resolved + '/index' + ext;
    if (pathToId.has(indexPath)) return pathToId.get(indexPath);
  }

  return null;
}

function isEntryPoint(filePath) {
  const name = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const dir = filePath.toLowerCase();
  return (
    name === 'index' ||
    name === 'main' ||
    name === 'app' ||
    name === 'server' ||
    name === 'entry' ||
    dir.includes('/pages/') ||
    dir.includes('/routes/')
  );
}

module.exports = { runStaticAnalysis };
