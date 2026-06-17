(function () {
  'use strict';

  /**
   * Per-language keyframe timing as fractions of each scene's duration (0–1).
   *
   * LOCKED (do not edit): `en`, `ms`, `ja` — approved sync with narration.
   */
  window.RTL3D_VIDEO_KEYFRAMES = {
    en: {
      /* LOCKED — do not modify */
      intro: {
        flash: 0.006, bolt: 0.018, boltDur: 0.123, kicker: 0.068, kickerDur: 0.11,
        titleK: 0.092, title: 0.031, titleDur: 0.135, titleStagger: 0.017,
        subtitleK: 0.197, subtitle: 0.129, subtitleDur: 0.11, boltFloatDur: 0.49
      },
      fact: {
        flash: 0.006, icon: 0.012, iconDur: 0.099, stat: 0.047, statDur: 0.11,
        line: 0.11, lineDur: 0.105, float: 0.116, floatDur: 0.30
      },
      malaysia: {
        map: 0.008, mapDur: 0.10, hotspot: 0.057, hotspotDur: 0.055,
        hotspotPulse: 0.106, hotspotPulseDur: 0.089, ring: 0.057, ringDur: 0.098,
        ringStagger: 0.016, flash: 0.065, mapLabel: 0.106, mapLabelDur: 0.049,
        statTag: 0.073, statTagDur: 0.057, statNum: 0.089, statNumDur: 0.081,
        dataLines: 0.130, dataLinesDur: 0.061, dataStagger: 0.020
      },
      acronym: {
        letters: 0.014, lettersDur: 0.067, letterStagger: 0.011, flash: 0.014,
        expand: 0.105, expandDur: 0.052, expandStagger: 0.013,
        factLine: 0.190, factLineDur: 0.076
      },
      donts: {
        icon: 0.009, iconDur: 0.062, title: 0.035, titleDur: 0.062,
        items: 0.071, itemsDur: 0.058, itemStagger: 0.044
      },
      outro: {
        flash: 0.025, logo: 0.050, logoDur: 0.212, cta: 0.150, ctaDur: 0.249,
        sub: 0.274, subDur: 0.212, ctaPulse: 0.399, ctaPulseDur: 0.399
      }
    },
    ms: {
      /* LOCKED — do not modify */
      intro: {
        flash: 0.010, bolt: 0.025, boltDur: 0.130, kicker: 0.068, kickerDur: 0.11,
        titleK: 0.092, title: 0.080, titleDur: 0.140, titleStagger: 0.020,
        subtitleK: 0.197, subtitle: 0.150, subtitleDur: 0.115, boltFloatDur: 0.45
      },
      fact: {
        flash: 0.008, icon: 0.020, iconDur: 0.095, stat: 0.080, statDur: 0.100,
        line: 0.200, lineDur: 0.095, float: 0.210, floatDur: 0.28
      },
      /** Scenes 6–9: LF/VHF, flash–bang, 30–30, indoors — narration runs longer. */
      factMid: {
        flash: 0.008, icon: 0.035, iconDur: 0.095, stat: 0.130, statDur: 0.100,
        line: 0.300, lineDur: 0.095, float: 0.310, floatDur: 0.28
      },
      malaysia: {
        map: 0.015, mapDur: 0.095, hotspot: 0.070, hotspotDur: 0.050,
        hotspotPulse: 0.120, hotspotPulseDur: 0.085, ring: 0.070, ringDur: 0.090,
        ringStagger: 0.018, flash: 0.080, mapLabel: 0.130, mapLabelDur: 0.045,
        statTag: 0.095, statTagDur: 0.055, statNum: 0.115, statNumDur: 0.075,
        dataLines: 0.180, dataLinesDur: 0.058, dataStagger: 0.022
      },
      acronym: {
        letters: 0.020, lettersDur: 0.065, letterStagger: 0.012, flash: 0.020,
        expand: 0.120, expandDur: 0.050, expandStagger: 0.014,
        factLine: 0.280, factLineDur: 0.070
      },
      donts: {
        icon: 0.012, iconDur: 0.058, title: 0.050, titleDur: 0.058,
        items: 0.100, itemsDur: 0.055, itemStagger: 0.040
      },
      outro: {
        flash: 0.020, logo: 0.060, logoDur: 0.200, cta: 0.180, ctaDur: 0.230,
        sub: 0.320, subDur: 0.200, ctaPulse: 0.420, ctaPulseDur: 0.380
      }
    },
    ja: {
      /* LOCKED — do not modify */
      intro: {
        flash: 0.010, bolt: 0.028, boltDur: 0.130, kicker: 0.068, kickerDur: 0.11,
        titleK: 0.092, title: 0.090, titleDur: 0.140, titleStagger: 0.020,
        subtitleK: 0.210, subtitle: 0.175, subtitleDur: 0.115, boltFloatDur: 0.45
      },
      fact: {
        flash: 0.008, icon: 0.022, iconDur: 0.095, stat: 0.085, statDur: 0.100,
        line: 0.210, lineDur: 0.095, float: 0.220, floatDur: 0.28
      },
      factMid: {
        flash: 0.008, icon: 0.038, iconDur: 0.095, stat: 0.150, statDur: 0.100,
        line: 0.340, lineDur: 0.095, float: 0.350, floatDur: 0.28
      },
      malaysia: {
        map: 0.015, mapDur: 0.095, hotspot: 0.072, hotspotDur: 0.050,
        hotspotPulse: 0.122, hotspotPulseDur: 0.085, ring: 0.072, ringDur: 0.090,
        ringStagger: 0.018, flash: 0.082, mapLabel: 0.135, mapLabelDur: 0.045,
        statTag: 0.098, statTagDur: 0.055, statNum: 0.118, statNumDur: 0.075,
        dataLines: 0.185, dataLinesDur: 0.058, dataStagger: 0.022
      },
      acronym: {
        letters: 0.022, lettersDur: 0.065, letterStagger: 0.012, flash: 0.022,
        expand: 0.155, expandDur: 0.050, expandStagger: 0.014,
        factLine: 0.400, factLineDur: 0.070
      },
      donts: {
        icon: 0.012, iconDur: 0.058, title: 0.052, titleDur: 0.058,
        items: 0.120, itemsDur: 0.055, itemStagger: 0.038
      },
      outro: {
        flash: 0.020, logo: 0.062, logoDur: 0.200, cta: 0.185, ctaDur: 0.230,
        sub: 0.325, subDur: 0.200, ctaPulse: 0.425, ctaPulseDur: 0.380
      }
    }
  };
})();
