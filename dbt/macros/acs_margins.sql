-- Margins of error for ACS estimates (Milestone 28).
--
-- The Census publishes a 90% margin of error beside every ACS estimate, as the same
-- variable with `M` in place of `E`. Two things about it are easy to get wrong, and
-- these macros exist so no staging model gets them wrong on its own.

-- A published margin, or NULL. Negative values are codes, not margins, and must never
-- reach the warehouse as numbers: -555555555 means the estimate is controlled, so it
-- has no sampling error (a margin of 0); every other code (-222222222 too few sample
-- cases, -333333333 a median in an open-ended interval, -666666666, -888888888,
-- -999999999) means the margin is unknown or does not apply.
{% macro acs_margin(column) -%}
    case
        when {{ column }} = '-555555555' then 0.0
        when {{ column }} like '-%' then null
        else nullif({{ column }}, '')::double
    end
{%- endmacro %}

-- The margin of a sum of estimates: the square root of the sum of their squared
-- margins (ACS General Handbook, chapter 8). NULL if any part's margin is unknown.
{% macro acs_sum_margin(margins) -%}
    sqrt({% for m in margins %}({{ m }}) ^ 2{% if not loop.last %} + {% endif %}{% endfor %})
{%- endmacro %}

-- The margin of a share X / Y where X is a subset of Y — renters cost-burdened among
-- renters, vacant units among all units. The Census's approximation:
-- sqrt(MOE_X^2 - p^2 * MOE_Y^2) / Y, and when the term under the root is negative,
-- the ratio form sqrt(MOE_X^2 + p^2 * MOE_Y^2) / Y instead (ACS General Handbook,
-- chapter 8). A share of 0 or 1 still has a margin; the formula handles both.
{% macro acs_share_margin(x, y, moe_x, moe_y) -%}
    case
        when ({{ y }}) > 0 then
            case
                when ({{ moe_x }}) ^ 2 - (({{ x }}) / ({{ y }})) ^ 2 * ({{ moe_y }}) ^ 2 >= 0
                then sqrt(({{ moe_x }}) ^ 2 - (({{ x }}) / ({{ y }})) ^ 2 * ({{ moe_y }}) ^ 2)
                     / ({{ y }})
                -- Also reached when a margin is unknown: every term is then NULL, and so
                -- is the result.
                else sqrt(({{ moe_x }}) ^ 2 + (({{ x }}) / ({{ y }})) ^ 2 * ({{ moe_y }}) ^ 2)
                     / ({{ y }})
            end
    end
{%- endmacro %}
