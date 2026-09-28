import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, rmSync } from 'node:fs'

const run = (command, args, cwd = process.cwd()) => {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status || 1)
}

run('npm', ['test'])
run('npm', ['run', 'lint'])
run('npm', ['run', 'build'])
run('npx', ['wrangler', 'd1', 'migrations', 'apply', 'dota2analysis-beta', '--remote', '--config', 'wrangler.beta.toml'])
run('npx', ['wrangler', 'deploy', '--config', 'worker/wrangler.beta.toml'])
try {
  if (existsSync('beta/functions')) rmSync('beta/functions', { recursive: true, force: true })
  cpSync('functions', 'beta/functions', { recursive: true })
  run('npx', ['wrangler', 'pages', 'deploy', '../dist', '--cwd', 'beta', '--project-name', 'dota2analysis-beta', '--branch', 'beta', '--commit-dirty=true'])
} finally {
  rmSync('beta/functions', { recursive: true, force: true })
}
