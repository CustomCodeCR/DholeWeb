import { mad, sad, sleepy, type Expression } from 'blobatar/expression'

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
