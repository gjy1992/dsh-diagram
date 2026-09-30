import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { validateArchSpec, formatDiagnostic, type Diagnostic } from '@dsh-diagram/schema';
import { renderArchitecture } from './render';

interface CliOptions {
  output: string;
}

const USAGE = `dsh-diagram CLI

用法：
  dsh-diagram validate <spec.yaml>              校验 YAML 规格，输出结构化诊断
  dsh-diagram build <spec.yaml> [-o outdir]     渲染单个规格并产出 .drawio
  dsh-diagram build-all <dir> [-o outdir]       批量渲染目录下所有 .yaml

选项：
  -o, --out <dir>   产物输出目录，默认 out
`;

function parseArgs(argv: string[]): { positional: string[]; options: CliOptions } {
  const positional: string[] = [];
  const options: CliOptions = { output: 'out' };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '-o' || arg === '--out') {
      options.output = argv[index + 1] ?? options.output;
      index += 1;
    } else {
      positional.push(arg);
    }
  }

  return { positional, options };
}

function printDiagnostics(diagnostics: Diagnostic[]): void {
  console.error(`✖ ${diagnostics.length} 项校验错误：`);
  for (const diagnostic of diagnostics) {
    console.error(`  - [${diagnostic.code}] ${diagnostic.path}: ${formatDiagnostic(diagnostic)}`);
  }
  console.error('ToolError 载荷（可直接回传 LLM）：');
  console.error(JSON.stringify(diagnostics, null, 2));
}

async function runValidate(file: string): Promise<boolean> {
  const source = await readFile(file, 'utf8');
  const result = validateArchSpec(source);
  if (!result.ok) {
    printDiagnostics(result.diagnostics);
    return false;
  }
  const { nodes, groups, edges } = result.spec;
  console.log(`✔ ${file}: ${nodes.length} nodes / ${groups.length} groups / ${edges.length} edges`);
  return true;
}

async function runBuild(file: string, options: CliOptions): Promise<boolean> {
  const source = await readFile(file, 'utf8');
  const startedAt = Date.now();
  const result = await renderArchitecture({ title: basename(file, extname(file)), yamlSpec: source });
  const elapsed = Date.now() - startedAt;

  if (!result.ok) {
    printDiagnostics(result.diagnostics);
    return false;
  }

  await mkdir(options.output, { recursive: true });
  const target = join(options.output, result.data.drawioFileName);
  await writeFile(target, result.data.drawioXml, 'utf8');
  console.log(`✔ ${file} -> ${target} (${elapsed} ms)`);
  return true;
}

async function runBuildAll(directory: string, options: CliOptions): Promise<boolean> {
  const entries = await readdir(directory);
  // 反例文件不参与构建（文件名含 invalid）
  const specs = entries
    .filter((entry) => /\.ya?ml$/i.test(entry) && !/invalid/i.test(entry))
    .sort();

  if (specs.length === 0) {
    console.error(`✖ ${directory} 下没有找到可用的 .yaml 规格`);
    return false;
  }

  let allPassed = true;
  for (const spec of specs) {
    const passed = await runBuild(join(directory, spec), options);
    allPassed = allPassed && passed;
  }
  return allPassed;
}

async function main(): Promise<void> {
  const { positional, options } = parseArgs(process.argv.slice(2));
  const [command, target] = positional;

  if (command === undefined || command === 'help' || command === '--help') {
    console.log(USAGE);
    return;
  }

  if (target === undefined) {
    console.error(`✖ 缺少目标文件参数\n\n${USAGE}`);
    process.exitCode = 1;
    return;
  }

  let passed: boolean;
  switch (command) {
    case 'validate':
      passed = await runValidate(target);
      break;
    case 'build':
      passed = await runBuild(target, options);
      break;
    case 'build-all':
      passed = await runBuildAll(target, options);
      break;
    default:
      console.error(`✖ 未知命令 '${command}'\n\n${USAGE}`);
      process.exitCode = 1;
      return;
  }

  if (!passed) {
    process.exitCode = 1;
  }
}

await main();