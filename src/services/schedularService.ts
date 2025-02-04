import { AccessLayer, Table } from "../constants/global";
import { FormPeriodSet } from "../interface/Period";
import { logHelper } from "../middleware/logger";
import * as utils from "../utils/utils.db";

export const SchedularService = {
    async clone(data: any[]) {
        try {
            const result = await utils.insert(
                Table.FormPeriodSet,
                ['formID', 'yearSession'],
                data
            )
            logHelper('Clone', 'clone', AccessLayer.Services);
            return result;
        } catch (error) {
            logHelper('Clone', 'clone', AccessLayer.Services, error);
            throw error;   
        }
    },

    async isDuplicated(session: string) {
        try {
            const result = await utils.retrieve(
                Table.FormPeriodSet, '*',
                {
                    column: 'yearSession',
                    value: session
                }
            )
            
            return result as FormPeriodSet;
        } catch (error) {
            logHelper('Check duplication', 'isDuplicated', AccessLayer.Services, error);
            throw error;
        }
    }
}