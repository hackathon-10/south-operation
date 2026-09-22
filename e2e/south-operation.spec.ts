import { expect, test, type Page } from '@playwright/test';

/**
 * התרחיש המרכזי של המערכת (§14 באפיון):
 * מפקד יוצר משימה → חייל אורז מחשב, מסך וציוד כמותי → סוגר אריזה →
 * מפקד יוצר שליחות → החייל מעמיס ויוצא → קולט ומפזר →
 * ראש הצוות רואה את המזהה והבעלים של המחשב והמסך.
 */

const PASSWORD = 'Demo!2345';

const USERS = {
  commander: 'commander@south.demo',
  soldierGdn: 'soldier.gdn@south.demo',
  soldierHub: 'soldier.kt@south.demo',
  teamLead: 'teamlead.dev@south.demo',
};

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('אימייל').fill(email);
  await page.getByLabel('סיסמה').fill(PASSWORD);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page.getByRole('navigation', { name: 'ניווט ראשי' }).first()).toBeVisible();
}

async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'תפריט משתמש' }).click();
  await page.getByRole('menuitem', { name: 'התנתקות' }).click();
  await expect(page.getByRole('button', { name: 'כניסה' })).toBeVisible();
}

test.describe('מבצע המעבר דרומה - מקצה לקצה', () => {
  test('מהמשימה ועד הציוד שמזוהה לבעליו', async ({ page }) => {
    // ---------- 1. מפקד יוצר משימת אריזה ----------
    await login(page, USERS.commander);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /בוקר טוב|צהריים טובים|ערב טוב/,
    );

    await page.goto('/tasks/new');
    await expect(page.getByRole('heading', { name: 'משימת אריזה חדשה' })).toBeVisible();

    await page.getByLabel('בסיס מקור').click();
    await page.getByRole('option', { name: 'גדעונים' }).click();

    await page.getByLabel('חדר מקור').click();
    await page.getByRole('option').first().click();

    await page.getByLabel('צוות').click();
    await page.getByRole('option', { name: 'צוות פיתוח א׳' }).click();

    await page.getByLabel('חדר יעד בקריית התקשוב').click();
    await page.getByRole('option').first().click();

    await page.getByRole('button', { name: 'המשך לבחירת ציוד' }).click();

    // בחירת מחשב/מסך (פריטים ייחודיים) + ציוד כמותי
    const assetCheckboxes = page.getByRole('checkbox', { name: /בחירת/ });
    await expect(assetCheckboxes.first()).toBeVisible();
    const assetCount = await assetCheckboxes.count();
    await assetCheckboxes.nth(0).check();
    if (assetCount > 1) await assetCheckboxes.nth(1).check();

    const quantityField = page.getByLabel('כמות').first();
    await quantityField.fill('2');

    await page.getByRole('button', { name: 'המשך' }).click();

    await page.getByLabel('חייל מבצע').click();
    await page.getByRole('option', { name: /אלה מאיר/ }).click();

    await page.getByLabel('דחיפות').click();
    await page.getByRole('option', { name: 'דחופה' }).click();

    await page.getByRole('button', { name: 'יצירת המשימה' }).click();

    await expect(page.getByRole('heading', { name: /^משימה TSK-/ })).toBeVisible();
    const taskUrl = page.url();
    const taskNumber = (await page.getByRole('heading', { name: /^משימה TSK-/ }).innerText())
      .replace('משימה ', '')
      .trim();

    await logout(page);

    // ---------- 2. החייל אורז ----------
    await login(page, USERS.soldierGdn);
    await page.goto(taskUrl);

    await page.getByRole('button', { name: 'התחלת משימה' }).click();
    await expect(page.getByText('בביצוע').first()).toBeVisible();

    await page.getByRole('button', { name: 'אריזה חדשה' }).click();
    await expect(page.getByRole('heading', { name: /^אריזה PKG-/ })).toBeVisible();
    const packageUrl = page.url();

    // הוספת כל הפריטים שנותרו במשימה
    const addButtons = page.getByRole('button', { name: 'הוספה' });
    await expect(addButtons.first()).toBeVisible();
    while ((await addButtons.count()) > 0) {
      await addButtons.first().click();
      await page.waitForTimeout(400);
    }

    await expect(page.getByText('כל הפריטים במשימה כבר נארזו. אפשר לסגור את האריזה')).toBeVisible();

    // ---------- 3. סגירת האריזה והפקת QR ----------
    await page.getByRole('button', { name: 'סגירת אריזה' }).click();
    await page.getByRole('button', { name: 'סגירה' }).click();

    await expect(page.getByText(/נסגרה בהצלחה/)).toBeVisible();
    await page.getByRole('link', { name: 'הדפסת תווית QR' }).click();

    await expect(page.getByRole('heading', { name: 'תווית אריזה' })).toBeVisible();
    await expect(page.locator('#print-area svg').first()).toBeVisible();
    const packageNumber = (await page.locator('#print-area').getByText(/^PKG-\d+$/).innerText()).trim();

    await logout(page);

    // ---------- 4. מפקד יוצר שליחות ----------
    await login(page, USERS.commander);
    await page.goto('/missions/new');

    const packageCheckbox = page.getByRole('checkbox', { name: `בחירת אריזה ${packageNumber}` });
    await expect(packageCheckbox).toBeVisible();
    await packageCheckbox.check();

    await page.getByRole('button', { name: 'הצעת מסלול' }).click();
    await expect(page.getByText('המסלול המוצע')).toBeVisible();
    await expect(page.getByText('למה זה המסלול')).toBeVisible();

    await page.getByLabel('כותרת השליחות').fill(`שליחות בדיקה ${taskNumber}`);

    const departure = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 16);
    await page.getByLabel('תאריך ושעת יציאה').fill(departure);

    await page.getByLabel('חייל מבצע').click();
    await page.getByRole('option', { name: /אלה מאיר/ }).click();

    await page.getByRole('checkbox', { name: /נדרשת נסיעה מאובטחת/ }).check();
    await page.getByLabel('הנחיות (מוצגות למורשים בלבד)').fill('ליווי לפי נוהל, יציאה בשעות היום');

    await page.getByRole('button', { name: 'יצירת השליחות' }).click();

    await expect(page.getByRole('heading', { name: /^שליחות SHP-/ })).toBeVisible();
    const missionUrl = page.url();
    await expect(page.getByText('נסיעה מאובטחת').first()).toBeVisible();
    await expect(page.getByText('ליווי לפי נוהל, יציאה בשעות היום')).toBeVisible();

    await logout(page);

    // ---------- 5. החייל מעמיס ויוצא לדרך ----------
    await login(page, USERS.soldierGdn);
    await page.goto(missionUrl);

    await page.getByRole('button', { name: 'תחילת העמסה' }).click();
    await expect(page.getByText('בהעמסה').first()).toBeVisible();

    await page.getByRole('button', { name: 'סימון הגעה' }).first().click();
    await page.getByRole('button', { name: 'סימון העמסה' }).first().click();
    await expect(page.getByText('הועמסה').first()).toBeVisible();

    await page.getByRole('button', { name: 'יציאה לדרך' }).click();
    await page.getByRole('button', { name: 'יציאה לדרך' }).last().click();
    await expect(page.getByText('בדרך').first()).toBeVisible();

    // האריזה נעולה מרגע היציאה
    await page.goto(packageUrl);
    await expect(
      page.getByText('האריזה נעולה מרגע שהשליחות יצאה לדרך. אי אפשר לשנות תכולה או יעד.'),
    ).toBeVisible();

    await logout(page);

    // ---------- 6. קליטה בקריית התקשוב ופיזור לחדר ----------
    await login(page, USERS.soldierHub);
    await page.goto(packageUrl);

    await page.getByRole('button', { name: 'קליטה בקריית התקשוב' }).click();
    await expect(page.getByText('נקלטה בקריית התקשוב').first()).toBeVisible();

    await page.getByRole('button', { name: 'אישור הנחה בחדר היעד' }).click();
    await expect(page.getByText('הגיעה לחדר היעד').first()).toBeVisible();

    await logout(page);

    // ---------- 7. ראש הצוות רואה מזהה ובעלים ----------
    await login(page, USERS.teamLead);
    await page.goto(packageUrl);

    await expect(page.getByText(/^תכולת האריזה/)).toBeVisible();
    await expect(page.getByText(/מזהה .+ · בעלים: .+/).first()).toBeVisible();

    // ראש צוות אינו רשאי לערוך תכולה
    await expect(page.getByRole('button', { name: 'סגירת אריזה' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'הוספה' })).toHaveCount(0);
  });

  test('מפת החדרים מציגה את הציוד האמיתי של החדר', async ({ page }) => {
    await login(page, USERS.commander);
    await page.goto('/map');

    await expect(page.getByRole('tab', { name: 'קומה 1' })).toBeVisible();
    await page.getByRole('tab', { name: 'קומה 2' }).click();
    await expect(page.getByText('קומה 2 - פיתוח ומוצר')).toBeVisible();

    const room = page.getByRole('button', { name: /^חדר 201/ });
    await room.click();

    const panel = page.getByRole('presentation').last();
    await expect(panel.getByText('חדר 201')).toBeVisible();
    await expect(panel.getByText('סה״כ פריטים')).toBeVisible();
  });

  test('ראש צוות אינו מגיע למסכי שליחויות', async ({ page }) => {
    await login(page, USERS.teamLead);
    await page.goto('/missions');
    await expect(page.getByText('התפקיד שלך אינו מורשה למסך הזה')).toBeVisible();
  });
});
