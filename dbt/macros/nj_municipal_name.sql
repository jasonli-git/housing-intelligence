{#
    Normalize a municipality name for matching MOD-IV against Census.

    MOD-IV writes `MUN_NAME` into a fixed-width field, so it abbreviates: "MT HOLLY
    TWP", "SO HACKENSACK TWP", "HASBROUCK HGHTS BORO". Census writes the same places in
    full. Both are describing the same 564 municipalities, and the differences are
    orthographic, not semantic.

    Two rules, in order:

    1. Expand abbreviations that are *general* — legal forms and compass directions —
       as whole words, so "NO HANOVER" becomes "NORTH HANOVER" but "NORWOOD" is left
       alone.
    2. Strip everything that is not a letter or digit, which absorbs the remaining
       differences in spacing and hyphenation: "HOHOKUS" and "Ho-Ho-Kus", "FAIRLAWN"
       and "Fair Lawn", "WOOD RIDGE" and "Wood-Ridge".

    What this deliberately does **not** do is strip a legal form. Removing "township"
    is what merged Boonton with Boonton Township and Egg Harbor City with Egg Harbor
    Township at Milestone 2 (ARCHITECTURE #27, #28). The form is carried through and
    matched, which is precisely why this source resolves where Zillow could not.

    Nor does it guess at truncation. Ten municipalities remain unmatched because MOD-IV
    cut the name to fit — "UPPER SADDLE RIV", "PARSIPPANY TR HLS", "SOUTH ORANGE
    VILLAGE TW" — and inventing a rule per place is exactly the guessing #27 rejects.
    They are reported rather than resolved.
#}
{% macro nj_municipal_name(column) %}
    regexp_replace(upper(
        {%- set expansions = [
            ('TWP', 'TOWNSHIP'), ('TWNSHP', 'TOWNSHIP'), ('TWSHP', 'TOWNSHIP'),
            ('BORO', 'BOROUGH'), ('BOR', 'BOROUGH'),
            ('MT', 'MOUNT'), ('HGHTS', 'HEIGHTS'), ('HTS', 'HEIGHTS'),
            ('NO', 'NORTH'), ('SO', 'SOUTH'),
            ('N', 'NORTH'), ('S', 'SOUTH'), ('E', 'EAST'), ('W', 'WEST')
        ] -%}
        {%- set ns = namespace(sql='upper(trim(' ~ column ~ '))') -%}
        {%- for short, long in expansions -%}
            {%- set ns.sql = "regexp_replace(" ~ ns.sql ~ ", '\\b" ~ short ~ "\\b', '" ~ long ~ "', 'g')" -%}
        {%- endfor -%}
        {{ ns.sql }}
    ), '[^A-Z0-9]', '', 'g')
{% endmacro %}
