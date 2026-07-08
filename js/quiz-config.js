(function () {
  'use strict';

  // ===================================================================
  //  QUIZ RESULTS → GOOGLE SHEET
  // ===================================================================
  // Paste your Google Apps Script web-app URL between the quotes below.
  // (See tools/quiz-sheet.gs.txt for the script to deploy + step-by-step
  //  instructions.) Until you set this, results are kept in the browser
  //  only and can be exported with RTL3D_QUIZ.exportCsv() in the console.
  //
  //  Example:
  //  window.RTL3D_QUIZ_ENDPOINT = 'https://script.google.com/macros/s/AKfy.../exec';

  window.RTL3D_QUIZ_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwJtW4JAQntrNA3qtao3FTVxrEw_4pPTtvxNU0pnMPbnwKt5FcrV-jAJYVfvMsr72Hzmw/exec';

  // Optional: paste your Google Sheet URL here for a direct link on the results page
  // before Apps Script doGet is redeployed.
  window.RTL3D_QUIZ_SHEET_URL = '';
})();
