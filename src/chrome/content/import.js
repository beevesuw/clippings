/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Clippings.
 *
 * The Initial Developer of the Original Code is 
 * Alex Eng <ateng@users.sourceforge.net>.
 * Portions created by the Initial Developer are Copyright (C) 2017
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://clippings/modules/aeConstants.js");
Components.utils.import("resource://clippings/modules/aeUtils.js");
Components.utils.import("resource://gre/modules/osfile.jsm")

let gDlgArgs, gStrBundle, gClippingsSvc, gImportURL, gImportPath, gImportFile;


//
// DOM utility function
//

function $(aID) {
  return document.getElementById(aID);
}


//
// Dialog functions
//

function init() 
{
  try {
    gClippingsSvc = Components.classes["clippings@mozdev.org/clippings;1"].getService(Components.interfaces.aeIClippingsService);
  }
  catch (e) {
    alert(e);
  }

  gStrBundle = $("clippings-strings");
  gDlgArgs = window.arguments[0];

  $("replace-shortcut-keys").checked = gDlgArgs.replaceShortcutKeys;

  $("import-file-brws").focus();
}


function chooseImportFile()
{
  var fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(Components.interfaces.nsIFilePicker);
  fp.init(window, gStrBundle.getString("dlgTitleImportClippings"), fp.modeOpen);
  fp.appendFilter(gStrBundle.getString("multiImpFmtFilterDesc"), "*.rdf; *.json");
  fp.appendFilter(gStrBundle.getString("rdfImportFilterDesc"), "*.rdf");
  fp.appendFilter(gStrBundle.getString("wxJSONImportFilterDesc"), "*.json");

  var dlgResult = fp.show();
  if (dlgResult != fp.returnOK) {
    return;
  }

  gImportFile = fp.file.QueryInterface(Components.interfaces.nsIFile);
  gImportURL = fp.fileURL.QueryInterface(Components.interfaces.nsIURI).spec;  
  gImportPath = fp.file.QueryInterface(Components.interfaces.nsIFile).path;

  $("import-file-path").value = gImportPath;

  // Prevent attempt at importing data source file.
  var dsURL = aeUtils.getDataSourcePathURL() + aeConstants.CLIPDAT_FILE_NAME;
  if (gImportURL == dsURL) {
    aeUtils.alertEx(document.title, aeString.format("%s %S", gStrBundle.getString("errorCannotImportDSFile"), gImportURL));
    return;
  }
}


function importClippings()
{
  if (!gImportURL || !$("import-file-path").value) {
    aeUtils.beep();
    $("import-file-brws").focus();
    return false;
  }
  
  let progressMeter = $("import-progress");
  progressMeter.style.visibility = "visible";

  function resetProgress() {
    progressMeter.style.visibility = "hidden";
    progressMeter.value = 0;
  }
  
  gDlgArgs.numImported = 0;

  let importDSRootCtr = {};
  let replaceShortcutKeys = $("replace-shortcut-keys").checked;

  progressMeter.value = 5;

  // Import Clippings/wx JSON file.
  if (gImportPath.endsWith(".json")) {
    let readFile = OS.File.read(gImportPath, { encoding: "utf-8" });

    readFile.then(aFileData => {
      importJSONFile(aFileData, replaceShortcutKeys);
    }).catch(aFileError => {
      aeUtils.log("Failed to import file: " + aFileError);
      aeUtils.alertEx(document.title, gStrBundle.getFormattedString("alertImportFailed", [gImportPath]));
      resetProgress();
    });

    aeUtils.log("Reading JSON import file asynchronously...");
    return false;
  }
  else {
    // Import Clippings RDF/XML file.
    try {
      gDlgArgs.numImported = gClippingsSvc.importFromFile(gImportURL, false, false, importDSRootCtr);
    }
    catch (e if e.result == Components.results.NS_ERROR_NOT_INITIALIZED) {
      aeUtils.alertEx(document.title, gStrBundle.getString('alertImportFailedNoDS'));
      resetProgress();
      return false;
    }
    catch (e if e.result == Components.results.NS_ERROR_FILE_ACCESS_DENIED) {
      aeUtils.alertEx(document.title, aeString.format("%s: %S", gStrBundle.getString("errorAccessDenied"), gImportPath));
      resetProgress();
      return false;
    }
    catch (e) {
      aeUtils.alertEx(document.title, gStrBundle.getFormattedString("alertImportFailed", [gImportPath]));
      resetProgress();
      return false;
    }

    importDSRootCtr = importDSRootCtr.value;

    progressMeter.value = 75;
    
    let importFlag;
    
    if (replaceShortcutKeys) {
      importFlag = gClippingsSvc.IMPORT_REPLACE_CURRENT;
    }
    else {
      importFlag = gClippingsSvc.IMPORT_KEEP_CURRENT;
    }

    try {
      gClippingsSvc.importShortcutKeys(importDSRootCtr, importFlag);
    }
    catch (e) {}

    progressMeter.value = 95;

    // Append the "empty" clipping to any empty folders that were imported
    gClippingsSvc.processEmptyFolders();

    progressMeter.value = 100;
    
    gDlgArgs.userCancel = false;
    return true;
  }

  aeUtils.log("At end of function doImport() - we should never get here!");
}


function importJSONFile(aJSONFileData, aReplaceShortcutKeys)
{
  let progressMeter = $("import-progress");

  function resetProgress() {
    progressMeter.style.visibility = "hidden";
    progressMeter.value = 0;
  }

  try {
    gDlgArgs.numImported = gClippingsSvc.importFromJSON(aJSONFileData, aReplaceShortcutKeys);
  }
  catch (e) {
    aeUtils.alertEx(document.title, gStrBundle.getFormattedString("alertImportFailed", [gImportPath]));
    resetProgress();
    return;
  }
  
  progressMeter.value = 95;

  // Append the "empty" clipping to any empty folders that were imported
  gClippingsSvc.processEmptyFolders();

  progressMeter.value = 100;
      
  aeUtils.log("Completing function importJSONFile() - forcing window close.");
  gDlgArgs.userCancel = false;
  window.close();
}


function cancel()
{
  gDlgArgs.userCancel = true;
  return true;
}
