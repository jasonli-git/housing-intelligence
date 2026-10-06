/** NJ's garden/coast motif: decorative linework, not a geographic or statistical claim. */
export function GardenStateArtwork({ header = false }: { header?: boolean }) {
  return <svg className={`state-place-artwork${header ? " state-place-artwork-header" : ""}`} viewBox="0 0 380 260" fill="none" aria-hidden="true" focusable="false">
    <circle className="state-artwork-wash" cx="229" cy="126" r="92" />
    <g className="state-artwork-trace">
      <path pathLength="1" d="M34 227C93 170 94 148 162 138S269 92 341 29M60 240C128 190 128 153 189 147S288 105 356 56M100 248C162 203 173 174 216 165S303 122 365 86" />
      <path pathLength="1" d="M169 214V110C169 86 178 65 194 50M169 156C144 153 126 132 126 108C154 107 169 128 169 156ZM171 126C202 124 221 104 221 77C192 79 173 99 171 126ZM180 80C157 77 144 62 145 42C167 45 181 59 180 80Z" />
      <path pathLength="1" d="M35 180V152L57 135L79 152V180M28 157L57 135L86 157M49 180V161H65V180M279 192V169L298 155L317 169V192M271 174L298 155L325 174" />
    </g>
    <g className="state-artwork-points"><circle cx="57" cy="199" r="2" /><circle cx="127" cy="188" r="2" /><circle cx="245" cy="133" r="2" /><circle cx="298" cy="210" r="2" /></g>
  </svg>;
}
