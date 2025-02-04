export interface ReportTable{
    groupID : number;
    groupName : string;
    ptjAcademic : string;
    yearSession : string;
    year : string;
    responseStatus : string;
}

export interface SessionInfo{
    auditor : string[];
    selfAuditPeriod : string;
    auditPeriod : string;
    pastSession : boolean;
  }