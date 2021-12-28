import { AzureFunction, Context, HttpRequest } from "@azure/functions"
import { loginToSmaregi } from "../common/smaregi/login"

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  const searchParam = req.query.search
  // if search parameter is not provided, fails.
  if (!searchParam) {
    const result = {
      status: "failure",
      reason: "search parameter was not provided. include it in the query parameters as '?search='.",
    } 
    context.res = {
      body: JSON.stringify(result),
      status: 400,
      headers: {
        "Content-Type": "application/json"
      }
    }
    return
  }

  // log in to smaregi
  const {page, browser} = await loginToSmaregi()

  // wait for the login process to finish
  await page.waitForSelector("li.panel.product.parent")
  await page.waitForTimeout(1000)

  // move to the products page
  await page.goto("https://www1.smaregi.jp/control/master/product/")
  await page.waitForTimeout(2000)

  // write the search query in the input
  await page.click("#searchQuery")
  await page.keyboard.type(searchParam)

  // select 在庫表示 > 表示
  const locator = page.locator("#selectShowStock")
  await locator.selectOption({value: "1"})
  await page.waitForTimeout(2000)

  // click search
  await page.click("input.btn-search")
  await page.waitForTimeout(2000)

  // crawl the table for the information
  const janCodesLocator = page.locator("table.product-list-tbl td.item-info span.code")
  const janCodes = await janCodesLocator.allInnerTexts()
  const stockNumbersLocator = page.locator("table.product-list-tbl td.product_stock_info")
  const stockNumbers = await stockNumbersLocator.allInnerTexts()

  // if the length of janCodes and that of stockNumbers don't match,
  // it means something wrong happened.
  if (janCodes.length !== stockNumbers.length) {
    const result = {
      status: "failure",
      reason: "scraping of the stock data went wrong. failed to retrieve data."
    }
    context.res = {
      body: JSON.stringify(result),
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    }
    await browser.close()
    return
  }

  const products = janCodes.map((janCode, index) => ({
    janCode,
    stock: parseFloat(stockNumbers[index])
  }))
  const result = {
    status: "success",
    count: janCodes.length,
    products
  }
  context.res = {
    body: JSON.stringify(result),
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  }
  await browser.close()
  return
}

export default httpTrigger