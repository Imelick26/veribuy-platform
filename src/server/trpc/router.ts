import { router } from "./init";
import { authRouter } from "./procedures/auth";
import { vehicleRouter } from "./procedures/vehicle";
import { inspectionRouter } from "./procedures/inspection";
import { reportRouter } from "./procedures/report";
import { mediaRouter } from "./procedures/media";
import { adminRouter } from "./procedures/admin";
import { billingRouter } from "./procedures/billing";

export const appRouter = router({
  auth: authRouter,
  vehicle: vehicleRouter,
  inspection: inspectionRouter,
  report: reportRouter,
  media: mediaRouter,
  admin: adminRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;
