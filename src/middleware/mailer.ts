import nodemailer from "nodemailer";
import dotenv from "dotenv";
import * as mysql from "../db";
import { logHelper } from "../middleware/logger";
import { RowDataPacket } from "mysql2";
import { AccessLayer } from "../constants/global";

dotenv.config();
export const mail = nodemailer.createTransport({
  service: "Gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.NOTIFICATION_EMAIL,
    pass: process.env.NOTIFICATION_PASSWORD,
  },
});

const findAllUsers = async () => {
  const query =
    "SELECT userEmail FROM users WHERE userStatus = 1 AND userID > 1";
  try {
    const [result] = await mysql.query(query);
    if(!(result as RowDataPacket[])[0].userEmail) return [];
    return (result as RowDataPacket[]).map((row) => row.userEmail).join(", ");
  } catch (error) {
    logHelper(
      "Error in finding all user emails to send notification to all",
      "findAllUsers",
      AccessLayer.Services,
      error,
      true
    );
    return [];
  }
};

const from = `"UMQEI System"<umqei@um.edu.my>`;
const footer =
  "\n\n\n(This is a system generated email. You are receiving this email because you have been added into the Universiti Malaya Quality Excellence Index (UMQEI) system by QMEC@UM with specific role(s) assigned. Kindly forward the email to qmec@um.edu.my and provide details if you think this is a mistake. System link : https://umqei.um.edu.my)";
export const mailTemplates = {
  ptj: {
    formAssessed(
      recipients: string[],
      ptj: string,
      enablerResult: string,
      session: string
    ) {
      return {
        from: from,
        to: recipients.join(", "),
        subject: "(UMQEI) Notification - Form Assessed",
        text: `The following enabler/result submitted has been assessed and submitted by the Assessor : \n
                PTj : ${ptj}
                Enabler/Result : ${enablerResult}
                Session Name : ${session}
                \nYou can now log into the system to view the assessment result of the enabler/result.${footer}`,
      };
    },
    formRejected(
      recipients: string[],
      bccAssessor: string[],
      ptj: string,
      enablerResult: string,
      session: string
    ) {
      return {
        from: from,
        to: recipients.join(", "),
        bcc: bccAssessor.join(", "),
        subject: "(UMQEI) Notification - Form Rejected",
        text: `The following enabler/result has been rejected by the Assessor : \n
                PTj : ${ptj}
                Enabler/Result : ${enablerResult}
                Session Name : ${session}
                \nPlease make the necessary changes based on the Assessor's comment (at the bottom of the enabler/result) and remarks, then resubmit before the deadline.${footer}`,
      };
    },
    assessmentDone(
      recipients: string[],
      bccAdmin: string[],
      ptj: string,
      session: string
    ) {
      return {
        from: from,
        to: recipients.join(", "),
        bcc: bccAdmin.join(", "),
        subject: "(UMQEI) Notification - Assessment for the PTj is Completed",
        text: `Assessment of this PTj is completed by the assessor(s). Please review the results. The details of the assessment are as follows : \n
                PTj : ${ptj}
                Session Name : ${session}${footer}`,
      };
    },
  },
  ptjHead: {
    remindSubmit(recipients: string[], ptj: string, session: string) {
      return {
        from: from,
        to: recipients.join(", "),
        subject: `(UMQEI) Action Required - Reminder for Head of PTj to Submit Self-assessment Forms`,
        text: `Dear Head of PTj(s), \n\n All the forms have been completely filled & saved. Please log into the system to check the saved responses, make changes if necessary, and submit them to be assessed by the Assessors before the deadline (Note : Only head(s) of PTj are allowed to submit the forms as part of the endorsement & verification process. You are receiving this email because you are being assigned as a head of PTj). Details are as follows : \n
                PTj : ${ptj}
                Session Name : ${session}${footer}`,
      };
    },
  },
  assessor: {
    ptjSubmitted(
      recipients: string[],
      ptj: string,
      enablerResult: string,
      session: string,
      assessmentPeriod: string
    ) {
      return {
        from: from,
        to: recipients.join(", "),
        subject: `(UMQEI) Action Required - An Enabler/Result is Ready for Assessment`,
        text: `You are receiving this email because you are among the assigned Assessor of this PTj. An enabler/result has been submitted by the PTj for your assessment, you may start assessing it once the assessment period starts. Details are as follows : \n
                PTj : ${ptj}
                Enabler/Result : ${enablerResult}
                Session Name : ${session}
                Assessment Period : ${assessmentPeriod}${footer}`,
      };
    },
    ptjSubmittedAll(
      recipients: string[],
      bccAdmin: string[],
      ptj: string,
      session: string
    ) {
      return {
        from: from,
        to: recipients.join(", "),
        bcc: bccAdmin.join(", "),
        subject: `(UMQEI) Notification : A PTj has Completed Their Self-assessment`,
        text: `All enablers/results have been self-assessed and submitted by the PTj for the session. The details of the self-assessment are as follows : \n
                PTj : ${ptj}
                Session Name : ${session}${footer}`,
      };
    },
    remindOverallComment(recipients: string[], ptj: string, session: string) {
      return {
        from: from,
        to: recipients.join(", "),
        subject: `(UMQEI) Action Required - Reminder to Provide Overall Comment`,
        text: `A last step is required to complete the assessment of the following PTj : \n
                PTj : ${ptj}
                Session : ${session}
                \nAs the last step of the assessment process, each assigned Assessor(s) are required to provide an overall comment to the PTj before the assessment deadline. If you haven't provided an overall comment, please follow the steps below : 
                1. Log into the system
                2. From the sidebar, click "Assessment"
                3. At the list, find the row with the corresponding PTj & Session, then click on the three vertical dots at the rightmost of the row
                4. Click "Comment", then write your comment and save
                5. You can modify the comment anytime before the assessment end date of the session.${footer}`,
      };
    },
  },
  allUser: {
    async sessionCreated(
      yearSession: string,
      selfAssessmentPeriod: string,
      assessmentPeriod: string
    ) {
      const allUsers = await findAllUsers();
      return {
        from: from,
        to: [],
        bcc: allUsers,
        subject: `(UMQEI) Notification - A New Session is Created`,
        text: `Dear users, \n\nA new session is created with the following details : \n
                Session Name : ${yearSession}
                Self-assessment Period : ${selfAssessmentPeriod}
                Assessment Period : ${assessmentPeriod}
                \nYou should have received your role assignment notification(s) before. Your role(s) may change from time to time with notification email being sent to you. Log into the system if you are unsure of your role(s). Please conduct your duties within the period stated.${footer}`,
      };
    },
    async sessionUpdated(
      yearSession: string,
      selfAssessmentPeriod: string,
      assessmentPeriod: string
    ) {
      const allUsers = await findAllUsers();
      return {
        from: from,
        to: [],
        bcc: allUsers,
        subject: `(UMQEI) Notification - A Session has been Updated`,
        text: `Dear users, \n\nThe following session is amended. The updated details are as follows : \n
                Session Name : ${yearSession}
                Self-assessment Period : ${selfAssessmentPeriod}
                Assessment Period : ${assessmentPeriod}
                \nIf necessary, please contact QMEC for more information.${footer}`,
      };
    },
    async selfAssessmentAlmostExpire(
      //to use schedular
      yearSession: string,
      selfAssessmentPeriod: string
    ) {
      const allUsers = await findAllUsers();
      return {
        from: from,
        to: [],
        bcc: allUsers,
        subject: `(UMQEI) Reminder - Self-Assessment Period is Expiring in 5 Days`,
        text: `Dear users, \n\nThe self-assessment period of the following session is closing in less than 5 days : \n
                Session Name : ${yearSession}
                Self-assessment Period : ${selfAssessmentPeriod}
                \nFor PTj, please finalize & submit the enablers/results, including the rejected ones, if any. No changes is allowed upon self-assessment expiration.
                \n For Assessor, if you still need to reject the enablers/results, please do it ASAP and inform QMEC, so that QMEC can remind the PTj to re-submit before the closing date. Once the self-assessment is closed, the PTj will not be able to modify/re-submit and you can start finalizing your assessment(s).${footer}`,
      };
    },
    async assessmentAlmostExpire(
      //to use schedular
      yearSession: string,
      assessmentPeriod: string
    ) {
      const allUsers = await findAllUsers();
      return {
        from: from,
        to: [],
        bcc: allUsers,
        subject: `(UMQEI) Reminder - Assessment Period is Expiring in 5 Days`,
        text: `Dear users, \n\nThe assessment period of the following session is closing in less than 5 days :\n
                Session Name : ${yearSession}
                Assessment Period : ${assessmentPeriod}
                \n For Assessor, please finalize your assessment(s) and submit them before the closing date.
                \nFor PTj, you may log into the system to review the finalized assessment results upon assessment expiration.${footer}`,
      };
    },
    async announcementPosted(title: string, content: string, date: string) {
      const allUsers = await findAllUsers();
      return {
        from: from,
        to: [],
        bcc: allUsers,
        subject: `(UMQEI) Notification - New Announcement : ${title}`,
        text: `Dear users, \n\nA new announcement has been posted by the admin. The details are as follows : \n
                Title : ${title}
                Content : ${content}
                Date Posted : ${date}
                \nThe information above might not be always valid. Log into the system and navigate to the announcement page to view the lateset announcements with full details including attachment files, if any.${footer}`,
      };
    },
  },
  administartion: {
    updateGroups(recipient: string, customMessage: string) {
      return {
        from: from,
        to: recipient,
        subject: `(UMQEI) Notification - Your Group Assignments Have Been Updated`,
        text: `The system admin has assigned you to these groups.\n\nYou are currently under:\n${customMessage}
        \nIf necessary, please contact QMEC for more information.${footer}`,
      };
    },
    inviteNewUser(recipient: string, customMessage: string) {
      return {
        from: from,
        to: recipient,
        subject: `(UMQEI) Notification - Welcome to UMQEI`,
        text: `You have been invited to join UMQEI.\n\nYou are currently under:\n${customMessage}
        \nPlease login to UMQEI using your UM email (username@um.edu.my) by clicking the following link: https://umqei.um.edu.my/login\n
        ${footer}`,
      };
    },
    removeUser(recipient: string) {
      return {
        from: from,
        to: recipient,
        subject: `(UMQEI) Notification - You Have Been Removed from UMQEI`,
        text: `Dear User,\n\nYou have been removed from UMQEI. Please contact your administrator for further details.\n\n${footer}`,
      };
    },
    assignTask(recipients: string[], ptj: string, session: string) {
      return {
        from: from,
        to: recipients,
        subject: `(UMQEI) Notification - You are Assigned to Assess the PTj`,
        text: `The system admin has assigned you as one of the Assessor(s) for the following PTj of the session : \n
                PTj to be assessed : ${ptj}
                Session Name : ${session}
                \nKindly take note of the assessment period start date & end date and assess the PTj within the period.${footer}`,
      };
    }
  }
};
