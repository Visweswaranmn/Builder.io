import { ProjectModel } from '../models/project.model.js';
import { EmployeeModel } from '../models/employee.model.js';
import { TaskModel } from '../models/task.model.js';
import { MaterialModel } from '../models/material.model.js';
import { ExpenseModel } from '../models/expense.model.js';

const ACTIVE_PROJECT_STATUSES = ['planning', 'in_progress', 'on_hold'];
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface DashboardSummary {
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

/** Builds the 6-month window (oldest first) ending at the current month. */
function lastSixMonths(): { year: number; month: number }[] {
  const now = new Date();
  const months: { year: number; month: number }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return months;
}

async function getCards(): Promise<DashboardSummary['cards']> {
  const [activeProjects, totalEmployees, pendingTasks, budgetAgg, expenseAgg] = await Promise.all([
    ProjectModel.countDocuments({ status: { $in: ACTIVE_PROJECT_STATUSES } }),
    EmployeeModel.countDocuments({ isActive: true }),
    TaskModel.countDocuments({ status: { $ne: 'completed' } }),
    ProjectModel.aggregate<{ total: number }>([
      { $group: { _id: null, total: { $sum: '$budget' } } },
    ]),
    ExpenseModel.aggregate<{ total: number }>([
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  return {
    activeProjects,
    totalEmployees,
    pendingTasks,
    totalBudget: budgetAgg[0]?.total ?? 0,
    totalExpenses: expenseAgg[0]?.total ?? 0,
  };
}

async function getProjectProgress(): Promise<DashboardSummary['charts']['projectProgress']> {
  const projects = await ProjectModel.find({}, 'name progress status')
    .sort({ createdAt: -1 })
    .limit(8);
  return projects.map((p) => ({ name: p.name, progress: p.progress ?? 0, status: p.status ?? 'planning' }));
}

async function getMonthlyExpenses(): Promise<DashboardSummary['charts']['monthlyExpenses']> {
  const months = lastSixMonths();
  const rangeStart = new Date(months[0].year, months[0].month - 1, 1);

  const rows = await ExpenseModel.aggregate<{ _id: { year: number; month: number }; total: number }>([
    { $match: { date: { $gte: rangeStart } } },
    {
      $group: {
        _id: { year: { $year: '$date' }, month: { $month: '$date' } },
        total: { $sum: '$amount' },
      },
    },
  ]);

  const totalsByKey = new Map(rows.map((r) => [`${r._id.year}-${r._id.month}`, r.total]));

  return months.map(({ year, month }) => ({
    month: MONTH_LABELS[month - 1],
    total: totalsByKey.get(`${year}-${month}`) ?? 0,
  }));
}

async function getMaterialUsage(): Promise<DashboardSummary['charts']['materialUsage']> {
  return MaterialModel.aggregate<{ name: string; unit: string; used: number }>([
    { $unwind: '$transactions' },
    { $match: { 'transactions.type': 'out' } },
    {
      $group: {
        _id: '$name',
        unit: { $first: '$unit' },
        used: { $sum: '$transactions.quantity' },
      },
    },
    { $project: { _id: 0, name: '$_id', unit: 1, used: 1 } },
    { $sort: { used: -1 } },
    { $limit: 5 },
  ]);
}

export async function getSummary(): Promise<DashboardSummary> {
  const [cards, projectProgress, monthlyExpenses, materialUsage] = await Promise.all([
    getCards(),
    getProjectProgress(),
    getMonthlyExpenses(),
    getMaterialUsage(),
  ]);

  return { cards, charts: { projectProgress, monthlyExpenses, materialUsage } };
}
