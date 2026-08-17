export class Metrics {
  head = 0;
  indexed = 0;
  projectionCycles = 0;
  projectionErrors = 0;
  queryRequests = 0;
  lastProjectionSuccess = 0;

  render(): string {
    const lag = Math.max(0, this.head - this.indexed);
    return [
      "# HELP toscan_projection_head Current node masterchain head.",
      "# TYPE toscan_projection_head gauge",
      `toscan_projection_head ${this.head}`,
      "# HELP toscan_projection_indexed Last projected masterchain block.",
      "# TYPE toscan_projection_indexed gauge",
      `toscan_projection_indexed ${this.indexed}`,
      "# HELP toscan_projection_lag Masterchain blocks waiting to be projected.",
      "# TYPE toscan_projection_lag gauge",
      `toscan_projection_lag ${lag}`,
      "# TYPE toscan_projection_cycles_total counter",
      `toscan_projection_cycles_total ${this.projectionCycles}`,
      "# TYPE toscan_projection_errors_total counter",
      `toscan_projection_errors_total ${this.projectionErrors}`,
      "# TYPE toscan_query_requests_total counter",
      `toscan_query_requests_total ${this.queryRequests}`,
      "# TYPE toscan_projection_last_success_unixtime gauge",
      `toscan_projection_last_success_unixtime ${this.lastProjectionSuccess}`,
      "",
    ].join("\n");
  }
}
