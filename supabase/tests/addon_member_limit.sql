-- Efter att en addon-yta finns (Task 3) med ägaren som enda medlem:
-- 1. Lägg till en Pro-medlem via invite_org_member/redeem_org_join_code -> OK.
-- 2. Försök lägga till en Free-medlem -> ska faila:
--    'Alla medlemmar i en delad arbetsyta måste ha en aktiv Pro-plan.'
-- 3. Fyll ytan till 5 medlemmar, försök en sjätte Pro-medlem -> ska faila:
--    'Den delade arbetsytan har nått gränsen på 5 medlemmar.'
select 'manuell scenariokörning enligt kommentarer' as note;
