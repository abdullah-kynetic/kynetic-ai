// Review only: does not load credentials or make HTTP requests.
import { buildDevTwentyPlan } from '../crm/src/server/leads/dev-twenty-plan';
const target = process.env.DEV_PORTAL_URL;
if (!target) throw new Error('DEV_PORTAL_URL is required');
process.stdout.write(JSON.stringify(buildDevTwentyPlan(target), null, 2) + '\n');
