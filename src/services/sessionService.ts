import { RowDataPacket } from "mysql2";
import { AccessLayer, Table } from "../constants/global";
import * as mysql from "../db";
import { logHelper } from "../middleware/logger";
import * as utils from "../utils/utils.db";


export const SessionService = {
  async getSessionData(sessionId: string) {
    try {
      const result = await utils.retrieve(Table.Sessions, "data", {
        column: "session_id",
        value: sessionId,
      });
      if (result && result.length > 0) {
        const json = JSON.parse(result[0].data);
        return json;
      }
    } catch (err) {
      logHelper(
        "Retrieve session data failed",
        "getSessionData",
        AccessLayer.Services,
        err
      );
      throw err;
    }
  },

  async removeUserSession(userId: number) {
    try {
      const query = `
				DELETE
				FROM sessions
				WHERE JSON_EXTRACT(data, '$.passport.user.userID') = ?;
			`
      const [rows] = await mysql.query(query,[userId]) as RowDataPacket[];
      if (rows.affectedRows !== undefined) {
        if (rows.affectedRows > 0) {
          return true;
        }
      }
      return false;
    } catch (error) {
      logHelper(
        "Remove user session data failed",
        "removeUserData",
        AccessLayer.Services,
        error,
        true
      );
      throw error;
    }
  }
};
