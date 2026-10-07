-- Home-purchase mortgage applications in New Jersey (Milestone 48, ARCHITECTURE #324):
-- first liens to buy an owner-occupied one-to-four-family home, from HMDA, one row per
-- application with its tract and what was decided.
--
-- Refinances, home-equity lines, reverse mortgages and business-purpose loans are left
-- out: they answer a different question from what financing buyers here used.
{{ config(materialized='table') }}

select activity_year::integer as year,
       census_tract as tract,
       left(census_tract, 5) as county,
       action_taken,
       loan_type,
       try_cast(interest_rate as double) as interest_rate,
       try_cast(loan_amount as double) as loan_amount,
       try_cast(loan_to_value_ratio as double) as ltv,
       try_cast(total_loan_costs as double) as loan_costs,
       -- Reported in thousands of dollars.
       try_cast(income as double) * 1000 as income,
       "denial_reason-1" as denial_reason
from read_parquet('{{ var("parquet_dir") }}/ffiec_hmda/*/nj_*.parquet')
where loan_purpose = '1'
  and lien_status = '1'
  and occupancy_type = '1'
  and derived_dwelling_category like 'Single Family (1-4 Units)%'
  and business_or_commercial_purpose <> '1'
  and reverse_mortgage <> '1'
  and "open-end_line_of_credit" <> '1'
  and length(census_tract) = 11
  and left(census_tract, 2) = '34'
