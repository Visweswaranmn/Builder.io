import { Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Dashboard from '@/pages/Dashboard';
import NotFound from '@/pages/NotFound';

import ProjectsList from '@/pages/projects/ProjectsList';
import ProjectForm from '@/pages/projects/ProjectForm';

import EmployeesList from '@/pages/employees/EmployeesList';
import EmployeeForm from '@/pages/employees/EmployeeForm';
import EmployeeDetail from '@/pages/employees/EmployeeDetail';

import TasksList from '@/pages/tasks/TasksList';
import TaskForm from '@/pages/tasks/TaskForm';

import MaterialsList from '@/pages/materials/MaterialsList';
import MaterialForm from '@/pages/materials/MaterialForm';
import MaterialDetail from '@/pages/materials/MaterialDetail';

import VendorsList from '@/pages/vendors/VendorsList';
import VendorForm from '@/pages/vendors/VendorForm';
import VendorDetail from '@/pages/vendors/VendorDetail';

import ExpensesList from '@/pages/expenses/ExpensesList';
import ExpenseForm from '@/pages/expenses/ExpenseForm';

import InvoicesList from '@/pages/invoices/InvoicesList';
import InvoiceForm from '@/pages/invoices/InvoiceForm';
import InvoiceDetail from '@/pages/invoices/InvoiceDetail';

import NotificationsPage from '@/pages/notifications/NotificationsPage';
import ReportsPage from '@/pages/reports/ReportsPage';

import DailyReportsList from '@/pages/dailyReports/DailyReportsList';
import DailyReportForm from '@/pages/dailyReports/DailyReportForm';
import DailyReportDetail from '@/pages/dailyReports/DailyReportDetail';

import UsersList from '@/pages/users/UsersList';
import UserForm from '@/pages/users/UserForm';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<Dashboard />} />

          <Route path="projects" element={<ProjectsList />} />
          <Route path="projects/new" element={<ProjectForm />} />
          <Route path="projects/:id" element={<ProjectForm />} />

          <Route path="employees" element={<EmployeesList />} />
          <Route path="employees/new" element={<EmployeeForm />} />
          <Route path="employees/:id" element={<EmployeeDetail />} />
          <Route path="employees/:id/edit" element={<EmployeeForm />} />

          <Route path="tasks" element={<TasksList />} />
          <Route path="tasks/new" element={<TaskForm />} />
          <Route path="tasks/:id/edit" element={<TaskForm />} />

          <Route path="materials" element={<MaterialsList />} />
          <Route path="materials/new" element={<MaterialForm />} />
          <Route path="materials/:id" element={<MaterialDetail />} />
          <Route path="materials/:id/edit" element={<MaterialForm />} />

          <Route path="vendors" element={<VendorsList />} />
          <Route path="vendors/new" element={<VendorForm />} />
          <Route path="vendors/:id" element={<VendorDetail />} />
          <Route path="vendors/:id/edit" element={<VendorForm />} />

          <Route path="expenses" element={<ExpensesList />} />
          <Route path="expenses/new" element={<ExpenseForm />} />
          <Route path="expenses/:id/edit" element={<ExpenseForm />} />

          <Route path="invoices" element={<InvoicesList />} />
          <Route path="invoices/new" element={<InvoiceForm />} />
          <Route path="invoices/:id" element={<InvoiceDetail />} />
          <Route path="invoices/:id/edit" element={<InvoiceForm />} />

          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="reports" element={<ReportsPage />} />

          <Route path="daily-reports" element={<DailyReportsList />} />
          <Route path="daily-reports/new" element={<DailyReportForm />} />
          <Route path="daily-reports/:id" element={<DailyReportDetail />} />

          <Route path="users" element={<UsersList />} />
          <Route path="users/new" element={<UserForm />} />
          <Route path="users/:id/edit" element={<UserForm />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
