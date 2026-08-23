import { ICONS } from './icons.ts'

const REPO_URL = 'https://github.com/saiphanindra1010/drawmark'
const REPO_API = 'https://api.github.com/repos/saiphanindra1010/drawmark'

let stars: number | null = null
let inflight: Promise<void> | null = null

export function githubStarBadge(): HTMLAnchorElement {
  const badge = document.createElement('a')
  badge.className = 'gh-star'
  badge.href = REPO_URL
  badge.target = '_blank'
  badge.rel = 'noopener noreferrer'
  badge.title = 'Star Drawmark on GitHub'
  badge.innerHTML = `${ICONS.star}<span>Star</span><span class="gh-star-count"></span>`
  if (stars !== null) {
    render(badge)
  } else {
    void load().then(render.bind(null, badge))
  }
  return badge
}

function render(badge: HTMLAnchorElement): void {
  const count = badge.querySelector('.gh-star-count')
  if (count && stars !== null) count.textContent = format(stars)
}

async function load(): Promise<void> {
  if (!inflight) {
    inflight = fetch(REPO_API, { headers: { Accept: 'application/vnd.github+json' } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const n = (data as { stargazers_count?: unknown } | null)?.stargazers_count
        if (typeof n === 'number') stars = n
      })
      .catch(() => undefined)
  }
  await inflight
}

function format(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n)
}
