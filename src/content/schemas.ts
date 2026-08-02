// schema v3
import { z } from 'zod';
export const schemas = {
  home: z.object({
    hero: z.object({
      headline: z.string(),
      headlineAccent: z.string(),
      subhead: z.string(),
      ctaPrimary: z.string(),
      ctaSecondary: z.string()
    }),
    features: z.object({
      eyebrow: z.string(),
      headline: z.string(),
      subhead: z.string(),
      cards: z.array(z.object({
        id: z.string(),
        size: z.string(),
        title: z.string(),
        description: z.string()
      }))
    }),
    howItWorks: z.object({
      eyebrow: z.string(),
      headline: z.string(),
      steps: z.array(z.object({
        id: z.string(),
        number: z.string(),
        title: z.string(),
        description: z.string()
      }))
    }),
    cta: z.object({
      headline: z.string(),
      headlineAccent: z.string(),
      subhead: z.string(),
      ctaPrimary: z.string(),
      ctaSecondary: z.string()
    })
  }),
  pricing: z.object({
    "hero": z.object({
      "eyebrow": z.string(),
      "headline": z.string(),
      "subheadline": z.string()
    }),
    "tiers": z.array(z.object({
      "id": z.string(),
      "name": z.string(),
      "tagline": z.string(),
      "price": z.string(),
      "period": z.string(),
      "cta": z.string(),
      "ctaHref": z.string(),
      "highlighted": z.boolean(),
      "features": z.array(z.string()),
      "notIncluded": z.array(z.string())
    })),
    "faq": z.array(z.object({
      "id": z.string(),
      "question": z.string(),
      "answer": z.string()
    })),
    "cta": z.object({
      "headline": z.string(),
      "subheadline": z.string(),
      "primaryCta": z.string(),
      "primaryHref": z.string(),
      "secondaryCta": z.string(),
      "secondaryHref": z.string()
    })
  }),
  pitch_analysis: z.object({
    "hero": z.object({
      "title": z.string(),
      "subtitle": z.string()
    }),
    "upload": z.object({
      "dropTitle": z.string(),
      "dropSubtitle": z.string(),
      "analyzeButton": z.string(),
      "analyzingTitle": z.string(),
      "analyzingNote": z.string(),
      "doneTitle": z.string(),
      "doneSubtitle": z.string()
    }),
    "features": z.array(z.object({
      "id": z.string(),
      "label": z.string(),
      "desc": z.string()
    })),
    "recent": z.object({
      "sectionLabel": z.string()
    })
  }),
  strike_zone: z.object({
    "page": z.object({
      "title": z.string(),
      "locationLabel": z.string(),
      "heatMapLabel": z.string(),
      "veloByZoneLabel": z.string()
    }),
    "filters": z.object({
      "playerLabel": z.string(),
      "sessionLabel": z.string(),
      "pitchTypeLabel": z.string(),
      "resultLabel": z.string()
    }),
    "empty": z.object({
      "title": z.string(),
      "subtitle": z.string()
    }),
    "resultLabels": z.object({
      "strike": z.string(),
      "ball": z.string(),
      "foul": z.string(),
      "swinging_strike": z.string(),
      "hit": z.string()
    })
  }),
  dashboard: z.object({
    "meta": z.object({
      "title": z.string(),
      "description": z.string()
    }),
    "nav": z.object({
      "dashboard": z.string(),
      "players": z.string(),
      "strikeZone": z.string(),
      "videoAnalysis": z.string()
    }),
    "noSession": z.object({
      "title": z.string(),
      "subtitle": z.string(),
      "newSessionButton": z.string(),
      "addPlayerLink": z.string()
    }),
    "sidebar": z.object({
      "playerLabel": z.string(),
      "noPlayersText": z.string(),
      "addPlayerLink": z.string(),
      "sessionsLabel": z.string(),
      "noSessionsText": z.string(),
      "newSessionButton": z.string()
    }),
    "views": z.object({
      "liveLabel": z.string(),
      "logLabel": z.string()
    }),
    "panels": z.object({
      "pitchLocationLabel": z.string(),
      "velocityByPitchLabel": z.string(),
      "pitchMixLabel": z.string(),
      "logNextPitchLabel": z.string(),
      "pitchLogTitle": z.string()
    }),
    "modal": z.object({
      "title": z.string(),
      "playerLabel": z.string(),
      "sessionLabelField": z.string(),
      "sessionLabelPlaceholder": z.string(),
      "notesField": z.string(),
      "notesPlaceholder": z.string(),
      "cancelButton": z.string(),
      "submitIdle": z.string(),
      "submitLoading": z.string()
    }),
    "table": z.object({
      "colNumber": z.string(),
      "colType": z.string(),
      "colResult": z.string(),
      "colVelocity": z.string(),
      "colSpinRate": z.string(),
      "colLocation": z.string(),
      "noPitchesText": z.string()
    })
  }),
  auth: z.object({
    "headingLogin": z.string(),
    "headingSignup": z.string(),
    "headingOAuthOnly": z.string(),
    "subheadingOAuthOnly": z.string(),
    "passwordHint": z.string(),
    "termsNotice": z.string()
  })
};
export type Schemas = typeof schemas;