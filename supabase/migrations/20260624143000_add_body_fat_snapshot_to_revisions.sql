alter table public.revisions
add column if not exists body_fat_skinfolds_pct numeric,
add column if not exists body_fat_pct numeric;

comment on column public.revisions.body_fat_skinfolds_pct is 'Percentual de grasa calculado por la formula de pliegues en el momento de la revision.';
comment on column public.revisions.body_fat_pct is 'Percentual de grasa final almacenado para la revision, usado para composicion historica.';

with computed as (
  select
    r.id,
    case
      when c.date_birth is null or r.reviewed_at is null then null
      else greatest(0, extract(year from age(r.reviewed_at::date, c.date_birth))::int)
    end as age_years,
    case
      when lower(coalesce(c.sex, '')) in ('female', 'mujer') then 'female'
      when lower(coalesce(c.sex, '')) in ('male', 'hombre') then 'male'
      else null
    end as normalized_sex,
    case
      when c.height_cm is null or c.height_cm <= 0 then null
      when r.neck_cm is null or r.belly_cm is null then null
      when lower(coalesce(c.sex, '')) in ('female', 'mujer') and r.glute_cm is null then null
      when lower(coalesce(c.sex, '')) in ('female', 'mujer') then
        case
          when (r.belly_cm + r.glute_cm - r.neck_cm) <= 0 then null
          else 495 / nullif(
            1.29579 - 0.35004 * (ln(r.belly_cm + r.glute_cm - r.neck_cm) / ln(10)) + 0.22100 * (ln(c.height_cm) / ln(10)),
            0
          ) - 450
        end
      else
        case
          when (r.belly_cm - r.neck_cm) <= 0 then null
          else 495 / nullif(
            1.0324 - 0.19077 * (ln(r.belly_cm - r.neck_cm) / ln(10)) + 0.15456 * (ln(c.height_cm) / ln(10)),
            0
          ) - 450
        end
    end as perimeter_body_fat_pct,
    case
      when c.date_birth is null or r.reviewed_at is null then null
      when r.bicep_fold_mm is null or r.tricep_fold_mm is null or r.subscapular_fold_mm is null or r.suprailiac_fold_mm is null then null
      when lower(coalesce(c.sex, '')) not in ('female', 'mujer', 'male', 'hombre') then null
      else
        case
          when lower(coalesce(c.sex, '')) in ('male', 'hombre') then
            case
              when extract(year from age(r.reviewed_at::date, c.date_birth))::int <= 19 then
                495 / nullif(
                  1.162 - 0.063 * (ln(r.bicep_fold_mm + r.tricep_fold_mm + r.subscapular_fold_mm + r.suprailiac_fold_mm) / ln(10)),
                  0
                ) - 450
              when extract(year from age(r.reviewed_at::date, c.date_birth))::int <= 29 then
                495 / nullif(
                  1.1631 - 0.0632 * (ln(r.bicep_fold_mm + r.tricep_fold_mm + r.subscapular_fold_mm + r.suprailiac_fold_mm) / ln(10)),
                  0
                ) - 450
              when extract(year from age(r.reviewed_at::date, c.date_birth))::int <= 39 then
                495 / nullif(
                  1.1422 - 0.0544 * (ln(r.bicep_fold_mm + r.tricep_fold_mm + r.subscapular_fold_mm + r.suprailiac_fold_mm) / ln(10)),
                  0
                ) - 450
              when extract(year from age(r.reviewed_at::date, c.date_birth))::int <= 49 then
                495 / nullif(
                  1.162 - 0.07 * (ln(r.bicep_fold_mm + r.tricep_fold_mm + r.subscapular_fold_mm + r.suprailiac_fold_mm) / ln(10)),
                  0
                ) - 450
              else
                495 / nullif(
                  1.1715 - 0.0779 * (ln(r.bicep_fold_mm + r.tricep_fold_mm + r.subscapular_fold_mm + r.suprailiac_fold_mm) / ln(10)),
                  0
                ) - 450
            end
          else
            case
              when extract(year from age(r.reviewed_at::date, c.date_birth))::int <= 19 then
                495 / nullif(
                  1.1549 - 0.0678 * (ln(r.bicep_fold_mm + r.tricep_fold_mm + r.subscapular_fold_mm + r.suprailiac_fold_mm) / ln(10)),
                  0
                ) - 450
              when extract(year from age(r.reviewed_at::date, c.date_birth))::int <= 29 then
                495 / nullif(
                  1.1599 - 0.0717 * (ln(r.bicep_fold_mm + r.tricep_fold_mm + r.subscapular_fold_mm + r.suprailiac_fold_mm) / ln(10)),
                  0
                ) - 450
              when extract(year from age(r.reviewed_at::date, c.date_birth))::int <= 39 then
                495 / nullif(
                  1.1423 - 0.0632 * (ln(r.bicep_fold_mm + r.tricep_fold_mm + r.subscapular_fold_mm + r.suprailiac_fold_mm) / ln(10)),
                  0
                ) - 450
              when extract(year from age(r.reviewed_at::date, c.date_birth))::int <= 49 then
                495 / nullif(
                  1.1333 - 0.0612 * (ln(r.bicep_fold_mm + r.tricep_fold_mm + r.subscapular_fold_mm + r.suprailiac_fold_mm) / ln(10)),
                  0
                ) - 450
              else
                495 / nullif(
                  1.1339 - 0.0645 * (ln(r.bicep_fold_mm + r.tricep_fold_mm + r.subscapular_fold_mm + r.suprailiac_fold_mm) / ln(10)),
                  0
                ) - 450
            end
        end
    end as skinfold_body_fat_pct
  from public.revisions r
  join public.clients c on c.id = r.client_id
)
update public.revisions r
set
  body_fat_skinfolds_pct = computed.skinfold_body_fat_pct,
  body_fat_pct = case
    when computed.skinfold_body_fat_pct is not null and computed.perimeter_body_fat_pct is not null and r.body_fat_visual_pct is not null then
      (computed.skinfold_body_fat_pct + computed.perimeter_body_fat_pct + r.body_fat_visual_pct) / 3.0
    when computed.skinfold_body_fat_pct is not null and computed.perimeter_body_fat_pct is not null then
      (computed.skinfold_body_fat_pct + computed.perimeter_body_fat_pct) / 2.0
    when computed.skinfold_body_fat_pct is not null and r.body_fat_visual_pct is not null then
      (computed.skinfold_body_fat_pct + r.body_fat_visual_pct) / 2.0
    when computed.perimeter_body_fat_pct is not null and r.body_fat_visual_pct is not null then
      (computed.perimeter_body_fat_pct + r.body_fat_visual_pct) / 2.0
    when computed.skinfold_body_fat_pct is not null then computed.skinfold_body_fat_pct
    when computed.perimeter_body_fat_pct is not null then computed.perimeter_body_fat_pct
    else r.body_fat_visual_pct
  end
from computed
where r.id = computed.id;