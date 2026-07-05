export function isExaminerDemoMode(demo: string | undefined): boolean {
  return demo?.trim().toLowerCase() === "exam";
}
