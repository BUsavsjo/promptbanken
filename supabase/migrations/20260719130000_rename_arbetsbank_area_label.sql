-- Ta bort kvarvarande "Pro"-ordval i pro_prompt_templates.area_label nu när
-- hela katalogen (inklusive dessa mallar) är öppen för alla (delprojekt 6).
update public.pro_prompt_templates
set area_label = 'Egen AI-arbetsbank'
where area = 'arbetsbank'
  and area_label = 'Pro-verktyg för egen AI-arbetsbank';
