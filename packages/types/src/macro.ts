export interface MacroExecutionResult {
  macroName: string;
  success: boolean;
  isDryRun?: boolean;
  stepResults: Array<{
    stepId: string;
    action: string;
    status: number;
    data: any;
  }>;
  finalData: any;
  errorMessage?: string;
}
