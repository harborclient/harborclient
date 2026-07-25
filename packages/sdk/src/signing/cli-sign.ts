#!/usr/bin/env node
import { runSignCli } from './cli.js';

const exitCode = await runSignCli(process.argv);
process.exit(exitCode);
