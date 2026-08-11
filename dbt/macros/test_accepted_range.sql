{#
  A numeric range test, written here rather than pulled from dbt_utils so the project
  needs no `dbt deps` and no network to run its tests.

  Returns the offending rows; dbt fails the test if any come back.
#}
{% test accepted_range(model, column_name, min_value, max_value) %}

select *
from {{ model }}
where {{ column_name }} is not null
  and ({{ column_name }} < {{ min_value }} or {{ column_name }} > {{ max_value }})

{% endtest %}
