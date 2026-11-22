// Warm route code without rendering any protected component before authorization.
const screens:Record<string,()=>Promise<unknown>>={
 '/admin/dashboard':()=>import('@/components/portal/features/admin/pages/Dashboard'),
 '/admin/legacy-operations':()=>import('@/components/portal/features/operations/OperationsWorkspace'),
 '/admin/operations-data':()=>import('@/components/portal/features/admin/pages/OperationsData'),
 '/admin/profile/me':()=>import('@/components/portal/features/admin/pages/Profile'),
 '/admin/profiles':()=>import('@/components/portal/features/admin/pages/Profiles'),
 '/admin/projects':()=>import('@/components/portal/features/admin/pages/Projects'),
 '/controller/audit':()=>import('@/components/portal/features/controller/pages/Audit'),
 '/controller/configuration':()=>import('@/components/portal/features/controller/pages/Configuration'),
 '/controller/cpe-db':()=>import('@/components/portal/features/controller/pages/EquipmentDatabase'),
 '/controller/inventory':()=>import('@/components/portal/features/controller/pages/Inventory'),
 '/controller/legacy-operations':()=>import('@/components/portal/features/operations/OperationsWorkspace'),
 '/controller/ont-db':()=>import('@/components/portal/features/controller/pages/EquipmentDatabase'),
 '/controller/projects':()=>import('@/components/portal/features/controller/pages/Projects'),
 '/technician/assurance-form/[ticketId]':()=>import('@/components/portal/features/technician/components/ServiceDeliveryForm'),
 '/technician/delivery-form/[orderId]':()=>import('@/components/portal/features/technician/components/DeliveryForm'),
 '/technician/submitted':()=>import('@/components/portal/features/technician/pages/AssuranceTasks'),
 '/technician/todo':()=>import('@/components/portal/features/technician/pages/AssuranceTasks'),
};
export function warmRoute(path:string){
 const key=path.replace(/^(\/technician\/(?:assurance|delivery)-form)\/[^/]+$/,(match,base)=>base+(base.endsWith('assurance-form')?'/[ticketId]':'/[orderId]'));
 void screens[key]?.().catch(()=>{/* The page boundary handles a failed chunk when rendered. */});
}
