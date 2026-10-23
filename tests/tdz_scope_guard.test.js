import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import * as parser from '@babel/parser';

function getAllSourceFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllSourceFiles(fullPath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

/**
 * Scan AST for Temporal Dead Zone (TDZ) violations:
 * In a block or function body, if a const/let is declared, it must not be referenced
 * in the initializer of an earlier statement in the same scope.
 */
function findTdzViolations(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx']
    });
  } catch (err) {
    return [{ file: filePath, message: 'Parse error: ' + err.message }];
  }

  const violations = [];

  function checkScopeBody(bodyStatements) {
    if (!Array.isArray(bodyStatements)) return;

    // Collect all lexical declarations (const/let) and their statement index
    const lexicalDecls = new Map(); // name -> statementIndex

    bodyStatements.forEach((stmt, idx) => {
      if (stmt.type === 'VariableDeclaration' && (stmt.kind === 'const' || stmt.kind === 'let')) {
        for (const decl of stmt.declarations) {
          if (decl.id.type === 'Identifier') {
            lexicalDecls.set(decl.id.name, idx);
          } else if (decl.id.type === 'ArrayPattern') {
            for (const elem of decl.id.elements) {
              if (elem && elem.type === 'Identifier') {
                lexicalDecls.set(elem.name, idx);
              }
            }
          } else if (decl.id.type === 'ObjectPattern') {
            for (const prop of decl.id.properties) {
              if (prop.type === 'ObjectProperty' && prop.value.type === 'Identifier') {
                lexicalDecls.set(prop.value.name, idx);
              }
            }
          }
        }
      }
    });

    // Check if any statement accesses a lexical decl declared in a LATER statement
    bodyStatements.forEach((stmt, stmtIdx) => {
      function traverseExpr(node, parent) {
        if (!node || typeof node !== 'object') return;
        // Do not traverse into inner functions because they execute asynchronously or on event
        if (
          node.type === 'FunctionDeclaration' ||
          node.type === 'FunctionExpression' ||
          node.type === 'ArrowFunctionExpression'
        ) {
          return;
        }

        if (node.type === 'Identifier') {
          // Ignore member expression properties (e.g. obj.propName)
          if (parent && parent.type === 'MemberExpression' && !parent.computed && parent.property === node) {
            return;
          }
          // Ignore object property keys (e.g. { key: value })
          if (parent && parent.type === 'ObjectProperty' && parent.key === node && !parent.computed) {
            return;
          }

          const declIdx = lexicalDecls.get(node.name);
          if (declIdx !== undefined && declIdx > stmtIdx) {
            violations.push({
              filePath,
              line: node.loc?.start?.line,
              col: node.loc?.start?.column,
              identifier: node.name,
              usedAtStatement: stmtIdx,
              declaredAtStatement: declIdx,
              message: `Variable '${node.name}' used at line ${node.loc?.start?.line} before its declaration at statement ${declIdx} (TDZ Violation)`
            });
          }
        }

        for (const key of Object.keys(node)) {
          if (key === 'loc' || key === 'comments') continue;
          const child = node[key];
          if (Array.isArray(child)) {
            child.forEach(c => traverseExpr(c, node));
          } else if (child && typeof child === 'object') {
            traverseExpr(child, node);
          }
        }
      }

      // Check RHS and expressions in this statement
      if (stmt.type === 'VariableDeclaration') {
        for (const decl of stmt.declarations) {
          if (decl.init) traverseExpr(decl.init, decl);
        }
      } else if (stmt.type === 'ExpressionStatement') {
        traverseExpr(stmt.expression, stmt);
      }
    });

    // Recursively check inner functions/blocks
    bodyStatements.forEach((stmt) => {
      function traverseInner(node) {
        if (!node || typeof node !== 'object') return;
        if (
          (node.type === 'FunctionDeclaration' ||
            node.type === 'FunctionExpression' ||
            node.type === 'ArrowFunctionExpression') &&
          node.body
        ) {
          if (node.body.type === 'BlockStatement') {
            checkScopeBody(node.body.body);
          }
        } else if (node.type === 'BlockStatement' && Array.isArray(node.body)) {
          checkScopeBody(node.body);
        }
        for (const key of Object.keys(node)) {
          if (key === 'loc' || key === 'comments') continue;
          const child = node[key];
          if (Array.isArray(child)) child.forEach(traverseInner);
          else if (child && typeof child === 'object') traverseInner(child);
        }
      }
      traverseInner(stmt);
    });
  }

  if (ast.program && Array.isArray(ast.program.body)) {
    checkScopeBody(ast.program.body);
  }

  return violations;
}

describe('Static TDZ & Lexical Scope Guard Suite', () => {
  it('BottomNav.jsx must not have any TDZ violations', () => {
    const bottomNavPath = path.resolve('src/components/common/BottomNav.jsx');
    const violations = findTdzViolations(bottomNavPath);
    assert.deepStrictEqual(violations, [], `Found TDZ violations in BottomNav.jsx: ${JSON.stringify(violations, null, 2)}`);
  });

  it('All core src/ components must have zero TDZ violations', () => {
    const allFiles = getAllSourceFiles(path.resolve('src'));
    const allViolations = [];
    for (const f of allFiles) {
      const v = findTdzViolations(f);
      if (v.length > 0) {
        allViolations.push(...v);
      }
    }
    assert.deepStrictEqual(
      allViolations,
      [],
      `Found TDZ violations across src: ${JSON.stringify(allViolations, null, 2)}`
    );
  });
});
