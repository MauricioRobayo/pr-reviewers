import './style.scss'
import GitHubPR from './js/github-pr'
import Reviewer from './js/components/reviewer'
import PRInfo from './js/components/pr-info'
import RepoInfo from './js/components/repo-info'
import * as create from './js/element-creator'

function buildPRInfoHTML(info) {
  const prInfo = new PRInfo({
    title: info.title,
    url: info.html_url,
    state: info.state,
  })
  return prInfo.html({
    parent: document.querySelector('#content'),
    classList: ['repo-info'],
  })
}

function buildRepoInfoHTML(info) {
  const repoInfo = new RepoInfo({
    title: info.base.repo.full_name,
    url: info.base.repo.html_url,
  })
  return repoInfo.html({
    parent: document.querySelector('#content'),
    classList: ['repo-info'],
  })
}

function buildReviewersHTML(reviewers) {
  const wrapper = create.element('section', {
    classList: ['reviewers-wrapper'],
  })
  const reviewersTitle = create.element('h2', {
    classList: ['reviewers-title'],
    textContent:
      reviewers.length > 0 ? 'Reviewers:' : 'No reviewers found for this PR.',
  })
  const reviewersList = create.element('ul', {
    id: 'reviewers',
    classList: ['reviewers'],
    children: reviewers.map(reviewer =>
      new Reviewer(reviewer).html({ tagName: 'li' })
    ),
  })
  wrapper.append(reviewersTitle, reviewersList)
  return wrapper
}

function buildInfoHTML(info) {
  const repoInfoHTML = buildRepoInfoHTML(info)
  const prInfoHTML = buildPRInfoHTML(info)
  return create.element('section', {
    id: 'info',
    children: [repoInfoHTML, prInfoHTML],
  })
}

function preRender(prUrl) {
  const infoContainers = document.querySelector('#info')
  const reviewersContainer = document.querySelector('.reviewers-wrapper')
  document.querySelector('#pull-request-url').value = prUrl
  if (infoContainers) {
    infoContainers.remove()
  }
  if (reviewersContainer) {
    reviewersContainer.remove()
  }
  document.querySelector('#error-msgs').innerHTML = ''
  document
    .querySelector('.pull-request-form-container')
    .classList.add('collapse')
  document.querySelector('#pr-btn').setAttribute('hidden', true)
  document.querySelector('#loader-container').classList.remove('hide')
}

function postRender() {
  document.querySelector('#pr-btn').removeAttribute('hidden')
  document.querySelector('#loader-container').classList.add('hide')
}

function renderError(error) {
  const errorMsg = create.element('div', {
    classList: ['error-msg'],
    textContent: error,
  })
  const errorMsgs = document.querySelector('#error-msgs')
  if (errorMsgs.childElementCount === 0) {
    errorMsgs.append(errorMsg)
  } else {
    errorMsgs.replaceChild(errorMsg, errorMsgs.firstChild)
  }
}

async function renderInfo({ info, reviewers }) {
  document
    .querySelector('#pr-content')
    .append(buildInfoHTML(info), buildReviewersHTML(reviewers))
}

async function onsubmit(event) {
  event.preventDefault()
  const prUrl = GitHubPR.validatePRUrl(
    document.querySelector('#pull-request-url').value
  )
  if (!prUrl) {
    renderError('Not a valid GitHub Pull request url!')
    return
  }
  window.location.hash = prUrl
}

async function fetchPR(prUrl) {
  const pr = new GitHubPR(prUrl)
  // Avoid doing these requests on parallel to avoid
  // doing the latter one if the former fails.
  const info = await pr.fetchInfo()
  const reviewers = await pr.fetchReviewers()
  return {
    info,
    reviewers,
  }
}

function loadFromCache(prUrl) {
  if (sessionStorage[prUrl]) {
    const { timestamp, prData } = JSON.parse(sessionStorage[prUrl])
    const fifteenMinutesInMilliseconds = 15 * 60 * 1000
    if (Date.now() - timestamp <= fifteenMinutesInMilliseconds) {
      return prData
    }
    sessionStorage.removeItem(prUrl)
  }
  return false
}

async function loadPR() {
  if (window.location.hash === '') {
    return
  }

  const prUrl = GitHubPR.validatePRUrl(window.location.hash.replace(/^#/, ''))
  if (!prUrl) {
    renderError('Not a valid GitHub Pull request url!')
    return
  }

  let prData
  preRender(prUrl)
  try {
    prData = loadFromCache(prUrl) || (await fetchPR(prUrl))
    renderInfo(prData)
  } catch (e) {
    renderError(e)
  }
  sessionStorage[prUrl] = JSON.stringify({
    timestamp: Date.now(),
    prData,
  })
  postRender()
}

document
  .querySelector('#pull-request-form')
  .addEventListener('submit', onsubmit)

window.addEventListener('hashchange', loadPR)
loadPR()
