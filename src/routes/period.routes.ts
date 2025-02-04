import { Router } from "express"
import { createPeriod, deletePeriod, editPeriod, getCurrentPeriodSession, getAllSessions } from "../controllers/period.controllers";

const router = Router();

router.route('/list').get(getAllSessions);
router.route('/creation').post(createPeriod);
router.route('/edition').patch(editPeriod);
router.route('/deletion').post(deletePeriod)

router.route('/current').get(getCurrentPeriodSession);

export default router;