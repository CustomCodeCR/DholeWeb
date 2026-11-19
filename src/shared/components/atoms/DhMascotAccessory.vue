<script setup lang="ts">
import type { MascotAccessory } from '@/core/stores/avatarMascotStore'

defineProps<{ kind: MascotAccessory }>()
</script>

<template>
  <svg
    v-if="kind !== 'none'"
    class="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
    viewBox="0 0 100 100"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <g v-if="kind === 'cap'">
      <path d="M23 33C25 9 40 6 54 8c17 3 25 12 27 27H23Z" fill="#2563eb" stroke="#163f90" stroke-width="3" stroke-linejoin="round"/>
      <path d="M48 29c19-4 33-2 41 9-10 7-29 7-44 2l3-11Z" fill="#60a5fa" stroke="#163f90" stroke-width="3" stroke-linejoin="round"/>
      <path d="M49 13v13" stroke="#93c5fd" stroke-width="3" stroke-linecap="round"/>
    </g>
    <g v-else-if="kind === 'crown'">
      <path d="m17 32-2-25 20 15L50 3l16 19L87 7l-4 25-6 10H24L17 32Z" fill="#fbbf24" stroke="#b45309" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M24 34h53v10H24z" fill="#fde68a" stroke="#b45309" stroke-width="3"/>
      <circle cx="36" cy="30" r="4" fill="#ef4444"/>
      <circle cx="51" cy="25" r="4" fill="#38bdf8"/>
      <circle cx="66" cy="30" r="4" fill="#a78bfa"/>
    </g>
    <g v-else-if="kind === 'glasses'">
      <path d="M7 45h14m58 0h14m-45 0h8" stroke="#111827" stroke-width="5" stroke-linecap="round"/>
      <rect x="19" y="36" width="29" height="25" rx="10" fill="#111827" fill-opacity=".8" stroke="#334155" stroke-width="4"/>
      <rect x="54" y="36" width="29" height="25" rx="10" fill="#111827" fill-opacity=".8" stroke="#334155" stroke-width="4"/>
      <path d="m26 43 10-4m24 4 10-4" stroke="#fff" stroke-opacity=".65" stroke-width="3" stroke-linecap="round"/>
    </g>
    <g v-else-if="kind === 'headphones'">
      <path d="M18 54V37C18 9 82 9 82 37v17" stroke="#334155" stroke-width="10" stroke-linecap="round"/>
      <path d="M18 35C21 3 79 3 82 35" stroke="#94a3b8" stroke-width="5" stroke-linecap="round"/>
      <rect x="9" y="41" width="17" height="29" rx="7" fill="#0ea5e9" stroke="#0c4a6e" stroke-width="4"/>
      <rect x="74" y="41" width="17" height="29" rx="7" fill="#0ea5e9" stroke="#0c4a6e" stroke-width="4"/>
    </g>
    <g v-else-if="kind === 'bow'">
      <path d="M50 22C35 9 20 7 20 21s15 17 30 10c16 7 30 6 30-8 0-15-15-15-30-1Z" fill="#fb7185" stroke="#9f1239" stroke-width="3" stroke-linejoin="round"/>
      <path d="m26 17 15 9m33-9-15 9" stroke="#fda4af" stroke-width="3" stroke-linecap="round"/>
      <circle cx="50" cy="26" r="8" fill="#f43f5e" stroke="#9f1239" stroke-width="3"/>
    </g>
    <g v-else-if="kind === 'hat'">
      <path d="m30 35 4-30h33l4 30" fill="#334155" stroke="#0f172a" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M32 28h37v8H32z" fill="#a855f7"/>
      <path d="M16 39c24-7 45-7 69 0 3 1 3 7-2 8-23 6-42 6-66 0-5-1-5-7-1-8Z" fill="#0f172a" stroke="#334155" stroke-width="3"/>
    </g>
  </svg>
</template>
