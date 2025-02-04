import { Router } from "express"
import { getAnalytics, getSelection, getEditDashboard, updateEditDashboard } from "../controllers/dashboard.controllers"
const router = Router();

router.route('/data').get(getAnalytics);
router.route('/selection/:groupID/:userID').get(getSelection);
router.route('/edit').get(getEditDashboard).put(updateEditDashboard);

export default router;