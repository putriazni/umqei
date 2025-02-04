import { AccessLayer, Table } from "../constants/global";
import { Period } from "../interface/Period";
import * as utils from "../utils/utils.db";
import * as mysql from "../db";
import { RowDataPacket } from "mysql2";
import { logHelper } from "../middleware/logger";
import { mail, mailTemplates } from "../middleware/mailer";

export const PeriodService = {
  async getActiveSessions() {
    try {
      const result = await utils.retrieve(Table.Period, "*");
      logHelper(
        "Retrieve active sessions",
        "getActiveSessions",
        AccessLayer.Services
      );
      return result as Period;
    } catch (error) {
      logHelper(
        "Retrieve active sessions",
        "getActiveSessions",
        AccessLayer.Services,
        error
      );
      throw error;
    }
  },

  async getSession(id: string) {
    try {
      const result = await utils.retrieve(Table.Period, "*", {
        column: "yearSession",
        value: id,
      });
      logHelper("Retrieve session", "getSession", AccessLayer.Services);
      if (result) {
        return result[0] as Period;
      } else {
        return result as unknown as Period;
      }
    } catch (error) {
      logHelper("Retrieve session", "getSession", AccessLayer.Services, error);
      throw error;
    }
  },

  async createSession(data: any[]) {
    try {
      const result = await utils.insert(
        Table.Period,
        [
          "yearSession",
          "auditStartDate",
          "auditEndDate",
          "selfAuditStartDate",
          "selfAuditEndDate",
          "year",
          "enablerWeightage",
          "resultWeightage",
        ],
        data
      );
      const mailOptions = await mailTemplates.allUser.sessionCreated(
        data[0][0],
        data[0][3].toLocaleString() + " - " + data[0][4].toLocaleString(),
        data[0][1].toLocaleString() + " - " + data[0][2].toLocaleString()
      );
      mail.sendMail(mailOptions, (error, info) => {
        if (error) {
          logHelper(
            "Send sessionCreated email : " + info,
            "createSession",
            AccessLayer.Services,
            error,
            true
          );
        } else {
          logHelper(
            "Send sessionCreated email : " + info,
            "createSession",
            AccessLayer.Services
          );
        }
      });
      logHelper("Create session", "createSession", AccessLayer.Services);
      return result;
    } catch (error) {
      logHelper("Create session", "createSession", AccessLayer.Services, error);
      throw error;
    }
  },

  async removePeriod(sessionID: string) {
    try {
      const result = await utils.remove(Table.Period, {
        column: "yearSession",
        value: sessionID,
      });
      logHelper("Remove session", "removeSession", AccessLayer.Services);
      return result;
    } catch (error) {
      logHelper("Remove session", "removeSession", AccessLayer.Services, error);
      throw error;
    }
  },

  async updateSession(id: string, data: any[]) {
    try {
      const result = await utils.update(
        Table.Period,
        [
          "auditStartDate",
          "auditEndDate",
          "selfAuditStartDate",
          "selfAuditEndDate",
          "year",
          "enablerWeightage",
          "resultWeightage",
        ],
        data,
        {
          column: "yearSession",
          value: id,
        }
      );
      if (result) {
        const mailOptions = await mailTemplates.allUser.sessionUpdated(
          id,
          data[2].toLocaleString() + " - " + data[3].toLocaleString(),
          data[0].toLocaleString() + " - " + data[1].toLocaleString()
        );
        mail.sendMail(mailOptions, (error, info) => {
          if (error) {
            logHelper(
              "Send sessionUpdated email : " + info,
              "updateSession",
              AccessLayer.Services,
              error,
              true
            );
          } else {
            logHelper(
              "Send sessionUpdated email : " + info,
              "updateSession",
              AccessLayer.Services
            );
          }
        });
      }
      logHelper("update session", "updateSession", AccessLayer.Services);
      return result;
    } catch (error) {
      logHelper("update session", "updateSession", AccessLayer.Services, error);
      throw error;
    }
  },

  async getCurrentYearSession() {
    try {
      const query = `
            SELECT 
            yearSession
            FROM period 
            WHERE CURRENT_TIMESTAMP 
                BETWEEN selfAuditStartDate AND auditEndDate`;
      const [result] = (await mysql.query(query)) as RowDataPacket[];
      logHelper(
        "Retrieve current yearsession",
        "getCurrentYearSession",
        AccessLayer.Controllers
      );
      return result;
    } catch (error) {
      logHelper(
        "Retrieve current yearsession",
        "getCurrentYearSession",
        AccessLayer.Controllers,
        error,
        true
      );
      throw error;
    }
  },

  async getCurrentPeriodSession() {
    try {
      const query = `
            SELECT 
            year,
            yearSession, 
            auditStartDate, 
            auditEndDate, 
            selfAuditStartDate, 
            selfAuditEndDate 
            FROM period 
            WHERE CURRENT_TIMESTAMP 
                BETWEEN selfAuditStartDate AND auditEndDate`;
      const [result] = (await mysql.query(query)) as RowDataPacket[];
      logHelper(
        "Retrieve current period session",
        "getCurrentPeriodSession",
        AccessLayer.Controllers
      );
      return result;
    } catch (error) {
      logHelper(
        "Retrieve current period session",
        "getCurrentPeriodSession",
        AccessLayer.Controllers,
        error,
        true
      );
      throw error;
    }
  },

  async getLatestPeriodSession() {
    try {
      const query = `
            SELECT 
            year,
            yearSession, 
            auditStartDate, 
            auditEndDate, 
            selfAuditStartDate, 
            selfAuditEndDate 
            FROM period
            WHERE selfAuditStartDate > CURRENT_TIMESTAMP
            ORDER BY selfAuditStartDate ASC
            LIMIT 1;
            `;
      const [result] = (await mysql.query(query)) as RowDataPacket[];
      logHelper(
        "Retrieve last period session",
        "getLatestPeriodSession",
        AccessLayer.Controllers
      );
      return result;
    } catch (error) {
      logHelper(
        "Retrieve last period session",
        "getLatestPeriodSession",
        AccessLayer.Controllers,
        error,
        true
      );
      throw error;
    }
  },
};
