import { router } from "./init";
import { authRouter } from "./procedures/auth";
import { vehicleRouter } from "./procedures/vehicle";
import { inspectionRouter } from "./procedures/inspection";
import { reportRouter } from "./procedures/report";
import { mediaRouter } from "./procedures/media";

export const appRouter = router({
  auth: authRouter,
  vehicle: vehicleRouter,
  inspection: inspectionRouter,
  report: reportRouter,
  media: mediaRouter,
});

export type AppRouter = typeof appRouter;
