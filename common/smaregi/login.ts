import * as playwright from "playwright-chromium"

// URL to start with
const URL = "https://accounts.smaregi.jp/login?client_id=pos"

export const loginToSmaregi = async (): Promise<{
  page: playwright.Page,
  browser: playwright.Browser
}> => {
  // retrieve login info from environment variable
  const mail = process.env["Smaregi_mail"]
  const password = process.env["Smaregi_password"]

  // setup the browser
  const browser = await playwright["chromium"].launch({headless: process.env["Headful"] === "TRUE"? false: true})
  const pwContext = await browser.newContext({acceptDownloads: true})
  const page = await pwContext.newPage()
  page.setDefaultTimeout(0)

  await page.goto(URL)

  // login
  await page.click(".f-login-id")
  await page.keyboard.type(mail)
  await page.click(".f-login-pswd")
  await page.keyboard.type(password)
  await page.click(".btn-primary-login")
  return {browser, page}
}
