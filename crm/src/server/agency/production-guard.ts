/** Production UI and actions refuse simulated Stripe events and simulated campaign steps. */
export function productionSimulationRefused(nodeEnv: string | undefined = process.env.NODE_ENV) {
  return nodeEnv === 'production';
}
