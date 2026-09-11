/** Shared syntax boundary for DSH versions/tags used as staging directory keys. */
const SAFE_UPDATE_VERSION = /^[0-9A-Za-z][0-9A-Za-z._+-]*$/

export function validUpdateVersion(value) {
  return typeof value === 'string' && value !== '' && SAFE_UPDATE_VERSION.test(value) && !value.includes('..')
}

export function updateVersionError(action = 'update') {
  return `${action} version must be an npm version/tag without path syntax`
}
