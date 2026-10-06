/** Decorative linework, not a chart: no values, scales or data encoding. */
export function AbstractField({ kind }: { kind: "household" | "contours" | "evidence" | "architecture" }) {
  return <svg className={`abstract-field abstract-field-${kind}`} viewBox="0 0 300 160" fill="none" aria-hidden="true" focusable="false">
    {kind === "household" ? <>
      <circle className="abstract-wash" cx="190" cy="84" r="62" />
      <circle cx="148" cy="84" r="62" /><circle cx="190" cy="84" r="62" />
      <path d="M58 146H267M89 146V68L147 25L205 68V146M117 146V103H150V146" />
    </> : kind === "contours" ? <>
      <path className="abstract-wash" d="M86 149C32 116 88 18 150 28S202 98 265 76V160H86Z" />
      {[0, 1, 2, 3, 4].map(i => <path key={i} transform={`translate(${i * 10} ${i * -7})`} d="M30 149C-5 110 55 29 106 42S166 130 246 93S288 40 320 18" />)}
    </> : kind === "architecture" ? <>
      <path className="abstract-wash" d="M40 145V105H85V72H135V95H180V40H230V70H275V145Z" />
      {[0,1,2].map(i=><path key={i} transform={`translate(${i*9} ${i*-8})`} d="M18 145H40V105H85V72H135V95H180V40H230V70H275V145H300" />)}
      <path d="M25 156H292M42 30Q130 -15 205 28T300 35" />
    </> : <>
      <circle className="abstract-wash" cx="211" cy="72" r="65" />
      {[0, 1, 2, 3, 4].map(i => <ellipse key={i} cx="195" cy="82" rx={28 + i * 15} ry="65" transform="rotate(-30 195 82)" />)}
      <path d="M72 139L283 17M92 154L300 34" />
    </>}
  </svg>;
}
