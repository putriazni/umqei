export interface Period {
    year: number;
    yearSession: string;
    auditStartDate: string;
    auditEndDate: string;
    selfAuditStartDate: string;
    selfAuditEndDate: string;
    enablerWeightage: number;
    resultWeightage: number;
    isCurrentPeriod?: boolean;
}

export interface FormPeriodSet {
    formID: number;
    yearSession: string;
}