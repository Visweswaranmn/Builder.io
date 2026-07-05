export interface DashboardSummary {
  cards: {
    activeProjects: number;
    totalEmployees: number;
    totalBudget: number;
    totalExpenses: number;
    pendingTasks: number;
  };
  charts: {
    projectProgress: { name: string; progress: number; status: string }[];
    monthlyExpenses: { month: string; total: number }[];
    materialUsage: { name: string; unit: string; used: number }[];
  };
}
