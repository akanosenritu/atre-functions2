import { AzureFunction, Context, HttpRequest } from "@azure/functions"
import { loginToSmaregi } from "../common/smaregi/login"
import { readFile } from "fs/promises"
import * as iconv from "iconv-lite"

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  const {page, browser} = await loginToSmaregi()

  // wait for the login process to finish
  await page.waitForSelector("li.panel.processing")
  await page.waitForTimeout(1000)

  // move to "日次処理"
  await page.goto("https://www1.smaregi.jp/control/processing/")
  await page.waitForTimeout(1000)

  // click "日報"
  const dailyReportLocator = page.locator("a.btn-default.modal-btn.processing-edit").nth(0)
  await dailyReportLocator.click()
  await page.waitForTimeout(2000)

  await page.click("a.btn-print")
  const locator = page.locator("div.btn-group ul.dropdown-menu li a").nth(1)
  await locator.click()
  await page.waitForTimeout(2000)
  
  await page.waitForSelector("#id_csv_download_button")
  const [temp, download] = await Promise.all([
    await page.click("#id_csv_download_button"),
    await page.waitForEvent("download")
  ])

  // process the downloaded file
  const path = await download.path()
  const content = await readFile(path)
  const text = iconv.decode(Buffer.from(content), "Shift_JIS")

  // create a success response
  const result = {
    status: "success",
    data: text
  }
  context.res = {
    status: 200,
    body: JSON.stringify(result),
    headers: {
      "Content-Type": "application/json"
    }
  }
  await browser.close()
}

export default httpTrigger