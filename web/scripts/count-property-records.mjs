import { existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const python = process.env.HIP_PYTHON ?? (existsSync(`${root}.venv/bin/python`) ? `${root}.venv/bin/python` : 'python3');
rmSync(new URL('../.property-scale.json', import.meta.url), {force:true});
const result = spawnSync(python, [fileURLToPath(new URL('./count-property-records.py', import.meta.url))], {stdio:'inherit'});
if (result.status !== 0) throw new Error('Property scale generation failed; resolve Python/DuckDB or landed-data errors before building.');
