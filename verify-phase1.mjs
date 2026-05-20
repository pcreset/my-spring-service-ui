import pkg from 'file:///C:/devtools/playwright/node_modules/playwright/index.js';
const { chromium } = pkg;

const browser = await chromium.launch();
const page = await browser.newPage();
page.setViewportSize({ width: 1400, height: 900 });

await page.route('**/api/v1/data/load**', route => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: [
        { Name: 'Alice',  Status: 'Active',   Department: 'Engineering', Salary: 95000,  StartDate: '2020-01-15' },
        { Name: 'Bob',    Status: 'Inactive', Department: 'Marketing',   Salary: 72000,  StartDate: '2019-06-01' },
        { Name: 'Carol',  Status: 'Active',   Department: 'Sales',       Salary: 68000,  StartDate: '2021-03-22' },
        { Name: 'David',  Status: 'Active',   Department: 'Engineering', Salary: 110000, StartDate: '2018-11-08' },
        { Name: 'Eve',    Status: 'Pending',  Department: 'HR',          Salary: 61000,  StartDate: '2022-07-30' },
      ]
    })
  });
});

await page.goto('http://localhost:5174');
await page.fill('input.file-input', 'employees.xlsx');
await page.click('button.load-btn');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'TestResults/01-grid-loaded.png' });

await page.click('button.tool-btn:has-text("Columns")');
await page.waitForTimeout(600);
await page.screenshot({ path: 'TestResults/02-col-panel-open.png' });

const cells = await page.locator('.ag-cell[col-id="Department"]').all();
if (cells.length) {
  await cells[0].dblclick();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'TestResults/03-cell-editing.png' });
  await page.keyboard.press('Escape');
}

await page.click('button.tool-btn:has-text("Auto-size")');
await page.waitForTimeout(600);
await page.screenshot({ path: 'TestResults/04-auto-sized.png' });

await browser.close();
console.log('done');
