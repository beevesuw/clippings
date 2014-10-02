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
 * Portions created by the Initial Developer are Copyright (C) 2007-2014
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://clippings/modules/aeConstants.js");
Components.utils.import("resource://clippings/modules/aeUtils.js");
Components.utils.import("resource://clippings/modules/aeMozApplication.js");


const EXPORTED_SYMBOLS = ["aeClippingSubst"];

const Cc = Components.classes;
const Ci = Components.interfaces;

// FUEL (Firefox) or STEEL (Thunderbird) APIs
var Application = aeGetMozApplicationObj();


/*
 * Module aeClippingSubst
 * Performs substitution of variables embedded inside a clipping with either
 * predefined values or user-input text.
 */
var aeClippingSubst = {
  _strBundle: null,
  _userAgentStr: null,
  _autoIncrementVars: {}
};


aeClippingSubst.init = function (aStringBundle, aUserAgentStr)
{
  this._strBundle = aStringBundle;
  this._userAgentStr = aUserAgentStr;
};


/*
 * Factory method
 * Returns an object that holds various properties of a clipping to be passed
 * as an argument to aeClippingSubst.processClippingText()
 */
aeClippingSubst.getClippingInfo = function (aURI, aName, aText, aParentFolderName)
{
  var rv = {
    uri  : aURI,
    name : aName,
    text : aText,
    parentFolderName: aParentFolderName
  };

  return rv;
};


aeClippingSubst.processClippingText = function (aClippingInfo, aWnd)
{
  if ((/^\[NOSUBST\]/.test(aClippingInfo.name))) {
    return aClippingInfo.text;
  }

  var rv = "";
  var strBundle = this._strBundle;

  // Remember the value of the same placeholder that was filled in previously
  var knownTags = {};
  let that = aeClippingSubst;
  let tabModalPrompt = aeUtils.getPref("clippings.tab_modal_placeholder_prompt", true);

  // For use if tab-modal prompts are enabled.
  let prmptSvc = Cc["@mozilla.org/prompter;1"].getService(Ci.nsIPromptFactory).getPrompt(aWnd, Ci.nsIPrompt);

  var fnReplace = function (str, p1, offset, s) {
    if (p1 in knownTags) {
      return knownTags[p1];
    }

    var rv = "";
    
    if (tabModalPrompt && Application.id == aeConstants.HOSTAPP_FX_GUID) {
      that._initTabModalPromptDlg(prmptSvc);
      let prmptText = that._strBundle.getFormattedString("substPromptText", [p1]);
      let input = { value: "" };
      let returnedOK = prmptSvc.prompt(that._strBundle.getString("substPromptTitle"), prmptText, input, null, {});

      let userInput = input.value;
      if (!returnedOK || userInput == "") { 
        return "";
      }
      knownTags[p1] = userInput;
      rv = userInput;
    }
    else {
      var dlgArgs = {
        varName:       p1,
        userInput:     "",
        autoIncrementMode: false,
        userCancel:    null
      };
      dlgArgs.wrappedJSObject = dlgArgs;

      that._openDialog(aWnd, "chrome://clippings/content/placeholder.xul", "ae_placeholder_prmpt", "modal,centerscreen", dlgArgs);
      if (dlgArgs.userCancel || dlgArgs.userInput == "") {
        return "";
      }

      knownTags[p1] = dlgArgs.userInput;
      rv = dlgArgs.userInput;
    }

    return rv;
  };

  var fnAutoIncrement = function (str, p1) {
    if (p1 in that._autoIncrementVars) {
      return ++that._autoIncrementVars[p1];
    }

    var defaultValue = 0;
    var rv = "";
    
    if (tabModalPrompt && Application.id == aeConstants.HOSTAPP_FX_GUID) {
      that._initTabModalPromptDlg(prmptSvc);
      let prmptText = that._strBundle.getFormattedString("autoIncrPromptText", [p1]);
      let input = {};
      let userInput = "";

      do {
        input.value = defaultValue;
        var returnedOK = prmptSvc.prompt(that._strBundle.getString("substPromptTitle"), prmptText, input, null, {});
        userInput = input.value;
        if (!returnedOK || userInput == "") {
          return "";
        }
      } while (isNaN(userInput));

      that._autoIncrementVars[p1] = userInput;
      rv = userInput;
    }
    else {
      var dlgArgs = {
        varName:       p1,
        userInput:     "",
        defaultValue:  defaultValue,
        autoIncrementMode: true,
        userCancel:    null
      };
      dlgArgs.wrappedJSObject = dlgArgs;

      do {
        that._openDialog(aWnd, "chrome://clippings/content/placeholder.xul", "ae_placeholder_prmpt", "modal,centerscreen", dlgArgs);
        if (dlgArgs.userCancel || dlgArgs.userInput == "") {
          return "";
        }
      } while (isNaN(dlgArgs.userInput));

      that._autoIncrementVars[p1] = dlgArgs.userInput;
      rv = dlgArgs.userInput;
    }

    return rv;
  };

  var date = new Date();

  rv = aClippingInfo.text.replace(/\$\[DATE\]/gm, date.toLocaleDateString());
  rv = rv.replace(/\$\[TIME\]/gm, date.toLocaleTimeString());
  rv = rv.replace(/\$\[NAME\]/gm, aClippingInfo.name);
  rv = rv.replace(/\$\[_RDF_CLIPPING_URI\]/gm, aClippingInfo.uri);
  rv = rv.replace(/\$\[FOLDER\]/gm, aClippingInfo.parentFolderName);
  rv = rv.replace(/\$\[HOSTAPP\]/gm, Application.name + " " + Application.version);
  rv = rv.replace(/\$\[UA\]/gm, this._userAgentStr);

  // Match placeholder names containing alphanumeric characters, and the
  // following Unicode blocks: Latin-1 Supplement, Latin Extended-A, Latin
  // Extended-B, Cyrillic, Hebrew.
  rv = rv.replace(/\$\[([a-zA-Z0-9_\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0400-\u04FF\u0590-\u05FF]+)\]/gm, fnReplace);
  rv = rv.replace(/\#\[([a-zA-Z0-9_\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0400-\u04FF\u0590-\u05FF]+)\]/gm, fnAutoIncrement);

  return rv;
};


aeClippingSubst._initTabModalPromptDlg = function (aPromptService)
{
  let pptyBag = aPromptService.QueryInterface(Components.interfaces.nsIWritablePropertyBag2);
  pptyBag.setPropertyAsBool("allowTabModal", true);
};


aeClippingSubst._openDialog = function (aParentWnd, aDialogURL, aName, aFeatures, aParams)
{
  if (aeUtils.getOS() == "Darwin") {
    var dlgFeatures = aFeatures + ",dialog=yes,resizable=no";
    var ww = Cc["@mozilla.org/embedcomp/window-watcher;1"].getService(Ci.nsIWindowWatcher);
    ww.openWindow(null, aDialogURL, aName, dlgFeatures, aParams);
  }
  else {
    aParentWnd.openDialog(aDialogURL, aName, aFeatures, aParams);
  }
};


aeClippingSubst.getAutoIncrementVarNames = function ()
{
  var rv = [];
  for (var name in this._autoIncrementVars) {
    rv.push(name);
  }
  return rv;
};


aeClippingSubst.resetAutoIncrementVar = function (aVarName)
{
  delete this._autoIncrementVars[aVarName];
};
