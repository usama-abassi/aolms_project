import {ProtectedRoute} from '@/components/portal/auth/components/ProtectedRoute';
import AdminLayout from '@/components/portal/features/admin/layout/AdminLayout';
export default function Layout({children}:{children:React.ReactNode}){return <AdminLayout><ProtectedRoute>{children}</ProtectedRoute></AdminLayout>;}
