import { AzureFunction, Context, HttpRequest } from "@azure/functions"
import { loginToSmaregi } from "../common/smaregi/login"
import { readFile } from "fs/promises"
import * as iconv from "iconv-lite"

// request: No input required.
// response: 
//  body: {
//          status: "success" | "noData" | "failed",
//          data: string 
//        }

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  try {
      
    const {page, browser} = await loginToSmaregi()

    // wait for the login process to finish
    await page.waitForSelector("li.panel.processing")
    await page.waitForTimeout(2000)

    // move to "日次処理"
    await page.goto("https://www1.smaregi.jp/control/processing/")
    await page.waitForSelector("a.btn-default.modal-btn.processing-edit")
    await page.waitForTimeout(2000)

    // click "日報"
    const dailyReportLocator = page.locator("a.btn-default.modal-btn.processing-edit").nth(0)
    await dailyReportLocator.click()
    await page.waitForSelector("a.btn-print")
    await page.waitForTimeout(2000)

    await page.click("a.btn-print")
    await page.waitForSelector("div.btn-group ul.dropdown-menu li a")
    await page.waitForTimeout(2000)
    const locator = page.locator("div.btn-group ul.dropdown-menu li a").nth(1)
    await locator.click()
    await page.waitForSelector("#id_csv_download_button")
    await page.waitForTimeout(3000)
    
    const [temp, download] = await Promise.all([
      await page.click("#id_csv_download_button"),
      await page.waitForEvent("download")
    ])

    // process the downloaded file
    const path = await download.path()
    const content = await readFile(path)
    const text = iconv.decode(Buffer.from(content), "Shift_JIS")

    // parse the data to determine whether the income data for today exists or not.
    const lines = text.split("\n")
    const totalSales = lines[3].split(",")[1].trim()

    // create a response
    // if totalSales === "0" it means no data
    const result = {
      status: totalSales === "\"0\""? "noData": "success",
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
  } catch (e) {
    context.res = {
      status: 500,
      body: JSON.stringify({status: "failed"}),
      headers: {
        "Content-Type": "application/json"
      }
    }
  }
}

export default httpTrigger