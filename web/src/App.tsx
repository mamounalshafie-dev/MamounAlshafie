import React, { Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, MetaProvider, ToastProvider, useAuth } from './lib/app-context';
import { ConfirmProvider } from './components/ui';
import { AppLayout } from './components/Layout';
import { PageSkeleton, Spinner } from './components/ui';
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Projects = React.lazy(() => import('./pages/Projects'));
const ProjectDetail = React.lazy(() => import('./pages/ProjectDetail'));
const Tasks = React.lazy(() => import('./pages/Tasks'));
const Timesheets = React.lazy(() => import('./pages/Timesheets'));
const Customers = React.lazy(() => import('./pages/Customers'));
const CustomerDetail = React.lazy(() => import('./pages/CustomerDetail'));
const Vendors = React.lazy(() => import('./pages/Vendors'));
const Quotations = React.lazy(() => import('./pages/Quotations'));
const Invoices = React.lazy(() => import('./pages/Invoices'));
const InvoiceDetail = React.lazy(() => import('./pages/InvoiceDetail'));
const PurchaseOrders = React.lazy(() => import('./pages/PurchaseOrders'));
const Inventory = React.lazy(() => import('./pages/Inventory'));
const ProductDetail = React.lazy(() => import('./pages/ProductDetail'));
const Accounting = React.lazy(() => import('./pages/Accounting'));
const Journal = React.lazy(() => import('./pages/Journal'));
const FinancialReports = React.lazy(() => import('./pages/FinancialReports'));
const Reports = React.lazy(() => import('./pages/Reports'));
const Employees = React.lazy(() => import('./pages/Employees'));
const EmployeeDetail = React.lazy(() => import('./pages/EmployeeDetail'));
const Attendance = React.lazy(() => import('./pages/Attendance'));
const Payroll = React.lazy(() => import('./pages/Payroll'));
const Leaves = React.lazy(() => import('./pages/Leaves'));
const ActivityLog = React.lazy(() => import('./pages/ActivityLog'));
const SettingsPage = React.lazy(() => import('./pages/Settings'));
const Profile = React.lazy(() => import('./pages/Profile'));
const NotFound = React.lazy(() => import('./pages/NotFound'));
import Login from './pages/Login';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg)' }}>
          <div className="card card-pad text-center" style={{ maxWidth: 460 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>⚠️</div>
            <h2 style={{ fontSize: 18 }}>حدث خطأ غير متوقع</h2>
            <p className="small muted mt-8" style={{ lineHeight: 1.8 }}>
              تعذّر عرض هذه الصفحة. يمكنك إعادة المحاولة أو العودة إلى لوحة التحكم.
            </p>
            <div className="row gap-12 mt-20" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => { window.location.href = '/'; }}>لوحة التحكم</button>
              <button className="btn" onClick={() => window.location.reload()}>إعادة المحاولة</button>
            </div>
            <pre className="tiny muted mt-16" style={{ direction: 'ltr', textAlign: 'left', overflow: 'auto', maxHeight: 120 }}>{String(this.state.error?.message || '')}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Splash() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 58, height: 58, borderRadius: 17, margin: '0 auto 18px',
          background: 'linear-gradient(135deg,#4f46e5,#0ea5e9)', display: 'grid', placeItems: 'center',
          boxShadow: '0 16px 36px -12px rgba(79,70,229,0.7)',
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <path d="M5 19V5l14 14V5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>نور ERP</div>
        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--brand-600)' }}><Spinner size={22} /></div>
      </div>
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <MetaProvider>
            <ErrorBoundary>
            <Suspense fallback={<Splash />}>
            <Routes>
              <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
              <Route element={<Protected><AppLayout /></Protected>}>
                <Route index element={<Dashboard />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/timesheets" element={<Timesheets />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/:id" element={<CustomerDetail />} />
                <Route path="/vendors" element={<Vendors />} />
                <Route path="/quotations" element={<Quotations />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/invoices/:id" element={<InvoiceDetail />} />
                <Route path="/purchase-orders" element={<PurchaseOrders />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/inventory/:id" element={<ProductDetail />} />
                <Route path="/accounting" element={<Accounting />} />
                <Route path="/accounting/journal" element={<Journal />} />
                <Route path="/accounting/reports" element={<FinancialReports />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/hr/employees" element={<Employees />} />
                <Route path="/hr/employees/:id" element={<EmployeeDetail />} />
                <Route path="/hr/attendance" element={<Attendance />} />
                <Route path="/hr/payroll" element={<Payroll />} />
                <Route path="/hr/leaves" element={<Leaves />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/activity" element={<ActivityLog />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
            </Suspense>
            </ErrorBoundary>
          </MetaProvider>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
