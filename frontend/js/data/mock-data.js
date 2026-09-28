/**
 * Measure X — Statutory Metrology Standards & UI Constants
 * Contains official metrology classifications, accuracy standards, and fee schedules.
 * DOES NOT CONTAIN mock users, mock passwords, or mock authentication stores.
 * All user identity and operational records reside in MySQL 8+.
 */

const METROLOGY_CONSTANTS = {
  INSTRUMENT_TYPES: [
    "Electronic Platform Scale",
    "Digital Counter Scale",
    "Electronic Weighbridge",
    "Electronic Fuel Dispenser (Multi-Product)",
    "Non-Automated Weighing Instrument (NAWI)",
    "Automatic Gravimetric Filling Instrument",
    "Continuous Totalizing Automatic Weighing Instrument"
  ],
  ACCURACY_CLASSES: [
    "Class I (Special Accuracy)",
    "Class II (High Accuracy)",
    "Class III (Medium Accuracy)",
    "Class IIII (Ordinary Accuracy)",
    "Class 0.5 (Liquid Fuel Dispenser)"
  ],
  STATUTORY_SCHEDULES: [
    "Legal Metrology (General) Rules, 2011, Schedule VII",
    "OIML R 76-1 / Non-automatic weighing instruments",
    "OIML R 117 / Measuring systems for liquids other than water"
  ]
};

// Safe backward-compatible global export
window.METROLOGY_CONSTANTS = METROLOGY_CONSTANTS;
window.INITIAL_MOCK_DATA = {
  users: [],
  notifications: [],
  instruments: [],
  applications: [],
  certificates: []
};
