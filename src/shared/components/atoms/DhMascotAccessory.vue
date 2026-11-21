<script setup lang="ts">
import { computed } from 'vue'
import { MASCOT_ACCESSORY_SLOT, normalizeMascotAccessories, type MascotAccessory } from '@/shared/components/atoms/mascotAccessoryCatalog'

const props = defineProps<{ kind?: MascotAccessory; kinds?: readonly MascotAccessory[] }>()
const rendered = computed(() => {
  const values = props.kinds ?? (props.kind ? [props.kind] : [])
  const order = { back: 0, head: 1, mouth: 2, eyes: 3, neck: 4, side: 5, accent: 6, ears: 7 }
  return normalizeMascotAccessories(values).sort((a, b) => order[MASCOT_ACCESSORY_SLOT[a]] - order[MASCOT_ACCESSORY_SLOT[b]])
})
</script>

<template>
  <svg
    v-if="rendered.length"
    class="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
    viewBox="0 0 100 100"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <g v-for="item in rendered" :key="item">
      <g v-if="item === 'cap'">
      <path d="M23 33C25 9 40 6 54 8c17 3 25 12 27 27H23Z" fill="#2563eb" stroke="#163f90" stroke-width="3" stroke-linejoin="round"/>
      <path d="M48 29c19-4 33-2 41 9-10 7-29 7-44 2l3-11Z" fill="#60a5fa" stroke="#163f90" stroke-width="3" stroke-linejoin="round"/>
      <path d="M49 13v13" stroke="#93c5fd" stroke-width="3" stroke-linecap="round"/>
    </g>
    <g v-if="item === 'crown'">
      <path d="m17 32-2-25 20 15L50 3l16 19L87 7l-4 25-6 10H24L17 32Z" fill="#fbbf24" stroke="#b45309" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M24 34h53v10H24z" fill="#fde68a" stroke="#b45309" stroke-width="3"/>
      <circle cx="36" cy="30" r="4" fill="#ef4444"/>
      <circle cx="51" cy="25" r="4" fill="#38bdf8"/>
      <circle cx="66" cy="30" r="4" fill="#a78bfa"/>
    </g>
    <g v-if="item === 'glasses'">
      <path d="M7 45h14m58 0h14m-45 0h8" stroke="#111827" stroke-width="5" stroke-linecap="round"/>
      <rect x="19" y="36" width="29" height="25" rx="10" fill="#111827" fill-opacity=".8" stroke="#334155" stroke-width="4"/>
      <rect x="54" y="36" width="29" height="25" rx="10" fill="#111827" fill-opacity=".8" stroke="#334155" stroke-width="4"/>
      <path d="m26 43 10-4m24 4 10-4" stroke="#fff" stroke-opacity=".65" stroke-width="3" stroke-linecap="round"/>
    </g>
    <g v-if="item === 'headphones'">
      <path d="M18 54V37C18 9 82 9 82 37v17" stroke="#334155" stroke-width="10" stroke-linecap="round"/>
      <path d="M18 35C21 3 79 3 82 35" stroke="#94a3b8" stroke-width="5" stroke-linecap="round"/>
      <rect x="9" y="41" width="17" height="29" rx="7" fill="#0ea5e9" stroke="#0c4a6e" stroke-width="4"/>
      <rect x="74" y="41" width="17" height="29" rx="7" fill="#0ea5e9" stroke="#0c4a6e" stroke-width="4"/>
    </g>
    <g v-if="item === 'bow'">
      <path d="M50 22C35 9 20 7 20 21s15 17 30 10c16 7 30 6 30-8 0-15-15-15-30-1Z" fill="#fb7185" stroke="#9f1239" stroke-width="3" stroke-linejoin="round"/>
      <path d="m26 17 15 9m33-9-15 9" stroke="#fda4af" stroke-width="3" stroke-linecap="round"/>
      <circle cx="50" cy="26" r="8" fill="#f43f5e" stroke="#9f1239" stroke-width="3"/>
    </g>
    <g v-if="item === 'hat'">
      <path d="m30 35 4-30h33l4 30" fill="#334155" stroke="#0f172a" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M32 28h37v8H32z" fill="#a855f7"/>
      <path d="M16 39c24-7 45-7 69 0 3 1 3 7-2 8-23 6-42 6-66 0-5-1-5-7-1-8Z" fill="#0f172a" stroke="#334155" stroke-width="3"/>
    </g>
      <g v-if="item === 'jester'">
        <path d="M18 34C9 16 20 3 34 11c8 5 12 15 15 19C49 13 62 2 75 12c14 9 9 22 6 25" fill="#9333ea" stroke="#4c1d95" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M49 30C60 4 85 6 85 27L81 39H49Z" fill="#ef4444" stroke="#991b1b" stroke-width="3"/>
        <path d="M20 33q28-8 61 2v10H20Z" fill="#fbbf24" stroke="#a16207" stroke-width="3"/>
        <circle cx="18" cy="34" r="6" fill="#fbbf24" stroke="#a16207" stroke-width="2.5"/>
        <circle cx="82" cy="29" r="6" fill="#fbbf24" stroke="#a16207" stroke-width="2.5"/>
      </g>
      <g v-if="item === 'monocle'">
        <circle cx="65" cy="46" r="16" stroke="#d6a653" stroke-width="4" fill="#fff" fill-opacity=".08"/>
        <path d="M80 49c14 5 7 18 0 25" stroke="#d6a653" stroke-width="2.5" stroke-linecap="round"/>
        <path d="m57 41 7-3" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      </g>
      <g v-if="item === 'party'">
        <path d="m22 36 14-28 15 30Z" fill="#f472b6" stroke="#9d174d" stroke-width="3" stroke-linejoin="round"/>
        <path d="m28 23 13 4M31 16l7 5" stroke="#fef08a" stroke-width="3"/>
        <circle cx="34" cy="7" r="5" fill="#22c55e"/>
        <path d="m80 9 3 5 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1Z" fill="#facc15"/>
        <circle cx="88" cy="42" r="3" fill="#38bdf8"/>
      </g>
      <g v-if="item === 'santa'">
        <path d="M18 33C25 6 50 1 68 9c11 5 17 17 19 21l-9 10H22Z" fill="#dc2626" stroke="#991b1b" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M27 21C41 5 65 11 78 27" stroke="#fca5a5" stroke-width="3" stroke-linecap="round"/>
        <path d="M17 32q33-9 66 0v13H17Z" fill="#f8fafc" stroke="#cbd5e1" stroke-width="3"/>
        <circle cx="86" cy="27" r="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2.5"/>
      </g>
      <g v-if="item === 'reindeer'">
        <path d="M27 39 15 5m12 22L6 18m18 6 2-16M73 39 85 5M73 27l21-9m-18 6-2-16" stroke="#8b5e3c" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M24 39q26-10 52 0" stroke="#92400e" stroke-width="5" stroke-linecap="round"/>
      </g>
      <g v-if="item === 'scarf'">
        <path d="M20 77Q50 86 81 76L77 93Q50 99 23 91Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="3"/>
        <path d="m33 82-1 12m16-11 1 13m16-14 2 12" stroke="#fff" stroke-width="6"/>
        <path d="M65 88 77 96l-6-1-3 5-9-7" fill="#dc2626" stroke="#7f1d1d" stroke-width="2"/>
      </g>
      <g v-if="item === 'candyCane'">
        <path d="M88 94V37a13 13 0 0 0-26 0" stroke="#fff" stroke-width="10" stroke-linecap="round"/>
        <path d="M88 92V37a13 13 0 0 0-26 0" stroke="#dc2626" stroke-width="10" stroke-dasharray="7 12"/>
      </g>
      <g v-if="item === 'lights'">
        <path d="M9 48Q3 9 50 13t42 35" stroke="#166534" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="11" cy="39" rx="4" ry="6" fill="#facc15"/>
        <ellipse cx="26" cy="21" rx="4" ry="6" fill="#f87171"/>
        <ellipse cx="49" cy="15" rx="4" ry="6" fill="#60a5fa"/>
        <ellipse cx="73" cy="20" rx="4" ry="6" fill="#facc15"/>
        <ellipse cx="89" cy="40" rx="4" ry="6" fill="#f87171"/>
      </g>
      <g v-if="item === 'witch'">
        <path d="m49 0 27 36H23Z" fill="#581c87" stroke="#2e1065" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M39 25h27l8 11H32Z" fill="#a855f7"/>
        <path d="M12 41q39-13 76 0 7 8-2 11-36 7-72 0-8-3-2-11Z" fill="#2e1065" stroke="#581c87" stroke-width="3"/>
        <circle cx="53" cy="32" r="4" fill="#facc15"/>
      </g>
      <g v-if="item === 'pumpkin'">
        <path d="M19 30C19 10 38 7 48 14c12-9 32-2 32 16 0 11-8 16-31 16-22 0-30-6-30-16Z" fill="#f97316" stroke="#9a3412" stroke-width="3"/>
        <path d="M49 14V5m-9 26c0-12 4-16 9-17m10 17c0-12-4-16-10-17" stroke="#9a3412" stroke-width="3" stroke-linecap="round"/>
        <path d="m49 5 9-2" stroke="#166534" stroke-width="5" stroke-linecap="round"/>
      </g>
      <g v-if="item === 'vampire'">
        <path d="M35 62q15 9 30 0" stroke="#7f1d1d" stroke-width="3" stroke-linecap="round"/>
        <path d="m40 64 4 12 5-10m2 0 5 10 4-12" fill="#fff" stroke="#cbd5e1" stroke-width="2" stroke-linejoin="round"/>
      </g>
      <g v-if="item === 'bat'">
        <path d="M24 59Q8 38 2 56l5 6-3 10 12-4 11 8 5-15M76 59q16-21 22-3l-5 6 3 10-12-4-11 8-5-15" fill="#6d28d9" stroke="#3b0764" stroke-width="3" stroke-linejoin="round"/>
      </g>
      <g v-if="item === 'ghost'">
        <path d="M79 57q-1-14 10-14t10 14v27l-6-5-5 5-5-5-5 5Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
        <circle cx="85" cy="58" r="2.5" fill="#334155"/><circle cx="93" cy="58" r="2.5" fill="#334155"/>
      </g>
      <g v-if="item === 'patrioticBand'">
        <path d="M19 24q31-10 62 0v22q-31-7-62 0Z" fill="#fff" stroke="#1e40af" stroke-width="2"/>
        <path d="M19 25q31-10 62 0v5q-31-9-62 0Zm0 16q31-7 62 0v5q-31-7-62 0Z" fill="#1d4ed8"/>
        <path d="M19 32q31-8 62 0v8q-31-8-62 0Z" fill="#dc2626"/>
      </g>
      <g v-if="item === 'patrioticBow'">
        <path d="M49 82C17 56 12 83 19 91c8 10 24 4 30-3 7 7 22 13 31 3 8-11-5-35-31-9Z" fill="#2563eb" stroke="#1e3a8a" stroke-width="3"/>
        <path d="M23 82q13-3 21 4m13 0q12-8 22-4" stroke="#fff" stroke-width="6"/>
        <path d="M29 85q9-1 14 2m14 0q9-5 17-2" stroke="#dc2626" stroke-width="3"/>
        <circle cx="49" cy="85" r="7" fill="#dc2626" stroke="#fff" stroke-width="2"/>
      </g>
      <g v-if="item === 'patrioticFlag'">
        <path d="M82 18v73" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>
        <path d="M84 19q-12-5-24 1v31q12-6 24-1Z" fill="#fff" stroke="#94a3b8" stroke-width="1.5"/>
        <path d="M84 19q-12-5-24 1v6q12-5 24-1Zm0 25q-12-5-24 1v6q12-6 24-1Z" fill="#1d4ed8"/>
        <path d="M60 31q12-6 24-1v14q-12-6-24 1Z" fill="#dc2626"/>
      </g>
      <g v-if="item === 'patrioticFlower'">
        <path d="M79 79q10-4 8-15m-8 15-6 8" stroke="#15803d" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="76" cy="64" rx="5" ry="10" fill="#a855f7" transform="rotate(-40 76 64)"/>
        <ellipse cx="88" cy="64" rx="5" ry="10" fill="#c084fc" transform="rotate(40 88 64)"/>
        <ellipse cx="82" cy="57" rx="5" ry="10" fill="#7e22ce"/>
        <circle cx="82" cy="65" r="5" fill="#f0abfc"/>
      </g>
    </g>
  </svg>
</template>
