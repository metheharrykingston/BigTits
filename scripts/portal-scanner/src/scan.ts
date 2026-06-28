#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { buildScanReport } from './draft-adapter.js';
import { extractPage } from './extract-page.js';
import type { PageSnapshot, ScanTarget } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TARGETS_DIR = path.join(ROOT, 'targets');
const DEFAULT_OUTPUT = path.join(ROOT, 'output');

interface CliOptions {
  target?: string;
  url?: string;
  headed: boolean;
  interactive: boolean;
  storageState?: string;
  output: string;
  timeout: number;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    headed: true,
    interactive: false,
    output: DEFAULT_OUTPUT,
    timeout: 120_000,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--target':
        opts.target = argv[++i];
        break;
      case '--url':
        opts.url = argv[++i];
        break;
      case '--headed':
        opts.headed = true;
        break;
      case '--headless':
        opts.headed = false;
        break;
      case '--interactive':
      case '-i':
        opts.interactive = true;
        break;
      case '--storage-state':
        opts.storageState = argv[++i];
        break;
      case '--output':
      case '-o':
        opts.output = path.resolve(argv[++i]);
        break;
      case '--timeout':
        opts.timeout = Number(argv[++i]) * 1000;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        break;
    }
  }

  return opts;
}

function printHelp(): void {
  console.log(`Gov Copilot Portal Scanner

Usage:
  npm run scan -- --target edistrict_delhi_income --interactive
  npm run scan -- --url https://example.gov.in/form --target edistrict_delhi_income

Options:
  --target <id>         Load targets/<id>.json
  --url <url>           Override start URL (single-page mode without --interactive)
  --interactive, -i     Headed session: snapshot pages manually (s=scan, q=quit)
  --storage-state <p>   Playwright storage state JSON (saved login)
  --output, -o <dir>    Output directory (default: scripts/portal_scanner/output)
  --headed              Show browser (default)
  --headless            Headless mode
  --timeout <sec>       Navigation timeout (default: 120)

After scan:
  python3 adapter_diff.py --draft output/<id>/draft_adapter.json
  python3 validate_adapter.py output/<id>/draft_adapter.json
`);
}

function loadTarget(id: string): ScanTarget {
  const file = path.join(TARGETS_DIR, `${id}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Target not found: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as ScanTarget;
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeOutputs(outDir: string, targetId: string, report: ReturnType<typeof buildScanReport>): void {
  ensureDir(outDir);

  const adapterForReview = { ...report.draft_adapter };
  fs.writeFileSync(path.join(outDir, 'scan_report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'draft_adapter.json'), JSON.stringify(adapterForReview, null, 2));

  const productionAdapter = { ...adapterForReview };
  delete (productionAdapter as { _meta?: unknown })._meta;
  fs.writeFileSync(
    path.join(outDir, `${targetId}_adapter.json`),
    JSON.stringify(productionAdapter, null, 2),
  );

  console.log('\n--- OUTPUT ---');
  console.log(`scan_report.json     → ${path.join(outDir, 'scan_report.json')}`);
  console.log(`draft_adapter.json   → ${path.join(outDir, 'draft_adapter.json')}`);
  console.log(`production adapter   → ${path.join(outDir, `${targetId}_adapter.json`)}`);
  console.log(`\nSeverity: ${report.severity.total}/25 (${report.severity.priority})`);
  console.log(`Steps: ${report.draft_adapter.steps.length}`);
  console.log(`Unmapped fields: ${report.draft_adapter._meta.unmapped_fields.length}`);
  console.log(`Unmapped uploads: ${report.draft_adapter._meta.unmapped_uploads.length}`);
}

async function waitForSnapshot(): Promise<'scan' | 'quit'> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    console.log('\n[s] Snapshot this page  |  [q] Finish scan and generate adapter');
    rl.question('> ', (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      resolve(a === 'q' || a === 'quit' ? 'quit' : 'scan');
    });
  });
}

async function interactiveSession(
  startUrl: string,
  opts: CliOptions,
): Promise<PageSnapshot[]> {
  const browser = await chromium.launch({ headless: !opts.headed });
  const context = await browser.newContext(
    opts.storageState ? { storageState: opts.storageState } : {},
  );
  const page = await context.newPage();
  page.setDefaultTimeout(opts.timeout);

  const pages: PageSnapshot[] = [];
  console.log(`Opening ${startUrl}`);
  await page.goto(startUrl, { waitUntil: 'domcontentloaded' });

  if (opts.storageState) {
    console.log(`Loaded storage state: ${opts.storageState}`);
  }

  console.log('\n=== INTERACTIVE SCAN ===');
  console.log('Log in and navigate to each form page in the browser.');
  console.log('Return here and press s to snapshot the current page.');

  let running = true;
  while (running) {
    const action = await waitForSnapshot();
    if (action === 'quit') {
      running = false;
      break;
    }

    try {
      const snapshot = await extractPage(page, pages.length);
      pages.push(snapshot);
      console.log(
        `Snapshot #${snapshot.index}: ${snapshot.phase} | ${snapshot.fields.length} fields, ${snapshot.uploads.length} uploads | ${snapshot.url}`,
      );
      if (snapshot.pause_triggers.length) {
        console.log(`  Pause triggers: ${snapshot.pause_triggers.join(', ')}`);
      }
    } catch (err) {
      console.error('Snapshot failed:', err instanceof Error ? err.message : err);
    }
  }

  await browser.close();
  return pages;
}

async function singlePageScan(url: string, opts: CliOptions): Promise<PageSnapshot[]> {
  const browser = await chromium.launch({ headless: !opts.headed });
  const context = await browser.newContext(
    opts.storageState ? { storageState: opts.storageState } : {},
  );
  const page = await context.newPage();
  page.setDefaultTimeout(opts.timeout);

  console.log(`Scanning ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const snapshot = await extractPage(page, 0);
  await browser.close();
  return [snapshot];
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.target && !opts.url) {
    printHelp();
    process.exit(1);
  }

  const target = opts.target ? loadTarget(opts.target) : null;
  const targetId = target?.id ?? 'ad_hoc';
  const startUrl = opts.url ?? target!.start_url;

  if (!target && !opts.url) {
    throw new Error('--target or --url required');
  }

  const scanTarget: ScanTarget = target ?? {
    id: 'ad_hoc',
    portal_id: 'unknown',
    service_id: 'unknown',
    adapter_version: 'draft_v1',
    start_url: startUrl,
    allowed_hosts: [new URL(startUrl).hostname],
  };

  let pages: PageSnapshot[];
  if (opts.interactive) {
    pages = await interactiveSession(startUrl, opts);
  } else {
    const urls = [startUrl, ...(scanTarget.extra_urls ?? [])];
    pages = [];
    for (const url of urls) {
      const batch = await singlePageScan(url, opts);
      for (const p of batch) {
        pages.push({ ...p, index: pages.length });
      }
    }
  }

  if (pages.length === 0) {
    console.error('No pages captured. Use --interactive and snapshot at least one form page.');
    process.exit(1);
  }

  const report = buildScanReport(scanTarget, pages);
  const outDir = path.join(opts.output, targetId);
  writeOutputs(outDir, targetId, report);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});