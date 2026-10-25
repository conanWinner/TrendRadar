import { defineRailway, project, service } from "railway/iac";

// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "TrendRadar";

export default defineRailway(() => {
  const TrendRadar = service("TrendRadar", {
    healthcheck: "/health",
    healthcheckTimeout: 120,
    // dockerfilePath from CaC: "docker/Dockerfile.railway"
    // builder from CaC: "DOCKERFILE"
  });
  return project("TrendRadar", {
    resources: [TrendRadar],
  });
});
