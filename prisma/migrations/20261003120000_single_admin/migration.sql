-- One admin: Barak (the operator). The subscription migration made every
-- account that existed then an admin + exempt; the others keep "exempt"
-- (they never pay) but lose admin. Data-only, nothing is deleted.
UPDATE "User" SET "subscriptionExempt" = true, "isAdmin" = false
WHERE "isAdmin" = true AND lower("email") <> 'barakk001@gmail.com';

UPDATE "User" SET "isAdmin" = true, "subscriptionExempt" = true
WHERE lower("email") = 'barakk001@gmail.com';
