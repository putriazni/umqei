import { AccessLayer } from "../constants/global";
import { logHelper } from "../middleware/logger";
import { mail, mailTemplates } from "../middleware/mailer";

export const EmailService = {
  async notifyRoleChanged(recepient: string, message: string) {
    const mailOptions = mailTemplates.administartion.updateGroups(recepient, message);
    mail.sendMail(mailOptions, (error, info) => {
      if (error) {
        logHelper(
          "Notify role changed : " + info,
          "notifyRoleChanged",
          AccessLayer.Services,
          error,
          true
        );
      } else {
        logHelper(
          "Notify role changed : " + info,
          "notifyRoleChanged",
          AccessLayer.Services,
        );
      }
    })
  },

  async notifyNewUserinvited(recepient: string, message: string) {
    const mailOptions = mailTemplates.administartion.inviteNewUser(recepient, message);
    mail.sendMail(mailOptions, (error, info) => {
      if (error) {
        logHelper(
          "Notify new user added : " + info,
          "notifyNewUserinvited",
          AccessLayer.Services,
          error,
          true
        );
      } else {
        logHelper(
          "Notify new user added : " + info,
          "notifyNewUserinvited",
          AccessLayer.Services,
        );
      }
    })
  },

  async notifyUserRemoved(recepient: string) {
    const mailOptions = mailTemplates.administartion.removeUser(recepient);
    mail.sendMail(mailOptions, (error, info) => {
      if (error) {
        logHelper(
          "Notify user removed : " + info,
          "notifyUserRemoved",
          AccessLayer.Services,
          error,
          true
        );
      } else {
        logHelper(
          "Notify user removed : " + info,
          "notifyUserRemoved",
          AccessLayer.Services,
        );
      }
    })
  },

  async notifyTaskAssigned(recepient: string[], groupName: string, session: string) {
    const mailOptions = mailTemplates.administartion.assignTask(recepient, groupName, session);
    mail.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
        logHelper(
          "Notify task assigned : " + info,
          "notifyTaskAssigned",
          AccessLayer.Services,
          error,
          true
        );
      } else {
        logHelper(
          "Notify task assigned : " + info,
          "notifyTaskAssigned",
          AccessLayer.Services,
        );
      }
    })
  },

  async notifyFormRejected(
    recepients: string[],
    bccAssessor: string[],
    ptj: string,
    enablerResult: string,
    session: string) {
    const mailOptions = mailTemplates.ptj.formRejected(recepients, bccAssessor, ptj, enablerResult, session)
    mail.sendMail(mailOptions, (error, info) => {
      if (error) {
        logHelper(
          "Notify form rejected : " + info,
          "notifyFormRejected",
          AccessLayer.Services,
          error,
          true
        );
      } else {
        logHelper(
          "Notify form rejected : " + info,
          "notifyFormRejected",
          AccessLayer.Services,
        );
      }
    })
  },

  async notifyFormAssessed(
    recipients: string[],
    ptj: string,
    enablerResult: string,
    session: string) {
    const mailOptions = mailTemplates.ptj.formAssessed(recipients, ptj, enablerResult, session)
    mail.sendMail(mailOptions, (error, info) => {
      if (error) {
        logHelper(
          "Notify form assessed : " + info,
          "notifyFormAssessed",
          AccessLayer.Services,
          error,
          true
        );
      } else {
        logHelper(
          "Notify form assessed : " + info,
          "notifyFormAssessed",
          AccessLayer.Services,
        );
      }
    })
  },

  async notifyPTJSubmitted(
    recipients: string[],
    ptj: string,
    enablerResult: string,
    session: string,
    assessmentPeriod: string) {
    const mailOptions = mailTemplates.assessor.ptjSubmitted(recipients, ptj, enablerResult, session, assessmentPeriod)
    mail.sendMail(mailOptions, (error, info) => {
      if (error) {
        logHelper(
          "Notify ptj submitted : " + info,
          "notifyPTJSubmitted",
          AccessLayer.Services,
          error,
          true
        );
      } else {
        logHelper(
          "Notify ptj submitted : " + info,
          "notifyPTJSubmitted",
          AccessLayer.Services,
        );
      }
    })
  },

  async notifyPTJSubmittedAll(
    recipients: string[],
    bccAdmin: string[],
    ptj: string,
    session: string) {
    const mailOptions = mailTemplates.assessor.ptjSubmittedAll(recipients, bccAdmin, ptj, session)
    mail.sendMail(mailOptions, (error, info) => {
      if (error) {
        logHelper(
          "Notify ptj submitted all : " + info,
          "notifyPTJSubmittedAll",
          AccessLayer.Services,
          error,
          true
        );
      } else {
        logHelper(
          "Notify ptj submitted all : " + info,
          "notifyPTJSubmittedAll",
          AccessLayer.Services,
        );
      }
    })
  },

  async notifyAssessmentDone(
    recipients: string[],
    bccAdmin: string[],
    ptj: string,
    session: string) {
    const mailOptions = mailTemplates.ptj.assessmentDone(recipients, bccAdmin, ptj, session)
    mail.sendMail(mailOptions, (error, info) => {
      if (error) {
        logHelper(
          "Notify assessment done : " + info,
          "notifyAssessmentDone",
          AccessLayer.Services,
          error,
          true
        );
      } else {
        logHelper(
          "Notify assessment done : " + info,
          "notifyAssessmentDone",
          AccessLayer.Services,
        );
      }
    })
  },

  async notifyOverallComment(
    recipients: string[],
    ptj: string,
    session: string) {
    const mailOptions = mailTemplates.assessor.remindOverallComment(recipients, ptj, session)
    mail.sendMail(mailOptions, (error, info) => {
      if (error) {
        logHelper(
          "Notify overall comment : " + info,
          "notifyOverallComment",
          AccessLayer.Services,
          error,
          true
        );
      } else {
        logHelper(
          "Notify overall comment : " + info,
          "notifyOverallComment",
          AccessLayer.Services,
        );
      }
    })
  },
}