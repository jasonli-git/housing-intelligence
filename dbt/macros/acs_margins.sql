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

-- The margin of a sum of HUD's bulk CHAS cells, by Table 8 column number (#353): the
-- root sum of squares, except that of the cells whose estimate is zero only the largest
-- margin counts (ACS General Handbook, ch. 8, which says to use the largest zero
-- margin once rather than each). HUD gives every zero cell a margin of 32, so summing
-- them all would widen a burden margin by 32 for each empty income band.
{% macro chas_sum_margin(cells) -%}
    sqrt(
        {% for c in cells %}case when json['T8_est{{ c }}']::double <> 0
            then json['T8_moe{{ c }}']::double ^ 2 else 0 end + {% endfor %}
        coalesce(list_max([{% for c in cells %}case when json['T8_est{{ c }}']::double = 0
            then json['T8_moe{{ c }}']::double end{% if not loop.last %}, {% endif %}{% endfor %}]), 0) ^ 2
    )
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

-- The median of a distribution the Census publishes only in brackets (Milestone 33), by
-- linear interpolation within the bracket holding the middle household — the method the
-- Census uses for its own medians. `prefix` names columns `<prefix>0`…`<prefix>n-1`, one
-- count per bracket in order, and `bounds` their lower bounds: bracket i runs from
-- bounds[i] to bounds[i+1], and the last is open-ended. A median falling in the open
-- bracket cannot be interpolated and is NULL rather than its lower bound, which would
-- read as a figure the survey does not give. NULL too where no household is counted.
{% macro bracket_median(prefix, bounds) -%}
    {%- set n = bounds | length -%}
    {%- set total -%}({% for i in range(n) %}{{ prefix }}{{ i }}{% if not loop.last %} + {% endif %}{% endfor %}){%- endset -%}
    case
        when {{ total }} is null or {{ total }} = 0 then null
    {%- for i in range(n) %}
        {%- set before -%}(0.0{% for j in range(i) %} + {{ prefix }}{{ j }}{% endfor %}){%- endset %}
        when {{ before }} + {{ prefix }}{{ i }} >= {{ total }} / 2.0 then
            {% if i == n - 1 -%}
            null
            {%- else -%}
            {{ bounds[i] }} + ({{ total }} / 2.0 - {{ before }}) / nullif({{ prefix }}{{ i }}, 0)
                * ({{ bounds[i + 1] }} - {{ bounds[i] }})
            {%- endif %}
    {%- endfor %}
    end
{%- endmacro %}

-- The margin of a ratio X / Y where X is not a subset of Y — minutes of commuting per
-- commuter (ACS General Handbook, chapter 8): sqrt(MOE_X^2 + R^2 * MOE_Y^2) / Y.
{% macro acs_ratio_margin(x, y, moe_x, moe_y) -%}
    case
        when ({{ y }}) > 0 then
            sqrt(({{ moe_x }}) ^ 2 + (({{ x }}) / ({{ y }})) ^ 2 * ({{ moe_y }}) ^ 2) / ({{ y }})
    end
{%- endmacro %}
