// Headers and order from April 2026 Assurance sheet.xlsx. Final remarks - ANISA is excluded.
const controllerColumns=[
 ['date','Date '],['team','Team'],['controller','Controller'],['ticket_number','Ticket No'],['package','Package'],['exchange','Exchange'],['block','Block'],['road','Road'],['building','Bldg'],['flat','Flat'],
 ['fault_description','Fault Description from LO'],['mobile','Mobile'],['description','Description'],['service_type','Service Type (List)'],['lo_name','LO Name (List)'],['case_number','Case service reques number-Email'],
 ['creation_datetime','Creationdate/time'],['assigned_datetime','Assigned Date/Time'],['close_datetime','Close Date/Time'],['sla','SLA From creation time'],['kpi','KPI Status (Automated)'],['exceeded_reason','Reason (If Exceeded)'],
 ['circuit','Circuit'],['status','Status'],['root_cause','Root Cause'],['resolution','Resolution (List)'],['resolution_description','Resolution Description'],['non_genuine','Non-Genuine Ticket'],['call_time','Call_Time'],
 ['faulty','Faulty/damaged'],['ont_model','ONT Model '],['old_serial','SN OLD ONT'],['new_serial','New SN No As Per NCE'],['protection_box','ONT Protection Box '],['saas_type','SAAS Type'],['box_number','Box Number '],
];
export const serviceAssuranceFields=controllerColumns.map(([key,label],i)=>({key,label,storage:key,type:key==='team'?'technician':'text',excelColumn:i<26?String.fromCharCode(65+i):`A${String.fromCharCode(65+i-26)}`}));
export const serviceAssuranceResponseFields=[
 'Ticket_Number','Date_Ticket_Created','Date_Ticket_Closed','Contractor_Name','Area_Location','LO_Operator','Customer_Name','Customer_Contact','Customer_Contacted','Call_Date','Call_Time','Communication_Method',
 'Troubleshooting_Conducted','Issue_Description','Actions_Taken','Issue_Resolved_On_Call','Final_Ticket_Status','Visit_Appointment_Date','Customer_Confirmation','Reason_Non_Genuine','Additional_Remarks','Technician_Confirmation','Compliance_Status','BNET_Remarks',
];
export const responseIdentifiers:Record<string,string>={Ticket_Number:'ticket_number',Date_Ticket_Created:'creation_datetime',Date_Ticket_Closed:'close_datetime',Area_Location:'exchange',LO_Operator:'lo_name',Customer_Contact:'mobile'};
