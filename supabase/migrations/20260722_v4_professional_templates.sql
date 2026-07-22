-- DotCo Cards V4 professional template configurations

insert into public.templates(template_key,name,category,preview_url,configuration,is_premium,is_active)
values ('corporate','Executive Navy','business',null,'{"layout":"executive","primary_color":"#0F172A","secondary_color":"#2563EB","background_color":"#F8FAFC","text_color":"#0F172A","button_color":"#2563EB","button_text_color":"#FFFFFF","font_family":"Manrope","button_style":"filled","profile_image_shape":"rounded","border_radius":14,"color_mode":"light","gradient_background":"linear-gradient(135deg,#0F172A 0%,#1E3A8A 58%,#2563EB 100%)"}'::jsonb,false,true)
on conflict (template_key) do update set
  name=excluded.name,
  category=excluded.category,
  configuration=excluded.configuration,
  is_premium=excluded.is_premium,
  is_active=true,
  updated_at=now();

insert into public.templates(template_key,name,category,preview_url,configuration,is_premium,is_active)
values ('minimal','Clean Slate','business',null,'{"layout":"minimal","primary_color":"#111827","secondary_color":"#64748B","background_color":"#FFFFFF","text_color":"#0F172A","button_color":"#111827","button_text_color":"#FFFFFF","font_family":"Inter","button_style":"outline","profile_image_shape":"circle","border_radius":10,"color_mode":"light","gradient_background":"linear-gradient(135deg,#F8FAFC 0%,#E2E8F0 100%)"}'::jsonb,false,true)
on conflict (template_key) do update set
  name=excluded.name,
  category=excluded.category,
  configuration=excluded.configuration,
  is_premium=excluded.is_premium,
  is_active=true,
  updated_at=now();

insert into public.templates(template_key,name,category,preview_url,configuration,is_premium,is_active)
values ('creative','Electric Studio','creative',null,'{"layout":"spotlight","primary_color":"#6D28D9","secondary_color":"#EC4899","background_color":"#FFF7FF","text_color":"#2E1065","button_color":"#7C3AED","button_text_color":"#FFFFFF","font_family":"Manrope","button_style":"filled","profile_image_shape":"circle","border_radius":20,"color_mode":"light","gradient_background":"linear-gradient(135deg,#4C1D95 0%,#7C3AED 45%,#EC4899 100%)"}'::jsonb,false,true)
on conflict (template_key) do update set
  name=excluded.name,
  category=excluded.category,
  configuration=excluded.configuration,
  is_premium=excluded.is_premium,
  is_active=true,
  updated_at=now();

insert into public.templates(template_key,name,category,preview_url,configuration,is_premium,is_active)
values ('luxury','Noir & Gold','premium',null,'{"layout":"luxe","primary_color":"#B68D40","secondary_color":"#5B4526","background_color":"#0B0D12","text_color":"#F8F3E7","button_color":"#B68D40","button_text_color":"#111111","font_family":"Georgia","button_style":"outline","profile_image_shape":"rounded","border_radius":8,"color_mode":"dark","gradient_background":"linear-gradient(135deg,#050608 0%,#171A20 62%,#6F5329 100%)"}'::jsonb,true,true)
on conflict (template_key) do update set
  name=excluded.name,
  category=excluded.category,
  configuration=excluded.configuration,
  is_premium=excluded.is_premium,
  is_active=true,
  updated_at=now();

insert into public.templates(template_key,name,category,preview_url,configuration,is_premium,is_active)
values ('real-estate','Property Pro','industry',null,'{"layout":"split","primary_color":"#0F766E","secondary_color":"#34D399","background_color":"#F5FFFC","text_color":"#0F2F2B","button_color":"#0F766E","button_text_color":"#FFFFFF","font_family":"Manrope","button_style":"filled","profile_image_shape":"rounded","border_radius":14,"color_mode":"light","gradient_background":"linear-gradient(135deg,#064E3B 0%,#0F766E 55%,#34D399 100%)"}'::jsonb,true,true)
on conflict (template_key) do update set
  name=excluded.name,
  category=excluded.category,
  configuration=excluded.configuration,
  is_premium=excluded.is_premium,
  is_active=true,
  updated_at=now();

insert into public.templates(template_key,name,category,preview_url,configuration,is_premium,is_active)
values ('beauty','Rose Atelier','industry',null,'{"layout":"soft","primary_color":"#BE185D","secondary_color":"#FDA4AF","background_color":"#FFF7FA","text_color":"#4A1528","button_color":"#BE185D","button_text_color":"#FFFFFF","font_family":"Georgia","button_style":"soft","profile_image_shape":"circle","border_radius":22,"color_mode":"light","gradient_background":"linear-gradient(135deg,#9D174D 0%,#DB2777 48%,#FDA4AF 100%)"}'::jsonb,true,true)
on conflict (template_key) do update set
  name=excluded.name,
  category=excluded.category,
  configuration=excluded.configuration,
  is_premium=excluded.is_premium,
  is_active=true,
  updated_at=now();

insert into public.templates(template_key,name,category,preview_url,configuration,is_premium,is_active)
values ('healthcare','Clinical Trust','industry',null,'{"layout":"executive","primary_color":"#0369A1","secondary_color":"#38BDF8","background_color":"#F4FAFF","text_color":"#0C3347","button_color":"#0369A1","button_text_color":"#FFFFFF","font_family":"Inter","button_style":"soft","profile_image_shape":"rounded","border_radius":12,"color_mode":"light","gradient_background":"linear-gradient(135deg,#075985 0%,#0284C7 55%,#38BDF8 100%)"}'::jsonb,true,true)
on conflict (template_key) do update set
  name=excluded.name,
  category=excluded.category,
  configuration=excluded.configuration,
  is_premium=excluded.is_premium,
  is_active=true,
  updated_at=now();

insert into public.templates(template_key,name,category,preview_url,configuration,is_premium,is_active)
values ('restaurant','Ember Table','industry',null,'{"layout":"spotlight","primary_color":"#9A3412","secondary_color":"#F59E0B","background_color":"#FFF9F0","text_color":"#3C1611","button_color":"#9A3412","button_text_color":"#FFFFFF","font_family":"Georgia","button_style":"filled","profile_image_shape":"circle","border_radius":14,"color_mode":"light","gradient_background":"linear-gradient(135deg,#7F1D1D 0%,#9A3412 52%,#F59E0B 100%)"}'::jsonb,true,true)
on conflict (template_key) do update set
  name=excluded.name,
  category=excluded.category,
  configuration=excluded.configuration,
  is_premium=excluded.is_premium,
  is_active=true,
  updated_at=now();

insert into public.templates(template_key,name,category,preview_url,configuration,is_premium,is_active)
values ('contractor','Built Tough','industry',null,'{"layout":"split","primary_color":"#292524","secondary_color":"#F97316","background_color":"#FFFBF5","text_color":"#292524","button_color":"#EA580C","button_text_color":"#FFFFFF","font_family":"Manrope","button_style":"filled","profile_image_shape":"square","border_radius":8,"color_mode":"light","gradient_background":"linear-gradient(135deg,#1C1917 0%,#44403C 56%,#F97316 100%)"}'::jsonb,true,true)
on conflict (template_key) do update set
  name=excluded.name,
  category=excluded.category,
  configuration=excluded.configuration,
  is_premium=excluded.is_premium,
  is_active=true,
  updated_at=now();

insert into public.templates(template_key,name,category,preview_url,configuration,is_premium,is_active)
values ('automotive','Apex Motion','industry',null,'{"layout":"bold","primary_color":"#0F172A","secondary_color":"#EF4444","background_color":"#F8FAFC","text_color":"#111827","button_color":"#DC2626","button_text_color":"#FFFFFF","font_family":"Manrope","button_style":"filled","profile_image_shape":"rounded","border_radius":10,"color_mode":"light","gradient_background":"linear-gradient(125deg,#020617 0%,#0F172A 64%,#EF4444 100%)"}'::jsonb,true,true)
on conflict (template_key) do update set
  name=excluded.name,
  category=excluded.category,
  configuration=excluded.configuration,
  is_premium=excluded.is_premium,
  is_active=true,
  updated_at=now();

insert into public.templates(template_key,name,category,preview_url,configuration,is_premium,is_active)
values ('daycare','Happy Day','industry',null,'{"layout":"playful","primary_color":"#0EA5E9","secondary_color":"#F472B6","background_color":"#FFFDF5","text_color":"#25445E","button_color":"#0284C7","button_text_color":"#FFFFFF","font_family":"DM Sans","button_style":"soft","profile_image_shape":"circle","border_radius":24,"color_mode":"light","gradient_background":"linear-gradient(135deg,#0EA5E9 0%,#38BDF8 45%,#F472B6 100%)"}'::jsonb,true,true)
on conflict (template_key) do update set
  name=excluded.name,
  category=excluded.category,
  configuration=excluded.configuration,
  is_premium=excluded.is_premium,
  is_active=true,
  updated_at=now();

insert into public.templates(template_key,name,category,preview_url,configuration,is_premium,is_active)
values ('credit-repair','Financial Rise','industry',null,'{"layout":"executive","primary_color":"#166534","secondary_color":"#22C55E","background_color":"#F7FFF8","text_color":"#123C20","button_color":"#15803D","button_text_color":"#FFFFFF","font_family":"Manrope","button_style":"filled","profile_image_shape":"rounded","border_radius":12,"color_mode":"light","gradient_background":"linear-gradient(135deg,#14532D 0%,#166534 56%,#22C55E 100%)"}'::jsonb,true,true)
on conflict (template_key) do update set
  name=excluded.name,
  category=excluded.category,
  configuration=excluded.configuration,
  is_premium=excluded.is_premium,
  is_active=true,
  updated_at=now();

insert into public.templates(template_key,name,category,preview_url,configuration,is_premium,is_active)
values ('midnight-pro','Midnight Pro','business',null,'{"layout":"bold","primary_color":"#8B5CF6","secondary_color":"#22D3EE","background_color":"#090B14","text_color":"#F8FAFC","button_color":"#8B5CF6","button_text_color":"#FFFFFF","font_family":"Manrope","button_style":"soft","profile_image_shape":"rounded","border_radius":16,"color_mode":"dark","gradient_background":"linear-gradient(135deg,#090B14 0%,#1E1B4B 52%,#0891B2 100%)"}'::jsonb,false,true)
on conflict (template_key) do update set
  name=excluded.name,
  category=excluded.category,
  configuration=excluded.configuration,
  is_premium=excluded.is_premium,
  is_active=true,
  updated_at=now();

insert into public.templates(template_key,name,category,preview_url,configuration,is_premium,is_active)
values ('warm-neutral','Warm Neutral','business',null,'{"layout":"editorial","primary_color":"#7C5C45","secondary_color":"#D6BFAF","background_color":"#FBF8F4","text_color":"#3D3028","button_color":"#7C5C45","button_text_color":"#FFFFFF","font_family":"Georgia","button_style":"outline","profile_image_shape":"rounded","border_radius":10,"color_mode":"light","gradient_background":"linear-gradient(135deg,#E7D8CC 0%,#C8AA92 100%)"}'::jsonb,false,true)
on conflict (template_key) do update set
  name=excluded.name,
  category=excluded.category,
  configuration=excluded.configuration,
  is_premium=excluded.is_premium,
  is_active=true,
  updated_at=now();

insert into public.templates(template_key,name,category,preview_url,configuration,is_premium,is_active)
values ('neon-tech','Neon Tech','premium',null,'{"layout":"spotlight","primary_color":"#7C3AED","secondary_color":"#06B6D4","background_color":"#070A12","text_color":"#F8FAFC","button_color":"#22D3EE","button_text_color":"#071018","font_family":"Manrope","button_style":"outline","profile_image_shape":"rounded","border_radius":18,"color_mode":"dark","gradient_background":"linear-gradient(135deg,#070A12 0%,#312E81 45%,#0891B2 100%)"}'::jsonb,true,true)
on conflict (template_key) do update set
  name=excluded.name,
  category=excluded.category,
  configuration=excluded.configuration,
  is_premium=excluded.is_premium,
  is_active=true,
  updated_at=now();

insert into public.templates(template_key,name,category,preview_url,configuration,is_premium,is_active)
values ('editorial-ink','Editorial Ink','premium',null,'{"layout":"editorial","primary_color":"#111111","secondary_color":"#A3A3A3","background_color":"#FAFAF9","text_color":"#171717","button_color":"#171717","button_text_color":"#FFFFFF","font_family":"Georgia","button_style":"outline","profile_image_shape":"square","border_radius":4,"color_mode":"light","gradient_background":"linear-gradient(135deg,#171717 0%,#525252 100%)"}'::jsonb,true,true)
on conflict (template_key) do update set
  name=excluded.name,
  category=excluded.category,
  configuration=excluded.configuration,
  is_premium=excluded.is_premium,
  is_active=true,
  updated_at=now();
