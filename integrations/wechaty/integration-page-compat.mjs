import { Page } from 'puppeteer/lib/cjs/puppeteer/common/Page.js'

const goto = Page.prototype.goto
const reload = Page.prototype.reload
Page.prototype.goto = function (url, options = {}) {
  return goto.call(this, url, url.startsWith('https://wx.qq.com') ? { ...options, waitUntil: 'domcontentloaded' } : options)
}
Page.prototype.reload = async function (options = {}) {
  if (!this.url().startsWith('https://wx.qq.com')) return reload.call(this, options)
  const result = await reload.call(this, { ...options, waitUntil: 'domcontentloaded' })
  this.emit('load')
  return result
}
