-- ============================================================
-- אילוצים ורצפים שאינם ניתנים לביטוי בסכמת Prisma.
--
-- NoCyberHere: PARAMETERIZED_DATABASE_ACCESS
-- Threat: שיבוש נתונים (כמויות שליליות, שורות לא עקביות) עקב באג ביישום או מרוץ תהליכים
-- Reason: המסד הוא קו ההגנה האחרון. גם אם שכבת היישום תישבר, הנתונים יישארו עקביים.
-- ============================================================

-- ------------------------------------------------------------
-- מלאי כמותי: אין ערכים שליליים, ואי אפשר לשריין/לארוז יותר מהמופה.
-- ------------------------------------------------------------
ALTER TABLE "RoomInventory"
  ADD CONSTRAINT "RoomInventory_quantities_non_negative"
  CHECK (
    "mappedQuantity" >= 0
    AND "reservedQuantity" >= 0
    AND "packedQuantity" >= 0
    AND "deliveredQuantity" >= 0
  );

ALTER TABLE "RoomInventory"
  ADD CONSTRAINT "RoomInventory_reserved_packed_within_mapped"
  CHECK ("reservedQuantity" + "packedQuantity" <= "mappedQuantity");

-- ------------------------------------------------------------
-- שורות משימת אריזה: כמות חיובית, לא נארז יותר מהנדרש,
-- ופריט ייחודי תמיד בכמות 1 (§7.9).
-- ------------------------------------------------------------
ALTER TABLE "PackingTaskLine"
  ADD CONSTRAINT "PackingTaskLine_quantities_valid"
  CHECK (
    "requestedQuantity" > 0
    AND "packedQuantity" >= 0
    AND "packedQuantity" <= "requestedQuantity"
  );

ALTER TABLE "PackingTaskLine"
  ADD CONSTRAINT "PackingTaskLine_serialized_quantity_is_one"
  CHECK ("assetInstanceId" IS NULL OR "requestedQuantity" = 1);

-- מק״ט כמותי מופיע פעם אחת בלבד בכל משימה.
CREATE UNIQUE INDEX "PackingTaskLine_bulk_unique"
  ON "PackingTaskLine" ("packingTaskId", "productCatalogItemId")
  WHERE "assetInstanceId" IS NULL;

-- פריט ייחודי מופיע פעם אחת בלבד בכל משימה.
CREATE UNIQUE INDEX "PackingTaskLine_asset_unique"
  ON "PackingTaskLine" ("packingTaskId", "assetInstanceId")
  WHERE "assetInstanceId" IS NOT NULL;

-- ------------------------------------------------------------
-- תכולת אריזה: כמות חיובית בלבד.
-- ------------------------------------------------------------
ALTER TABLE "PackageBulkLine"
  ADD CONSTRAINT "PackageBulkLine_quantity_positive"
  CHECK ("quantity" > 0);

-- ------------------------------------------------------------
-- עצירות: סדר לא שלילי.
-- ------------------------------------------------------------
ALTER TABLE "MissionStop"
  ADD CONSTRAINT "MissionStop_sequence_non_negative"
  CHECK ("sequence" >= 0);

-- ------------------------------------------------------------
-- נסיעה מאובטחת מחייבת הנחיות (§7.12).
-- ------------------------------------------------------------
ALTER TABLE "TransportMission"
  ADD CONSTRAINT "TransportMission_secured_notes_required"
  CHECK (
    "requiresSecuredTransport" = false
    OR ("securedTransportNotes" IS NOT NULL AND length(btrim("securedTransportNotes")) > 0)
  );

ALTER TABLE "TransportMission"
  ADD CONSTRAINT "TransportMission_estimates_non_negative"
  CHECK (
    ("routeDistanceKmEstimate" IS NULL OR "routeDistanceKmEstimate" >= 0)
    AND ("routeDurationMinutesEstimate" IS NULL OR "routeDurationMinutesEstimate" >= 0)
  );

-- ------------------------------------------------------------
-- מפת קומה: מידות חיוביות בתוך הקנבס.
-- ------------------------------------------------------------
ALTER TABLE "RoomMapShape"
  ADD CONSTRAINT "RoomMapShape_dimensions_positive"
  CHECK ("x" >= 0 AND "y" >= 0 AND "width" > 0 AND "height" > 0);

ALTER TABLE "FloorMap"
  ADD CONSTRAINT "FloorMap_canvas_positive"
  CHECK ("canvasWidth" > 0 AND "canvasHeight" > 0 AND "floorNumber" > 0);

-- ------------------------------------------------------------
-- רצפים למזהים ידידותיים למשתמש (PKG-10425 / TSK-00128 / SHP-00031).
-- שימוש ב-sequence מבטיח מזהה ייחודי גם תחת בקשות מקבילות.
-- ------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS package_number_seq START WITH 10001 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS task_number_seq START WITH 101 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS mission_number_seq START WITH 21 INCREMENT BY 1;
