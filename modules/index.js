import fetch from 'node-fetch'
import { stringify } from 'query-string'
import invariant from 'invariant'

function stringifyQuery(query) {
  return typeof query === 'string' ? query : stringify(query)
}

/**
 * Creates a fetch function using all arguments as middleware.
 */
export function createFetch() {
  const middleware = Array.prototype.slice.call(arguments, 0)

  return middleware.reduceRight((fetch, middleware) => {
    return function (url, options) {
      return middleware(fetch, url, options)
    }
  }, fetch)
}

function setHeader(options, name, value) {
  const headers = options.headers || (options.headers = {})
  headers[name] = value
}

/**
 * Sets the request method.
 */
export function method(verb) {
  return (fetch, url, options={}) => {
    options.method = verb
    return fetch(url, options)
  }
}

/**
 * Adds a header to the request.
 */
export function header(name, value) {
  return (fetch, url, options={}) => {
    setHeader(options, name, value)
    return fetch(url, options)
  }
}

/**
 * Adds an Authorization header to the request.
 */
export function auth(value) {
  return header('Authorization', value)
}

/**
 * Adds an Accept header to the request.
 */
export function accept(contentType) {
  return header('Accept', contentType)
}

/**
 * Adds the given string at the front of the request URL.
 */
export function base(baseURL) {
  return (fetch, url, options) => fetch(baseURL + url, options)
}

/**
 * Adds the given object to the query string in the request.
 */
export function query(object) {
  const queryString = stringifyQuery(object)

  return (fetch, url, options) => {
    url += (url.indexOf('?') === -1 ? '?' : '&') + queryString
    return fetch(url, options)
  }
}

/**
 * Adds the given content to the request.
 */
export function body(content, contentType) {
  invariant(
    typeof content === 'string',
    'body(content) must be a string (for now)'
  )

  return (fetch, url, options={}) => {
    options.body = content

    setHeader(options, 'Content-Type', contentType)
    setHeader(options, 'Content-Length', content.length)

    return fetch(url, options)
  }
}

/**
 * Adds an application/json payload to the request.
 */
export function json(object) {
  return body(
    typeof object === 'string' ? object : JSON.stringify(object),
    'application/json'
  )
}

/**
 * Adds the given object to the query string of GET/HEAD requests
 * and as a x-www-form-urlencoded payload on all others.
 */
export function params(object) {
  const queryString = stringifyQuery(object)

  return (fetch, url, options={}) => {
    const method = (options.method || 'GET').toUpperCase()
    const middleware = (method === 'GET' || method === 'HEAD')
      ? query(queryString)
      : body(queryString, 'x-www-form-urlencoded')

    return middleware(fetch, url, options)
  }
}

function enhanceResponse(callback) {
  return (fetch, url, options) => fetch(url, options).then(callback)
}

/**
 * Adds the text of the response to response.textString.
 */
export function parseText() {
  return enhanceResponse(response => (
    response.text().then(text => {
      response.textString = text
      return response
    })
  ))
}

/**
 * Adds the JSON of the response to response.jsonData.
 */
export function parseJSON() {
  return enhanceResponse(response => (
    response.json()
      .then(json => {
        response.jsonData = json
        return response
      }, error => {
        throw new Error('Error parsing JSON: ' + error.stack)
      })
  ))
}

/**
 * Adds the requestURL and requestOptions properties to the
 * response/error. Mainly useful in testing/debugging.
 */
export function requestInfo() {
  return (fetch, url, options) => {
    fetch(url, options)
      .then(response => {
        response.requestURL = url
        response.requestOptions = options
        return response
      }, error => {
        error = error || new Error
        error.requestURL = url
        error.requestOptions = options
        throw error
      })
  }
}
