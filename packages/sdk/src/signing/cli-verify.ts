#!/usr/bin/env node
import { runVerifyCli } from './cli.js';

const exitCode = await runVerifyCli(process.argv);
process.exit(exitCode);
