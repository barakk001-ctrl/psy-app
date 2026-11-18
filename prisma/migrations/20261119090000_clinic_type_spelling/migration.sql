-- The clinic-type chip "טיפול באמנויות" is now spelled "טיפול באומנויות";
-- lines saved from the old chip follow it. Free text that differs is left as typed.
UPDATE "User" SET "clinicType" = 'טיפול באומנויות' WHERE "clinicType" = 'טיפול באמנויות';
