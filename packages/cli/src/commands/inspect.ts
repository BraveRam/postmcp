import { parseOpenAPI } from '@postmcp/core';
import { resolvePresetSpec } from '../presets/index.js';
import Table from 'cli-table3';
import pc from 'picocolors';

export interface InspectCommandOptions {
  json?: boolean;
}

export async function inspectCommand(specArg: string, options: InspectCommandOptions): Promise<void> {
  let specPath = specArg;
  if (!specPath) {
    console.error(pc.red('Error: No OpenAPI spec provided. Usage: postmcp inspect <spec-path-or-url-or-@preset>'));
    process.exit(1);
  }

  if (specPath.startsWith('@')) {
    try {
      specPath = await resolvePresetSpec(specPath);
    } catch (err: any) {
      console.error(pc.red(`Error resolving preset: ${err.message}`));
      process.exit(1);
    }
  }

  let spec;
  try {
    spec = await parseOpenAPI(specPath);
  } catch (err: any) {
    console.error(pc.red(`Failed to parse specification: ${err.message}`));
    process.exit(1);
  }

  if (options.json) {
    console.log(JSON.stringify(spec, null, 2));
    return;
  }

  // Header Banner
  console.log();
  console.log(pc.bold(pc.cyan(`⚡ PostMCP API Inspection: ${spec.title} (v${spec.version})`)));
  if (spec.description) {
    console.log(pc.dim(spec.description.slice(0, 120) + (spec.description.length > 120 ? '...' : '')));
  }
  console.log();

  // 1. Overview Table
  const overviewTable = new Table({
    head: [pc.bold('Metric'), pc.bold('Value')],
    colWidths: [25, 55],
  });

  const totalOps = spec.operations.length;
  const methodsCount: Record<string, number> = {};
  const riskCounts = { READ_ONLY: 0, MUTATION: 0, CRITICAL: 0 };

  for (const op of spec.operations) {
    const m = op.method.toUpperCase();
    methodsCount[m] = (methodsCount[m] || 0) + 1;
    riskCounts[op.riskTier] = (riskCounts[op.riskTier] || 0) + 1;
  }

  const methodsStr = Object.entries(methodsCount)
    .map(([m, c]) => `${m}: ${c}`)
    .join(' | ');

  const defaultUrl = spec.servers.length > 0 ? spec.servers[0].url : 'None declared';
  const secSchemes = Object.keys(spec.securitySchemes).join(', ') || 'None declared';
  const recommendedJit = totalOps > 20 ? pc.green('Yes (Dynamic JIT routing recommended)') : pc.blue('No (Static direct tools)');

  overviewTable.push(
    ['Total Endpoints', `${totalOps} operations`],
    ['HTTP Methods', methodsStr],
    ['Base URL', defaultUrl],
    ['Security Schemes', secSchemes],
    ['JIT Router Mode', recommendedJit],
    ['Macros / Workflows', `${spec.macros?.length || 0} composite macros`]
  );

  console.log(overviewTable.toString());
  console.log();

  // 2. Risk Tiers Breakdown
  console.log(pc.bold('🛡️ Safety & Risk Tier Breakdown:'));
  console.log(`  ${pc.green('● READ_ONLY')}:  ${riskCounts.READ_ONLY} endpoints (Safe for autonomous exploration)`);
  console.log(`  ${pc.yellow('● MUTATION')}:   ${riskCounts.MUTATION} endpoints (Creates or updates data)`);
  console.log(`  ${pc.red('● CRITICAL')}:   ${riskCounts.CRITICAL} endpoints (Destructive actions / simulated in dry-run)`);
  console.log();

  // 3. Sample Endpoints List
  console.log(pc.bold(`📋 Operations List (Showing first 10 of ${totalOps}):`));
  const opTable = new Table({
    head: [pc.bold('Tool Name (ID)'), pc.bold('Method'), pc.bold('Path'), pc.bold('Risk Tier')],
    colWidths: [22, 10, 32, 14],
  });

  const sampleOps = spec.operations.slice(0, 10);
  for (const op of sampleOps) {
    const tierColor =
      op.riskTier === 'READ_ONLY' ? pc.green(op.riskTier) : op.riskTier === 'CRITICAL' ? pc.red(op.riskTier) : pc.yellow(op.riskTier);
    opTable.push([op.id, op.method.toUpperCase(), op.path, tierColor]);
  }

  console.log(opTable.toString());
  if (totalOps > 10) {
    console.log(pc.dim(`  ... and ${totalOps - 10} more endpoints.`));
  }
  console.log();
}
