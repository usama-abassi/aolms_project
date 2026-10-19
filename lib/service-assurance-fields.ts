import schema from './service-assurance-schema.json'

export const serviceAssuranceFields = schema.fields
export const serviceAssuranceResponseFields = schema.response
export const responseIdentifiers:Record<string,string> = {'Team Name':'team','SR / Ticket number':'ticket_number'}
export const materialFields = schema.response.filter((_,i)=>i>=7&&!['Comments and/or questions','Email Address'].includes(schema.response[i]))
export const assuranceReportColumns = schema.columns
export const assuranceReportGroups = schema.groups
export const assuranceMaterialMapping = schema.mapping
export const replacementResolutions = new Set([...schema.resolutions,'replaced'])
