"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * A way into any county from any page.
 *
 * A select and a Go button rather than a select that navigates on change: arrowing
 * through a closed select fires `change` on every step in some browsers, so a keyboard
 * reader would be carried to Atlantic County before reaching the one they wanted.
 */
export function CountyPicker({ counties }: { counties: { id: number; name: string }[] }) {
  const router = useRouter();
  const [id, setId] = useState("");

  return (
    <form
      className="picker"
      onSubmit={(event) => {
        event.preventDefault();
        if (id) router.push(`/regions/${id}`);
      }}
    >
      <label className="picker-label" htmlFor="county-picker">
        County
      </label>
      <select id="county-picker" value={id} onChange={(event) => setId(event.target.value)}>
        <option value="">Choose…</option>
        {counties.map((county) => (
          <option key={county.id} value={county.id}>
            {county.name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={!id}>
        Go
      </button>
    </form>
  );
}
