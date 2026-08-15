import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import categoryRoutes from "./category.routes";
import productRoutes from "./product.routes";
import orderRoutes from "./order.routes";
import reviewRoutes from "./review.routes";
import attendanceRoutes from "./attendance.routes";
import leaveRoutes from "./leave.routes";
import taskRoutes from "./task.routes";
import performanceRoutes from "./performance.routes";
import salaryRoutes from "./salary.routes";
import inventoryRoutes from "./inventory.routes";
import reportRoutes from "./report.routes";
import heroSlideRoutes from "./heroSlide.routes";
import homepageSectionRoutes from "./homepageSection.routes";
import siteSettingsRoutes from "./siteSettings.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/orders", orderRoutes);
router.use("/reviews", reviewRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/leaves", leaveRoutes);
router.use("/tasks", taskRoutes);
router.use("/performance-reviews", performanceRoutes);
router.use("/salary-payments", salaryRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/reports", reportRoutes);
router.use("/hero-slides", heroSlideRoutes);
router.use("/homepage-sections", homepageSectionRoutes);
router.use("/site-settings", siteSettingsRoutes);

export default router;
