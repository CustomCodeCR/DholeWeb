import { happy, mad, sad, scared, shy, sick, sleepy, smug, surprised, thinking, unsure, type Expression } from 'blobatar/expression'

// Native Blobatar morph channels keep each Dhole expression deterministic.
export const stressed: Expression = {
  ...mad,
  p: {
    ...mad.p,
    esx: 1.18,
    esy: 0.61,
    tilt: 21,
    edy: -0.85,
    edx: 0.5,
    esx2: 0.14,
    esy2: -0.27,
    tilt2: -17,
    edy2: 1.3,
    heat: 0.3,
    shake: 0.36,
    rock: 0.12,
    bdy: 0.25,
  },
}

export const tired: Expression = {
  ...sleepy,
  p: {
    ...sleepy.p,
    esx: 1.26,
    esy: 0.19,
    tilt: 9,
    edy: 3.3,
    edx: 0.7,
    esx2: -0.15,
    esy2: 0.08,
    tilt2: -17,
    edy2: 0.85,
    bdy: 2.5,
  },
}

export const resigned: Expression = {
  ...sad,
  p: {
    ...sad.p,
    esx: 1.12,
    esy: 0.43,
    tilt: 16,
    edy: 2.5,
    edx: 1.45,
    esx2: -0.18,
    esy2: -0.1,
    tilt2: -33,
    edy2: 1,
    bdy: 2,
  },
}

// Additional expressions compose native Blobatar eye, body and motion channels.

/** achicopalado: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const achicopalado: Expression = {
  ...sad,
  p: {
    ...sad.p,
    esx: 0.55,
    esy: 0.42,
    tilt: 31,
    edy: 4.2,
    edx: 1.7,
    bdy: 3.2,
  },
}

/** emperrado: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const emperrado: Expression = {
  ...mad,
  p: {
    ...mad.p,
    esx: 1.6,
    esy: 0.3,
    tilt: -40,
    edy: -0.3,
    edx: 1.2,
    bdy: -0.3,
    heat: 0.55,
    shake: 0.21,
  },
}

/** emocionado: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const emocionado: Expression = {
  ...happy,
  p: {
    ...happy.p,
    esx: 1.85,
    esy: 0.38,
    tilt: -3,
    edy: -2.6,
    edx: 1.6,
    bdy: -3.1,
    rock: 0.35,
  },
}

/** nostalgico: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const nostalgico: Expression = {
  ...sad,
  p: {
    ...sad.p,
    esx: 0.86,
    esy: 0.66,
    tilt: 13,
    edy: 2.1,
    edx: 1.4,
    bdy: 1.8,
    edy2: -0.85,
  },
}

/** desesperado: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const desesperado: Expression = {
  ...mad,
  p: {
    ...mad.p,
    esx: 1.25,
    esy: 0.75,
    tilt: -29,
    edy: -1.1,
    edx: 0.9,
    bdy: 2.5,
    shake: 0.9,
  },
}

/** aburrido: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const aburrido: Expression = {
  ...sleepy,
  p: {
    ...sleepy.p,
    esx: 1.23,
    esy: 0.29,
    tilt: 2,
    edy: 2,
    edx: 1.1,
    bdy: 1.7,
  },
}

/** pereza: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const pereza: Expression = {
  ...sleepy,
  p: {
    ...sleepy.p,
    esx: 0.94,
    esy: 0.18,
    tilt: -7,
    edy: 3.7,
    edx: 1.3,
    bdy: 3.1,
  },
}

/** celoso: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const celoso: Expression = {
  ...unsure,
  p: {
    ...unsure.p,
    esx: 1.09,
    esy: 0.59,
    tilt: -13,
    edy: -0.4,
    edx: -0.1,
    bdy: 0,
    esy2: -0.24,
    tilt2: 26,
  },
}

/** avergonzado: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const avergonzado: Expression = {
  ...shy,
  p: {
    ...shy.p,
    esx: 0.56,
    esy: 0.41,
    tilt: 14,
    edy: 2.6,
    edx: 0.1,
    bdy: 2.1,
    heat: 0.5,
  },
}

/** culpable: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const culpable: Expression = {
  ...sad,
  p: {
    ...sad.p,
    esx: 0.68,
    esy: 0.62,
    tilt: 34,
    edy: 3.8,
    edx: 0.45,
    bdy: 2.6,
    edy2: 1.3,
  },
}

/** orgulloso: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const orgulloso: Expression = {
  ...smug,
  p: {
    ...smug.p,
    esx: 1.53,
    esy: 0.5,
    tilt: 23,
    edy: -1.1,
    edx: 1.05,
    bdy: -2.7,
    tilt2: -46,
  },
}

/** curioso: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const curioso: Expression = {
  ...thinking,
  p: {
    ...thinking.p,
    esx: 1.1,
    esy: 1.04,
    tilt: 7,
    edy: -1,
    edx: 0.4,
    bdy: -0.4,
    edy2: -3.5,
    rock: 0.35,
  },
}

/** asqueado: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const asqueado: Expression = {
  ...sick,
  p: {
    ...sick.p,
    esx: 1.48,
    esy: 0.31,
    tilt: 34,
    edy: 1.5,
    edx: 1.6,
    bdy: 1.7,
    heat: 0.7,
  },
}

/** preocupado: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const preocupado: Expression = {
  ...scared,
  p: {
    ...scared.p,
    esx: 0.72,
    esy: 0.8,
    tilt: 21,
    edy: 0.4,
    edx: -0.25,
    bdy: 0.7,
    shake: 0.19,
  },
}

/** decepcionado: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const decepcionado: Expression = {
  ...sad,
  p: {
    ...sad.p,
    esx: 0.83,
    esy: 0.39,
    tilt: 10,
    edy: 3.5,
    edx: 1.6,
    bdy: 2.9,
  },
}

/** irritado: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const irritado: Expression = {
  ...mad,
  p: {
    ...mad.p,
    esx: 1.42,
    esy: 0.36,
    tilt: -25,
    edy: 1.7,
    edx: 1.4,
    bdy: 0.8,
    shake: 0.4,
    heat: 0.4,
  },
}

/** impaciente: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const impaciente: Expression = {
  ...thinking,
  p: {
    ...thinking.p,
    esx: 1.4,
    esy: 0.36,
    tilt: -16,
    edy: 0.6,
    edx: 0.4,
    bdy: 0.25,
    edy2: -1.8,
    rock: 0.9,
    shake: 0.3,
  },
}

/** ojosLlorosos: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const ojosLlorosos: Expression = {
  ...sad,
  p: {
    ...sad.p,
    esx: 0.88,
    esy: 1.16,
    tilt: 18,
    edy: 1.5,
    edx: 1.6,
    bdy: 1.9,
    esy2: 0.15,
  },
}

/** arrogante: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const arrogante: Expression = {
  ...smug,
  p: {
    ...smug.p,
    esx: 1.68,
    esy: 0.27,
    tilt: -18,
    edy: -2.2,
    edx: 1.4,
    bdy: -1.2,
    tilt2: 36,
  },
}

/** melancolico: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const melancolico: Expression = {
  ...sad,
  p: {
    ...sad.p,
    esx: 0.72,
    esy: 0.84,
    tilt: 6,
    edy: 2.4,
    edx: 2,
    bdy: 3.4,
    edy2: -1.2,
  },
}

/** humillado: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const humillado: Expression = {
  ...shy,
  p: {
    ...shy.p,
    esx: 0.54,
    esy: 0.32,
    tilt: 23,
    edy: 4,
    edx: 0.4,
    bdy: 3.2,
  },
}

/** miserable: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const miserable: Expression = {
  ...sad,
  p: {
    ...sad.p,
    esx: 0.45,
    esy: 0.38,
    tilt: 36,
    edy: 4.4,
    edx: 1.8,
    bdy: 4.1,
  },
}

/** abrumado: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const abrumado: Expression = {
  ...scared,
  p: {
    ...scared.p,
    esx: 0.88,
    esy: 0.65,
    tilt: 19,
    edy: 1.8,
    edx: -0.3,
    bdy: 2.3,
    shake: 0.46,
  },
}

/** vulnerable: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const vulnerable: Expression = {
  ...scared,
  p: {
    ...scared.p,
    esx: 0.69,
    esy: 1.08,
    tilt: -1,
    edy: 1.3,
    edx: 1,
    bdy: 1,
    shake: 0.12,
  },
}

/** rechazado: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const rechazado: Expression = {
  ...sad,
  p: {
    ...sad.p,
    esx: 0.7,
    esy: 0.52,
    tilt: 4,
    edy: 2.6,
    edx: 2.5,
    bdy: 3.1,
    edy2: 0.9,
  },
}

/** desilusionado: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const desilusionado: Expression = {
  ...sad,
  p: {
    ...sad.p,
    esx: 1.02,
    esy: 0.47,
    tilt: 25,
    edy: 2.8,
    edx: 1.1,
    bdy: 2,
    edy2: -1,
  },
}

/** alarmado: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const alarmado: Expression = {
  ...surprised,
  p: {
    ...surprised.p,
    esx: 1.34,
    esy: 1.14,
    tilt: -16,
    edy: -0.9,
    edx: 1,
    bdy: -2.2,
    shake: 0.5,
  },
}

/** horrorizado: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const horrorizado: Expression = {
  ...scared,
  p: {
    ...scared.p,
    esx: 1.02,
    esy: 1.26,
    tilt: -23,
    edy: -2.1,
    edx: -0.15,
    bdy: -1.5,
    shake: 0.8,
  },
}

/** pasmado: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const pasmado: Expression = {
  ...surprised,
  p: {
    ...surprised.p,
    esx: 1.16,
    esy: 1.36,
    tilt: 0,
    edy: -2.2,
    edx: 0.9,
    bdy: -1.6,
  },
}

/** irritable: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const irritable: Expression = {
  ...mad,
  p: {
    ...mad.p,
    esx: 1.72,
    esy: 0.28,
    tilt: -14,
    edy: 1.2,
    edx: 0.95,
    bdy: 0.8,
    shake: 0.63,
    heat: 0.5,
  },
}

/** desconcertado: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const desconcertado: Expression = {
  ...unsure,
  p: {
    ...unsure.p,
    esx: 0.84,
    esy: 1.22,
    tilt: 12,
    edy: -0.2,
    edx: 0.55,
    bdy: 0.1,
    esy2: -0.57,
    tilt2: -23,
    edy2: -1,
  },
}

/** desmotivado: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const desmotivado: Expression = {
  ...sleepy,
  p: {
    ...sleepy.p,
    esx: 0.84,
    esy: 0.35,
    tilt: 19,
    edy: 3.2,
    edx: 2.2,
    bdy: 3,
  },
}

/** resentido: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const resentido: Expression = {
  ...mad,
  p: {
    ...mad.p,
    esx: 1.24,
    esy: 0.31,
    tilt: -35,
    edy: 1.1,
    edx: 0.9,
    bdy: 0.7,
    esy2: 0.16,
    heat: 0.35,
    shake: 0.12,
  },
}

/** agobiado: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const agobiado: Expression = {
  ...stressed,
  p: {
    ...stressed.p,
    esx: 1.11,
    esy: 0.42,
    tilt: 27,
    edy: 1.3,
    edx: 0.25,
    bdy: 2.2,
    shake: 0.55,
  },
}

/** temeroso: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const temeroso: Expression = {
  ...scared,
  p: {
    ...scared.p,
    esx: 0.63,
    esy: 0.78,
    tilt: -19,
    edy: -0.3,
    edx: -0.5,
    bdy: 0.9,
    shake: 0.3,
  },
}

/** incomodo: distinct pose, preserving Blobatar's accessible SVG renderer. */
export const incomodo: Expression = {
  ...shy,
  p: {
    ...shy.p,
    esx: 1.06,
    esy: 0.42,
    tilt: 22,
    edy: 1.8,
    edx: 0.55,
    bdy: 1.1,
    esy2: -0.25,
    heat: 0.4,
  },
}
