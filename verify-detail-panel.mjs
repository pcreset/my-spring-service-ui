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
        { Name: 'Alice', Status: 'Active', Department: 'Engineering', selected: true,  HumanInstruction: 'Review Q2 performance data' },
        { Name: 'Bob',   Status: 'Inactive', Department: 'Marketing', selected: false, HumanInstruction: '' },
        { Name: 'Carol', Status: 'Active', Department: 'Sales',       selected: true,  HumanInstruction: 'Follow up with client' },
      ]
    })
  });
});

await page.goto('http://localhost:5174');
await page.fill('input.file-input', 'employees.xlsx');
await page.click('button.load-btn');
await page.waitForTimeout(1500);

// Click first row to select it
await page.locator('.ag-row').first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'TestResults/05-detail-panel-selected.png' });

// Edit the HumanInstruction field
await page.locator('.detail-textarea').fill('Updated instruction text for Alice');
await page.waitForTimeout(300);
await page.screenshot({ path: 'TestResults/06-detail-panel-edited.png' });

await browser.close();
console.log('done');
