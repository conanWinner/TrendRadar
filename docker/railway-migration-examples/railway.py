from railway_sdk import define_railway, project, service

# This repository manages only its own resources in the environment. Other
# repositories export their own partial name.
# See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
PARTIAL = "TrendRadar"

@define_railway
def main(ctx=None):
    TrendRadar = service(
        "TrendRadar",
        healthcheck="/health",
    )
    return project("TrendRadar", resources=[TrendRadar])
