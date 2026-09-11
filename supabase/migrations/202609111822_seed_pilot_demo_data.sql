-- Applied to production as migration: seed_pilot_demo_data
-- Public pilot entities only. No fake contributions or payments are seeded.

insert into public.schools (name, level, province, municipality, town, verified)
values
  ('Mankweng Primary School','primary','Limpopo','Polokwane','Mankweng',true),
  ('Mankweng High School','high','Limpopo','Polokwane','Mankweng',true),
  ('Turfloop Primary School','primary','Limpopo','Polokwane','Mankweng',true),
  ('Hwiti High School','high','Limpopo','Polokwane','Mankweng',true)
on conflict do nothing;

insert into public.projects (school_id, title, description, category, target_cents, status, priority)
select s.id, v.title, v.description, v.category, v.target_cents, v.status::project_status, v.priority
from (values
  ('Mankweng High School','Soccer field','Upgrade the school soccer field with drainage, levelling, grass and basic spectator areas.','Sport',35000000,'fundraising',1),
  ('Mankweng High School','Netball court','Build a safe surfaced netball court with markings, hoops and fencing.','Sport',20000000,'fundraising',2),
  ('Mankweng Primary School','Computer lab','Equip a secure computer lab with devices, networking and backup power.','Technology',27000000,'fundraising',1)
) as v(school_name,title,description,category,target_cents,status,priority)
join public.schools s on s.name = v.school_name
where not exists (select 1 from public.projects p where p.school_id=s.id and p.title=v.title);

insert into public.project_updates (project_id, title, body, published_at)
select p.id, 'Project opened for community support', 'The project has been verified for the Skolo Saka pilot and is now visible to the school community.', now()
from public.projects p
where not exists (select 1 from public.project_updates u where u.project_id=p.id and u.title='Project opened for community support');
