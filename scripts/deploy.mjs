// 一条命令发布到 GitHub Pages：npm run deploy
// 做的事：用 /timetable/ 前缀构建 → 拷到临时目录 → 提交到 gh-pages 分支（force push）
// 前提：这台机器上 git 已配置好 GitHub 凭证（github.com 的 credential helper 能直接放行）
import { spawnSync } from 'node:child_process'
import { rmSync, mkdirSync, cpSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url)).replace(/[\\/]scripts$/, '')
const owner = 'hha08377'
const repo = 'timetable'
const remote = `https://github.com/${owner}/${repo}.git`
const pagesDir = join(root, 'temp', 'pages')

// Windows 上 git 可能不在 PATH 里，按已知路径兜底
function findGit() {
  const candidates = [
    'git',
    'C:/Users/hha super jiaolong/AppData/Local/Programs/Git/cmd/git.exe',
  ]
  for (const c of candidates) {
    const r = spawnSync(c, ['--version'], { encoding: 'utf8' })
    if (r.status === 0) return c
  }
  throw new Error('找不到 git，先确认 Git 已安装')
}

const git = findGit()
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { cwd: root, stdio: opts.quiet ? 'pipe' : 'inherit', encoding: 'utf8', ...opts })
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} 失败\n${r.stderr || ''}`)
  return r
}

console.log('1/4 构建（base=/timetable/）...')
run(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  env: { ...process.env, GH_PAGES: '1' },
  quiet: true,
})

console.log('2/4 准备发布目录...')
if (existsSync(pagesDir)) rmSync(pagesDir, { recursive: true, force: true })
mkdirSync(pagesDir, { recursive: true })
cpSync(join(root, 'dist'), pagesDir, { recursive: true })
writeFileSync(join(pagesDir, '.nojekyll'), '')

console.log('3/4 提交到 gh-pages...')
const inPages = (args, opts = {}) => run(git, args, { cwd: pagesDir, quiet: true, ...opts })
inPages(['init', '-q'])
inPages(['checkout', '-q', '-b', 'gh-pages'])
inPages(['add', '-A'])
inPages(['-c', 'user.name=hha08377', '-c', 'user.email=259664892@qq.com', 'commit', '-q', '-m', 'deploy: build output'])

console.log('4/4 推送到 GitHub...')
inPages(['push', '--force', remote, 'gh-pages:gh-pages'])
console.log(`\n完成 → https://${owner}.github.io/${repo}/`)
console.log('（GitHub 那边构建通常 30-60 秒，之后刷新页面就能看到新版）')