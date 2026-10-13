-- Ten reviewed cohorts per matched place; zero households is valid, not missing.
select level,geoid from {{ ref('stg_housing_pressure') }}
group by level,geoid
having count(*) <> 10 or count(distinct tenure || ':' || band::varchar) <> 10
union all
select level,geoid from {{ ref('stg_housing_pressure') }}
where vintage <> '2018-2022' or geoid is null or file_sha256 is null
   or total < 0 or burdened < 0 or severe < 0 or unknown < 0
   or total_moe < 0 or burdened_moe < 0 or severe_moe < 0 or unknown_moe < 0
   or severe > burdened + 15 or burdened + unknown > total + 15
