/* -*- mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * Portions created by the Initial Developer are Copyright (C) 2005-2013
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

//
// This source file is shared by both new.xul and newFolder.xul
//

Components.utils.import("resource://clippings/modules/aeConstants.js");
Components.utils.import("resource://clippings/modules/aeString.js");
Components.utils.import("resource://clippings/modules/aeUtils.js");


var dialogArgs = window.arguments[0].wrappedJSObject;
var gFolderMenu, gStrBundle;
var gClippingsSvc;
var gSelectedFolderURI;
var gIsFolderMenuSeparatorInitialized = false;

// Used in new.xul only
var gClippingName, gClippingText, gCreateAsUnquoted, gRemoveExtraLineBreaks;
var gClippingKey;
var gIsFolderCreated;

// Used in newFolder.xul only
var gFolderName;


//
// DOM utility function
//

function $(aID)
{
  return document.getElementById(aID);
}


//
// Dialog box functions for both new.xul and newFolder.xul
//
    
function initDlg() 
{
  try {
    gClippingsSvc = Components.classes["clippings@mozdev.org/clippings;1"].getService(Components.interfaces.aeIClippingsService);
  }
  catch (e) {
    alert(e);
    window.close();
  }

  gStrBundle = $("ae-clippings-strings");

  // The datasource has already been initialized in the host app, so just get
  // the datasource object from the Clippings service.
  var ds = gClippingsSvc.getDataSource("");

  gFolderMenu = $("folder-menu-button");
  gFolderMenu.database.AddDataSource(ds);
  gFolderMenu.builder.rebuild();

  // newFolder.xul
  if (window.location.href == "chrome://clippings/content/newFolder.xul") {
    gFolderName = $("folder-name");
    gFolderName.value = gStrBundle.getString("newFolderName");
    gFolderName.clickSelectsAll = true;
    chooseFolder(dialogArgs.parentFolderURI);
  }
  // new.xul
  else {
    gClippingName = $("clipping-name");
    gClippingText = $("clipping-text");
    gClippingKey  = $("clipping-key");
    gCreateAsUnquoted = $("create-as-unquoted");
    gRemoveExtraLineBreaks = $("remove-extra-linebreaks");
    var app = gStrBundle.getString("pasteIntoBothHostApps");
    var hint = gStrBundle.getFormattedString("shortcutKeyHint", [app]);

    if (aeUtils.getOS() == "Darwin") {
      // On Mac OS X, OS_TARGET is "Darwin"
      // Shortcut key hint text is different due to Mac OS X-specific issue
      // with shortcut key prefix; see bug 18879
      hint = gStrBundle.getFormattedString("shortcutKeyHintMac", [app]);

      // Remove 0-9 as shortcut key choices; digits do not work on Mac OS X
      var clippingKeyPopup = $("clipping-key-popup");
      var digitMenuitems = [];
      for (let i = 0; i < clippingKeyPopup.childNodes.length; i++) {
	var child = clippingKeyPopup.childNodes[i];
	if (! isNaN(parseInt(child.label))) {
	  digitMenuitems.push(child);
	}
      }

      while (digitMenuitems.length > 0) {
	clippingKeyPopup.removeChild(digitMenuitems.pop());
      }
    }

    var hintTxtNode = document.createTextNode(hint);
    $("shortcut-key-hint").appendChild(hintTxtNode);

    // Creation checkbox options - Thunderbird only
    if (Application.id == aeConstants.HOSTAPP_TB_GUID) {
      $("tb-create-options-grid").style.display = "-moz-grid";
      // If there are no message quotation symbols in dialogArgs.text, then
      // disable the "Create as unquoted text" checkbox.
      if (dialogArgs.text.search(/^>/gm) == -1) {
	gCreateAsUnquoted.disabled = true;
      }
    }
    
    gClippingName.value = dialogArgs.name;
    gClippingText.value = dialogArgs.text;
    gClippingName.clickSelectsAll = true;
    gClippingText.clickSelectsAll = true;

    // Automatic spell checking
    var isSpellCheckingEnabled = aeUtils.getPref("clippings.check_spelling", true);

    if (isSpellCheckingEnabled) {
      gClippingName.setAttribute("spellcheck", "true");
      gClippingText.setAttribute("spellcheck", "true");
    }

    gIsFolderCreated = false;
    gSelectedFolderURI = gClippingsSvc.kRootFolderURI;
  }
}


function checkForChangedFolders()
{
  if (isFolderMissing(gSelectedFolderURI)) {
    aeUtils.log("Folder does not exist.  Defaulting to root folder.");
    gSelectedFolderURI = gClippingsSvc.kRootFolderURI;
    gFolderMenu.label = gStrBundle.getString("clippingsRoot");
    gFolderMenu.style.listStyleImage  = "url('chrome://clippings/skin/images/clippings-root.png')";
  }  
}


function isFolderMissing(aFolderURI)
{
  var rv = false;
  var exists;

  try {
    exists =  gClippingsSvc.exists(aFolderURI);
  }
  catch (e) {}

  if (! exists) {
    rv = true;
  }
  else {
    // Folders that exist, but have a detached parent folder, also qualify
    // as "missing."
    var parentURI;
    try {
      parentURI = gClippingsSvc.getParent(aFolderURI);
    }
    catch (e) {
      rv = true;
    }

    while (!rv && parentURI && parentURI != gClippingsSvc.kRootFolderURI) {
      if (gClippingsSvc.isDetached(parentURI)) {
	rv = true;
      }

      try {
	parentURI = gClippingsSvc.getParent(parentURI);
      }
      catch (e) {
	rv = true;
      }
    }
  }

  return rv;
}


function chooseFolder(aFolderURI)
{
  gSelectedFolderURI = aFolderURI;

  if (aFolderURI == gClippingsSvc.kRootFolderURI) {
    gFolderMenu.setAttribute("label", gStrBundle.getString("clippingsRoot"));
    gFolderMenu.style.listStyleImage = "url('chrome://clippings/skin/images/clippings-root.png')";
  }
  else {
    gFolderMenu.setAttribute("label", gClippingsSvc.getName(aFolderURI));
    gFolderMenu.style.listStyleImage = "url('chrome://clippings/skin/images/folder.png')";
  }
}


function initMenuSeparator(aMenuPopup)
{
  // Always rebuild folder menu separator
  var popup = $("folder-menu-popup");
  var oldSep = $("clippings-root-separator");
  if (oldSep) {
    popup.removeChild(oldSep);
  }

  if (gClippingsSvc.getCountSubfolders(gClippingsSvc.kRootFolderURI) > 0) {
    var clippingsRootMnuItem = $("clippings-root");
    var newSep = document.createElement("menuseparator");
    newSep.id = "clippings-root-separator";
    aMenuPopup.insertBefore(newSep, clippingsRootMnuItem.nextSibling);

    gIsFolderMenuSeparatorInitialized = true;
  }
}


// new.xul only
function createFolder()
{
  var dlgArgs = { 
    parentFolderURI: gSelectedFolderURI || gClippingsSvc.kRootFolderURI
  };

  // Temporarily disable widgets in New Clipping dialog while New Folder
  //  dialog is open.
  var okBtn = document.documentElement.getButton("accept");
  var cancelBtn = document.documentElement.getButton("cancel");
  var dlgElts = document.getElementsByTagName("*");
  var dlgEltsLen = dlgElts.length;

  for (let i = 0; i < dlgEltsLen; i++) {
    dlgElts[i].disabled = true;
  }
  okBtn.disabled = true;
  cancelBtn.disabled = true;

  dlgArgs.wrappedJSObject = dlgArgs;
  window.openDialog("chrome://clippings/content/newFolder.xul", "newfldr_dlg", "dialog,modal,centerscreen", dlgArgs);

  // After New Folder dialog is dismissed, re-enable New Clipping dlg widgets.
  for (let i = 0; i < dlgEltsLen; i++) {
    // Sometimes dlgElts[i] is undefined; not sure why, but check for it anyway
    if (dlgElts[i]) {
      dlgElts[i].disabled = false;
    }
  }
  okBtn.disabled = false;
  cancelBtn.disabled = false;

  if (dlgArgs.userCancel) {
    return;
  }

  // Remove the separator following the Clippings root folder item in
  // preparation for the folder menu rebuild.
  var popup = $("folder-menu-popup");
  var sep = $("clippings-root-separator");
  if (sep) {
    popup.removeChild(sep);
    gIsFolderMenuSeparatorInitialized = false;
  }

  gFolderMenu.builder.rebuild();
  chooseFolder(dlgArgs.newFolderURI);
  gIsFolderCreated = true;
}


// new.xul only
function updateShortcutKeyAvailability()
{
  var msgTxtNode = $("key-conflict-notification").firstChild;

  if (gClippingKey.selectedIndex == 0) {
    msgTxtNode.data = "";
    return;
  }

  var selectedKey = gClippingKey.selectedItem.label;
  var keyDict = gClippingsSvc.getShortcutKeyDict();

  if (keyDict.hasKey(selectedKey)) {
    msgTxtNode.data = gStrBundle.getString("errorShortcutKeyDefined");
  }
  else {
    msgTxtNode.data = gStrBundle.getString("shortcutKeyAvailable");
  }
}


function doOK() 
{
  if (! gSelectedFolderURI) {
    gSelectedFolderURI = gClippingsSvc.kRootFolderURI;
  }
  else {
    checkForChangedFolders();
  }

  // newFolder.xul
  if (window.location.href == "chrome://clippings/content/newFolder.xul") {
    var name = gFolderName.value;
    var uri = gClippingsSvc.createNewFolderEx(gSelectedFolderURI, null, name, null, false, gClippingsSvc.ORIGIN_NEW_CLIPPING_DLG);
    dialogArgs.newFolderURI = uri;
  }
  // new.xul
  else {
    var clipText = gClippingText.value;

    // Thunderbird only
    if (gCreateAsUnquoted.checked) {
      clipText = clipText.replace(/^>>* ?(>>* ?)*/gm, "");
    }

    if (gRemoveExtraLineBreaks.checked) {
      clipText = clipText.replace(/([^\n])( )?\n([^\n])/gm, "$1 $3");
    }

    dialogArgs.name = gClippingName.value;
    dialogArgs.text = clipText;
    dialogArgs.destFolder = gSelectedFolderURI;

    // Shortcut key
    if (gClippingKey.selectedIndex > 0) {
      var selectedKey = gClippingKey.selectedItem.label;

      // Check if the key is already assigned to another clipping
      var keyDict = gClippingsSvc.getShortcutKeyDict();

      if (keyDict.hasKey(selectedKey)) {
	aeUtils.alertEx(gStrBundle.getString("appName"),
	   	       gStrBundle.getString("errorShortcutKeyDetail"));
	$("dlg-tabs").selectedIndex = 1;
	$("dlg-tabpanels").selectedIndex = 1;
	gClippingKey.focus();
	return false;
      }

      dialogArgs.key = selectedKey;
    }
  }

  dialogArgs.userCancel = false;
  return true;
}


function doCancel() 
{
  if (window.location.href == "chrome://clippings/content/new.xul"
      && gIsFolderCreated) {
    dialogArgs.destFolder = gSelectedFolderURI;
  }

  dialogArgs.userCancel = true;
  return true;
}
