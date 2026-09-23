import { describe, expect, it } from 'vitest';
import { UserRole } from '@south/shared';
import { mobileNavItemsForRole, navItemsForRole } from './navigation';

/** תצוגה מותאמת תפקיד - הניווט משתנה לפי מי שמחובר (§10). */
describe('ניווט לפי תפקיד', () => {
  it('מפקד לוגיסטיקה מקבל גם בקשות הצטרפות וגם יומן פעולות', () => {
    const paths = navItemsForRole(UserRole.LOGISTICS_COMMANDER).map((item) => item.to);
    expect(paths).toContain('/join-requests');
    expect(paths).toContain('/audit');
    expect(paths).toContain('/missions');
  });

  it('חייל לוגיסטיקה אינו מקבל יומן פעולות ובקשות הצטרפות', () => {
    const paths = navItemsForRole(UserRole.LOGISTICS_SOLDIER).map((item) => item.to);
    expect(paths).toContain('/tasks');
    expect(paths).toContain('/scan');
    expect(paths).not.toContain('/audit');
    expect(paths).not.toContain('/join-requests');
  });

  it('ראש צוות אינו מקבל גישה לשליחויות', () => {
    const paths = navItemsForRole(UserRole.TEAM_LEAD).map((item) => item.to);
    expect(paths).toContain('/packages');
    expect(paths).toContain('/map');
    expect(paths).not.toContain('/missions');
    expect(paths).not.toContain('/audit');
  });

  it('מפקד מבצע מקבל ניווט דק: דשבורד, בקשות הצטרפות ויומן פעולות בלבד', () => {
    const paths = navItemsForRole(UserRole.OPERATION_MANAGER).map((item) => item.to);
    expect(paths).toEqual(['/', '/join-requests', '/audit']);
  });

  it('מפקד מבצע אינו מקבל סריקת QR - זו עבודת שטח', () => {
    const paths = navItemsForRole(UserRole.OPERATION_MANAGER).map((item) => item.to);
    expect(paths).not.toContain('/scan');
    expect(paths).not.toContain('/tasks');
  });

  it('הניווט התחתון במובייל מכיל רק פריטים שסומנו לכך', () => {
    const mobile = mobileNavItemsForRole(UserRole.LOGISTICS_SOLDIER);
    expect(mobile.length).toBeLessThanOrEqual(5);
    expect(mobile.every((item) => item.mobile)).toBe(true);
  });
});
