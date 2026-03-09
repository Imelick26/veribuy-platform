import { router } from "./init";
import { authRouter } from "./procedures/auth";
import { vehicleRouter } from "./procedures/vehicle";
import { inspectionRouter } from "./procedures/inspection";
import { reportRouter } from "./procedures/report";

export const appRouter = router({
  auth: authRouter,
  vehicle: vehicleRouter,
  inspection: inspectionRouter,
  report: reportRouter,
});

export type AppRouter = typeof appRouter;
