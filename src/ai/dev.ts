import { config } from 'dotenv';
config();

import '@/ai/flows/explain-scheduling-conflicts-flow.ts';
import '@/ai/flows/generate-weekly-roster.ts';
import '@/ai/flows/optimize-roster-gender-balance.ts';