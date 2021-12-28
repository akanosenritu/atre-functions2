import { AzureFunction, Context, HttpRequest } from "@azure/functions"
import { loginToSmaregi } from "../common/smaregi/login"
import { readFile } from "fs/promises"
import * as iconv from "iconv-lite"

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  try {
    // log in to smaregi
    const {page, browser} = await loginToSmaregi()

    // wait for login process to finish
    await page.waitForSelector("li.panel.home.current")

    // move to the statistics page
    await page.goto("https://www1.smaregi.jp/control/sales/productTable.html")
    await page.waitForTimeout(2000)

    // open date picker
    await page.click("#v-range-picker")
    await page.waitForSelector("div.vue-range-picker")
    await page.waitForTimeout(2000)

    // select today
    await page.waitForSelector('li[data-range-key="今日"]')
    await page.click('li[data-range-key="今日"]')
    await page.waitForTimeout(2000)

    // click search
    await page.click("input.btn-search")
    await page.waitForTimeout(2000)

    const downloadButtonLocator = page.locator("a.btn-file-dl")
    // check if the button is disabled or not
    // if disabled, abort the process.
    const classNames = (await downloadButtonLocator.getAttribute("class")).split(" ")
    if (classNames.findIndex(elem => elem === "disabled") !== -1) {
      const result = {
        status: "noData"
      }
      context.res = {
        body: JSON.stringify(result),
        headers: {
          "Content-Type": "application/json"
        }
      }

      await browser.close()
      return 
    }

    // open csv downloader 
    await downloadButtonLocator.click()
    await page.waitForTimeout(2000)
    
    // download csv file
    await page.waitForSelector("#id_csv_download_button")

    const [temp, download] = await Promise.all([
      await page.click("#id_csv_download_button"),
      await page.waitForEvent("download"),
    ])
    const path = await download.path()

    // load text from the csv file
    const content = await readFile(path)
    const text = iconv.decode(Buffer.from(content), "Shift_JIS")

    // return the text
    const result = {
      status: "success",
      data: text
    }
    context.res = {
      body: JSON.stringify(result),
      headers: {
        "Content-Type": "application/json"
      }
    }

    // clean up
    await browser.close()
  } catch (e) {
    context.res = {
      status: 500,
    }
  } 
}

export default httpTrigger