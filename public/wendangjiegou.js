/**
 * 生成目录结构的 Markdown 文件
 * @param {string} rootDir - 根目录路径
 * @param {string} outputFile - 输出的 Markdown 文件路径
 * 使用方法，在你要生成目录结构的目录下执行 node wendangjiegou.js
 */

const fs = require('fs');
const path = require('path');

const rootDir = process.argv[2] || process.cwd(); // 支持命令行指定路径
const outputFile = path.join(rootDir, 'directory_structure.md');

function generateTree(dir, prefix = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  let tree = '';

  entries.forEach((entry, index) => {
    const isLast = index === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const nextPrefix = prefix + (isLast ? '    ' : '│   ');
    const fullPath = path.join(dir, entry.name);

    tree += `${prefix}${connector}${entry.name}\n`;

    if (entry.isDirectory()) {
      tree += generateTree(fullPath, nextPrefix);
    }
  });

  return tree;
}

function generateMarkdown() {
  const title = `# 📁 ${path.basename(rootDir)} 目录结构\n\n`;
  const codeStart = '```\n';
  const codeEnd = '```\n';

  const tree = generateTree(rootDir);
  const content = `${title}${codeStart}${tree}${codeEnd}`;

  fs.writeFileSync(outputFile, content, 'utf-8');
  console.log(`✅ 目录结构已生成: ${outputFile}`);
}

generateMarkdown();
