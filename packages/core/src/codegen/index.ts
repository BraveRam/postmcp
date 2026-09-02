import { NormalizedSpec, GeneratedProject } from '@postmcp/types';
import { generatePythonProject } from './python.js';
import { generateTypeScriptProject } from './typescript.js';

export { generatePythonProject, generateTypeScriptProject };
export type { GeneratedProject };

export interface GenerateProjectOptions {
  target?: 'python' | 'typescript' | 'py' | 'ts';
  baseUrl?: string;
}

export function generateProject(
  spec: NormalizedSpec,
  options: GenerateProjectOptions = {}
): GeneratedProject {
  const target = (options.target || 'typescript').toLowerCase();
  if (target === 'python' || target === 'py') {
    return generatePythonProject(spec);
  }
  return generateTypeScriptProject(spec);
}
