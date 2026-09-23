-- ============================================================
-- אחראי לאריזה: כל אריזה מקבלת משתמש אחראי, שנקבע בעת פתיחתה.
--
-- העמודה חייבת להיות NOT NULL, אבל יש כבר אריזות קיימות במסד. לכן המיגרציה
-- מתבצעת בשלושה שלבים: הוספה כ-nullable, מילוי רטרואקטיבי מתוך createdById
-- (מי שפתח את האריזה הוא האחראי עד שיוחלף), ורק אז הקשחה ל-NOT NULL.
-- ============================================================

-- 1. הוספה כ-nullable כדי לא להיכשל על שורות קיימות.
ALTER TABLE "Package" ADD COLUMN "responsibleUserId" UUID;

-- 2. מילוי רטרואקטיבי: האחראי ההתחלתי הוא מי שיצר את האריזה.
UPDATE "Package" SET "responsibleUserId" = "createdById" WHERE "responsibleUserId" IS NULL;

-- 3. הקשחה - מכאן והלאה השדה חובה.
ALTER TABLE "Package" ALTER COLUMN "responsibleUserId" SET NOT NULL;

-- 4. מפתח זר ואינדקס (Restrict: אי אפשר למחוק משתמש שאחראי על אריזה).
ALTER TABLE "Package"
  ADD CONSTRAINT "Package_responsibleUserId_fkey"
  FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Package_responsibleUserId_idx" ON "Package"("responsibleUserId");
