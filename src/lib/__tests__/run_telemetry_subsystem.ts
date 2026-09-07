import { runTelemetrySubsystemTests } from "./telemetry_subsystem.test";

runTelemetrySubsystemTests()
  .then(() => {
    console.log("Telemetry subsystem test execution completed cleanly.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Telemetry subsystem test execution error:", err);
    process.exit(1);
  });
