import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// AST Parsers — loaded lazily to save memory if not needed
let babelParser = null;
let tsParser = null;

async function getBabelParser() {
  if (!babelParser) babelParser = await import('@babel/parser');
  return babelParser.default || babelParser;
}

async function getTsParser() {
  if (!tsParser) tsParser = await import('@typescript-eslint/parser');
  return tsParser.default || tsParser;
}

export async function runStaticAnalysis(files, onProgress) {
  onProgress(15, 'Starting AST analysis…');

  const total = files.length;
  const analyzed = [];
  const pathToId = new Map();

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

      const result = await parseFile(file);
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
  const edges = [];
  const fanInCounts = new Map();

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

  for (const file of analyzed) {
    file.fan_in = fanInCounts.get(file.id) || 0;
    file.fan_out = edges.filter((e) => e.source === file.id).length;
    file.importance = file.fan_in * 3 + file.fan_out;
  }

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

  const graphEdges = edges.filter((e) => topIds.has(e.source) && topIds.has(e.target));

  onProgress(50, `Graph built: ${graphNodes.length} nodes, ${graphEdges.length} edges`);

  return {
    analyzedFiles: analyzed,
    graphJson: { nodes: graphNodes, edges: graphEdges },
    pathToId,
  };
}

async function parseFile(file) {
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
      await parseWithTsParser(code, file.path, imports, exports, rawImportPaths);
    } else if (lang === 'javascript') {
      await parseWithBabel(code, file.path, imports, exports, rawImportPaths);
    } else {
      parseWithRegex(code, file.language, imports, exports, rawImportPaths);
    }
  } catch {
    try {
      parseWithRegex(code, file.language, imports, exports, rawImportPaths);
    } catch {
      // ignore
    }
  }

  return { imports, exports, rawImportPaths };
}

async function parseWithBabel(code, filePath, imports, exports, rawImportPaths) {
  const parser = await getBabelParser();
  let ast;

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

async function parseWithTsParser(code, filePath, imports, exports, rawImportPaths) {
  const parser = await getTsParser();
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
    await parseWithBabel(code, filePath, imports, exports, rawImportPaths);
  }
}

function extractFromBabelAst(ast, imports, exports, rawImportPaths) {
  if (!ast || !ast.program || !ast.program.body) return;

  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration' && node.source) {
      const src = node.source.value;
      imports.push(src);
      rawImportPaths.push({ path: src, isDynamic: false });
    }

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
      if (node.source) {
        rawImportPaths.push({ path: node.source.value, isDynamic: false });
      }
    }

    if (node.type === 'ExpressionStatement') {
      extractDynamicImports(node, rawImportPaths);
    }
  }
}

function extractFromEstreeAst(ast, imports, exports, rawImportPaths) {
  extractFromBabelAst({ program: ast }, imports, exports, rawImportPaths);
}

function extractDynamicImports(node, rawImportPaths) {
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
    const reqMatches = code.matchAll(/require\(['"]([^'"]+)['"]\)/g);
    for (const m of reqMatches) {
      imports.push(m[1]);
      rawImportPaths.push({ path: m[1], isDynamic: false });
    }
  }
}

function resolveImport(rawImport, fromFilePath, pathToId) {
  if (!rawImport.path.startsWith('.')) return null;

  const fromDir = path.dirname(fromFilePath);
  const resolved = path.join(fromDir, rawImport.path).replace(/\\/g, '/');

  if (pathToId.has(resolved)) return pathToId.get(resolved);

  for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mjs']) {
    const withExt = resolved + ext;
    if (pathToId.has(withExt)) return pathToId.get(withExt);
  }

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
