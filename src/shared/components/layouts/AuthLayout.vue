<template>
  <main class="grid min-h-screen place-items-center p-6">
    <section class="dh-glass dh-liquid w-full max-w-md rounded-[38px] p-8 shadow-[var(--dh-shadow-lg)]">
      <div class="mb-8 text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[26px] bg-[var(--dh-primary)] text-2xl font-black text-white shadow-[var(--dh-glow)]">D</div>
        <h1 class="text-3xl font-black text-[var(--dh-text)]">Dhole</h1>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Operations Platform</p>
      </div>
      <RouterView />
    </section>
  </main>
</template>
