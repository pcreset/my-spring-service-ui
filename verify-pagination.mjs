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
      data: Array.from({ length: 45 }, (_, i) => ({
        Name: `Person ${i + 1}`, Status: 'Active', Department: 'Engineering',
        selected: i % 2 === 0, HumanInstruction: `Instruction for person ${i + 1}`
      }))
    })
  });
});

await page.goto('http://localhost:5174');
await page.fill('input.file-input', 'employees.xlsx');
await page.click('button.load-btn');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'TestResults/07-pagination-check.png' });

await browser.close();
console.log('done');
